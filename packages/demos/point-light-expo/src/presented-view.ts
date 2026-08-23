import { type RelaySnapshot } from './simulation.ts';

/**
 * Presentation-time interpolation.
 *
 * The simulation runs at a fixed 60 Hz. The renderer runs whenever the display asks for a frame,
 * which on a 120 or 144 Hz panel is roughly twice as often. Presenting the raw simulation state
 * shows the same positions for two or three frames and then jumps, which reads as judder however
 * smooth the underlying motion is.
 *
 * This blends the previous step's positions towards the current ones. It changes presentation only.
 * `ADR framework/0013` permits it: "The renderer can estimate positions between two simulation
 * states."
 *
 * Positions only. Discrete state — the run, the status, integrity — must never be blended, because
 * half of a state change is not a state.
 */

/** Further than anything in the relay travels in one 60 Hz step, so a respawn snaps. */
const TELEPORT_DISTANCE = 2;

type Vec2Buffer = { x: number; z: number };

export type PresentedView = Readonly<{
  capture(): void;
  present(alpha: number): RelaySnapshot;
}>;

function blend(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

export function createPresentedView(live: RelaySnapshot): PresentedView {
  const previousPlayer: Vec2Buffer = { x: live.player.x, z: live.player.z };
  const previousShades: Vec2Buffer[] = live.shades.map((shade) => ({ x: shade.x, z: shade.z }));

  // Preallocated so a frame costs no garbage.
  const presentedPlayer = { ...live.player };
  const presentedShades = live.shades.map((shade) => ({ ...shade }));
  const presented = {
    ...live,
    player: presentedPlayer,
    shades: presentedShades,
  } as unknown as { -readonly [Key in keyof RelaySnapshot]: RelaySnapshot[Key] };

  return Object.freeze({
    capture(): void {
      previousPlayer.x = live.player.x;
      previousPlayer.z = live.player.z;
      for (let index = 0; index < previousShades.length; index += 1) {
        const shade = live.shades[index];
        const history = previousShades[index];
        if (shade === undefined || history === undefined) continue;
        history.x = shade.x;
        history.z = shade.z;
      }
    },

    present(alpha: number): RelaySnapshot {
      const clamped = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

      Object.assign(presented, live);
      presented.player = presentedPlayer;
      presented.shades = presentedShades;

      Object.assign(presentedPlayer, live.player);
      presentedPlayer.x = blend(previousPlayer.x, live.player.x, clamped);
      presentedPlayer.z = blend(previousPlayer.z, live.player.z, clamped);

      for (let index = 0; index < presentedShades.length; index += 1) {
        const shade = live.shades[index];
        const history = previousShades[index];
        const target = presentedShades[index];
        if (shade === undefined || history === undefined || target === undefined) continue;
        Object.assign(target, shade);
        const jumped = Math.abs(shade.x - history.x) > TELEPORT_DISTANCE
          || Math.abs(shade.z - history.z) > TELEPORT_DISTANCE;
        target.x = jumped ? shade.x : blend(history.x, shade.x, clamped);
        target.z = jumped ? shade.z : blend(history.z, shade.z, clamped);
      }

      return presented as RelaySnapshot;
    },
  });
}
