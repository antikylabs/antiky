import {
  createCamera,
  createCube,
  createProgram,
  createRenderer,
  createSphere,
  createTexture,
  createTorus,
  loadGlb,
  type BroMetalTexture,
  type Geometry,
  type Renderer,
} from 'brometal';

import { TRAVERSAL_ASSETS, type TraversalAssetId } from './asset-catalog.ts';
import {
  COURSE_CHECKPOINTS,
  COURSE_COLLECTIBLES,
  COURSE_HAZARDS,
  COURSE_PLATFORMS,
  platformTop,
} from './course.ts';
import { createTraversalCameraRig } from './presentation.ts';
import { summarizeTraversalMeasurements } from './measurements.ts';
import traversalGlowShader from './shaders/traversal-glow.shader.gen';
import traversalModelShader from './shaders/traversal-model.shader.gen';
import traversalSurfaceShader from './shaders/traversal-surface.shader.gen';
import { RUNNER_RADIUS, type TraversalSnapshot } from './simulation.ts';

type Vec3 = readonly [number, number, number];
type PointerState = Readonly<{ x: number; y: number }>;

const SEA_GREY: Vec3 = [0.46, 0.58, 0.6];
const ULTRAMARINE: Vec3 = [0.08, 0.22, 0.5];
const OCHRE: Vec3 = [0.76, 0.48, 0.13];
const CLAY: Vec3 = [0.58, 0.28, 0.2];
const VERMILION: Vec3 = [0.86, 0.16, 0.08];
const CREAM: Vec3 = [0.88, 0.76, 0.55];
const GRASS: Vec3 = [0.2, 0.42, 0.25];
const INK: Vec3 = [0.055, 0.075, 0.085];
const PLATFORM_COLORS = [GRASS, CLAY, OCHRE] as const;

type Instance = Readonly<{
  offset: Vec3;
  scale: Vec3;
  params: Vec3;
}>;

function createSurfaceBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, traversalSurfaceShader);
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const materials = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: 1,
    uploadBytes: offsets.byteLength + scales.byteLength + colors.byteLength + materials.byteLength,
    clear(): void { scales.fill(0); materials.fill(0); },
    set(index: number, offset: Vec3, scale: Vec3, color: Vec3, material: Vec3): void {
      offsets.set(offset, index * 3);
      scales.set(scale, index * 3);
      colors.set(color, index * 3);
      materials.set(material, index * 3);
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      program.instanceAttributes.iMaterial.set(materials);
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj.set(viewProjection);
      program.uniforms.uCameraPosition.set(cameraPosition);
      program.uniforms.uTime.set(time);
    },
    draw(): void { program.draw(); },
    dispose(): void { program.dispose(); },
  });
}

function createGlowBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, traversalGlowShader, { blend: 'alpha' });
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const alphas = new Float32Array(capacity);
  const rotations = new Float32Array(capacity);
  const phases = new Float32Array(capacity);
  return Object.freeze({
    capacity,
    drawCalls: 1,
    uploadBytes: offsets.byteLength + scales.byteLength + colors.byteLength
      + alphas.byteLength + rotations.byteLength + phases.byteLength,
    clear(): void { scales.fill(0); alphas.fill(0); },
    set(index: number, offset: Vec3, scale: Vec3, color: Vec3, alpha: number, rotation: number, phase: number): void {
      offsets.set(offset, index * 3);
      scales.set(scale, index * 3);
      colors.set(color, index * 3);
      alphas[index] = alpha;
      rotations[index] = rotation;
      phases[index] = phase;
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      program.instanceAttributes.iAlpha.set(alphas);
      program.instanceAttributes.iRotation.set(rotations);
      program.instanceAttributes.iPhase.set(phases);
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj.set(viewProjection);
      program.uniforms.uCameraPosition.set(cameraPosition);
      program.uniforms.uTime.set(time);
    },
    draw(): void { program.draw(); },
    dispose(): void { program.dispose(); },
  });
}

async function createCatalogBatch(
  renderer: Renderer,
  assetId: TraversalAssetId,
  capacity: number,
  tint: Vec3 = [1, 1, 1],
) {
  const asset = TRAVERSAL_ASSETS.find((entry) => entry.id === assetId)!;
  const model = await loadGlb(asset.url);
  if (model.images.length === 0) throw new Error(`${asset.fileName} has no embedded catalog image.`);
  const textures: BroMetalTexture[] = [];
  for (const image of model.images) {
    const ownedImageBuffer = new ArrayBuffer(image.data.byteLength);
    new Uint8Array(ownedImageBuffer).set(image.data);
    const bitmap = await createImageBitmap(new Blob([ownedImageBuffer], { type: image.mimeType }));
    textures.push(createTexture(renderer, bitmap, { flipY: false, anisotropy: 4 }));
    bitmap.close();
  }
  const programs = model.meshes.map((mesh) => {
    if (mesh.indices === null || mesh.imageIndex === null) {
      throw new Error(`${asset.fileName} needs indexed, embedded-image geometry.`);
    }
    const program = createProgram(renderer, traversalModelShader);
    program.attributes.aPosition.set(mesh.positions);
    program.attributes.aNormal.set(mesh.normals ?? new Float32Array(mesh.positions.length));
    program.attributes.aUv.set(mesh.uvs ?? new Float32Array(mesh.positions.length / 3 * 2));
    program.setIndices(mesh.indices);
    program.uniforms.uTex.set(textures[mesh.imageIndex]!);
    program.uniforms.uTint.set(tint);
    return program;
  });
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: programs.length,
    uploadBytes: (offsets.byteLength + scales.byteLength + params.byteLength) * programs.length,
    clear(): void { scales.fill(0); params.fill(0); },
    set(index: number, instance: Instance): void {
      offsets.set(instance.offset, index * 3);
      scales.set(instance.scale, index * 3);
      params.set(instance.params, index * 3);
    },
    upload(): void {
      programs.forEach((program) => {
        program.instanceAttributes.iOffset.set(offsets);
        program.instanceAttributes.iScale.set(scales);
        program.instanceAttributes.iParams.set(params);
      });
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      programs.forEach((program) => {
        program.uniforms.uViewProj.set(viewProjection);
        program.uniforms.uCameraPosition.set(cameraPosition);
        program.uniforms.uTime.set(time);
      });
    },
    draw(): void { programs.forEach((program) => program.draw()); },
    dispose(): void {
      programs.forEach((program) => program.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  });
}

function stableNoise(index: number, salt: number): number {
  const value = Math.sin(index * 63.17 + salt * 17.53) * 43147.19;
  return value - Math.floor(value);
}

function courseTopAt(x: number, time: number): number {
  const platform = COURSE_PLATFORMS.find((entry) => Math.abs(x - entry.x) <= entry.width * 0.5);
  return platform === undefined ? 0 : platformTop(platform, time);
}

export type TraversalRenderer = Readonly<{
  measurements: Readonly<{ instances: number; drawCalls: number; uploadBytesPerFrame: number; note: string }>;
  render(state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void;
  dispose(): void;
}>;

export async function createTraversalRenderer(canvas: HTMLCanvasElement): Promise<TraversalRenderer> {
  const renderer = await createRenderer(canvas, { clearColor: [0.56, 0.67, 0.69, 1], cull: 'none' });
  try {
    const catalogEntries = await Promise.all([
      createCatalogBatch(renderer, 'grass', COURSE_PLATFORMS.length),
      createCatalogBatch(renderer, 'overhang', COURSE_PLATFORMS.length),
      createCatalogBatch(renderer, 'moving', COURSE_PLATFORMS.length),
      createCatalogBatch(renderer, 'flag', 6),
      createCatalogBatch(renderer, 'coin', 2),
      createCatalogBatch(renderer, 'spikes', COURSE_HAZARDS.length, [0.95, 0.72, 0.64]),
      createCatalogBatch(renderer, 'tree', 10),
    ]);
    const [grass, overhang, moving, flags, coins, spikes, trees] = catalogEntries;
    const scenery = createSurfaceBatch(renderer, createCube(), 64);
    const runner = createSurfaceBatch(renderer, createSphere({ radius: 1, widthSegments: 20, heightSegments: 14 }), 9);
    const contactShadow = createSurfaceBatch(renderer, createSphere({ radius: 1, widthSegments: 18, heightSegments: 10 }), 1);
    const hud = createSurfaceBatch(renderer, createCube(), 16);
    const wind = createGlowBatch(renderer, createCube(), 30);
    const trail = createGlowBatch(renderer, createSphere({ radius: 1, widthSegments: 8, heightSegments: 6 }), 72);
    const effects = createGlowBatch(renderer, createTorus({ radius: 1, tube: 0.055, radialSegments: 8, tubularSegments: 48 }), 8);
    const procedural = [scenery, runner, contactShadow, hud, wind, trail, effects];
    const cameraRig = createTraversalCameraRig();
    const camera = createCamera({ position: [0, 5, 12], fovY: Math.PI / 3.6, near: 0.1, far: 240 });
    const cameraPosition = new Float32Array(3);

    const measurements = summarizeTraversalMeasurements([...catalogEntries, ...procedural]);

    const render = (state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void => {
      grass.clear(); overhang.clear(); moving.clear();
      let grassIndex = 0;
      let overhangIndex = 0;
      let movingIndex = 0;
      COURSE_PLATFORMS.forEach((platform, index) => {
        const top = platformTop(platform, state.time);
        const common = { params: [0, 0, index] as Vec3 };
        if (platform.asset === 'moving') {
          moving.set(movingIndex, { ...common, offset: [platform.x, top - 0.54, 0], scale: [platform.width, 1.8, 2.7] });
          movingIndex += 1;
        } else if (platform.asset === 'overhang') {
          overhang.set(overhangIndex, { ...common, offset: [platform.x, top - 0.7, 0], scale: [platform.width / 2.08, 0.72, 2.55] });
          overhangIndex += 1;
        } else {
          grass.set(grassIndex, { ...common, offset: [platform.x, top - 0.7, 0], scale: [platform.width / 2.08, 0.72, 1.42] });
          grassIndex += 1;
        }
      });
      grass.upload(); overhang.upload(); moving.upload();

      flags.clear();
      COURSE_CHECKPOINTS.forEach((checkpoint, index) => {
        flags.set(index, {
          offset: [checkpoint.x, courseTopAt(checkpoint.x, state.time) + 0.03, -1.32],
          scale: [1.5, 1.85, 1.5],
          params: [0, 0.08 + state.effects.checkpoint * 0.04, index * 1.7],
        });
      });
      flags.set(3, { offset: [164.2, 2.84, -1.5], scale: [2.2, 3.2, 2.2], params: [0, 0.11, 4.2] });
      flags.upload();

      coins.clear();
      if (!state.collectedSeal) {
        const collectible = COURSE_COLLECTIBLES[0]!;
        coins.set(0, {
          offset: [collectible.x, collectible.y + Math.sin(state.time * 3) * 0.12, 0.05],
          scale: [1.65, 1.65, 1.65],
          params: [state.time * 2.6, 0, 0],
        });
      }
      if (state.outcome === 'delivered') {
        coins.set(1, { offset: [166, 4.5, 0], scale: [2.6, 2.6, 2.6], params: [state.time * 1.8, 0, 1] });
      }
      coins.upload();

      spikes.clear();
      COURSE_HAZARDS.forEach((hazard, index) => spikes.set(index, {
        offset: [hazard.x, hazard.top + 0.02, 0],
        scale: [1.35, 1.35, 1.65],
        params: [0, 0, index],
      }));
      spikes.upload();

      trees.clear();
      [5, 39, 57, 76, 104, 116, 132, 160].forEach((x, index) => trees.set(index, {
        offset: [x, courseTopAt(x, state.time) - 0.02, index % 2 === 0 ? -1.75 : -2.05],
        scale: [1.5 + index % 3 * 0.16, 1.5 + index % 3 * 0.16, 1.5],
        params: [index % 2 === 0 ? 0.15 : -0.25, 0.018, index * 0.8],
      }));
      trees.upload();

      scenery.clear();
      scenery.set(0, [85, -3.25, -8], [190, 0.5, 20], SEA_GREY, [0, 0, 0]);
      scenery.set(1, [85, -3.55, 4], [190, 0.45, 8], [0.36, 0.48, 0.49], [0, 0, 0]);
      for (let index = 0; index < 18; index += 1) {
        const x = index * 10 - 2;
        const height = 0.8 + stableNoise(index, 2) * 2.2;
        scenery.set(2 + index, [x, -2.55 + height * 0.5, -13 - index % 3 * 2.2], [7.5, height, 3.5], index % 2 === 0 ? CLAY : OCHRE, [0, 0, 0]);
      }
      for (let index = 0; index < 9; index += 1) {
        const height = 1.2 + index * 0.48;
        scenery.set(20 + index, [158 + index * 1.15, -1.7 + height * 0.5, -4.8], [0.9, height, 1.1], index % 2 === 0 ? CREAM : CLAY, [0, 0, 0]);
      }
      for (let index = 0; index < 12; index += 1) {
        const x = Math.floor(state.player.x / 18) * 18 + (index - 6) * 5.2;
        scenery.set(29 + index, [x, 6 + index % 3 * 0.8, -15 - index % 2 * 2], [2.4 + index % 3, 0.42, 1.1], CREAM, [0, 0, 0]);
      }
      scenery.upload();

      const gait = Math.sin(state.time * (7 + Math.abs(state.player.vx)));
      runner.clear();
      runner.set(0, [state.player.x, state.player.y + 0.08, 0.04], [0.45 + state.player.squash * 0.1, 0.58 - state.player.squash * 0.12, 0.34], ULTRAMARINE, [0, 0.08, 0]);
      runner.set(1, [state.player.x + state.player.facing * 0.27, state.player.y + 0.43, 0.03], [0.33, 0.33, 0.3], CREAM, [0, 0.06, 0]);
      runner.set(2, [state.player.x + state.player.facing * 0.43, state.player.y + 0.46, 0.29], [0.07, 0.07, 0.05], INK, [0, 0, 0]);
      runner.set(3, [state.player.x - 0.18, state.player.y - 0.34 + gait * 0.07, 0.03], [0.17, 0.12, 0.23], OCHRE, [0, 0, gait * 0.25]);
      runner.set(4, [state.player.x + 0.18, state.player.y - 0.34 - gait * 0.07, 0.03], [0.17, 0.12, 0.23], OCHRE, [0, 0, -gait * 0.25]);
      runner.set(5, [state.player.x - state.player.facing * 0.38, state.player.y + 0.1, -0.02], [0.34, 0.25, 0.26], VERMILION, [0, 0.08, -state.player.facing * 0.1]);
      runner.set(6, [state.player.x - state.player.facing * 0.38, state.player.y + 0.1, 0.26], [0.37, 0.035, 0.29], CREAM, [0, 0, -state.player.facing * 0.1]);
      runner.upload();

      const supportTop = courseTopAt(state.player.x, state.time);
      const shadowDistance = Math.max(0, state.player.y - RUNNER_RADIUS - supportTop);
      contactShadow.clear();
      contactShadow.set(0, [state.player.x, supportTop + 0.025, -0.02], [0.75 - Math.min(0.42, shadowDistance * 0.18), 0.035, 0.42], INK, [0, 0, 0]);
      contactShadow.upload();

      trail.clear();
      state.trail.forEach((particle, index) => {
        const life = Math.max(0, particle.life);
        const color = particle.color === 0 ? SEA_GREY : particle.color === 1 ? OCHRE : VERMILION;
        const scale = (0.025 + life * 0.11) * Math.min(1, life * 4);
        trail.set(index, [particle.x, particle.y, 0.1], [scale, scale, scale], color, Math.min(0.7, life * 2.4), 0, index * 0.31);
      });
      trail.upload();

      wind.clear();
      const windAnchor = Math.floor(state.player.x / 20) * 20;
      for (let index = 0; index < 30; index += 1) {
        const depth = index % 3;
        const wrap = ((state.time * (1.7 + depth * 0.4) + stableNoise(index, 5) * 24) % 24) - 12;
        wind.set(index, [windAnchor + wrap, -0.4 + stableNoise(index, 9) * 7, -2 - depth * 2.6], [0.28 + depth * 0.12, 0.012, 0.025], depth === 0 ? CREAM : SEA_GREY, 0.07, -0.05, index);
      }
      wind.upload();

      effects.clear();
      COURSE_CHECKPOINTS.forEach((checkpoint, index) => effects.set(index, [checkpoint.x, courseTopAt(checkpoint.x, state.time) + 1.05, 0.1], [0.82 + state.effects.checkpoint * 0.3, 0.82 + state.effects.checkpoint * 0.3, 1], index <= state.checkpointIndex ? OCHRE : SEA_GREY, 0.18 + state.effects.checkpoint * 0.22, state.time * 0.16, index));
      effects.set(3, [166, 4.15, 0.1], [1.45 + state.effects.delivery * 0.45, 1.45 + state.effects.delivery * 0.45, 1], state.outcome === 'failed' ? VERMILION : OCHRE, state.outcome === 'delivered' ? 0.68 : 0.2, state.time * 0.12, 4);
      effects.upload();

      const cameraFrame = cameraRig.update(renderer.aspect, state, pointer, deltaSeconds);
      cameraPosition.set(cameraFrame.position);
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(...cameraFrame.target);
      const viewProjection = camera.viewProjection(renderer.aspect);

      hud.clear();
      const hudX = cameraFrame.target[0] - (renderer.aspect < 0.9 ? 2.2 : 4.4);
      const hudY = cameraFrame.target[1] + (renderer.aspect < 0.9 ? 4 : 3.15);
      hud.set(0, [hudX, hudY, 1.7], [3.7, 0.2, 0.08], INK, [0, 0, 0]);
      hud.set(1, [hudX - 1.85 + state.progress * 1.85, hudY, 1.75], [3.7 * state.progress, 0.11, 0.1], ULTRAMARINE, [0, 0.1, 0]);
      const stormWidth = 3.7 * (1 - state.storm);
      hud.set(2, [hudX, hudY - 0.38, 1.7], [3.7, 0.18, 0.08], INK, [0, 0, 0]);
      hud.set(3, [hudX - 1.85 + stormWidth * 0.5, hudY - 0.38, 1.75], [stormWidth, 0.09, 0.1], state.remainingTime < 15 ? VERMILION : OCHRE, [0, 0.06, 0]);
      for (let index = 0; index < 3; index += 1) {
        hud.set(4 + index, [hudX + 2.25 + index * 0.42, hudY - 0.18, 1.72], [0.28, 0.28, 0.12], index < state.parcelSeals ? VERMILION : INK, [0, 0.08, Math.PI * 0.25]);
      }
      hud.set(7, [hudX + 3.65, hudY - 0.18, 1.72], [0.22, 0.48, 0.12], state.controlMode === 'attract' ? OCHRE : state.controlMode === 'manual' ? ULTRAMARINE : SEA_GREY, [0, 0.08, 0]);
      if (state.outcome !== 'running') {
        const outcomeColor = state.outcome === 'delivered' ? OCHRE : VERMILION;
        hud.set(8, [cameraFrame.target[0], cameraFrame.target[1] + 1.75, 1.4], [5.1, 0.22, 0.12], outcomeColor, [0, 0.12, 0]);
        hud.set(9, [cameraFrame.target[0], cameraFrame.target[1] + 1.75, 1.42], [0.22, 1.1, 0.14], outcomeColor, [0, 0.12, state.outcome === 'delivered' ? 0 : Math.PI * 0.25]);
      }
      hud.upload();

      procedural.forEach((batch) => batch.setFrame(viewProjection, cameraPosition, state.time));
      catalogEntries.forEach((batch) => batch.setFrame(viewProjection, cameraPosition, state.time));
      renderer.present(() => {
        scenery.draw();
        wind.draw();
        grass.draw(); overhang.draw(); moving.draw();
        contactShadow.draw();
        spikes.draw(); trees.draw(); flags.draw(); coins.draw();
        effects.draw(); runner.draw(); trail.draw(); hud.draw();
      });
    };

    return Object.freeze({
      measurements,
      render,
      dispose(): void {
        catalogEntries.forEach((batch) => batch.dispose());
        procedural.forEach((batch) => batch.dispose());
        renderer.destroy();
      },
    });
  } catch (cause: unknown) {
    renderer.destroy();
    throw cause;
  }
}
