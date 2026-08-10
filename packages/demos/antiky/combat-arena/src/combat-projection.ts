import { createCube, createSphere, createTorus, type Renderer } from 'brometal';

import { ARENA_STRUCTURE_INSTANCES, setArenaEnergy, setArenaStructure } from './arena-environment.ts';
import { setCombatSignals } from './arena-signals.ts';
import { COMBAT_PALETTE, enemyVisualProfile } from './combat-visuals.ts';
import {
  createGlowBatch,
  createSurfaceBatch,
  horizontalGeometry,
  type GlowBatch,
  type Vec3,
} from './render-batches.ts';
import { disposeResources, registerResource, rollbackResources } from './resource-lifetime.ts';
import { ENEMY_COUNT, type CombatEnemy, type CombatSnapshot, type EnemyRole } from './combat-state.ts';

const SURFACE_CAPACITY = 68;
const GLOW_CAPACITY = 173;
const RING_CAPACITY = 40;
const SHADOW_START = ARENA_STRUCTURE_INSTANCES;
const GAUGE_START = SHADOW_START + ENEMY_COUNT + 1;
const SIGNAL_GAUGE_START = GAUGE_START + 28;
const SIGNAL_RING_START = 24;
const SIGNAL_OFFSETS = Object.freeze({ gauge: SIGNAL_GAUGE_START, ring: SIGNAL_RING_START });
const ANCHOR_COLOR: Vec3 = [0.72, 0.31, 0.16];
export const COMBAT_READABILITY_PROFILE = Object.freeze({
  markedScale: 1.38,
  markedMinimumAlpha: 0.7,
  hudZ: 5.95,
  hullSegmentWidth: 0.47,
  driveSegmentWidth: 0.3,
  playerRingRadius: 0.95,
  wardenRingRadius: 2.6,
});

export const COMBAT_PROJECTION_CAPACITY = Object.freeze({
  surfaces: SURFACE_CAPACITY,
  glows: GLOW_CAPACITY,
  rings: RING_CAPACITY,
});

function roleColor(role: EnemyRole): Vec3 {
  if (role === 'rusher') return COMBAT_PALETTE.warm;
  if (role === 'gunner') return COMBAT_PALETTE.amber;
  if (role === 'shield-anchor') return ANCHOR_COLOR;
  return COMBAT_PALETTE.white;
}

function shadowSize(enemy: Readonly<CombatEnemy>): number {
  if (enemy.role === 'warden') return 3.25;
  if (enemy.role === 'shield-anchor') return 1.45;
  if (enemy.role === 'gunner') return 1.22;
  return 1.05;
}

function setGauges(surfaces: ReturnType<typeof createSurfaceBatch>, state: CombatSnapshot): void {
  let index = GAUGE_START;
  for (let hull = 0; hull < state.player.maxHull; hull += 1) {
    const active = hull < state.player.hull;
    const color = active ? COMBAT_PALETTE.cyan : COMBAT_PALETTE.steelDark;
    surfaces.setValues(index, -5.35 + hull * 0.59, 0.18, COMBAT_READABILITY_PROFILE.hudZ, COMBAT_READABILITY_PROFILE.hullSegmentWidth, 0.16, 0.31, color[0], color[1], color[2], active ? 0.58 : 0, 0, 0);
    index += 1;
  }
  for (let drive = 0; drive < 10; drive += 1) {
    const active = drive < Math.ceil(state.player.drive / state.player.maxDrive * 10);
    const color = active ? COMBAT_PALETTE.cyan : COMBAT_PALETTE.steelDark;
    surfaces.setValues(index, 1.78 + drive * 0.39, 0.15, COMBAT_READABILITY_PROFILE.hudZ, COMBAT_READABILITY_PROFILE.driveSegmentWidth, 0.115, 0.19, color[0], color[1], color[2], active ? 0.5 : 0, 0, 0);
    index += 1;
  }
  for (let round = 0; round < state.maxRounds; round += 1) {
    const complete = round + 1 < state.round || state.phase === 'victory';
    const current = round + 1 === state.round;
    const color = complete ? COMBAT_PALETTE.white : current ? COMBAT_PALETTE.amber : COMBAT_PALETTE.steelDark;
    surfaces.setValues(index, -0.5 + round * 0.5, 0.16, 6.28, 0.32, 0.11, 0.22, color[0], color[1], color[2], complete || current ? 0.34 : 0, 0, 0);
    index += 1;
  }
  let boss: (typeof state.enemies)[number] | undefined;
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    if (enemy.active && enemy.role === 'warden') {
      boss = enemy;
      break;
    }
  }
  for (let segment = 0; segment < 12; segment += 1) {
    const active = boss !== undefined && segment < Math.ceil(boss.hull / boss.maxHull * 12);
    const visible = boss === undefined ? 0 : 1;
    const color = active ? COMBAT_PALETTE.warm : COMBAT_PALETTE.steelDark;
    surfaces.setValues(index, -2.75 + segment * 0.5, 0.12, -6.35, 0.39 * visible, 0.075 * visible, 0.12 * visible, color[0], color[1], color[2], active ? 0.22 : 0, 0, 0);
    index += 1;
  }
}

function pushGlow(
  glows: GlowBatch,
  index: number,
  offsetX: number, offsetY: number, offsetZ: number,
  scaleX: number, scaleY: number, scaleZ: number,
  color: Vec3,
  alpha: number,
  rotation: number,
  phase: number,
): number {
  if (index >= GLOW_CAPACITY) return index;
  glows.setValues(index, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, color[0], color[1], color[2], alpha, rotation, phase);
  return index + 1;
}

function setCombatGlows(glows: GlowBatch, state: CombatSnapshot): void {
  glows.clear();
  let index = 0;

  for (const projectile of state.projectiles) {
    if (projectile.life <= 0) continue;
    const color = projectile.kind === 'hostile' ? COMBAT_PALETTE.warm : projectile.kind === 'deflected' ? COMBAT_PALETTE.white : COMBAT_PALETTE.cyan;
    const rotation = -Math.atan2(projectile.vx, projectile.vz);
    const trail = projectile.kind === 'deflected' ? 0.78 : projectile.kind === 'hostile' ? 0.52 : 0.34;
    index = pushGlow(glows, index, projectile.x, 0.48, projectile.z, 0.095, 0.095, projectile.kind === 'hostile' ? 0.3 : 0.22, color, projectile.kind === 'hostile' ? 0.9 : 0.7, rotation, projectile.life);
    index = pushGlow(glows, index, (projectile.x + projectile.previousX) * 0.5, 0.42, (projectile.z + projectile.previousZ) * 0.5, 0.035, 0.025, trail, color, 0.42, rotation, projectile.life + 0.7);
  }

  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    if (!enemy.active) continue;
    const profile = enemyVisualProfile(enemy);
    if (enemy.hit > 0) {
      index = pushGlow(glows, index, enemy.x, 0.42, enemy.z, profile.width * 0.46, 0.12, profile.length * 0.42, COMBAT_PALETTE.white, Math.min(0.72, enemy.hit * 2.2), 0, enemyIndex);
    }
    if (enemy.state !== 'telegraph') continue;
    const dx = state.player.x - enemy.x;
    const dz = state.player.z - enemy.z;
    const distance = Math.max(0.001, Math.hypot(dx, dz));
    const directionX = dx / distance;
    const directionZ = dz / distance;
    const rotation = -Math.atan2(directionX, directionZ);
    const lanes = enemy.role === 'warden' ? 3 : enemy.role === 'shield-anchor' ? 2 : 1;
    for (let lane = 0; lane < lanes; lane += 1) {
      const lateral = (lane - (lanes - 1) / 2) * 0.3;
      index = pushGlow(glows, index, enemy.x + directionX * distance * 0.44 + directionZ * lateral, 0.1, enemy.z + directionZ * distance * 0.44 - directionX * lateral, 0.045, 0.025, distance * 0.42, COMBAT_PALETTE.warm, 0.5 + profile.emissive * 0.28, rotation, enemy.phase + lane * 0.4);
    }
    index = pushGlow(glows, index, enemy.x, 0.46, enemy.z, 0.12, 0.12, 0.32, COMBAT_PALETTE.white, 0.64, rotation, enemy.phase);
  }

  if (state.player.dash > 0) {
    const rotation = -Math.atan2(state.player.facingX, state.player.facingZ);
    const x = state.player.x - state.player.facingX * 0.62;
    const z = state.player.z - state.player.facingZ * 0.62;
    index = pushGlow(glows, index, x, 0.4, z, 0.12, 0.07, 2.15, COMBAT_PALETTE.white, 0.84, rotation, state.time);
    index = pushGlow(glows, index, x + state.player.facingZ * 0.14, 0.36, z - state.player.facingX * 0.14, 0.035, 0.035, 1.88, COMBAT_PALETTE.cyan, 0.66, rotation, state.time + 0.3);
    index = pushGlow(glows, index, x - state.player.facingZ * 0.14, 0.36, z + state.player.facingX * 0.14, 0.035, 0.035, 1.88, COMBAT_PALETTE.cyan, 0.66, rotation, state.time + 0.6);
  }

  index = setArenaEnergy(glows, index, state);
  for (let particleIndex = 0; particleIndex < state.particles.length && index < GLOW_CAPACITY; particleIndex += 1) {
    const particle = state.particles[particleIndex]!;
    if (particle.life <= 0) continue;
    const color = particle.color === 0 ? COMBAT_PALETTE.cyan : particle.color === 5 ? COMBAT_PALETTE.warm : particle.color === 4 ? COMBAT_PALETTE.white : COMBAT_PALETTE.amber;
    const speed = Math.hypot(particle.vx, particle.vz);
    const size = (0.035 + particle.life * 0.1) * Math.min(1, particle.life * 5);
    index = pushGlow(glows, index, particle.x, particle.y, particle.z, size, size, size + Math.min(0.34, speed * 0.014), color, Math.min(0.72, particle.life * 2), -Math.atan2(particle.vx, particle.vz), particleIndex * 0.19);
  }
  glows.upload();
}

function setCombatRings(rings: GlowBatch, state: CombatSnapshot): void {
  rings.clear();
  rings.setValues(0, 0, -0.11, 0, 7.72, 7.72, 7.72, COMBAT_PALETTE.cyanDeep[0], COMBAT_PALETTE.cyanDeep[1], COMBAT_PALETTE.cyanDeep[2], 0.28, 0, 0);
  rings.setValues(1, 0, -0.09, 0, 6.82, 6.82, 6.82, COMBAT_PALETTE.steel[0], COMBAT_PALETTE.steel[1], COMBAT_PALETTE.steel[2], 0.16, 0, 1.1);
  const phaseColor = state.phase === 'defeat' ? COMBAT_PALETTE.warm : state.phase === 'clear' || state.phase === 'victory' ? COMBAT_PALETTE.white : COMBAT_PALETTE.cyan;
  rings.setValues(2, 0, 0.01, 0, 2.25, 2.25, 2.25, phaseColor[0], phaseColor[1], phaseColor[2], state.phase === 'combat' ? 0.08 : state.phase === 'intro' ? 0.34 : 0.52, 0, state.time);
  const playerColor = state.player.invulnerable > 0 ? COMBAT_PALETTE.white : COMBAT_PALETTE.cyan;
  const playerRing = COMBAT_READABILITY_PROFILE.playerRingRadius + state.player.dash * 3.8;
  rings.setValues(3, state.player.x, 0.02, state.player.z, playerRing, playerRing, playerRing, playerColor[0], playerColor[1], playerColor[2], 0.26 + state.player.dash * 1.8, 0, state.time);
  let index = 4;
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    if (!enemy.active) continue;
    const size = enemy.role === 'warden'
      ? COMBAT_READABILITY_PROFILE.wardenRingRadius
      : enemy.role === 'shield-anchor'
        ? 1.35
        : enemy.role === 'gunner'
          ? 1.1
          : 0.95;
    const color = enemy.state === 'attack' ? COMBAT_PALETTE.white : roleColor(enemy.role);
    rings.setValues(index, enemy.x, 0.025, enemy.z, size, size, size, color[0], color[1], color[2], enemy.state === 'telegraph' ? 0.8 : enemy.state === 'attack' ? 0.66 : enemy.state === 'recovery' ? 0.07 : 0.15, 0, enemy.phase);
    index += 1;
    if (enemy.mark > 0) {
      const markedSize = size * COMBAT_READABILITY_PROFILE.markedScale;
      rings.setValues(index, enemy.x, 0.04, enemy.z, markedSize, markedSize, markedSize, COMBAT_PALETTE.cyan[0], COMBAT_PALETTE.cyan[1], COMBAT_PALETTE.cyan[2], Math.min(0.86, COMBAT_READABILITY_PROFILE.markedMinimumAlpha + enemy.mark * 0.06), 0, enemy.phase + 1.7);
      index += 1;
    }
    if (enemy.shield > 0) {
      const shieldSize = size * 1.55;
      rings.setValues(index, enemy.x, 0.06, enemy.z, shieldSize, shieldSize, shieldSize, COMBAT_PALETTE.white[0], COMBAT_PALETTE.white[1], COMBAT_PALETTE.white[2], 0.34, 0, enemyIndex);
      index += 1;
    }
  }
}

export type CombatProjection = Readonly<{
  project(state: CombatSnapshot): void;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void;
  drawSurface(): void;
  drawEnergy(): void;
  dispose(): void;
}>;

export type CombatProjectionDependencies = Readonly<{
  createSurfaceBatch: typeof createSurfaceBatch;
  createGlowBatch: typeof createGlowBatch;
}>;

const COMBAT_PROJECTION_DEPENDENCIES: CombatProjectionDependencies = Object.freeze({
  createSurfaceBatch,
  createGlowBatch,
});

export function createCombatProjection(
  renderer: Renderer,
  dependencies: CombatProjectionDependencies = COMBAT_PROJECTION_DEPENDENCIES,
): CombatProjection {
  const resources: { dispose(): void }[] = [];
  let surfaces: ReturnType<typeof createSurfaceBatch>;
  let glows: ReturnType<typeof createGlowBatch>;
  let rings: ReturnType<typeof createGlowBatch>;
  try {
    surfaces = registerResource(resources, dependencies.createSurfaceBatch(renderer, createCube(), SURFACE_CAPACITY));
    glows = registerResource(resources, dependencies.createGlowBatch(renderer, createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }), GLOW_CAPACITY));
    rings = registerResource(resources, dependencies.createGlowBatch(renderer, horizontalGeometry(createTorus({ radius: 1, tube: 0.035, radialSegments: 10, tubularSegments: 96 })), RING_CAPACITY));
  } catch (cause: unknown) {
    rollbackResources(resources);
    throw cause;
  }

  return Object.freeze({
    project(state): void {
      surfaces.clear();
      setArenaStructure(surfaces);
      const playerVisible = state.phase === 'defeat' ? 0.32 : 1;
      surfaces.setValues(SHADOW_START, state.player.x, -0.145, state.player.z, 0.72 * playerVisible, 0.025, 0.92 * playerVisible, COMBAT_PALETTE.shadow[0], COMBAT_PALETTE.shadow[1], COMBAT_PALETTE.shadow[2], 0, 0, -Math.atan2(state.player.facingX, state.player.facingZ));
      for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
        const enemy = state.enemies[enemyIndex]!;
        const visible = enemy.active ? 1 : 0;
        const size = shadowSize(enemy);
        surfaces.setValues(SHADOW_START + enemyIndex + 1, enemy.x, -0.14, enemy.z, size * visible, 0.02, size * 0.8 * visible, COMBAT_PALETTE.shadow[0], COMBAT_PALETTE.shadow[1], COMBAT_PALETTE.shadow[2], 0, 0, 0);
      }
      setGauges(surfaces, state);
      setCombatRings(rings, state);
      setCombatSignals(surfaces, rings, state, SIGNAL_OFFSETS);
      surfaces.upload();
      rings.upload();
      setCombatGlows(glows, state);
    },
    frame(viewProjection, cameraPosition, time): void {
      surfaces.frame(viewProjection, cameraPosition, time);
      rings.frame(viewProjection, cameraPosition, time);
      glows.frame(viewProjection, cameraPosition, time);
    },
    drawSurface(): void {
      surfaces.program.draw();
    },
    drawEnergy(): void {
      rings.program.draw();
      glows.program.draw();
    },
    dispose(): void {
      disposeResources(resources);
    },
  });
}
