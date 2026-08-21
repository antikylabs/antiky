import { type CombatSnapshot } from './simulation.ts';

/**
 * Presentation-time interpolation.
 *
 * The simulation runs at a fixed 60 Hz. The renderer does not: it runs whenever the display asks
 * for a frame, which on a 120 or 144 Hz panel is roughly twice as often. Presenting the raw
 * simulation state means the same positions are shown for two or three frames and then jump, which
 * reads as judder no matter how smooth the underlying motion is. It also masks the camera shake,
 * whose whole point is small high-frequency movement.
 *
 * This blends the previous step's positions towards the current ones by the session's leftover
 * accumulator. It changes presentation only. `ADR framework/0013` permits exactly this: "The
 * renderer can estimate positions between two simulation states."
 *
 * Positions only. Discrete state — phase, hull, whether an enemy is active — must never be blended,
 * because half of a state change is not a state.
 */

type Vec2Buffer = { x: number; z: number };

export type PresentedView = Readonly<{
  /** Copy the current positions into the history, before the next batch of simulation steps. */
  capture(): void;
  /** Blend by `alpha` in 0..1 and return the state the renderer should present. */
  present(alpha: number): CombatSnapshot;
}>;

function blend(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

export function createPresentedView(live: CombatSnapshot): PresentedView {
  const previousPlayer: Vec2Buffer = { x: live.player.x, z: live.player.z };
  const previousEnemies: Vec2Buffer[] = live.enemies.map((enemy) => ({ x: enemy.x, z: enemy.z }));

  // Preallocated so a frame costs no garbage. Every field is refreshed from the live state each
  // time, so a stale value cannot survive here.
  const presentedPlayer = { ...live.player };
  const presentedEnemies = live.enemies.map((enemy) => ({ ...enemy }));
  const presented = {
    ...live,
    player: presentedPlayer,
    enemies: presentedEnemies,
  } as unknown as { -readonly [Key in keyof CombatSnapshot]: CombatSnapshot[Key] };

  return Object.freeze({
    capture(): void {
      previousPlayer.x = live.player.x;
      previousPlayer.z = live.player.z;
      for (let index = 0; index < previousEnemies.length; index += 1) {
        const enemy = live.enemies[index];
        const history = previousEnemies[index];
        if (enemy === undefined || history === undefined) continue;
        history.x = enemy.x;
        history.z = enemy.z;
      }
    },

    present(alpha: number): CombatSnapshot {
      const clamped = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

      // Scalars come from the live view every frame, so anything the simulation changed since the
      // last present is picked up. Only the positions below are treated specially.
      Object.assign(presented, live);
      presented.player = presentedPlayer;
      presented.enemies = presentedEnemies;

      Object.assign(presentedPlayer, live.player);
      presentedPlayer.x = blend(previousPlayer.x, live.player.x, clamped);
      presentedPlayer.z = blend(previousPlayer.z, live.player.z, clamped);

      for (let index = 0; index < presentedEnemies.length; index += 1) {
        const enemy = live.enemies[index];
        const history = previousEnemies[index];
        const target = presentedEnemies[index];
        if (enemy === undefined || history === undefined || target === undefined) continue;
        Object.assign(target, enemy);
        // A teleport is not motion. Blending across one would drag the enemy through the arena, so
        // a jump larger than anything a step can travel snaps instead.
        const jumped = Math.abs(enemy.x - history.x) > TELEPORT_DISTANCE
          || Math.abs(enemy.z - history.z) > TELEPORT_DISTANCE;
        target.x = jumped ? enemy.x : blend(history.x, enemy.x, clamped);
        target.z = jumped ? enemy.z : blend(history.z, enemy.z, clamped);
      }

      return presented as CombatSnapshot;
    },
  });
}

/**
 * Further than any entity travels in one 60 Hz step. The fastest thing in the arena is the player
 * dash at roughly 26 units per second, which covers 0.44 units per step.
 */
const TELEPORT_DISTANCE = 2;
