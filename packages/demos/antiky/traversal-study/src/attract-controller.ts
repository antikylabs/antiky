import { COURSE_HAZARDS, COURSE_PLATFORMS, platformTop } from './course.ts';

export type AttractControllerState = Readonly<{
  time: number;
  player: Readonly<{ x: number; y: number; grounded: boolean }>;
  outcome: 'running' | 'delivered' | 'failed';
}>;

export type AttractCommand = Readonly<{
  horizontal: number;
  jump: boolean;
}>;

/** Canonical, deterministic demo driver. Player input never passes through this controller. */
export function canonicalAttractCommand(state: AttractControllerState): AttractCommand {
  if (state.outcome !== 'running') return Object.freeze({ horizontal: 0, jump: false });

  const support = COURSE_PLATFORMS.find((platform) => {
    const within = Math.abs(state.player.x - platform.x) <= platform.width * 0.5;
    return within && platformTop(platform, state.time) <= state.player.y + 0.12;
  });
  const supportEdge = support === undefined
    ? Number.POSITIVE_INFINITY
    : support.x + support.width * 0.5;
  const edgeTakeoff = supportEdge - state.player.x < 1.05;
  const hazardTakeoff = COURSE_HAZARDS.some((hazard) => {
    const distance = hazard.x - state.player.x;
    return distance > 0.48 && distance < 1.12;
  });

  return Object.freeze({
    horizontal: 1,
    jump: state.player.grounded && (edgeTakeoff || hazardTakeoff),
  });
}
