import arenaDepthShader from './shaders/arena-depth.shader.gen.ts';
import { createHudBatch, type HudBatch } from './arena-hud.ts';
import type { BroMetalTexture } from 'brometal';
import {
  createCube,
  createProgram,
  createSphere,
  createTorus,
  type BroMetalProgram,
  type Renderer,
} from 'brometal';

import { ARENA_STRUCTURE_INSTANCES, setArenaEnergy, setArenaStructure } from './arena-environment.ts';
import { setCombatSignals } from './arena-signals.ts';
import { ARENA_LIGHTS } from './arena-lights.ts';
import { COMBAT_PALETTE, enemyVisualProfile } from './combat-visuals.ts';
import {
  createContactShadowBatch,
  createGlowBatch,
  createRibbonBatch,
  createRippleBatch,
  createSurfaceBatch,
  horizontalGeometry,
  type GlowBatch,
  type Vec3,
} from './render-batches.ts';
import { createDisposalScope } from '@antiky/framework';
import { ENEMY_COUNT, PROJECTILE_CAPACITY, type CombatEnemy, type CombatSnapshot, type EnemyRole } from './combat-state.ts';

// Was 68 when the seven contact shadows lived here too. They now have their own unlit batch.
const SURFACE_CAPACITY = 61;
const CONTACT_SHADOW_CAPACITY = ENEMY_COUNT + 1;
const GLOW_CAPACITY = 143;
/**
 * Item 16's trails: each projectile keeps a short CPU position history and draws the segments
 * between consecutive samples as one continuous tapered ribbon.
 *
 * The glow capacity above dropped from 173 to 143 in the same change: the ribbon replaced the
 * per-projectile midpoint trail sprite, which freed the 36 slots that sprite was sized for (with
 * six of them re-spent on the floodlight fixtures).
 */
const RIBBON_SAMPLES = 3;
const RIBBON_CAPACITY = PROJECTILE_CAPACITY * (RIBBON_SAMPLES - 1);
/** Item 17's impact rings: one slot per enemy plus one for the player. */
const RIPPLE_CAPACITY = ENEMY_COUNT + 1;
const RING_CAPACITY = 40;
const GAUGE_START = ARENA_STRUCTURE_INSTANCES;
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
  shadows: CONTACT_SHADOW_CAPACITY,
  glows: GLOW_CAPACITY,
  rings: RING_CAPACITY,
  ribbons: RIBBON_CAPACITY,
  ripples: RIPPLE_CAPACITY,
});

/**
 * Contact shadows upload three vec3s per instance where every other batch uploads four. The
 * measurement below would overstate the frame's upload traffic if it assumed one stride for all.
 */
export const COMBAT_PROJECTION_INSTANCE_FLOATS = Object.freeze({
  surfaces: 12,
  shadows: 9,
  glows: 12,
  rings: 12,
  ribbons: 12,
  ripples: 6,
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

/**
 * The player's readouts, drawn flat over the frame.
 *
 * These used to be cubes in the world at z = 5.95: lit by the scene, shaded by earthshine, and
 * foreshortened toward the edges of the frame. A meter is interface — it should be the same size
 * and the same colour wherever it lands, and it should not move when the camera does.
 *
 * Coordinates are normalised device coordinates: (-1, -1) bottom left, (1, 1) top right. Sizes are
 * chosen in that space directly rather than derived from world units, because the whole point is
 * that they have no world position to derive from.
 */
function setGauges(hud: HudBatch, state: CombatSnapshot): void {
  hud.clear();
  let index = 0;

  // Hull, bottom left. The player's own health is the thing read most often, so it gets the
  // largest segments and the most stable position on screen.
  for (let hull = 0; hull < state.player.maxHull; hull += 1) {
    const active = hull < state.player.hull;
    hud.set(
      index, -0.88 + hull * 0.062, -0.88, 0.026, 0.022,
      active ? COMBAT_PALETTE.cyan : COMBAT_PALETTE.steelDark,
      active ? 1 : 0, active ? 0.95 : 0.4,
    );
    index += 1;
  }

  // Drive, directly beneath hull. Ten thin segments so a partial charge reads as a level rather
  // than as a count.
  const driveSegments = Math.ceil(state.player.drive / state.player.maxDrive * 10);
  for (let drive = 0; drive < 10; drive += 1) {
    const active = drive < driveSegments;
    hud.set(
      index, -0.88 + drive * 0.038, -0.935, 0.015, 0.011,
      active ? COMBAT_PALETTE.cyan : COMBAT_PALETTE.steelDark,
      active ? 1 : 0, active ? 0.85 : 0.32,
    );
    index += 1;
  }

  // Round pips, top centre — glanced at between rounds rather than during them.
  for (let round = 0; round < state.maxRounds; round += 1) {
    const complete = round + 1 < state.round || state.phase === 'victory';
    const current = round + 1 === state.round;
    hud.set(
      index, -0.04 + round * 0.042, 0.9, 0.014, 0.014,
      complete ? COMBAT_PALETTE.white : current ? COMBAT_PALETTE.amber : COMBAT_PALETTE.steelDark,
      complete || current ? 1 : 0, complete || current ? 0.9 : 0.3,
    );
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
  // The boss bar, top centre and wider, present only while a warden is alive.
  for (let segment = 0; segment < 12; segment += 1) {
    const active = boss !== undefined && segment < Math.ceil(boss.hull / boss.maxHull * 12);
    const visible = boss === undefined ? 0 : 1;
    hud.set(
      index, -0.23 + segment * 0.042, 0.82, 0.018 * visible, 0.013 * visible,
      active ? COMBAT_PALETTE.warm : COMBAT_PALETTE.steelDark,
      active ? 1 : 0, visible * (active ? 0.92 : 0.34),
    );
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

  // The six floodlight fixtures themselves. Goal 08: a rig whose light arrives from nowhere reads
  // as paint — the fixture is the small blown-out core that says "this is a light", and it is what
  // the bloom pass exists to pick up. The glow shader is additive into the HDR target, so these
  // exceed 1.0 and bloom the way the §6.2 brief asks the goal glow to.
  for (let post = 0; post < ARENA_LIGHTS.length; post += 1) {
    const fixture = ARENA_LIGHTS[post]!;
    index = pushGlow(
      glows, index,
      // Seated on item 14's trim rail (y 1.62) rather than floating over the wall top, so the
      // fixture reads as mounted on the rail it lights.
      fixture.position[0] * 0.955, 1.62, fixture.position[2] * 0.955,
      0.15, 0.15, 0.3,
      fixture.color,
      1.3, 0, post * 1.7,
    );
  }

  for (const projectile of state.projectiles) {
    if (projectile.life <= 0) continue;
    const color = projectile.kind === 'hostile' ? COMBAT_PALETTE.warm : projectile.kind === 'deflected' ? COMBAT_PALETTE.white : COMBAT_PALETTE.cyan;
    const rotation = -Math.atan2(projectile.vx, projectile.vz);
    const trail = projectile.kind === 'deflected' ? 0.78 : projectile.kind === 'hostile' ? 0.52 : 0.34;
    // The head keeps its glow; the old midpoint trail sprite is gone — item 16's ribbon draws the
    // trail as one stroke instead of beads.
    index = pushGlow(glows, index, projectile.x, 0.48, projectile.z, 0.095, 0.095, projectile.kind === 'hostile' ? 0.3 : 0.22, color, projectile.kind === 'hostile' ? 0.9 : 0.7, rotation, projectile.life);
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
    // Impact timing: a snap, then a settle, with alpha on its own curve.
    //
    // Size and opacity were both linear in `life`, so they rose and fell as one — a puff that shrank
    // and faded in lockstep, which reads as one thing dimming rather than as something happening.
    // AC-V2 measures exactly that as a correlation between the two curves.
    //
    // Now: scale snaps to its peak within the first few frames and eases back, while alpha holds
    // briefly and then drops away faster. They share a cause and not a shape.
    const age = 1 - Math.min(1, particle.life / Math.max(particle.maxLife, 0.0001));
    // Peak at about 8% of the lifetime — two or three frames at 60Hz for the shortest particles.
    const snap = Math.min(1, age / 0.08);
    const settle = 1 - Math.min(1, Math.max(0, age - 0.08) / 0.92) * 0.55;
    const size = (0.035 + particle.maxLife * 0.1) * snap * settle;
    // Held while the shape reads, then a cubic fall — at ten frames of a short particle this is
    // comfortably under a quarter of peak, which is the criterion.
    const fade = 1 - age;
    const opacity = Math.min(0.72, fade * fade * fade * 1.9);
    index = pushGlow(glows, index, particle.x, particle.y, particle.z, size, size, size + Math.min(0.34, speed * 0.014), color, opacity, -Math.atan2(particle.vx, particle.vz), particleIndex * 0.19);
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
  /** The lit program behind the moving props, so the renderer can bind the shadow map to it. */
  surfaceProgram: BroMetalProgram;
  /** Its companion drawn from the sun. */
  surfaceDepthProgram: BroMetalProgram;
  drawSurface(): void;
  drawSurfaceDepth(): void;
  drawShadows(): void;
  drawEnergy(): void;
  /** Item 17's distortion sources, drawn into the offset target the post pass reads. */
  drawRipples(): void;
  /** Flat, screen-space, and last: the HUD sits over everything the scene drew. */
  drawHud(): void;
  dispose(): void;
}>;

export type CombatProjectionDependencies = Readonly<{
  createSurfaceBatch: typeof createSurfaceBatch;
  createGlowBatch: typeof createGlowBatch;
  createRibbonBatch: typeof createRibbonBatch;
  createRippleBatch: typeof createRippleBatch;
  createHudBatch: typeof createHudBatch;
  createContactShadowBatch: typeof createContactShadowBatch;
}>;

const COMBAT_PROJECTION_DEPENDENCIES: CombatProjectionDependencies = Object.freeze({
  createSurfaceBatch,
  createGlowBatch,
  createRibbonBatch,
  createRippleBatch,
  createHudBatch,
  createContactShadowBatch,
});

export function createCombatProjection(
  renderer: Renderer,
  /**
   * Loaded by the caller, not here.
   *
   * This factory is synchronous and `loadTexture` is not, so the billboard arrives as an argument
   * from `renderer.ts`, which is already async and already owns the catalog and the fleet. That is
   * the same shape the detail normal uses in this demo, and it keeps the ownership honest: the
   * renderer holds it, the projection borrows it.
   */
  billboard: BroMetalTexture,
  dependencies: CombatProjectionDependencies = COMBAT_PROJECTION_DEPENDENCIES,
): CombatProjection {
  const resources = createDisposalScope();
  let surfaces: ReturnType<typeof createSurfaceBatch>;
  let shadows: ReturnType<typeof createContactShadowBatch>;
  let glows: ReturnType<typeof createGlowBatch>;
  let hud: HudBatch;
  let rings: ReturnType<typeof createGlowBatch>;
  let ribbons: ReturnType<typeof createRibbonBatch>;
  let ripples: ReturnType<typeof createRippleBatch>;
  try {
    // The depth factory is what makes these props cast. Without it `surfaceDepthProgram` is
    // undefined and the renderer's shadow binding throws during construction, which surfaces as a
    // capture timeout rather than as an error — the runtime never finishes publishing.
    surfaces = resources.adopt(dependencies.createSurfaceBatch(
      renderer,
      createCube(),
      SURFACE_CAPACITY,
      undefined,
      (target) => createProgram(target, arenaDepthShader),
    ));
    shadows = resources.adopt(dependencies.createContactShadowBatch(renderer, CONTACT_SHADOW_CAPACITY, billboard));
    hud = resources.adopt(dependencies.createHudBatch(renderer));
    glows = resources.adopt(dependencies.createGlowBatch(renderer, createSphere({ radius: 1, widthSegments: 12, heightSegments: 8 }), GLOW_CAPACITY, billboard));
    rings = resources.adopt(dependencies.createGlowBatch(renderer, horizontalGeometry(createTorus({ radius: 1, tube: 0.035, radialSegments: 10, tubularSegments: 96 })), RING_CAPACITY, billboard));
    ribbons = resources.adopt(dependencies.createRibbonBatch(renderer, RIBBON_CAPACITY, billboard));
    ripples = resources.adopt(dependencies.createRippleBatch(renderer, RIPPLE_CAPACITY));
  } catch (cause: unknown) {
    resources.rollback();
    throw cause;
  }

  // The trail history: RIBBON_SAMPLES recent positions per projectile slot. Slots are pooled and
  // stable, so indexing by slot is safe. The head sample refreshes every projection; when a slot
  // is dead its history collapses onto the current point so the next shot starts clean instead of
  // ribboning from wherever the last one died.
  const trailHistory = new Float32Array(PROJECTILE_CAPACITY * RIBBON_SAMPLES * 3);
  const trailAlive = new Uint8Array(PROJECTILE_CAPACITY);

  const setTrails = (state: CombatSnapshot): void => {
    ribbons.clear();
    let segment = 0;
    for (let slot = 0; slot < state.projectiles.length; slot += 1) {
      const projectile = state.projectiles[slot]!;
      const base = slot * RIBBON_SAMPLES * 3;
      const y = 0.46;
      if (projectile.life <= 0) {
        trailAlive[slot] = 0;
        continue;
      }
      if (trailAlive[slot] === 0) {
        for (let sample = 0; sample < RIBBON_SAMPLES; sample += 1) {
          trailHistory[base + sample * 3] = projectile.x;
          trailHistory[base + sample * 3 + 1] = y;
          trailHistory[base + sample * 3 + 2] = projectile.z;
        }
        trailAlive[slot] = 1;
      }
      // Shift the tail down and write the head.
      for (let sample = RIBBON_SAMPLES - 1; sample > 0; sample -= 1) {
        trailHistory[base + sample * 3] = trailHistory[base + (sample - 1) * 3]!;
        trailHistory[base + sample * 3 + 1] = trailHistory[base + (sample - 1) * 3 + 1]!;
        trailHistory[base + sample * 3 + 2] = trailHistory[base + (sample - 1) * 3 + 2]!;
      }
      trailHistory[base] = projectile.x;
      trailHistory[base + 1] = y;
      trailHistory[base + 2] = projectile.z;

      const color = projectile.kind === 'hostile' ? COMBAT_PALETTE.warm : projectile.kind === 'deflected' ? COMBAT_PALETTE.white : COMBAT_PALETTE.cyan;
      const intensity = Math.min(1, projectile.life * 3) * (projectile.kind === 'hostile' ? 1.35 : 1.1);
      for (let sample = 0; sample < RIBBON_SAMPLES - 1; sample += 1) {
        // Older segments fade and thin: the stroke tapers into its own past.
        const fade = 1 - sample / (RIBBON_SAMPLES - 1);
        ribbons.setValues(
          segment,
          trailHistory[base + (sample + 1) * 3]!, trailHistory[base + (sample + 1) * 3 + 1]!, trailHistory[base + (sample + 1) * 3 + 2]!,
          trailHistory[base + sample * 3]!, trailHistory[base + sample * 3 + 1]!, trailHistory[base + sample * 3 + 2]!,
          color[0], color[1], color[2],
          0.085 * (0.4 + fade * 0.6), intensity, fade,
        );
        segment += 1;
      }
    }
    ribbons.upload();
  };

  const setRipples = (state: CombatSnapshot): void => {
    ripples.clear();
    // An enemy's `hit` runs 1 -> 0 after an impact; the ring expands as it fades, which is the
    // pressure wave leaving the point of impact. Strength is screen-space UV units, so 0.012 is a
    // little over one percent of the frame at the ring's crest.
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex]!;
      const hit = enemy.active ? Math.max(0, Math.min(1, enemy.hit)) : 0;
      const expansion = 1 - hit;
      ripples.setValues(
        enemyIndex,
        enemy.x, -0.1, enemy.z,
        0.35 + expansion * 1.6, hit * hit * 0.014, 0.5,
      );
    }
    const impact = Math.max(0, Math.min(1, state.impact));
    ripples.setValues(
      ENEMY_COUNT,
      state.player.x, -0.1, state.player.z,
      0.3 + (1 - impact) * 1.3, impact * impact * 0.016, 0.45,
    );
    ripples.upload();
  };

  return Object.freeze({
    project(state): void {
      surfaces.clear();
      shadows.clear();
      setArenaStructure(surfaces);
      const playerVisible = state.phase === 'defeat' ? 0.32 : 1;
      shadows.setValues(0, state.player.x, -0.145, state.player.z, 0.72 * playerVisible, -Math.atan2(state.player.facingX, state.player.facingZ), 0.92 * playerVisible, COMBAT_PALETTE.shadow[0], COMBAT_PALETTE.shadow[1], COMBAT_PALETTE.shadow[2]);
      for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
        const enemy = state.enemies[enemyIndex]!;
        const visible = enemy.active ? 1 : 0;
        const size = shadowSize(enemy);
        shadows.setValues(enemyIndex + 1, enemy.x, -0.14, enemy.z, size * visible, 0, size * 0.8 * visible, COMBAT_PALETTE.shadow[0], COMBAT_PALETTE.shadow[1], COMBAT_PALETTE.shadow[2]);
      }
      setGauges(hud, state);
      setCombatRings(rings, state);
      setCombatSignals(surfaces, rings, state, SIGNAL_OFFSETS);
      surfaces.upload();
      hud.upload();
      shadows.upload();
      rings.upload();
      setCombatGlows(glows, state);
      setTrails(state);
      setRipples(state);
    },
    frame(viewProjection, cameraPosition, time): void {
      surfaces.frame(viewProjection, cameraPosition, time);
      shadows.frame(viewProjection);
      rings.frame(viewProjection, cameraPosition, time);
      glows.frame(viewProjection, cameraPosition, time);
      ribbons.frame(viewProjection, cameraPosition, time);
      ripples.frame(viewProjection, time);
    },
    surfaceProgram: surfaces.program,
    surfaceDepthProgram: surfaces.depthProgram!,
    drawSurface(): void {
      surfaces.program.draw();
    },
    /** The moving props seen from the sun. Called inside the shadow pass, before the scene. */
    drawSurfaceDepth(): void {
      surfaces.drawDepth();
    },
    /** Alpha-blended, so this must run after every opaque draw in the frame. */
    drawShadows(): void {
      shadows.program.draw();
    },
    drawEnergy(): void {
      rings.program.draw();
      ribbons.program.draw();
      glows.program.draw();
    },
    /** The distortion sources, drawn into the offset target the post pass reads. */
    drawRipples(): void {
      ripples.program.draw();
    },
    drawHud(): void {
      hud.draw();
    },
    dispose(): void {
      resources.dispose();
    },
  });
}
