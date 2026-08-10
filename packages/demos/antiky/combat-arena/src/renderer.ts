import {
  createCamera,
  createCube,
  createCylinder,
  createRenderer,
  createSphere,
  createTorus,
} from 'brometal';

import { CATALOG_ASSET_COUNT, createArenaCatalogResources } from './arena-assets.ts';
import { setCombatSignals } from './arena-signals.ts';
import { combatCameraFrame } from './presentation.ts';
import {
  createGlowBatch,
  createSurfaceBatch,
  horizontalGeometry,
  type Vec3,
} from './render-batches.ts';
import {
  ENEMY_COUNT,
  PARTICLE_CAPACITY,
  PROJECTILE_CAPACITY,
  type CombatEnemy,
  type CombatSnapshot,
  type EnemyRole,
} from './simulation.ts';

const CYAN: Vec3 = [0.08, 0.72, 0.92];
const CYAN_DARK: Vec3 = [0.035, 0.28, 0.36];
const WHITE: Vec3 = [0.82, 0.9, 1];
const WARM: Vec3 = [1, 0.24, 0.07];
const AMBER: Vec3 = [0.95, 0.54, 0.1];
const STEEL: Vec3 = [0.26, 0.29, 0.34];
const SHADOW: Vec3 = [0.006, 0.008, 0.012];

const CAPACITY = Object.freeze({
  room: 1,
  floor: 9,
  cables: 8,
  targets: ENEMY_COUNT,
  grenades: 12,
  fighters: ENEMY_COUNT + 2,
  shadows: ENEMY_COUNT + 1,
  gauges: 36,
  glows: PROJECTILE_CAPACITY + PARTICLE_CAPACITY + 20,
  rings: 28,
});

export type CombatRendererMeasurements = Readonly<{
  instances: number;
  drawCalls: number;
  uploadBytesPerFrame: number;
  catalogAssets: number;
  particlePacking: 'active-prefix';
}>;

export type CombatRenderer = Readonly<{
  measurements: CombatRendererMeasurements;
  render(state: CombatSnapshot, pointer: Readonly<{ x: number; y: number }>): void;
  dispose(): void;
}>;

export function deriveCombatRendererMeasurements(): CombatRendererMeasurements {
  const instances = Object.values(CAPACITY).reduce((total, capacity) => total + capacity, 0);
  const dynamicSurfaceInstances = CAPACITY.fighters + CAPACITY.shadows + CAPACITY.gauges;
  const dynamicGlowInstances = CAPACITY.glows + CAPACITY.rings;
  const dynamicModelInstances = CAPACITY.targets + CAPACITY.grenades;
  const floatsPerInstance = 12;
  return Object.freeze({
    instances,
    drawCalls: Object.keys(CAPACITY).length,
    uploadBytesPerFrame:
      (dynamicSurfaceInstances + dynamicGlowInstances + dynamicModelInstances)
      * floatsPerInstance
      * Float32Array.BYTES_PER_ELEMENT,
    catalogAssets: CATALOG_ASSET_COUNT,
    particlePacking: 'active-prefix',
  });
}

function roleColor(role: EnemyRole): Vec3 {
  if (role === 'rusher') return WARM;
  if (role === 'gunner') return AMBER;
  if (role === 'shield-anchor') return [0.72, 0.31, 0.16];
  return WHITE;
}

function roleScale(enemy: Readonly<CombatEnemy>): number {
  if (enemy.role === 'rusher') return 2.4;
  if (enemy.role === 'gunner') return 2.85;
  if (enemy.role === 'shield-anchor') return 3.65;
  return 5.15;
}

function facingAngle(enemy: Readonly<CombatEnemy>, player: CombatSnapshot['player']): number {
  return -Math.atan2(player.x - enemy.x, player.z - enemy.z);
}

export async function createCombatRenderer(canvas: HTMLCanvasElement): Promise<CombatRenderer> {
  const renderer = await createRenderer(canvas, {
    clearColor: [0.005, 0.007, 0.011, 1],
    cull: 'back',
  });
  const disposables: { dispose(): void }[] = [];
  try {
    const catalog = await createArenaCatalogResources(renderer, CAPACITY);
    const { room, floorTiles, cables, targets, grenades } = catalog;
    disposables.push(catalog);

    const fighters = createSurfaceBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 28, heightSegments: 18 }),
      CAPACITY.fighters,
    );
    const shadows = createSurfaceBatch(
      renderer,
      createCylinder({ radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: 36 }),
      CAPACITY.shadows,
    );
    const gauges = createSurfaceBatch(renderer, createCube(), CAPACITY.gauges);
    const glows = createGlowBatch(
      renderer,
      createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }),
      CAPACITY.glows,
    );
    const rings = createGlowBatch(
      renderer,
      horizontalGeometry(createTorus({ radius: 1, tube: 0.035, radialSegments: 10, tubularSegments: 96 })),
      CAPACITY.rings,
    );
    disposables.push(fighters, shadows, gauges, glows, rings);

    const cameraPosition = new Float32Array(3);
    const camera = createCamera({
      position: [0, 13.4, 14.8],
      fovY: Math.PI / 3.85,
      near: 0.1,
      far: 60,
    });
    const measurements = deriveCombatRendererMeasurements();
    let disposed = false;

    const render = (state: CombatSnapshot, pointer: Readonly<{ x: number; y: number }>): void => {
      if (disposed) return;
      const playerVisible = state.phase === 'defeat' ? 0.32 : 1;
      fighters.clear();
      fighters.set(
        0,
        [state.player.x, 0.4, state.player.z],
        [0.58 * playerVisible, 0.24 * playerVisible, 0.76 * playerVisible],
        CYAN,
        [0.5 + state.player.dash * 2.2, state.player.invulnerable > 0 ? 0.18 : 0, -Math.atan2(state.player.facingX, state.player.facingZ)],
      );
      fighters.set(
        1,
        [state.player.x, 0.44, state.player.z],
        [0.2 * playerVisible, 0.16 * playerVisible, 0.24 * playerVisible],
        WHITE,
        [0.68, 0, 0],
      );
      state.enemies.forEach((enemy, index) => {
        const visible = enemy.active ? 1 : 0;
        const scale = enemy.role === 'warden' ? 0.72 : enemy.role === 'shield-anchor' ? 0.56 : 0.42;
        fighters.set(
          index + 2,
          [enemy.x, 0.42, enemy.z],
          [scale * visible, scale * 0.62 * visible, scale * visible],
          roleColor(enemy.role),
          [enemy.state === 'attack' ? 0.42 : 0.08, enemy.hit, facingAngle(enemy, state.player)],
        );
      });
      fighters.upload();

      shadows.clear();
      shadows.set(0, [state.player.x, -0.145, state.player.z], [0.68, 0.025, 0.68], SHADOW, [0, 0, 0]);
      state.enemies.forEach((enemy, index) => {
        const visible = enemy.active ? 1 : 0;
        const size = enemy.role === 'warden' ? 1.2 : enemy.role === 'shield-anchor' ? 0.88 : 0.7;
        shadows.set(index + 1, [enemy.x, -0.14, enemy.z], [size * visible, 0.02, size * visible], SHADOW, [0, 0, 0]);
      });
      shadows.upload();

      targets.clear();
      state.enemies.forEach((enemy, index) => {
        const visible = enemy.active ? 1 : 0;
        const scale = roleScale(enemy) * visible;
        const stateDim = enemy.state === 'recovery' ? 0.58 : enemy.state === 'telegraph' ? 1 : 0.82;
        targets.set(
          index,
          [enemy.x, 0.22, enemy.z],
          [scale, scale, scale],
          roleColor(enemy.role).map((value) => value * stateDim) as unknown as Vec3,
          [enemy.mark > 0 ? 0.5 : 0.08, enemy.hit, facingAngle(enemy, state.player)],
        );
      });
      targets.upload();

      grenades.clear();
      let grenadeIndex = 0;
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2 + Math.PI / 8;
        grenades.set(
          grenadeIndex,
          [Math.cos(angle) * 7.1, -0.11, Math.sin(angle) * 7.1],
          [2.1, 2.1, 2.1],
          [0.35, 0.29, 0.24],
          [0.02, 0, angle],
        );
        grenadeIndex += 1;
      }
      state.enemies.forEach((enemy) => {
        if (!enemy.active || (enemy.role !== 'gunner' && enemy.role !== 'shield-anchor' && enemy.role !== 'warden')) return;
        const scale = enemy.role === 'warden' ? 4 : 2.6;
        grenades.set(
          grenadeIndex,
          [enemy.x, enemy.role === 'warden' ? 1.05 : 0.72, enemy.z],
          [scale, scale, scale],
          roleColor(enemy.role),
          [0.18, enemy.hit, state.time * 0.7 + grenadeIndex],
        );
        grenadeIndex += 1;
      });
      grenades.upload();

      gauges.clear();
      let gaugeIndex = 0;
      for (let index = 0; index < state.player.maxHull; index += 1) {
        const active = index < state.player.hull;
        gauges.set(
          gaugeIndex,
          [-5.4 + index * 0.48, 0.15, -6.78],
          [0.35, 0.12, 0.24],
          active ? CYAN : [0.055, 0.065, 0.075],
          [active ? 0.28 : 0, 0, 0],
        );
        gaugeIndex += 1;
      }
      const driveSegments = 10;
      for (let index = 0; index < driveSegments; index += 1) {
        const active = index < Math.ceil(state.player.drive / state.player.maxDrive * driveSegments);
        gauges.set(
          gaugeIndex,
          [2.15 + index * 0.34, 0.13, -6.78],
          [0.25, 0.08, 0.13],
          active ? CYAN : [0.04, 0.05, 0.06],
          [active ? 0.2 : 0, 0, 0],
        );
        gaugeIndex += 1;
      }
      for (let index = 0; index < state.maxRounds; index += 1) {
        const complete = index + 1 < state.round || state.phase === 'victory';
        const current = index + 1 === state.round;
        gauges.set(
          gaugeIndex,
          [-0.44 + index * 0.44, 0.16, -7.08],
          [0.28, 0.1, 0.2],
          complete ? WHITE : current ? AMBER : [0.05, 0.06, 0.07],
          [complete || current ? 0.24 : 0, 0, 0],
        );
        gaugeIndex += 1;
      }
      const boss = state.enemies.find((enemy) => enemy.active && enemy.role === 'warden');
      for (let index = 0; index < 12; index += 1) {
        const active = boss !== undefined && index < Math.ceil(boss.hull / boss.maxHull * 12);
        const visible = boss === undefined ? 0 : 1;
        gauges.set(
          gaugeIndex,
          [-2.75 + index * 0.5, 0.12, -6.35],
          [0.39 * visible, 0.075 * visible, 0.12 * visible],
          active ? WARM : [0.06, 0.035, 0.025],
          [active ? 0.22 : 0, 0, 0],
        );
        gaugeIndex += 1;
      }
      glows.clear();
      let glowIndex = 0;
      state.projectiles.forEach((projectile, index) => {
        if (projectile.life <= 0) return;
        const color = projectile.kind === 'hostile' ? WARM : projectile.kind === 'deflected' ? WHITE : CYAN;
        const rotation = -Math.atan2(projectile.vx, projectile.vz);
        glows.set(
          glowIndex,
          [projectile.x, 0.48, projectile.z],
          [0.09, 0.09, projectile.kind === 'hostile' ? 0.34 : 0.25],
          color,
          projectile.kind === 'hostile' ? 0.82 : 0.62,
          rotation,
          index * 0.31,
        );
        glowIndex += 1;
      });
      state.particles.forEach((particle, index) => {
        if (particle.life <= 0) return;
        const color = particle.color === 0
          ? CYAN
          : particle.color === 5
            ? WARM
            : particle.color === 4
              ? WHITE
              : AMBER;
        const scale = (0.035 + particle.life * 0.1) * Math.min(1, particle.life * 5);
        glows.set(
          glowIndex,
          [particle.x, particle.y, particle.z],
          [scale, scale, scale],
          color,
          Math.min(0.72, particle.life * 2),
          0,
          index * 0.19,
        );
        glowIndex += 1;
      });
      if (state.player.dash > 0) {
        const speed = Math.hypot(state.player.vx, state.player.vz);
        glows.set(
          glowIndex,
          [
            state.player.x - state.player.facingX * 0.5,
            0.38,
            state.player.z - state.player.facingZ * 0.5,
          ],
          [0.11, 0.07, Math.min(1.8, 0.48 + speed * 0.045)],
          WHITE,
          0.72,
          -Math.atan2(state.player.facingX, state.player.facingZ),
          state.time,
        );
        glowIndex += 1;
      }
      state.enemies.forEach((enemy, index) => {
        if (!enemy.active || enemy.state !== 'telegraph') return;
        const dx = state.player.x - enemy.x;
        const dz = state.player.z - enemy.z;
        const distance = Math.hypot(dx, dz);
        const [directionX, directionZ] = distance > 0.001 ? [dx / distance, dz / distance] : [0, -1];
        glows.set(
          glowIndex,
          [enemy.x + directionX * distance * 0.45, 0.1, enemy.z + directionZ * distance * 0.45],
          [0.045, 0.025, Math.max(0.2, distance * 0.42)],
          WARM,
          enemy.role === 'rusher' || enemy.role === 'warden' ? 0.42 : 0.18,
          -Math.atan2(directionX, directionZ),
          index * 0.8,
        );
        glowIndex += 1;
      });
      glows.upload();

      rings.clear();
      rings.set(0, [0, -0.11, 0], [7.72, 7.72, 7.72], CYAN_DARK, 0.28, 0, 0);
      rings.set(1, [0, -0.09, 0], [6.82, 6.82, 6.82], STEEL, 0.16, 0, 1.1);
      const phaseColor = state.phase === 'defeat'
        ? WARM
        : state.phase === 'clear' || state.phase === 'victory'
          ? WHITE
          : CYAN;
      const phaseAlpha = state.phase === 'combat' ? 0.08 : state.phase === 'intro' ? 0.34 : 0.52;
      rings.set(2, [0, 0.01, 0], [2.25, 2.25, 2.25], phaseColor, phaseAlpha, 0, state.time);
      rings.set(
        3,
        [state.player.x, 0.02, state.player.z],
        [0.64 + state.player.dash * 3.8, 0.64 + state.player.dash * 3.8, 0.64 + state.player.dash * 3.8],
        state.player.invulnerable > 0 ? WHITE : CYAN,
        0.26 + state.player.dash * 1.8,
        0,
        state.time,
      );
      let ringIndex = 4;
      state.enemies.forEach((enemy, index) => {
        if (!enemy.active) return;
        const telegraph = enemy.state === 'telegraph';
        const attacking = enemy.state === 'attack';
        const recovering = enemy.state === 'recovery';
        const size = enemy.role === 'warden' ? 1.2 : enemy.role === 'shield-anchor' ? 0.86 : 0.68;
        rings.set(
          ringIndex,
          [enemy.x, 0.025, enemy.z],
          [size, size, size],
          attacking ? WHITE : roleColor(enemy.role),
          telegraph ? 0.76 : attacking ? 0.64 : recovering ? 0.08 : 0.15,
          0,
          enemy.phase,
        );
        ringIndex += 1;
        if (enemy.mark > 0) {
          rings.set(
            ringIndex,
            [enemy.x, 0.04, enemy.z],
            [size * 1.26, size * 1.26, size * 1.26],
            CYAN,
            Math.min(0.7, 0.28 + enemy.mark * 0.1),
            0,
            enemy.phase + 1.7,
          );
          ringIndex += 1;
        }
        if (enemy.shield > 0) {
          rings.set(
            ringIndex,
            [enemy.x, 0.06, enemy.z],
            [size * 1.52, size * 1.52, size * 1.52],
            WHITE,
            0.34,
            0,
            index,
          );
          ringIndex += 1;
        }
      });
      setCombatSignals(gauges, rings, state);
      gauges.upload();
      rings.upload();

      const cameraFrame = combatCameraFrame(renderer.aspect, state, pointer);
      cameraPosition.set(cameraFrame.position);
      camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
      camera.lookAt(...cameraFrame.target);
      const viewProjection = camera.viewProjection(renderer.aspect);
      catalog.frame(viewProjection, cameraPosition);
      [fighters, shadows, gauges, glows, rings].forEach((batch) => batch.frame(viewProjection, cameraPosition, state.time));

      renderer.present(() => {
        room.program.draw();
        floorTiles.program.draw();
        cables.program.draw();
        shadows.program.draw();
        grenades.program.draw();
        targets.program.draw();
        fighters.program.draw();
        gauges.program.draw();
        rings.program.draw();
        glows.program.draw();
      });
    };

    return Object.freeze({
      measurements,
      render,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        disposables.reverse().forEach((disposable) => disposable.dispose());
        renderer.destroy();
      },
    });
  } catch (cause: unknown) {
    disposables.reverse().forEach((disposable) => disposable.dispose());
    renderer.destroy();
    throw cause;
  }
}
