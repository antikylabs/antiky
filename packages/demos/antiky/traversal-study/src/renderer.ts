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
  type BroMetalProgram,
  type Geometry,
  type Renderer,
} from 'brometal';

import { TRAVERSAL_ASSETS, type TraversalAssetId } from './asset-catalog.ts';
import {
  COURSE_CHECKPOINTS,
  COURSE_COLLECTIBLES,
  COURSE_HAZARDS,
  COURSE_PLATFORMS,
  DELIVERY_X,
  hazardTop,
  platformTop,
} from './course.ts';
import {
  backgroundCompositionAt,
} from './environment.ts';
import { createTraversalCameraRig } from './presentation.ts';
import { TRAVERSAL_BATCH_CAPACITIES } from './render-plan.ts';
import {
  acquireTransactional,
  createDisposalStack,
  createRendererResourceLifetime,
  type DisposalStack,
} from './resource-scope.ts';
import { summarizeTraversalMeasurements } from './measurements.ts';
import { COURSE_SKY } from './ambient.ts';
import { createKitMaterialLookup } from './kit-materials.ts';
import { createLightingRamp } from './lighting-ramp.ts';
import { loadVfxBillboard } from './vfx-billboard.ts';
import { loadDetailNormal } from './detail-normal.ts';
import traversalGlowShader from './shaders/traversal-glow.shader.gen';
import traversalModelShader from './shaders/traversal-model.shader.gen';
import traversalSurfaceShader from './shaders/traversal-surface.shader.gen';
import { RUNNER_RADIUS, type TraversalSnapshot } from './simulation.ts';
import {
  HAZARD_SPIKE_SCALE,
  HAZARD_TELEGRAPH_DEPTH,
  HAZARD_TELEGRAPH_HALF_DEPTH,
  HAZARD_TELEGRAPH_HALF_HEIGHT,
  HUD_BAR_GAP,
  HUD_BAR_HALF_HEIGHT,
  HUD_BAR_HALF_WIDTH,
  HUD_DEPTH,
  HUD_LABEL_CELLS,
  HUD_LABEL_CELL_HALF_HEIGHT,
  HUD_LABEL_CELL_HALF_WIDTH,
  HUD_LABEL_CENTER_X_OFFSET,
  HUD_METER_CENTER_X_OFFSET,
  HUD_METER_HALF_WIDTH,
  hazardTelegraphHalfWidth,
  hudAnchorX,
  hudAnchorY,
} from './visual-layout.ts';

type Vec3 = readonly [number, number, number];
type PointerState = Readonly<{ x: number; y: number }>;
type CatalogProgram = BroMetalProgram<
  { aPosition: 'vec3'; aNormal: 'vec3'; aUv: 'vec2' },
  { iOffset: 'vec3'; iScale: 'vec3'; iParams: 'vec3' },
  {
    uViewProj: 'mat4';
    uCameraPosition: 'vec3';
    uTime: 'float';
    uGradeColor: 'vec3';
    uGradeMix: 'float';
    uTex: 'sampler2D';
  }
>;

const SEA_GREY: Vec3 = [0.46, 0.58, 0.6];
const ULTRAMARINE: Vec3 = [0.08, 0.22, 0.5];
const OCHRE: Vec3 = [0.76, 0.48, 0.13];
const CLAY: Vec3 = [0.58, 0.28, 0.2];
const VERMILION: Vec3 = [0.86, 0.16, 0.08];
const CREAM: Vec3 = [0.88, 0.76, 0.55];
const GRASS: Vec3 = [0.2, 0.42, 0.25];
const INK: Vec3 = [0.055, 0.075, 0.085];

function writeVec3(target: Float32Array, index: number, x: number, y: number, z: number): void {
  const offset = index * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

function rollbackAndRethrow(disposal: DisposalStack, cause: unknown): never {
  try {
    disposal.dispose();
  } catch (rollbackCause: unknown) {
    throw new AggregateError(
      [cause, rollbackCause],
      'Renderer construction and rollback both failed.',
      { cause },
    );
  }
  throw cause;
}

function createSurfaceBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const disposal = createDisposalStack();
  const program = disposal.adopt(createProgram(renderer, traversalSurfaceShader));
  try {
    program.attributes.aPosition.set(geometry.positions);
    program.attributes.aNormal.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const materials = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: 1,
    uploadBytes: offsets.byteLength + scales.byteLength + colors.byteLength + materials.byteLength,
    clear(): void { scales.fill(0); materials.fill(0); },
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: Vec3, m0: number, m1: number, m2: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(colors, index, color[0], color[1], color[2]);
      writeVec3(materials, index, m0, m1, m2);
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
    dispose(): void { disposal.dispose(); },
  });
}

function createGlowBatch(
  renderer: Renderer,
  geometry: Geometry,
  capacity: number,
  billboard: BroMetalTexture,
) {
  const disposal = createDisposalStack();
  const program = disposal.adopt(createProgram(renderer, traversalGlowShader, { blend: 'alpha' }));
  program.uniforms.uBillboard.set(billboard);
  try {
    program.attributes.aPosition.set(geometry.positions);
    program.attributes.aNormal.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
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
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: Vec3, alpha: number, rotation: number, phase: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(colors, index, color[0], color[1], color[2]);
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
    dispose(): void { disposal.dispose(); },
  });
}

/**
 * Filtering, decided by what the texture actually is rather than per call site.
 *
 * Two classes ship in this demo and they want opposite treatment:
 *
 * **Palette strips** — a row of solid swatches, one per source material. Quaternius' Ultimate
 * Platformer pack is flat-shaded low-poly with no source texture at all, so its colour is baked into
 * a strip this narrow: `cloud-large` is a single pixel because the model is a single colour. Linear
 * filtering and anisotropy average adjacent swatches at every seam, which turns a two-colour model
 * into a muddy gradient, and mips collapse the strip towards its own average. Nearest, no mips.
 *
 * **Real textures** — Kenney's platformer kit ships an authored 512x512 colormap with a genuine
 * unwrap. Those want trilinear and anisotropy, or every surface seen at a grazing angle is
 * simultaneously over-blurred across and aliased along.
 *
 * A palette is recognised by shape, not by filename: one texel tall and no wider than the number of
 * materials any of these kits produce. The widest today is `relay-tower` at 7.
 */
const PALETTE_MAX_WIDTH = 16;

function textureFiltering(width: number, height: number): { filter: 'smooth' | 'nearest'; anisotropy?: number } {
  const palette = height === 1 && width <= PALETTE_MAX_WIDTH;
  return palette ? { filter: 'nearest' } : { filter: 'smooth', anisotropy: 8 };
}

async function createCatalogBatch(
  renderer: Renderer,
  assetId: TraversalAssetId,
  capacity: number,
  detailNormal: BroMetalTexture,
  ramp: BroMetalTexture,
  kitMaterials: BroMetalTexture,
  gradeColor: Vec3 = [1, 1, 1],
  gradeMix = 0,
  /** How far light wraps past the terminator. Clouds are volumes; everything else here is solid. */
  wrap = 0,
) {
  const asset = TRAVERSAL_ASSETS.find((entry) => entry.id === assetId)!;
  const model = await loadGlb(asset.url);
  if (model.images.length === 0) throw new Error(`${asset.fileName} has no embedded catalog image.`);
  const disposal = createDisposalStack();
  const textures: BroMetalTexture[] = [];
  const programs: CatalogProgram[] = [];
  try {
    for (const image of model.images) {
      const ownedImageBuffer = new ArrayBuffer(image.data.byteLength);
      new Uint8Array(ownedImageBuffer).set(image.data);
      const bitmap = await createImageBitmap(new Blob([ownedImageBuffer], { type: image.mimeType }));
      try {
        textures.push(disposal.adopt(createTexture(renderer, bitmap, {
          flipY: false,
          ...textureFiltering(bitmap.width, bitmap.height),
        })));
      } finally {
        bitmap.close();
      }
    }
    for (const mesh of model.meshes) {
      if (mesh.indices === null || mesh.imageIndex === null) {
        throw new Error(`${asset.fileName} needs indexed, embedded-image geometry.`);
      }
      const program = disposal.adopt(createProgram(renderer, traversalModelShader));
      programs.push(program);
      program.attributes.aPosition.set(mesh.positions);
      program.attributes.aNormal.set(mesh.normals ?? new Float32Array(mesh.positions.length));
      program.attributes.aUv.set(mesh.uvs ?? new Float32Array(mesh.positions.length / 3 * 2));
      program.setIndices(mesh.indices);
      program.uniforms.uTex.set(textures[mesh.imageIndex]!);
      program.uniforms.uDetailNormal.set(detailNormal);
      program.uniforms.uRamp.set(ramp);
      program.uniforms.uKitMaterials.set(kitMaterials);
      program.uniforms.uSh0.set(COURSE_SKY[0]!);
      program.uniforms.uSh1.set(COURSE_SKY[1]!);
      program.uniforms.uSh2.set(COURSE_SKY[2]!);
      program.uniforms.uSh3.set(COURSE_SKY[3]!);
      program.uniforms.uSh4.set(COURSE_SKY[4]!);
      program.uniforms.uSh5.set(COURSE_SKY[5]!);
      program.uniforms.uSh6.set(COURSE_SKY[6]!);
      program.uniforms.uSh7.set(COURSE_SKY[7]!);
      program.uniforms.uSh8.set(COURSE_SKY[8]!);
      program.uniforms.uGradeColor.set(gradeColor);
      program.uniforms.uGradeMix.set(gradeMix);
      program.uniforms.uWrap.set(wrap);
    }
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: programs.length,
    uploadBytes: (offsets.byteLength + scales.byteLength + params.byteLength) * programs.length,
    clear(): void { scales.fill(0); params.fill(0); },
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, p0: number, p1: number, p2: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(params, index, p0, p1, p2);
    },
    upload(): void {
      for (let index = 0; index < programs.length; index += 1) {
        const program = programs[index]!;
        program.instanceAttributes.iOffset.set(offsets);
        program.instanceAttributes.iScale.set(scales);
        program.instanceAttributes.iParams.set(params);
      }
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      for (let index = 0; index < programs.length; index += 1) {
        const program = programs[index]!;
        program.uniforms.uViewProj.set(viewProjection);
        program.uniforms.uCameraPosition.set(cameraPosition);
        program.uniforms.uTime.set(time);
      }
    },
    draw(): void {
      for (let index = 0; index < programs.length; index += 1) programs[index]!.draw();
    },
    dispose(): void {
      disposal.dispose();
    },
  });
}

function stableNoise(index: number, salt: number): number {
  const value = Math.sin(index * 63.17 + salt * 17.53) * 43147.19;
  return value - Math.floor(value);
}

function courseTopAt(x: number, time: number): number {
  for (let index = 0; index < COURSE_PLATFORMS.length; index += 1) {
    const platform = COURSE_PLATFORMS[index]!;
    if (Math.abs(x - platform.x) <= platform.width * 0.5) return platformTop(platform, time);
  }
  return 0;
}

export type TraversalRenderer = Readonly<{
  measurements: Readonly<{ instances: number; drawCalls: number; uploadBytesPerFrame: number; note: string }>;
  render(state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void;
  dispose(): void;
}>;

export async function createTraversalRenderer(canvas: HTMLCanvasElement): Promise<TraversalRenderer> {
  // Back-face culling: the course geometry is closed, so every back face drawn was fragment work
  // thrown away. If a specific mesh ever needs double-siding, draw that mesh in its own pass rather
  // than reverting this for the whole demo.
  const renderer = await createRenderer(canvas, { clearColor: [0.38, 0.57, 0.68, 1], cull: 'back' });
  const lifetime = createRendererResourceLifetime(() => renderer.destroy());
  const owned = lifetime.resources;
  try {
    // Loaded once and shared by all thirteen catalog batches. Thirteen uploads of the same 512x512
    // image is twelve wasted, and the renderer outlives every batch that borrows it.
    const detailNormal = owned.adopt(await loadDetailNormal(renderer));
    // One ramp for every catalog batch: it is the demo's lighting model, not a per-object
    // material, so there is exactly one of it.
    const ramp = owned.adopt(createLightingRamp(renderer));
    const kitMaterials = owned.adopt(createKitMaterialLookup(renderer));
    // One sprite for every effect: it is the demo's effect texture, not a per-effect material.
    const vfxBillboard = owned.adopt(await loadVfxBillboard(renderer));
    const catalogTransaction = await acquireTransactional([
      () => createCatalogBatch(renderer, 'grass', TRAVERSAL_BATCH_CAPACITIES.grass, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'overhang', TRAVERSAL_BATCH_CAPACITIES.overhang, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'moving', TRAVERSAL_BATCH_CAPACITIES.moving, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'flag', TRAVERSAL_BATCH_CAPACITIES.flag, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'coin', TRAVERSAL_BATCH_CAPACITIES.coin, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'spikes', TRAVERSAL_BATCH_CAPACITIES.spikes, detailNormal, ramp, kitMaterials, [0.92, 0.22, 0.09], 0.62),
      () => createCatalogBatch(renderer, 'tree', TRAVERSAL_BATCH_CAPACITIES.tree, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'courier', TRAVERSAL_BATCH_CAPACITIES.courier, detailNormal, ramp, kitMaterials),
      () => createCatalogBatch(renderer, 'cloud-small', TRAVERSAL_BATCH_CAPACITIES['cloud-small'], detailNormal, ramp, kitMaterials, [0.96, 0.98, 1], 0.9, 0.65),
      () => createCatalogBatch(renderer, 'cloud-large', TRAVERSAL_BATCH_CAPACITIES['cloud-large'], detailNormal, ramp, kitMaterials, [0.96, 0.98, 1], 0.9, 0.65),
      () => createCatalogBatch(renderer, 'coastal-cliff', TRAVERSAL_BATCH_CAPACITIES['coastal-cliff'], detailNormal, ramp, kitMaterials, [0.3, 0.45, 0.55], 0.78),
      () => createCatalogBatch(renderer, 'coastal-tree', TRAVERSAL_BATCH_CAPACITIES['coastal-tree'], detailNormal, ramp, kitMaterials, [0.18, 0.38, 0.24], 0.28),
      () => createCatalogBatch(renderer, 'relay-tower', TRAVERSAL_BATCH_CAPACITIES['relay-tower'], detailNormal, ramp, kitMaterials, [0.64, 0.71, 0.74], 0.38),
    ]);
    owned.adopt(catalogTransaction);
    const catalogEntries = catalogTransaction.resources;
    const grass = catalogEntries[0]!;
    const overhang = catalogEntries[1]!;
    const moving = catalogEntries[2]!;
    const flags = catalogEntries[3]!;
    const coins = catalogEntries[4]!;
    const spikes = catalogEntries[5]!;
    const trees = catalogEntries[6]!;
    const courier = catalogEntries[7]!;
    const cloudSmall = catalogEntries[8]!;
    const cloudLarge = catalogEntries[9]!;
    const coastalCliffs = catalogEntries[10]!;
    const coastalTrees = catalogEntries[11]!;
    const relayTowers = catalogEntries[12]!;
    const contactShadow = owned.adopt(createSurfaceBatch(renderer, createSphere({ radius: 1, widthSegments: 18, heightSegments: 10 }), TRAVERSAL_BATCH_CAPACITIES.contactShadow));
    const hud = owned.adopt(createSurfaceBatch(renderer, createCube(), TRAVERSAL_BATCH_CAPACITIES.hud));
    const trail = owned.adopt(createGlowBatch(renderer, createSphere({ radius: 1, widthSegments: 8, heightSegments: 6 }), TRAVERSAL_BATCH_CAPACITIES.trail, vfxBillboard));
    const effects = owned.adopt(createGlowBatch(renderer, createTorus({ radius: 1, tube: 0.055, radialSegments: 8, tubularSegments: 48 }), TRAVERSAL_BATCH_CAPACITIES.effects, vfxBillboard));
    const procedural = [contactShadow, hud, trail, effects];
    const cameraRig = createTraversalCameraRig();
    // near 0.5 against far 240 is a 480:1 depth ratio, inside the 500:1 budget. The old 0.1 gave
    // 2400:1 and spent most of the depth buffer's precision on the first half-metre, which nothing
    // in a side-on platformer ever occupies — the camera sits 12 units back and never approaches
    // the course.
    const camera = createCamera({ position: [0, 5, 12], fovY: Math.PI / 3.6, near: 0.5, far: 240 });
    const cameraPosition = new Float32Array(3);

    const measurements = summarizeTraversalMeasurements([...catalogEntries, ...procedural]);
    const drawFrame = (): void => {
      cloudLarge.draw(); cloudSmall.draw();
      coastalCliffs.draw(); relayTowers.draw(); coastalTrees.draw(); trees.draw();
      grass.draw(); overhang.draw(); moving.draw();
      contactShadow.draw();
      spikes.draw(); flags.draw(); coins.draw();
      effects.draw(); courier.draw(); trail.draw(); hud.draw();
    };

    const render = (state: TraversalSnapshot, pointer: PointerState, deltaSeconds: number): void => {
      const composition = backgroundCompositionAt(state.player.x);
      grass.clear(); overhang.clear(); moving.clear(); trees.clear();
      cloudSmall.clear(); cloudLarge.clear(); coastalCliffs.clear(); coastalTrees.clear(); relayTowers.clear();
      let grassIndex = 0;
      let overhangIndex = 0;
      let movingIndex = 0;
      let treeIndex = 0;
      let cloudSmallIndex = 0;
      let cloudLargeIndex = 0;
      let coastalCliffIndex = 0;
      let coastalTreeIndex = 0;
      let relayTowerIndex = 0;
      for (let index = 0; index < COURSE_PLATFORMS.length; index += 1) {
        const platform = COURSE_PLATFORMS[index]!;
        const top = platformTop(platform, state.time);
        if (platform.asset === 'moving') {
          moving.set(movingIndex, platform.x, top - 0.54, 0, platform.width, 1.8, 2.7, 0, 0, index);
          movingIndex += 1;
        } else if (platform.asset === 'overhang') {
          overhang.set(overhangIndex, platform.x, top - 0.7, 0, platform.width / 2.08, 0.72, 2.55, 0, 0, index);
          overhangIndex += 1;
        } else {
          grass.set(grassIndex, platform.x, top - 0.7, 0, platform.width / 2.08, 0.72, 1.42, 0, 0, index);
          grassIndex += 1;
        }
      }
      for (let index = 0; index < composition.catalog.length; index += 1) {
        const landmark = composition.catalog[index]!;
        const sway = landmark.asset === 'tree' || landmark.asset === 'coastal-tree' ? 0.012 : 0;
        if (landmark.asset === 'tree') trees.set(treeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, sway, landmark.phase);
        if (landmark.asset === 'cloud-small') cloudSmall.set(cloudSmallIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0.004, landmark.phase);
        if (landmark.asset === 'cloud-large') cloudLarge.set(cloudLargeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0.003, landmark.phase);
        if (landmark.asset === 'coastal-cliff') coastalCliffs.set(coastalCliffIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0, landmark.phase);
        if (landmark.asset === 'coastal-tree') coastalTrees.set(coastalTreeIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, sway, landmark.phase);
        if (landmark.asset === 'relay-tower') relayTowers.set(relayTowerIndex++, landmark.x, landmark.y, landmark.z, landmark.scale[0], landmark.scale[1], landmark.scale[2], landmark.yaw, 0, landmark.phase);
      }
      grass.upload(); overhang.upload(); moving.upload(); trees.upload();
      cloudSmall.upload(); cloudLarge.upload(); coastalCliffs.upload(); coastalTrees.upload(); relayTowers.upload();

      flags.clear();
      for (let index = 0; index < COURSE_CHECKPOINTS.length; index += 1) {
        const checkpoint = COURSE_CHECKPOINTS[index]!;
        flags.set(index, checkpoint.x, courseTopAt(checkpoint.x, state.time) + 0.03, -1.32, 1.5, 1.85, 1.5, 0, 0.08 + state.effects.checkpoint * 0.04, index * 1.7);
      }
      flags.set(3, DELIVERY_X - 1.5, courseTopAt(DELIVERY_X, state.time) + 0.03, -1.5, 2.2, 3.2, 2.2, 0, 0.11, 4.2);
      flags.upload();

      coins.clear();
      if (!state.collectedSeal) {
        const collectible = COURSE_COLLECTIBLES[0]!;
        coins.set(0, collectible.x, collectible.y + Math.sin(state.time * 3) * 0.12, 0.05, 1.65, 1.65, 1.65, state.time * 2.6, 0, 0);
      }
      if (state.outcome === 'delivered') {
        coins.set(1, DELIVERY_X, courseTopAt(DELIVERY_X, state.time) + 1.7, 0, 2.6, 2.6, 2.6, state.time * 1.8, 0, 1);
      }
      coins.upload();

      spikes.clear();
      for (let index = 0; index < COURSE_HAZARDS.length; index += 1) {
        const hazard = COURSE_HAZARDS[index]!;
        spikes.set(index, hazard.x, hazardTop(hazard, state.time) + 0.02, 0, HAZARD_SPIKE_SCALE[0], HAZARD_SPIKE_SCALE[1], HAZARD_SPIKE_SCALE[2], 0, 0, index);
      }
      spikes.upload();

      const gait = Math.sin(state.time * (7 + Math.abs(state.player.vx)));
      const courierScaleX = (0.305 + state.player.squash * 0.018) * state.player.facing;
      const courierScaleY = 0.305 - state.player.squash * 0.022;
      courier.clear();
      courier.set(0, state.player.x, state.player.y - RUNNER_RADIUS + 0.002, 0.02, courierScaleX, courierScaleY, 0.305, gait * 0.018, 0.012, state.time * 1.7);
      courier.upload();

      const supportTop = courseTopAt(state.player.x, state.time);
      const shadowDistance = Math.max(0, state.player.y - RUNNER_RADIUS - supportTop);
      contactShadow.clear();
      contactShadow.set(0, state.player.x, supportTop + 0.025, -0.02, 0.75 - Math.min(0.42, shadowDistance * 0.18), 0.035, 0.42, INK, 0, 0, 0);
      contactShadow.upload();

      trail.clear();
      for (let index = 0; index < state.trail.length; index += 1) {
        const particle = state.trail[index]!;
        const life = Math.max(0, particle.life);
        const color = particle.color === 0 ? SEA_GREY : particle.color === 1 ? OCHRE : VERMILION;
        const scale = (0.025 + life * 0.11) * Math.min(1, life * 4);
        trail.set(index, particle.x, particle.y, 0.1, scale, scale, scale, color, Math.min(0.7, life * 2.4), 0, index * 0.31);
      }
      const windAnchor = Math.floor(state.player.x / 20) * 20;
      for (let index = 0; index < 30; index += 1) {
        const depth = index % 3;
        const wrap = ((state.time * (1.7 + depth * 0.4) + stableNoise(index, 5) * 24) % 24) - 12;
        const speck = 0.025 + depth * 0.012;
        trail.set(state.trail.length + index, windAnchor + wrap, -0.4 + stableNoise(index, 9) * 7, -2 - depth * 2.6, speck * 2.4, speck, speck, depth === 0 ? CREAM : SEA_GREY, 0.1, -0.05, index);
      }
      trail.upload();

      effects.clear();
      for (let index = 0; index < COURSE_CHECKPOINTS.length; index += 1) {
        const checkpoint = COURSE_CHECKPOINTS[index]!;
        const checkpointScale = 0.82 + state.effects.checkpoint * 0.3;
        effects.set(index, checkpoint.x, courseTopAt(checkpoint.x, state.time) + 1.05, 0.1, checkpointScale, checkpointScale, 1, index <= state.checkpointIndex ? OCHRE : SEA_GREY, 0.18 + state.effects.checkpoint * 0.22, state.time * 0.16, index);
      }
      const deliveryScale = 1.45 + state.effects.delivery * 0.45;
      effects.set(3, DELIVERY_X, courseTopAt(DELIVERY_X, state.time) + 1.35, 0.1, deliveryScale, deliveryScale, 1, state.outcome === 'failed' ? VERMILION : OCHRE, state.outcome === 'delivered' ? 0.68 : 0.2, state.time * 0.12, 4);
      const landScale = 0.55 + state.effects.land * 0.9;
      effects.set(4, state.player.x, supportTop + 0.08, 0.12, landScale, landScale, 1, CREAM, state.effects.land * 0.52, 0, 5);
      const jumpScale = 0.5 + state.effects.jump * 0.55;
      effects.set(5, state.player.x, state.player.y, 0.14, jumpScale, jumpScale, 1, ULTRAMARINE, state.effects.jump * 0.34, 0, 6);
      const collectible = COURSE_COLLECTIBLES[0]!;
      const collectibleScale = 0.72 + state.effects.collectible * 1.2;
      effects.set(6, collectible.x, collectible.y, 0.12, collectibleScale, collectibleScale, 1, OCHRE, state.effects.collectible * 0.72, state.time * 0.3, 7);
      const resetPulse = Math.max(state.effects.damage, state.effects.retry);
      const resetScale = 0.75 + resetPulse * 1.4;
      effects.set(7, state.player.x, state.player.y, 0.14, resetScale, resetScale, 1, state.effects.damage > state.effects.retry ? VERMILION : CREAM, resetPulse * 0.66, -state.time * 0.24, 8);
      effects.upload();

      const cameraFrame = cameraRig.update(renderer.aspect, state, pointer, deltaSeconds);
      cameraPosition.set(cameraFrame.position);
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(cameraFrame.target[0], cameraFrame.target[1], cameraFrame.target[2]);
      const viewProjection = camera.viewProjection(renderer.aspect);

      hud.clear();
      const hudX = hudAnchorX(cameraFrame.target[0], renderer.aspect);
      const hudY = hudAnchorY(cameraFrame.target[1], renderer.aspect);
      let hudIndex = 0;
      hud.set(hudIndex++, hudX, hudY, HUD_DEPTH, HUD_BAR_HALF_WIDTH, HUD_BAR_HALF_HEIGHT, 0.06, INK, 0, 0, 0);
      const progressWidth = HUD_METER_HALF_WIDTH * state.progress;
      hud.set(hudIndex++, hudX + HUD_METER_CENTER_X_OFFSET - HUD_METER_HALF_WIDTH + progressWidth, hudY, HUD_DEPTH + 0.04, progressWidth, HUD_BAR_HALF_HEIGHT * 0.52, 0.075, ULTRAMARINE, 0, 0.1, 0);
      hud.set(hudIndex++, hudX, hudY - HUD_BAR_GAP, HUD_DEPTH, HUD_BAR_HALF_WIDTH, HUD_BAR_HALF_HEIGHT, 0.06, INK, 0, 0, 0);
      const stormWidth = HUD_METER_HALF_WIDTH * (1 - state.storm);
      hud.set(hudIndex++, hudX + HUD_METER_CENTER_X_OFFSET - HUD_METER_HALF_WIDTH + stormWidth, hudY - HUD_BAR_GAP, HUD_DEPTH + 0.04, stormWidth, HUD_BAR_HALF_HEIGHT * 0.52, 0.075, state.remainingTime < 15 ? VERMILION : OCHRE, 0, 0.06, 0);
      for (let index = 0; index < HUD_LABEL_CELLS.progress.length; index += 1) {
        const cell = HUD_LABEL_CELLS.progress[index]!;
        hud.set(hudIndex++, hudX + HUD_LABEL_CENTER_X_OFFSET + cell[0], hudY + cell[1], HUD_DEPTH + 0.05, HUD_LABEL_CELL_HALF_WIDTH, HUD_LABEL_CELL_HALF_HEIGHT, 0.076, CREAM, 0, 0.05, 0);
      }
      for (let index = 0; index < HUD_LABEL_CELLS.storm.length; index += 1) {
        const cell = HUD_LABEL_CELLS.storm[index]!;
        hud.set(hudIndex++, hudX + HUD_LABEL_CENTER_X_OFFSET + cell[0], hudY - HUD_BAR_GAP + cell[1], HUD_DEPTH + 0.05, HUD_LABEL_CELL_HALF_WIDTH, HUD_LABEL_CELL_HALF_HEIGHT, 0.076, CREAM, 0, 0.05, 0);
      }
      const parcelY = hudY - HUD_BAR_GAP * 2.05;
      hud.set(hudIndex++, hudX - 0.88, parcelY, HUD_DEPTH + 0.02, 0.31, 0.19, 0.09, CLAY, 0, 0.08, 0);
      hud.set(hudIndex++, hudX - 0.88, parcelY, HUD_DEPTH + 0.04, 0.045, 0.2, 0.1, VERMILION, 0, 0.08, 0);
      hud.set(hudIndex++, hudX - 0.88, parcelY, HUD_DEPTH + 0.045, 0.32, 0.04, 0.105, VERMILION, 0, 0.08, 0);
      for (let index = 0; index < 3; index += 1) {
        hud.set(hudIndex++, hudX - 0.31 + index * 0.36, parcelY, HUD_DEPTH + 0.02, 0.16, 0.16, 0.09, index < state.parcelSeals ? VERMILION : SEA_GREY, 0, 0.08, Math.PI * 0.25);
      }
      hud.set(hudIndex++, hudX + 0.87, parcelY, HUD_DEPTH + 0.02, 0.15, 0.27, 0.09, state.controlMode === 'attract' ? OCHRE : state.controlMode === 'manual' ? ULTRAMARINE : SEA_GREY, 0, 0.08, 0);
      if (state.outcome !== 'running') {
        const outcomeColor = state.outcome === 'delivered' ? OCHRE : VERMILION;
        hud.set(hudIndex++, cameraFrame.target[0], cameraFrame.target[1] + 1.75, 1.4, 2.35, 0.16, 0.1, outcomeColor, 0, 0.12, 0);
        hud.set(hudIndex++, cameraFrame.target[0], cameraFrame.target[1] + 1.75, 1.42, 0.16, 0.72, 0.11, outcomeColor, 0, 0.12, state.outcome === 'delivered' ? 0 : Math.PI * 0.25);
      }
      hud.set(hudIndex++, state.player.x - state.player.facing * 0.23, state.player.y + 0.12, 0.34, 0.28, 0.23, 0.18, VERMILION, 0, 0.1, state.player.facing * 0.08);
      for (let index = 0; index < COURSE_HAZARDS.length; index += 1) {
        const hazard = COURSE_HAZARDS[index]!;
        hud.set(hudIndex++, hazard.x, hazardTop(hazard, state.time) + 0.055, HAZARD_TELEGRAPH_DEPTH, hazardTelegraphHalfWidth(hazard.width), HAZARD_TELEGRAPH_HALF_HEIGHT, HAZARD_TELEGRAPH_HALF_DEPTH, OCHRE, 0, 0.06, 0);
      }
      hud.upload();

      for (let index = 0; index < procedural.length; index += 1) procedural[index]!.setFrame(viewProjection, cameraPosition, state.time);
      for (let index = 0; index < catalogEntries.length; index += 1) catalogEntries[index]!.setFrame(viewProjection, cameraPosition, state.time);
      renderer.present(drawFrame);
    };

    return Object.freeze({
      measurements,
      render,
      dispose(): void {
        lifetime.dispose();
      },
    });
  } catch (cause: unknown) {
    return lifetime.rollback(cause);
  }
}
