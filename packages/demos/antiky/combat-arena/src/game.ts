import {
  createCamera,
  createCube,
  createCylinder,
  createProgram,
  createRenderer,
  createSphere,
  createTorus,
  createTorusKnot,
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

import arenaGlowShader from './shaders/arena-glow.shader.gen';
import arenaSurfaceShader from './shaders/arena-surface.shader.gen';
import { COMBAT_WORLD_ID, createCombatInspectionModel } from './inspection.ts';
import {
  createCombatSimulation,
  type CombatInput,
  type CombatSnapshot,
} from './simulation.ts';

type Vec3 = readonly [number, number, number];

const CYAN: Vec3 = [0.08, 0.82, 1.35];
const BLUE: Vec3 = [0.16, 0.32, 1.2];
const PINK: Vec3 = [1.35, 0.08, 0.72];
const ORANGE: Vec3 = [1.5, 0.34, 0.04];
const VIOLET: Vec3 = [0.62, 0.16, 1.45];
const ENEMY_COLORS = [PINK, ORANGE, VIOLET] as const;

function horizontalGeometry(geometry: Geometry): Geometry {
  const positions = new Float32Array(geometry.positions);
  const normals = new Float32Array(geometry.normals);
  for (let index = 0; index < positions.length; index += 3) {
    const y = positions[index + 1]!;
    positions[index + 1] = -positions[index + 2]!;
    positions[index + 2] = y;
    const normalY = normals[index + 1]!;
    normals[index + 1] = -normals[index + 2]!;
    normals[index + 2] = normalY;
  }
  return Object.freeze({ ...geometry, positions, normals });
}

function createSurfaceBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, arenaSurfaceShader);
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      colors.fill(0);
      params.fill(0);
    },
    set(
      index: number,
      offset: Vec3,
      scale: Vec3,
      color: Vec3,
      material: Vec3,
    ): void {
      offsets.set(offset, index * 3);
      scales.set(scale, index * 3);
      colors.set(color, index * 3);
      params.set(material, index * 3);
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      program.instanceAttributes.iParams.set(params);
    },
    dispose(): void {
      program.dispose();
    },
  });
}

function createGlowBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, arenaGlowShader, { blend: 'additive' });
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
    dispose(): void {
      program.dispose();
    },
  });
}

function capturedInput(context: Parameters<GameModuleEntry>[0], state: CombatSnapshot): CombatInput {
  const movementX = context.movement.active && Number.isFinite(context.movement.x)
    ? context.movement.x
    : 0;
  const movementZ = context.movement.active && Number.isFinite(context.movement.z)
    ? context.movement.z
    : 0;
  let aimX = context.pointer.active && Number.isFinite(context.pointer.x)
    ? (context.pointer.x - 0.5) * 2
    : state.player.facingX;
  let aimZ = context.pointer.active && Number.isFinite(context.pointer.y)
    ? -(context.pointer.y - 0.5) * 2
    : state.player.facingZ;
  const aimLength = Math.hypot(aimX, aimZ);
  if (aimLength > 0.01) {
    aimX /= aimLength;
    aimZ /= aimLength;
  } else {
    aimX = state.player.facingX;
    aimZ = state.player.facingZ;
  }
  return Object.freeze({
    movement: Object.freeze({
      x: Math.max(-1, Math.min(1, movementX)),
      z: Math.max(-1, Math.min(1, movementZ)),
      active: Math.hypot(movementX, movementZ) > 0.01,
    }),
    aim: Object.freeze({ x: aimX, z: aimZ }),
    attack: context.pointer.clicked,
  });
}

const game: GameModuleEntry = async (context) => {
  const renderer = await createRenderer(context.canvas, {
    clearColor: [0.003, 0.005, 0.018, 1],
    cull: 'back',
  });
  try {
    const inspectionModel = createCombatInspectionModel(context.runtimeInstanceId);
    const simulation = createCombatSimulation((event) => inspectionModel.record(event));
    const session = createEngineSession<CombatInput>({
      sessionId: createSessionId(),
      worldId: COMBAT_WORLD_ID,
      runtimeInstanceId: context.runtimeInstanceId,
      systems: [Object.freeze({
        id: 'combat-simulation',
        run(step) {
          simulation.update(step.fixedDeltaSeconds, step.input);
        },
      })],
      captureInput(input) {
        if (
          !Number.isFinite(input.movement.x)
          || !Number.isFinite(input.movement.z)
          || !Number.isFinite(input.aim.x)
          || !Number.isFinite(input.aim.z)
        ) return null;
        return Object.freeze({
          movement: Object.freeze({ ...input.movement }),
          aim: Object.freeze({ ...input.aim }),
          attack: input.attack === true,
        });
      },
      getStateDigest: () => simulation.digest(),
    });

    const floor = createSurfaceBatch(
      renderer,
      createCylinder({ radiusTop: 1, radiusBottom: 1.04, height: 1, radialSegments: 96 }),
      1,
    );
    floor.set(0, [0, -0.5, 0], [8.8, 0.34, 8.8], [0.045, 0.065, 0.13], [0.05, 0, 0]);
    floor.upload();

    const architecture = createSurfaceBatch(renderer, createCube(), 24);
    architecture.clear();
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const x = Math.cos(angle) * 8.4;
      const z = Math.sin(angle) * 8.4;
      architecture.set(
        index,
        [x, 0.2 + (index % 3) * 0.09, z],
        [0.32 + Math.abs(Math.sin(angle)) * 0.3, 0.62 + (index % 3) * 0.18, 0.32 + Math.abs(Math.cos(angle)) * 0.3],
        index % 2 === 0 ? [0.08, 0.18, 0.34] : [0.16, 0.07, 0.28],
        [0.22, 0, index % 2 === 0 ? 0.18 : -0.18],
      );
    }
    [
      [-7.65, 0.05, 0, 0.28, 0.16, 1.9],
      [7.65, 0.05, 0, 0.28, 0.16, 1.9],
      [0, 0.05, -7.65, 1.9, 0.16, 0.28],
      [0, 0.05, 7.65, 1.9, 0.16, 0.28],
    ].forEach(([x, y, z, sx, sy, sz], index) => {
      architecture.set(12 + index, [x!, y!, z!], [sx!, sy!, sz!], [0.08, 0.24, 0.42], [0.7, 0, 0]);
    });
    architecture.upload();

    const pylons = createSurfaceBatch(
      renderer,
      createCylinder({ radiusTop: 0.72, radiusBottom: 1, height: 1, radialSegments: 32 }),
      16,
    );
    pylons.clear();
    for (let index = 0; index < 16; index += 1) {
      const angle = index / 16 * Math.PI * 2;
      pylons.set(
        index,
        [Math.cos(angle) * 9.2, -0.05, Math.sin(angle) * 9.2],
        [0.22, 1.5 + (index % 4) * 0.3, 0.22],
        index % 2 === 0 ? CYAN : PINK,
        [0.95, 0, index % 2 === 0 ? 0.12 : -0.12],
      );
    }
    pylons.upload();

    const fighters = createSurfaceBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 32, heightSegments: 20 }),
      12,
    );
    const drones = createSurfaceBatch(
      renderer,
      createTorusKnot({ radius: 0.72, tube: 0.19, tubularSegments: 96, radialSegments: 14, p: 2, q: 3 }),
      9,
    );
    const glowSpheres = createGlowBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 14, heightSegments: 10 }),
      158,
    );
    const energyRings = createGlowBatch(
      renderer,
      horizontalGeometry(createTorus({ radius: 1, tube: 0.028, radialSegments: 10, tubularSegments: 128 })),
      14,
    );

    const cameraPosition = new Float32Array(3);
    const camera = createCamera({ position: [0, 12, 14], fovY: Math.PI / 3.8, near: 0.1, far: 60 });
    const allPrograms = [
      floor.program,
      architecture.program,
      pylons.program,
      fighters.program,
      drones.program,
      glowSpheres.program,
      energyRings.program,
    ];

    context.report({
      instances: 234,
      drawCalls: allPrograms.length,
      uploadBytesPerFrame: 14_724,
      note: 'Framework-owned fixed-step combat rendered as instanced BroMetal geometry',
    });

    const render = (state: CombatSnapshot): void => {
      fighters.clear();
      fighters.set(
        0,
        [state.player.x, 0.48, state.player.z],
        [0.62, 0.34, 0.78],
        [0.08, 0.5, 0.9],
        [0.9 + state.player.dash * 1.7, 0, -0.55],
      );
      fighters.set(
        1,
        [state.player.x, 0.53, state.player.z],
        [0.24, 0.2, 0.3],
        [0.78, 0.94, 1.4],
        [2.4, 0, 0.85],
      );
      state.enemies.forEach((enemy, index) => {
        const visible = enemy.respawn > 0 ? 0 : 1;
        fighters.set(
          index + 2,
          [enemy.x, 0.58, enemy.z],
          [0.28 * visible, 0.28 * visible, 0.28 * visible],
          ENEMY_COLORS[enemy.kind]!,
          [2.5, enemy.hit, 0.5 + index * 0.11],
        );
        drones.set(
          index,
          [enemy.x, 0.58, enemy.z],
          [0.68 * visible, 0.52 * visible, 0.68 * visible],
          ENEMY_COLORS[enemy.kind]!,
          [0.78, enemy.hit, (index % 2 === 0 ? 1 : -1) * (0.6 + enemy.kind * 0.18)],
        );
      });
      fighters.upload();
      drones.upload();

      glowSpheres.clear();
      let glowIndex = 0;
      state.projectiles.forEach((projectile, index) => {
        const visible = projectile.life > 0 ? 1 : 0;
        const rotation = -Math.atan2(projectile.vx, projectile.vz);
        glowSpheres.set(
          glowIndex,
          [projectile.x, 0.58, projectile.z],
          [0.12 * visible, 0.12 * visible, 0.42 * visible],
          CYAN,
          Math.min(1, projectile.life * 3) * visible,
          rotation,
          index * 0.37,
        );
        glowIndex += 1;
      });
      state.particles.forEach((particle, index) => {
        const visible = Math.max(0, particle.life);
        const color = particle.color === 0 ? CYAN : ENEMY_COLORS[(particle.color - 1) % 3]!;
        const scale = (0.04 + visible * 0.12) * Math.min(1, visible * 4);
        glowSpheres.set(
          glowIndex,
          [particle.x, particle.y, particle.z],
          [scale, scale, scale],
          color,
          Math.min(1, visible * 2.4),
          0,
          index * 0.19,
        );
        glowIndex += 1;
      });
      for (; glowIndex < 158; glowIndex += 1) {
        glowSpheres.set(glowIndex, [0, -20, 0], [0, 0, 0], CYAN, 0, 0, glowIndex);
      }
      glowSpheres.upload();

      energyRings.clear();
      energyRings.set(0, [0, -0.12, 0], [8.35, 8.35, 8.35], CYAN, 0.42, 0, 0);
      energyRings.set(1, [0, -0.08, 0], [7.72, 7.72, 7.72], PINK, 0.24, 0, 1.1);
      energyRings.set(2, [0, -0.04, 0], [5.25, 5.25, 5.25], BLUE, 0.16, 0, 2.2);
      energyRings.set(
        3,
        [state.player.x, 0.08, state.player.z],
        [0.75 + state.player.dash * 1.5, 0.75 + state.player.dash * 1.5, 0.75 + state.player.dash * 1.5],
        CYAN,
        0.58 + state.player.dash * 0.42,
        0,
        state.time,
      );
      state.enemies.forEach((enemy, index) => {
        const visible = enemy.respawn > 0 ? 0 : 1;
        energyRings.set(
          index + 4,
          [enemy.x, 0.12, enemy.z],
          [0.68 * visible, 0.68 * visible, 0.68 * visible],
          ENEMY_COLORS[enemy.kind]!,
          (0.14 + enemy.hit * 0.7) * visible,
          0,
          enemy.phase,
        );
      });
      energyRings.set(13, [0, 0.02, 0], [2.6, 2.6, 2.6], VIOLET, 0.12, 0, 4.4);
      energyRings.upload();

      const hitEnergy = state.enemies.reduce((total, enemy) => total + enemy.hit, 0);
      const mobile = renderer.aspect < 0.9;
      const cameraY = mobile ? 16 : 12.2;
      const cameraZ = mobile ? 17.5 : 14.2;
      const driftX = (context.pointer.x - 0.5) * (mobile ? 1 : 2.1);
      const shake = Math.sin(state.time * 42) * Math.min(0.16, hitEnergy * 0.025);
      cameraPosition[0] = state.player.x * 0.12 + driftX + shake;
      cameraPosition[1] = cameraY;
      cameraPosition[2] = cameraZ + state.player.z * 0.08;
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(state.player.x * 0.18, 0, state.player.z * 0.18 - 0.7);
      const viewProjection = camera.viewProjection(renderer.aspect);
      allPrograms.forEach((program) => {
        program.uniforms.uViewProj.set(viewProjection);
        program.uniforms.uCameraPosition.set(cameraPosition);
        program.uniforms.uTime.set(state.time);
      });

      renderer.present(() => {
        floor.program.draw();
        architecture.program.draw();
        pylons.program.draw();
        fighters.program.draw();
        drones.program.draw();
        energyRings.program.draw();
        glowSpheres.program.draw();
      });
    };

    let previousPlatformTime: number | null = null;
    let disposed = false;
    const semanticInput = (): CombatInput => capturedInput(context, simulation.view());
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
          floor.dispose();
          architecture.dispose();
          pylons.dispose();
          fighters.dispose();
          drones.dispose();
          glowSpheres.dispose();
          energyRings.dispose();
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
