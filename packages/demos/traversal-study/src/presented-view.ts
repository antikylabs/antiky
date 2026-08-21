import { type TraversalSnapshot } from './simulation.ts';

/**
 * Presentation-time interpolation.
 *
 * The simulation runs at a fixed 60 Hz. The renderer runs whenever the display asks for a frame,
 * which on a 120 or 144 Hz panel is roughly twice as often. Presenting the raw simulation state
 * shows the same position for two or three frames and then jumps. On a demo whose whole subject is
 * a runner's momentum, that judder is the thing the player notices first.
 *
 * This blends the previous step's position towards the current one. It changes presentation only.
 * `ADR framework/0013` permits it: "The renderer can estimate positions between two simulation
 * states."
 *
 * Position only. Discrete state — the outcome, the checkpoint index, whether the runner is
 * grounded — must never be blended, because half of a state change is not a state.
 */

/** Further than the runner travels in one 60 Hz step, so a checkpoint respawn snaps. */
const TELEPORT_DISTANCE = 2;

export type PresentedView = Readonly<{
  capture(): void;
  present(alpha: number): TraversalSnapshot;
}>;

function blend(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

export function createPresentedView(live: TraversalSnapshot): PresentedView {
  const previous = { x: live.player.x, y: live.player.y };

  // Preallocated so a frame costs no garbage.
  const presentedPlayer = { ...live.player };
  const presented = {
    ...live,
    player: presentedPlayer,
  } as unknown as { -readonly [Key in keyof TraversalSnapshot]: TraversalSnapshot[Key] };

  return Object.freeze({
    capture(): void {
      previous.x = live.player.x;
      previous.y = live.player.y;
    },

    present(alpha: number): TraversalSnapshot {
      const clamped = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

      Object.assign(presented, live);
      presented.player = presentedPlayer;
      Object.assign(presentedPlayer, live.player);

      const jumped = Math.abs(live.player.x - previous.x) > TELEPORT_DISTANCE
        || Math.abs(live.player.y - previous.y) > TELEPORT_DISTANCE;
      if (!jumped) {
        presentedPlayer.x = blend(previous.x, live.player.x, clamped);
        presentedPlayer.y = blend(previous.y, live.player.y, clamped);
      }

      return presented as TraversalSnapshot;
    },
  });
}
