import { COURSE_HAZARDS, COURSE_PLATFORMS, platformTop } from './course.ts';

export type AttractControllerState = Readonly<{
  time: number;
  player: Readonly<{ x: number; y: number; vx: number; grounded: boolean }>;
  outcome: 'running' | 'delivered' | 'failed';
}>;

export type AttractCommand = Readonly<{
  horizontal: number;
  jump: boolean;
}>;

type MutableAttractCommand = { horizontal: number; jump: boolean };
const sharedCommand: MutableAttractCommand = { horizontal: 0, jump: false };

export function writeCanonicalAttractCommand(
  time: number,
  player: AttractControllerState['player'],
  outcome: AttractControllerState['outcome'],
  output: MutableAttractCommand,
): AttractCommand {
  if (outcome !== 'running') {
    output.horizontal = 0;
    output.jump = false;
    return output;
  }

  let support = undefined as typeof COURSE_PLATFORMS[number] | undefined;
  for (let index = 0; index < COURSE_PLATFORMS.length; index += 1) {
    const platform = COURSE_PLATFORMS[index]!;
    const within = Math.abs(player.x - platform.x) <= platform.width * 0.5;
    if (within && platformTop(platform, time) <= player.y + 0.12) {
      support = platform;
      break;
    }
  }
  const supportEdge = support === undefined
    ? Number.POSITIVE_INFINITY
    : support.x + support.width * 0.5;
  const takeoffDistance = Math.max(1.15, Math.abs(player.vx) * 0.22);
  const edgeTakeoff = supportEdge - player.x < takeoffDistance;
  let hazardTakeoff = false;
  for (let index = 0; index < COURSE_HAZARDS.length; index += 1) {
    const distance = COURSE_HAZARDS[index]!.x - player.x;
    if (distance > 0.45 && distance < takeoffDistance) {
      hazardTakeoff = true;
      break;
    }
  }

  output.horizontal = 1;
  output.jump = player.grounded && (edgeTakeoff || hazardTakeoff);
  return output;
}

/** Canonical, deterministic demo driver. Player input never passes through this controller. */
export function canonicalAttractCommand(state: AttractControllerState): AttractCommand {
  return writeCanonicalAttractCommand(state.time, state.player, state.outcome, sharedCommand);
}
