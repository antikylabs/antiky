import {
  createCamera,
  createCone,
  createCube,
  createCylinder,
  createPlane,
  createProgram,
  createSphere,
  createTorus,
  loadTexture,
  mat4,
  type BroMetalTexture,
  type Renderer,
} from 'brometal';
import type { GamePointerInput } from '@antiky/framework/game';

import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';
import { createRelayOnboardingOverlay } from './onboarding.ts';
import {
  createGlowBatch,
  createSurfaceBatch,
  horizontalGeometry,
  type Vec3,
} from './render-batches.ts';
import { authoritativeRelayRegionRadii, type RelaySnapshot } from './simulation.ts';
import floorShader from './shaders/reliquary-floor.shader.gen';
import FLOOR_AO_URL from 'virtual:blackout-relay/forest-floor-ao';
import FLOOR_DIFFUSE_URL from 'virtual:blackout-relay/forest-floor-diffuse';
import FLOOR_ROUGHNESS_URL from 'virtual:blackout-relay/forest-floor-roughness';

const STONE: Vec3 = [0.14, 0.16, 0.14];
const DARK_STONE: Vec3 = [0.075, 0.085, 0.08];
const MOSS: Vec3 = [0.11, 0.19, 0.12];
const VERDIGRIS: Vec3 = [0.07, 0.25, 0.2];
const OLD_BRASS: Vec3 = [0.34, 0.23, 0.11];
const BONE: Vec3 = [0.52, 0.5, 0.4];
const SHADE: Vec3 = [0.055, 0.025, 0.06];
const DANGER: Vec3 = [0.48, 0.045, 0.12];
const INTEGRITY: Vec3 = [0.48, 0.82, 0.55];
const SURFACE_INSTANCE_COUNT = 48 + 18 + 8 + 24 + 28;
const GLOW_INSTANCE_COUNT = 100;

type PresentationLight = Readonly<{
  transform: Readonly<{ position: readonly [number, number, number] }>;
  pointLight: Readonly<{ color: readonly [number, number, number]; radius: number }>;
}>;

export type RelayRenderer = Readonly<{
  measurements: Readonly<{
    instances: number;
    drawCalls: number;
    uploadBytesPerFrame: number;
    note: string;
  }>;
  render(
    state: RelaySnapshot,
    powers: readonly [number, number, number],
    pointer: GamePointerInput,
  ): void;
  dispose(): void;
}>;

function colorForRelay(index: number): Vec3 {
  return EXPO_LIGHT_DEFINITIONS[index]!.pointLight.color;
}

function setupArchitecture(batch: ReturnType<typeof createSurfaceBatch>): void {
  batch.clear();
  for (let index = 0; index < 32; index += 1) {
    const angle = index / 32 * Math.PI * 2;
    const x = Math.cos(angle) * (8.35 + (index % 3) * 0.22);
    const z = Math.sin(angle) * (5.75 + ((index + 1) % 3) * 0.18);
    const height = 0.32 + ((index * 7) % 5) * 0.16;
    batch.set(
      index,
      [x, -0.28 + height, z],
      [0.56 + (index % 4) * 0.17, height, 0.38 + ((index + 2) % 3) * 0.12],
      index % 5 === 0 ? MOSS : index % 3 === 0 ? DARK_STONE : STONE,
      [0.78 + (index % 3) * 0.07, index % 7 === 0 ? 0.18 : 0.03, 0],
      -angle + (index % 2 === 0 ? 0.18 : -0.13),
    );
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2 + 0.34;
    const radius = 3.35 + (index % 2) * 1.15;
    batch.set(
      32 + index,
      [Math.cos(angle) * radius, -0.23, Math.sin(angle) * radius],
      [1.05 + (index % 3) * 0.22, 0.07, 0.14 + (index % 2) * 0.08],
      index % 3 === 0 ? VERDIGRIS : OLD_BRASS,
      [0.64, 0.7, index % 3 === 0 ? 0.025 : 0],
      -angle + 0.42,
    );
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    batch.set(
      40 + index,
      [Math.cos(angle) * 1.85, -0.26, Math.sin(angle) * 1.85],
      [0.54 + (index % 2) * 0.18, 0.09, 0.33],
      index % 2 === 0 ? DARK_STONE : MOSS,
      [0.9, 0.02, 0],
      -angle,
    );
  }
  batch.upload();
}

function setupColumns(batch: ReturnType<typeof createSurfaceBatch>): void {
  batch.clear();
  EXPO_LIGHT_DEFINITIONS.forEach((light, index) => {
    batch.set(
      index,
      [light.transform.position[0], 0.02, light.transform.position[2]],
      [0.72, 0.74, 0.72],
      index === 0 ? OLD_BRASS : index === 1 ? VERDIGRIS : [0.25, 0.13, 0.2],
      [0.62, 0.7, 0.015],
    );
  });
  batch.set(3, [0, -0.16, 0], [1.62, 0.34, 1.62], DARK_STONE, [0.88, 0.06, 0]);
  batch.set(4, [0, 0.04, 0], [1.22, 0.42, 1.22], STONE, [0.82, 0.04, 0]);
  batch.set(5, [0, 0.28, 0], [0.7, 0.5, 0.7], OLD_BRASS, [0.5, 0.78, 0.02]);
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2 + 0.2;
    const height = 1.1 + (index % 4) * 0.36;
    batch.set(
      6 + index,
      [Math.cos(angle) * 7.15, -0.3 + height * 0.48, Math.sin(angle) * 4.72],
      [0.25 + (index % 2) * 0.08, height, 0.25 + ((index + 1) % 2) * 0.08],
      index % 3 === 0 ? MOSS : STONE,
      [0.94, index % 4 === 0 ? 0.12 : 0.02, 0],
    );
  }
  const broken = [[-3.6, 3.8], [3.4, -3.3], [-6.2, 0.8], [6.4, -0.4]] as const;
  broken.forEach(([x, z], index) => {
    batch.set(14 + index, [x, -0.12, z], [0.42, 0.42 + index * 0.1, 0.42], DARK_STONE, [0.9, 0.02, 0]);
  });
  batch.upload();
}

export async function createRelayRenderer(
  renderer: Renderer,
  lights: readonly PresentationLight[],
): Promise<RelayRenderer> {
  let diffuseTexture: BroMetalTexture | undefined;
  let aoTexture: BroMetalTexture | undefined;
  let roughnessTexture: BroMetalTexture | undefined;
  try {
    diffuseTexture = await loadTexture(renderer, FLOOR_DIFFUSE_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    });
    aoTexture = await loadTexture(renderer, FLOOR_AO_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    });
    roughnessTexture = await loadTexture(renderer, FLOOR_ROUGHNESS_URL, {
      filter: 'smooth', wrap: 'repeat', anisotropy: 8,
    });
  } catch (cause: unknown) {
    diffuseTexture?.dispose();
    aoTexture?.dispose();
    roughnessTexture?.dispose();
    throw cause;
  }

  const floorGeometry = createPlane({ width: 18, height: 12.8, widthSegments: 24, heightSegments: 18 });
  const floorProgram = createProgram(renderer, floorShader);
  floorProgram.attributes.aPosition.set(floorGeometry.positions);
  floorProgram.attributes.aUv.set(floorGeometry.uvs);
  floorProgram.setIndices(floorGeometry.indices);
  floorProgram.uniforms.uDiffuse.set(diffuseTexture);
  floorProgram.uniforms.uAo.set(aoTexture);
  floorProgram.uniforms.uRoughness.set(roughnessTexture);
  const onboarding = createRelayOnboardingOverlay(renderer);

  const architecture = createSurfaceBatch(renderer, createCube(), 48);
  const columns = createSurfaceBatch(
    renderer,
    createCylinder({ radiusTop: 0.82, radiusBottom: 1, height: 1, radialSegments: 28 }),
    18,
  );
  const forms = createSurfaceBatch(renderer, createCone({ radius: 1, height: 2, radialSegments: 5 }), 8);
  const orbs = createSurfaceBatch(renderer, createSphere({ radius: 1, widthSegments: 24, heightSegments: 16 }), 24);
  const rings = createSurfaceBatch(
    renderer,
    horizontalGeometry(createTorus({ radius: 1, tube: 0.035, radialSegments: 8, tubularSegments: 72 })),
    28,
  );
  const glows = createGlowBatch(
    renderer,
    createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }),
    GLOW_INSTANCE_COUNT,
  );
  setupArchitecture(architecture);
  setupColumns(columns);

  const surfaceBatches = [architecture, columns, forms, orbs, rings];
  const identity = mat4.identity();
  const cameraPosition = new Float32Array(3);
  const camera = createCamera({ position: [0, 11.8, 11.2], fovY: Math.PI / 3.65, near: 0.1, far: 45 });
  let disposed = false;

  const setLights = (
    powers: readonly [number, number, number],
    program: (typeof surfaceBatches)[number]['program'],
  ): void => {
    program.uniforms.uEmberPosition.set(lights[0]!.transform.position);
    program.uniforms.uEmberColor.set(lights[0]!.pointLight.color);
    program.uniforms.uEmberPower.set(powers[0]);
    program.uniforms.uEmberRadius.set(lights[0]!.pointLight.radius);
    program.uniforms.uIonPosition.set(lights[1]!.transform.position);
    program.uniforms.uIonColor.set(lights[1]!.pointLight.color);
    program.uniforms.uIonPower.set(powers[1]);
    program.uniforms.uIonRadius.set(lights[1]!.pointLight.radius);
    program.uniforms.uVioletPosition.set(lights[2]!.transform.position);
    program.uniforms.uVioletColor.set(lights[2]!.pointLight.color);
    program.uniforms.uVioletPower.set(powers[2]);
    program.uniforms.uVioletRadius.set(lights[2]!.pointLight.radius);
  };

  const render = (
    state: RelaySnapshot,
    powers: readonly [number, number, number],
    pointer: GamePointerInput,
  ): void => {
    forms.clear();
    const chargeColor = state.player.charge.relayIndex === null
      ? BONE
      : colorForRelay(state.player.charge.relayIndex);
    forms.set(
      0,
      [state.player.x, 0.36, state.player.z],
      state.status === 'lost' ? [0.48, 0.2, 0.48] : [0.42, 0.62, 0.42],
      chargeColor,
      [0.26, 0.72, 0.08 + state.player.charge.value * 0.46],
      -Math.atan2(state.player.facingX, state.player.facingZ),
    );
    state.shades.forEach((shade, index) => {
      const retreat = shade.mode === 'retreat';
      forms.set(
        1 + index,
        [shade.x, 0.43 + Math.sin(state.time * 2.1 + shade.phase) * 0.08, shade.z],
        retreat ? [0.34, 0.48, 0.34] : [0.5, 0.72, 0.5],
        retreat ? [0.11, 0.08, 0.12] : SHADE,
        [0.78, 0.08, retreat ? 0 : 0.025],
        state.time * (index % 2 === 0 ? 0.28 : -0.24) + shade.phase,
      );
    });
    EXPO_LIGHT_DEFINITIONS.forEach((light, index) => {
      const relayScales = [
        [0.58, 0.5, 0.58],
        [0.38, 0.78, 0.38],
        [0.56, 0.66, 0.42],
      ] as const;
      forms.set(
        5 + index,
        [light.transform.position[0], 1.22, light.transform.position[2]],
        relayScales[index]!,
        index === 1 ? VERDIGRIS : index === 0 ? OLD_BRASS : [0.3, 0.12, 0.2],
        [0.46, 0.82, 0.035],
        index * 0.74,
      );
    });
    forms.upload();

    orbs.clear();
    orbs.set(0, [state.player.x, 0.62, state.player.z], [0.17, 0.17, 0.17], chargeColor, [0.18, 0.45, 0.65 + state.player.charge.value]);
    state.shades.forEach((shade, index) => {
      orbs.set(1 + index, [shade.x, 0.61, shade.z], [0.075, 0.075, 0.075], DANGER, [0.2, 0.3, shade.mode === 'threaten' ? 1.2 : 0.12]);
    });
    EXPO_LIGHT_DEFINITIONS.forEach((light, index) => {
      orbs.set(5 + index, light.transform.position, [0.18, 0.18, 0.18], colorForRelay(index), [0.16, 0.25, 1.5 + powers[index]! * 0.28]);
    });
    orbs.set(
      8,
      [0, 0.76, 0],
      [0.34, 0.34, 0.34],
      state.rejectPulse > 0 ? DANGER : OLD_BRASS,
      [0.22, 0.86, 0.06 + state.forgePulse * 0.5 + state.rejectPulse * 1.3],
    );
    for (let index = 0; index < 3; index += 1) {
      const angle = index / 3 * Math.PI * 2 - Math.PI / 2;
      orbs.set(
        9 + index,
        [Math.cos(angle) * 0.72, 0.72, Math.sin(angle) * 0.72],
        state.deposits[index] ? [0.18, 0.28, 0.18] : [0.14, 0.14, 0.14],
        state.deposits[index] ? colorForRelay(index) : DARK_STONE,
        [0.22, 0.62, state.deposits[index] ? 1.2 : 0.01],
      );
    }
    let signatureIndex = 12;
    EXPO_LIGHT_DEFINITIONS.forEach((light, relayIndex) => {
      const count = relayIndex + 1;
      for (let marker = 0; marker < count; marker += 1) {
        const angle = count === 1
          ? -Math.PI / 2
          : marker / count * Math.PI * 2 - Math.PI / 2;
        orbs.set(
          signatureIndex,
          [
            light.transform.position[0] + Math.cos(angle) * 0.92,
            0.08 + relayIndex * 0.045,
            light.transform.position[2] + Math.sin(angle) * 0.92,
          ],
          [0.1, 0.1 + relayIndex * 0.025, 0.1],
          BONE,
          [0.72, 0.08, 0.035],
        );
        signatureIndex += 1;
      }
    });
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2 + 0.12;
      const radius = 6.55 + (index % 3) * 0.34;
      orbs.set(
        18 + index,
        [Math.cos(angle) * radius, 0.2 + (index % 4) * 0.16, Math.sin(angle) * radius * 0.68],
        [0.12 + (index % 2) * 0.05, 0.18 + (index % 3) * 0.04, 0.12 + (index % 2) * 0.05],
        index % 4 === 0 ? VERDIGRIS : BONE,
        [0.72, index % 4 === 0 ? 0.56 : 0.05, 0.005],
      );
    }
    orbs.upload();

    rings.clear();
    EXPO_LIGHT_DEFINITIONS.forEach((light, index) => {
      const authoritativeRegion = authoritativeRelayRegionRadii(index, powers[index]!);
      rings.set(index, [light.transform.position[0], -0.31, light.transform.position[2]], [authoritativeRegion.safe, authoritativeRegion.safe, authoritativeRegion.safe], colorForRelay(index), [0.48, 0.56, 0.035]);
      rings.set(3 + index, [light.transform.position[0], -0.27, light.transform.position[2]], [authoritativeRegion.charge, authoritativeRegion.charge, authoritativeRegion.charge], colorForRelay(index), [0.28, 0.7, state.deposits[index] ? 0.03 : 0.18]);
    });
    [0.82, 1.18, 1.53].forEach((scale, index) => {
      const rejectExpansion = state.rejectPulse * 0.08;
      rings.set(
        6 + index,
        [0, -0.17 + index * 0.035, 0],
        [scale + rejectExpansion, scale + rejectExpansion, scale + rejectExpansion],
        state.rejectPulse > 0
          ? DANGER
          : index === 0 ? OLD_BRASS : index === 1 ? VERDIGRIS : DARK_STONE,
        [
          0.48 + index * 0.12,
          0.72,
          0.02 + state.forgePulse * 0.1 + state.rejectPulse * 0.32,
        ],
      );
    });
    for (let index = 0; index < 3; index += 1) {
      const angle = index / 3 * Math.PI * 2 - Math.PI / 2;
      const color = state.deposits[index] ? colorForRelay(index) : DARK_STONE;
      rings.set(9 + index, [Math.cos(angle) * 0.72, 0.48, Math.sin(angle) * 0.72], [0.24, 0.24, 0.24], color, [0.25, 0.64, state.deposits[index] ? 0.86 : 0]);
    }
    const playerRingScale = state.player.charge.relayIndex === null ? 0 : 0.48 + state.player.charge.value * 0.22;
    rings.set(12, [state.player.x, 0.03, state.player.z], [playerRingScale, playerRingScale, playerRingScale], chargeColor, [0.22, 0.62, state.player.charge.value * 0.8]);
    state.shades.forEach((shade, index) => {
      const scale = shade.mode === 'threaten' ? 0.58 : 0.32;
      rings.set(13 + index, [shade.x, -0.22, shade.z], [scale, scale, scale], shade.mode === 'threaten' ? DANGER : [0.13, 0.09, 0.14], [0.34, 0.34, shade.mode === 'threaten' ? 0.13 : 0]);
    });
    for (let index = 0; index < 3; index += 1) {
      const visible = state.status === 'playing' ? 0 : 1;
      const center = state.status === 'lost' ? [state.player.x, state.player.z] as const : [0, 0] as const;
      const scale = visible * (0.75 + index * 0.52 + Math.sin(state.time * 2 + index) * 0.08);
      rings.set(17 + index, [center[0], 0.12 + index * 0.22, center[1]], [scale, scale, scale], state.status === 'won' ? colorForRelay(index) : DANGER, [0.16, 0.5, visible * 0.9]);
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2 + 0.28;
      const scale = 0.34 + (index % 3) * 0.16;
      rings.set(20 + index, [Math.cos(angle) * 4.7, -0.33, Math.sin(angle) * 3.5], [scale, scale, scale], index % 2 === 0 ? VERDIGRIS : OLD_BRASS, [0.82, 0.44, 0.008]);
    }
    rings.upload();

    glows.clear();
    state.particles.forEach((particle, index) => {
      const visible = Math.max(0, particle.life);
      glows.set(
        index,
        [particle.x, particle.y, particle.z],
        (0.035 + visible * 0.09) * Math.min(1, visible * 5),
        particle.kind === 2 ? DANGER : colorForRelay(particle.relayIndex),
        visible * (particle.kind === 1 ? 2.1 : 1.35),
        index * 0.31,
      );
    });
    EXPO_LIGHT_DEFINITIONS.forEach((light, index) => {
      glows.set(64 + index, light.transform.position, 0.42 + powers[index]! * 0.035, colorForRelay(index), powers[index]!, index * 2.1);
    });
    for (let index = 0; index < 5; index += 1) {
      const angle = index / 5 * Math.PI * 2 + state.time * 0.35;
      const alive = state.integrity * 5 > index + 0.05;
      glows.set(67 + index, [state.player.x + Math.cos(angle) * 0.58, 0.42, state.player.z + Math.sin(angle) * 0.58], alive ? 0.055 : 0.018, alive ? INTEGRITY : DANGER, alive ? 1.2 : 0.08, index);
    }
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2 - state.time * 0.42;
      const charged = state.player.charge.value * 8 > index + 0.01;
      glows.set(72 + index, [state.player.x + Math.cos(angle) * 0.38, 0.93, state.player.z + Math.sin(angle) * 0.38], charged ? 0.047 : 0.014, chargeColor, charged ? 1.45 : 0.04, index * 0.5);
    }
    for (let index = 0; index < 3; index += 1) {
      const angle = index / 3 * Math.PI * 2 - Math.PI / 2;
      glows.set(80 + index, [Math.cos(angle) * 0.72, 0.76, Math.sin(angle) * 0.72], state.deposits[index] ? 0.2 : 0.045, colorForRelay(index), state.deposits[index] ? 2.2 : 0.1, index);
    }
    state.shades.forEach((shade, index) => {
      glows.set(83 + index, [shade.x, 0.61, shade.z], shade.mode === 'threaten' ? 0.11 : 0.045, DANGER, shade.mode === 'threaten' ? 1.7 : 0.18, shade.phase);
    });
    for (let index = 0; index < 13; index += 1) {
      const angle = index * 2.39996;
      const radius = 2.8 + (index % 5) * 1.15;
      glows.set(87 + index, [Math.cos(angle) * radius, 0.35 + (index % 4) * 0.48, Math.sin(angle) * radius * 0.7], 0.025 + (index % 3) * 0.008, index % 3 === 0 ? colorForRelay(index % 3) : BONE, 0.34, index * 0.73, 0.15);
    }
    glows.upload();

    const pointerX = pointer.active && Number.isFinite(pointer.x) ? pointer.x - 0.5 : 0;
    const pointerY = pointer.active && Number.isFinite(pointer.y) ? pointer.y - 0.5 : 0;
    const shake = Math.min(0.12, state.dangerPulse * 0.06);
    const cameraX = pointerX * 0.7 + Math.sin(state.time * 24) * shake;
    const cameraY = 11.8 - pointerY * 0.45;
    const cameraZ = 11.2 + Math.cos(state.time * 21) * shake;
    cameraPosition.set([cameraX, cameraY, cameraZ]);
    camera.setPosition(cameraX, cameraY, cameraZ);
    camera.lookAt(state.player.x * 0.035, 0.1, -0.45 + state.player.z * 0.025);
    const viewProjection = camera.viewProjection(renderer.aspect);

    surfaceBatches.forEach((batch) => {
      batch.program.uniforms.uViewProj.set(viewProjection);
      batch.program.uniforms.uModel.set(identity);
      batch.program.uniforms.uCameraPosition.set(cameraPosition);
      batch.program.uniforms.uTime.set(state.time);
      setLights(powers, batch.program);
    });
    floorProgram.uniforms.uViewProj.set(viewProjection);
    floorProgram.uniforms.uCameraPosition.set(cameraPosition);
    floorProgram.uniforms.uEmberPosition.set(lights[0]!.transform.position);
    floorProgram.uniforms.uEmberColor.set(lights[0]!.pointLight.color);
    floorProgram.uniforms.uEmberPower.set(powers[0]);
    floorProgram.uniforms.uEmberRadius.set(lights[0]!.pointLight.radius);
    floorProgram.uniforms.uIonPosition.set(lights[1]!.transform.position);
    floorProgram.uniforms.uIonColor.set(lights[1]!.pointLight.color);
    floorProgram.uniforms.uIonPower.set(powers[1]);
    floorProgram.uniforms.uIonRadius.set(lights[1]!.pointLight.radius);
    floorProgram.uniforms.uVioletPosition.set(lights[2]!.transform.position);
    floorProgram.uniforms.uVioletColor.set(lights[2]!.pointLight.color);
    floorProgram.uniforms.uVioletPower.set(powers[2]);
    floorProgram.uniforms.uVioletRadius.set(lights[2]!.pointLight.radius);
    glows.program.uniforms.uViewProj.set(viewProjection);
    glows.program.uniforms.uCameraPosition.set(cameraPosition);
    glows.program.uniforms.uTime.set(state.time);
    const onboardingOpacity = state.status === 'playing' && !state.deposits.some(Boolean)
      ? Math.max(0, Math.min(1, (14 - state.time) * 0.5))
      : 0;
    onboarding.setOpacity(onboardingOpacity);

    renderer.present(() => {
      floorProgram.draw();
      architecture.draw();
      columns.draw();
      rings.draw();
      forms.draw();
      orbs.draw();
      glows.draw();
      onboarding.draw();
    });
  };

  return Object.freeze({
    measurements: Object.freeze({
      instances: 2 + SURFACE_INSTANCE_COUNT + GLOW_INSTANCE_COUNT,
      drawCalls: 8,
      uploadBytesPerFrame: 7_120,
      note: 'fixed-step Blackout Relay with an authoritative ring field and presentation-only three-channel Poly Haven floor lighting',
    }),
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      floorProgram.dispose();
      onboarding.dispose();
      surfaceBatches.forEach((batch) => batch.dispose());
      glows.dispose();
      diffuseTexture.dispose();
      aoTexture.dispose();
      roughnessTexture.dispose();
    },
  });
}
