import {
  createCamera,
  createCone,
  createCube,
  createProgram,
  createRenderer,
  createSphere,
  createTorus,
  type Geometry,
  type Renderer,
} from 'brometal';
import {
  createEngineSession,
  createInspectionSnapshot,
  createSessionId,
} from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';

import traversalGlowShader from './shaders/traversal-glow.shader.gen';
import traversalSurfaceShader from './shaders/traversal-surface.shader.gen';
import { TRAVERSAL_WORLD_ID, createTraversalInspectionModel } from './inspection.ts';
import {
  COURSE_HAZARDS,
  COURSE_LENGTH,
  platformInstancesNear,
  createTraversalSimulation,
  type TraversalInput,
  type TraversalSnapshot,
} from './simulation.ts';

type Vec3 = readonly [number, number, number];

const AQUA: Vec3 = [0.06, 0.94, 1.05];
const CORAL: Vec3 = [1.4, 0.18, 0.38];
const GOLD: Vec3 = [1.5, 0.76, 0.12];
const VIOLET: Vec3 = [0.72, 0.22, 1.4];
const PLATFORM_COLORS = [
  [0.035, 0.48, 0.6],
  [0.9, 0.11, 0.32],
  [0.95, 0.52, 0.08],
] as const satisfies readonly Vec3[];

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
    program,
    clear(): void {
      scales.fill(0);
      materials.fill(0);
    },
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
    dispose(): void { program.dispose(); },
  });
}

function createGlowBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, traversalGlowShader, { blend: 'additive' });
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
    program,
    clear(): void {
      scales.fill(0);
      alphas.fill(0);
    },
    set(
      index: number,
      offset: Vec3,
      scale: Vec3,
      color: Vec3,
      alpha: number,
      rotation: number,
      phase: number,
    ): void {
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
    dispose(): void { program.dispose(); },
  });
}

function stableNoise(index: number, salt: number): number {
  const value = Math.sin(index * 63.17 + salt * 17.53) * 43147.19;
  return value - Math.floor(value);
}

function captureInput(context: Parameters<GameModuleEntry>[0]): TraversalInput {
  const horizontal = context.movement.active && Number.isFinite(context.movement.x)
    ? Math.max(-1, Math.min(1, context.movement.x))
    : 0;
  return Object.freeze({
    horizontal,
    active: Math.abs(horizontal) > 0.01,
    jump: context.pointer.clicked || (context.movement.active && context.movement.z < -0.4),
  });
}

const game: GameModuleEntry = async (context) => {
  const renderer = await createRenderer(context.canvas, {
    clearColor: [0.008, 0.016, 0.055, 1],
    cull: 'back',
  });
  try {
    const inspectionModel = createTraversalInspectionModel(context.runtimeInstanceId);
    const simulation = createTraversalSimulation((event) => inspectionModel.record(event));
    const session = createEngineSession<TraversalInput>({
      sessionId: createSessionId(),
      worldId: TRAVERSAL_WORLD_ID,
      runtimeInstanceId: context.runtimeInstanceId,
      systems: [Object.freeze({
        id: 'traversal-simulation',
        run(step) { simulation.update(step.fixedDeltaSeconds, step.input); },
      })],
      captureInput(input) {
        if (!Number.isFinite(input.horizontal)) return null;
        return Object.freeze({
          horizontal: Math.max(-1, Math.min(1, input.horizontal)),
          active: input.active === true,
          jump: input.jump === true,
        });
      },
      getStateDigest: () => simulation.digest(),
    });

    const platformBodies = createSurfaceBatch(renderer, createCube(), 24);
    const islandUndersides = createSurfaceBatch(
      renderer,
      createCone({ radius: 1, height: 2, radialSegments: 18 }),
      24,
    );
    const runner = createSurfaceBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 24, heightSegments: 16 }),
      8,
    );
    const hazards = createSurfaceBatch(
      renderer,
      createCone({ radius: 1, height: 2, radialSegments: 20 }),
      9,
    );
    const skyline = createSurfaceBatch(renderer, createCube(), 36);
    const atmosphere = createSurfaceBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 20, heightSegments: 14 }),
      24,
    );
    const gates = createGlowBatch(
      renderer,
      createTorus({ radius: 1, tube: 0.035, radialSegments: 10, tubularSegments: 96 }),
      12,
    );
    const trail = createGlowBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 10, heightSegments: 7 }),
      72,
    );
    const programs = [
      platformBodies.program,
      islandUndersides.program,
      runner.program,
      hazards.program,
      skyline.program,
      atmosphere.program,
      gates.program,
      trail.program,
    ];
    const cameraPosition = new Float32Array(3);
    const camera = createCamera({ position: [0, 4.8, 12.5], fovY: Math.PI / 3.6, near: 0.1, far: 80 });

    context.report({
      instances: 229,
      drawCalls: programs.length,
      uploadBytesPerFrame: 14_908,
      note: 'Framework fixed-step traversal with moving platforms and layered BroMetal scenery',
    });

    const render = (state: TraversalSnapshot): void => {
      const platforms = platformInstancesNear(state.player.x, state.time);
      platformBodies.clear();
      islandUndersides.clear();
      platforms.forEach((platform, index) => {
        const color = PLATFORM_COLORS[platform.definition.accent]!;
        const moving = platform.definition.amplitude > 0 ? 1 : 0;
        platformBodies.set(
          index,
          [platform.x, platform.top - 0.3, 0],
          [platform.definition.width, 0.58, 2.75],
          color,
          [0.16 + moving * 0.46, moving * 0.18, 0],
        );
        islandUndersides.set(
          index,
          [platform.x, platform.top - 1.28, 0],
          [platform.definition.width * 0.43, 1.2 + platform.definition.width * 0.12, 1.1],
          [color[0] * 0.36, color[1] * 0.36, color[2] * 0.42],
          [0.05, 0, Math.PI],
        );
      });
      platformBodies.upload();
      islandUndersides.upload();

      const gait = Math.sin(state.time * (8 + Math.abs(state.player.vx) * 1.1));
      const squash = state.player.squash;
      const facing = state.player.facing;
      runner.clear();
      runner.set(
        0,
        [state.player.x, state.player.y + 0.1, 0.06],
        [0.46 + squash * 0.14, 0.58 - squash * 0.14, 0.34],
        [0.04, 0.72, 0.78],
        [0.34, 0, 0],
      );
      runner.set(
        1,
        [state.player.x + facing * 0.28, state.player.y + 0.42, 0.03],
        [0.34, 0.34, 0.31],
        [1.05, 0.78, 0.48],
        [0.12, 0, 0],
      );
      runner.set(
        2,
        [state.player.x + facing * 0.43, state.player.y + 0.46, 0.3],
        [0.075, 0.075, 0.055],
        [0.01, 0.025, 0.07],
        [0, 0, 0],
      );
      runner.set(
        3,
        [state.player.x - 0.19, state.player.y - 0.35 + gait * 0.08, 0.04],
        [0.18, 0.12, 0.25],
        CORAL,
        [0.18, 0, gait * 0.3],
      );
      runner.set(
        4,
        [state.player.x + 0.19, state.player.y - 0.35 - gait * 0.08, 0.04],
        [0.18, 0.12, 0.25],
        CORAL,
        [0.18, 0, -gait * 0.3],
      );
      runner.set(
        5,
        [state.player.x + facing * 0.15, state.player.y + 0.72, -0.03],
        [0.12, 0.26, 0.12],
        GOLD,
        [0.24, 0, -0.25],
      );
      runner.set(
        6,
        [state.player.x + facing * 0.38, state.player.y + 0.68, -0.03],
        [0.12, 0.24, 0.12],
        GOLD,
        [0.24, 0, 0.25],
      );
      runner.set(
        7,
        [state.player.x - facing * 0.38, state.player.y + 0.08, -0.04],
        [0.28, 0.17, 0.17],
        VIOLET,
        [0.4, 0, -facing * 0.5 + gait * 0.18],
      );
      runner.upload();

      hazards.clear();
      let hazardIndex = 0;
      const currentLap = Math.floor(state.player.x / COURSE_LENGTH);
      for (let lapOffset = -1; lapOffset <= 1; lapOffset += 1) {
        COURSE_HAZARDS.forEach((hazard, index) => {
          hazards.set(
            hazardIndex,
            [hazard.x + (currentLap + lapOffset) * COURSE_LENGTH, hazard.top + 0.34, 0.05],
            [0.3, 0.68 + index * 0.08, 0.48],
            index % 2 === 0 ? CORAL : VIOLET,
            [0.7, 0, 0],
          );
          hazardIndex += 1;
        });
      }
      hazards.upload();

      skyline.clear();
      const skylineAnchor = Math.floor(state.player.x / 12) * 12;
      for (let index = 0; index < 36; index += 1) {
        const row = index % 2;
        const x = skylineAnchor + (index - 18) * 2.2 + row * 0.8;
        const height = 1.2 + stableNoise(index + Math.floor(skylineAnchor), 3) * 5.8;
        const depth = -5.5 - row * 3.2 - stableNoise(index, 5) * 1.8;
        skyline.set(
          index,
          [x, -1.7 + height * 0.5, depth],
          [1.2 + stableNoise(index, 8) * 0.9, height, 1.1],
          row === 0 ? [0.035, 0.13, 0.3] : [0.13, 0.045, 0.28],
          [0.04 + (index % 5 === 0 ? 0.18 : 0), 0, 0],
        );
      }
      skyline.upload();

      atmosphere.clear();
      atmosphere.set(
        0,
        [state.player.x + 8.5, 6.8, -14],
        [2.25, 2.25, 1.2],
        [1.7, 0.64, 0.13],
        [1.8, 0, 0],
      );
      for (let index = 1; index < 24; index += 1) {
        const band = index % 3;
        const x = skylineAnchor + (index - 12) * 4.1 + Math.sin(index * 2.7) * 1.6;
        const y = 3.8 + band * 1.1 + Math.sin(index * 1.9) * 0.45;
        atmosphere.set(
          index,
          [x, y, -8.5 - band * 1.8],
          [1.7 + band * 0.65, 0.34 + band * 0.08, 0.7],
          band === 1 ? [0.18, 0.28, 0.58] : [0.12, 0.38, 0.62],
          [0.14, 0, 0],
        );
      }
      atmosphere.upload();

      gates.clear();
      const gateAnchor = Math.floor(state.player.x / 18) * 18;
      for (let index = 0; index < 10; index += 1) {
        const x = gateAnchor + (index - 3) * 18;
        gates.set(
          index,
          [x, 2.5 + Math.sin(index * 1.7) * 0.3, 0.15],
          [1.28, 1.28, 1],
          index % 2 === 0 ? AQUA : GOLD,
          0.28,
          state.time * 0.18 * (index % 2 === 0 ? 1 : -1),
          index,
        );
      }
      gates.set(
        10,
        [state.player.x, state.player.y + 0.02, -0.08],
        [0.62 + squash * 0.22, 0.62 + squash * 0.22, 1],
        AQUA,
        0.32 + Math.min(0.4, Math.abs(state.player.vy) * 0.04),
        0,
        state.time,
      );
      gates.set(
        11,
        [state.player.x - facing * 0.72, state.player.y + 0.06, -0.1],
        [0.34, 0.34, 1],
        CORAL,
        Math.min(0.5, Math.abs(state.player.vx) * 0.07),
        0,
        state.time + 2,
      );
      gates.upload();

      trail.clear();
      state.trail.forEach((particle, index) => {
        const life = Math.max(0, particle.life);
        const color = particle.color === 0 ? AQUA : particle.color === 1 ? GOLD : CORAL;
        const scale = (0.035 + life * 0.13) * Math.min(1, life * 4);
        trail.set(
          index,
          [particle.x, particle.y, 0.08],
          [scale, scale, scale],
          color,
          Math.min(1, life * 2.8),
          0,
          index * 0.31,
        );
      });
      trail.upload();

      const mobile = renderer.aspect < 0.9;
      cameraPosition[0] = state.player.x + (mobile ? 2.2 : 3.7);
      cameraPosition[1] = (mobile ? 6.2 : 4.9) + (context.pointer.y - 0.5) * 0.5;
      cameraPosition[2] = mobile ? 16.5 : 12.6;
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(
        state.player.x + (mobile ? 0.4 : 1.8),
        Math.max(1.1, state.player.y * 0.34 + 0.9),
        -0.8,
      );
      const viewProjection = camera.viewProjection(renderer.aspect);
      programs.forEach((program) => {
        program.uniforms.uViewProj.set(viewProjection);
        program.uniforms.uCameraPosition.set(cameraPosition);
        program.uniforms.uTime.set(state.time);
      });

      renderer.present(() => {
        skyline.program.draw();
        atmosphere.program.draw();
        islandUndersides.program.draw();
        platformBodies.program.draw();
        hazards.program.draw();
        gates.program.draw();
        runner.program.draw();
        trail.program.draw();
      });
    };

    let previousPlatformTime: number | null = null;
    let disposed = false;
    const semanticInput = (): TraversalInput => captureInput(context);
    const inspection: GameInspectionPort = Object.freeze({
      snapshot(state) {
        const base = createGameInspectionSnapshot(state, { session: session.readStatus() });
        const snapshot = simulation.read();
        return createInspectionSnapshot({
          ...base,
          world: inspectionModel.world(snapshot),
          events: inspectionModel.events(),
        });
      },
      pauseSimulation() {
        const result = session.pause('tool');
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      resumeSimulation() {
        const result = session.resume('tool');
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      stepSimulation(expectedCompletedStepCount) {
        const result = session.step(expectedCompletedStepCount, semanticInput());
        render(simulation.view());
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        const elapsed = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
          ? 0
          : platformTimeSeconds - previousPlatformTime;
        previousPlatformTime = platformTimeSeconds;
        session.advance(elapsed, semanticInput());
        render(simulation.view());
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          session.dispose();
          platformBodies.dispose();
          islandUndersides.dispose();
          runner.dispose();
          hazards.dispose();
          skyline.dispose();
          atmosphere.dispose();
          gates.dispose();
          trail.dispose();
        } finally {
          renderer.destroy();
        }
      },
    });
  } catch (cause: unknown) {
    renderer.destroy();
    throw cause;
  }
};

export default game;
