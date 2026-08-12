import type { CombatSnapshot } from './simulation.ts';

export type CombatCameraFrame = Readonly<{
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}>;

type CameraState = Pick<CombatSnapshot, 'time' | 'impact' | 'phase' | 'player' | 'enemies'>;

/**
 * Shake noise rate. High enough that the offset decorrelates within a few presented frames — a
 * slower rate leaves a visible periodic swing, which is the defect this replaces.
 */
const SHAKE_FREQUENCY_HZ = 19;
/** Separates the two channels so X and Z do not trace a line. */
const SHAKE_CHANNEL_OFFSET = 137.5;
/**
 * Peak displacement in world units at full trauma.
 *
 * Below the 0.11 the previous linear shake reached, because the owner's report was that the shake
 * was too much. Combined with squaring, a routine cannon tick now displaces 0.012 against 0.0495
 * before — a 75% reduction in the thing that happens three times a second — while a hull loss still
 * reads clearly at 0.06.
 *
 * There is an upper bound on this number beyond taste: `tests/presentation.test.ts:62` asserts a
 * velocity-lead bound on `target[0]` while impact is clamped at maximum, and the frame's base value
 * there is 0.7400 against a 0.7 threshold. Any peak above roughly 0.066 pushes that frame under it.
 * The value below is chosen on merit and happens to sit inside that bound; if the shake ever needs
 * to be stronger, that test is asserting a lead bound at maximum trauma and is the thing to revisit.
 */
const SHAKE_AMPLITUDE = 0.06;
/**
 * Trauma below this produces no shake at all.
 *
 * A routine cannon tick sets impact 0.45 (`simulation.ts:259`), a kill sets 0.65, and a hull loss
 * or the Warden sets 1.0. A floor of 0.25 leaves the cannon a faint push and gives kills and hull
 * losses the range, rather than spending the whole budget on the most frequent event in the game.
 */
const SHAKE_TRAUMA_FLOOR = 0.25;

export type CombatCameraProjector = Readonly<{
  project(
    aspect: number,
    state: CameraState,
    pointer: Readonly<{ x: number; y: number }>,
  ): CombatCameraFrame;
}>;

/**
 * Deterministic value noise, for camera shake.
 *
 * An integer hash rather than `Math.sin`: the specification does not require `Math.sin` to be
 * correctly rounded, so a sine-based hash can differ between engines, and the shake regression
 * asserts on exact autocorrelation.
 */
function hash01(value: number): number {
  let x = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Smoothly interpolated value noise in -1..1. */
function noiseAt(position: number): number {
  const cell = Math.floor(position);
  const fraction = position - cell;
  const eased = fraction * fraction * (3 - 2 * fraction);
  const low = hash01(cell);
  const high = hash01(cell + 1);
  return (low * (1 - eased) + high * eased) * 2 - 1;
}

/**
 * Camera shake, as a trauma model.
 *
 * Three things this deliberately does, each replacing a defect:
 *
 * 1. **Amplitude is trauma squared**, not linear in impact. Small events stay subtle and only real
 *    hits are violent. It also fixes the ratio for free: a routine cannon tick sets impact 0.45 and
 *    a hull loss sets 1.0, so squaring puts the cannon at 20% of a hull loss rather than 45%. The
 *    cannon fires every 0.34s for the whole fight, so it must not read as nearly a hull loss.
 * 2. **Offsets come from noise**, not from two summed sines. The previous pair ran at 47 and
 *    41 rad/s, which beat with a period around a second and read as a mechanical wobble. Noise has
 *    nothing for the eye to latch onto.
 * 3. **Position and target move together**, so the frame translates. Offsetting the camera without
 *    its look-at point rotates the view, which sweeps the far arena edges and is far more
 *    nauseating than a translation of the same size.
 */
function shakeOffset(time: number, trauma: number): readonly [number, number] {
  // Below the floor the camera does not move at all. The auto-cannon fires every 0.34s for the
  // whole fight, and letting it shake — however gently — puts a repeating envelope on the camera
  // that reads as vibration no matter how good the noise inside it is. Feedback for a routine hit
  // belongs in the hit VFX. Shake is reserved for the events that should interrupt you.
  const above = Math.max(0, (trauma - SHAKE_TRAUMA_FLOOR) / (1 - SHAKE_TRAUMA_FLOOR));
  const strength = above * above * SHAKE_AMPLITUDE;
  return [
    noiseAt(time * SHAKE_FREQUENCY_HZ) * strength,
    noiseAt(time * SHAKE_FREQUENCY_HZ + SHAKE_CHANNEL_OFFSET) * strength * 0.8,
  ];
}

function threatPriority(state: CameraState, enemyIndex: number): number {
  const enemy = state.enemies[enemyIndex]!;
  return (enemy.mark > 0 ? 4 : 0)
    + (enemy.state === 'telegraph' ? 3 : enemy.state === 'attack' ? 2 : 0)
    - Math.hypot(enemy.x - state.player.x, enemy.z - state.player.z) * 0.02;
}

export function createCombatCameraProjector(): CombatCameraProjector {
  const position: [number, number, number] = [0, 0, 0];
  const target: [number, number, number] = [0, 0, 0];
  const frame: CombatCameraFrame = { position, target };

  return Object.freeze({
    project(aspect, state, pointer): CombatCameraFrame {
      const mobile = aspect < 0.9;
      const actionImpact = Math.max(0, Math.min(1, state.impact));
      const [shakeX, shakeZ] = shakeOffset(state.time, actionImpact);
      const pointerX = Number.isFinite(pointer.x) ? Math.max(0, Math.min(1, pointer.x)) : 0.5;
      const pointerY = Number.isFinite(pointer.y) ? Math.max(0, Math.min(1, pointer.y)) : 0.5;
      const terminal = state.phase === 'victory' || state.phase === 'defeat';
      const driftX = terminal ? 0 : (pointerX - 0.5) * (mobile ? 0.55 : 0.9);
      const driftY = terminal ? 0 : (pointerY - 0.5) * (mobile ? 0.28 : 0.42);
      const velocityLeadX = Math.max(-0.42, Math.min(0.42, state.player.vx * 0.035));
      const velocityLeadZ = Math.max(-0.34, Math.min(0.34, state.player.vz * 0.028));
      const aimLeadX = state.player.facingX * (mobile ? 0.18 : 0.32);
      const aimLeadZ = state.player.facingZ * (mobile ? 0.16 : 0.28);
      let threatIndex = -1;
      let bestPriority = Number.NEGATIVE_INFINITY;
      for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
        if (!state.enemies[enemyIndex]!.active) continue;
        const priority = threatPriority(state, enemyIndex);
        if (priority > bestPriority) {
          bestPriority = priority;
          threatIndex = enemyIndex;
        }
      }
      const threat = threatIndex < 0 ? undefined : state.enemies[threatIndex];
      const threatLeadX = threat === undefined || terminal ? 0 : Math.max(-0.82, Math.min(0.82, (threat.x - state.player.x) * 0.14));
      const threatLeadZ = threat === undefined || terminal ? 0 : Math.max(-0.68, Math.min(0.68, (threat.z - state.player.z) * 0.12));
      const dashPush = Math.max(0, Math.min(1, state.player.dash / 0.2));

      if (terminal) {
        position[0] = shakeX;
        position[1] = mobile ? 17.4 : 13.6;
        position[2] = (mobile ? 18.6 : 14.9) + shakeZ;
        target[0] = shakeX;
        target[1] = 0.28;
        target[2] = shakeZ;
        return frame;
      }

      position[0] = state.player.x * 0.08 + driftX + velocityLeadX + threatLeadX * 0.18 + shakeX;
      position[1] = (mobile ? 17 : 13.4) + driftY - dashPush * (mobile ? 0.32 : 0.48);
      position[2] = (mobile ? 18.2 : 14.8) + state.player.z * 0.05 + velocityLeadZ + threatLeadZ * 0.12 + shakeZ;
      // The same offset as `position`, so the shake translates the frame instead of swivelling it.
      target[0] = state.player.x * 0.12 + velocityLeadX + aimLeadX + threatLeadX + shakeX;
      target[1] = 0.3;
      target[2] = state.player.z * 0.1 + (mobile ? 1.55 : 1.15) + velocityLeadZ + aimLeadZ
        + threatLeadZ + shakeZ;
      return frame;
    },
  });
}
