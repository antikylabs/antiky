/**
 * Where the course is, asked once.
 *
 * The simulation, the renderer and the inspector all need to know what the courier is standing on.
 * They used to each answer it themselves, with three different rules, so the courier could stand on
 * one platform while its contact shadow, the checkpoint flags and the landing rings were drawn
 * against another and the inspector reported a third. Everything that asks now asks here.
 */
import {
  COURSE_PLATFORMS,
  platformTop,
  type PlatformDefinition,
} from '../course.ts';

export type PlatformInstance = Readonly<{
  definition: PlatformDefinition;
  definitionIndex: number;
  x: number;
  top: number;
}>;

type MutablePlatformInstance = {
  -readonly [Key in keyof PlatformInstance]: PlatformInstance[Key];
};

const platformInstances: MutablePlatformInstance[] = COURSE_PLATFORMS.map((definition, definitionIndex) => ({
  definition,
  definitionIndex,
  x: definition.x,
  top: definition.top,
}));

export function platformInstancesNear(_x: number, time: number): readonly PlatformInstance[] {
  for (let index = 0; index < platformInstances.length; index += 1) {
    const platform = platformInstances[index]!;
    platform.top = platformTop(platform.definition, time);
  }
  return platformInstances;
}

/**
 * How far inside a platform's edge the courier must be before it counts as standing on it.
 *
 * The courier is a circle, so its centre reaches the edge slightly before it would really topple.
 */
const PLATFORM_EDGE_INSET = 0.05;

/** How far above a platform's top the courier can be and still be resting on it. */
const SUPPORT_REACH = 0.14;

/**
 * The platform the courier is standing on at `x`, or `null` over a gap.
 *
 * Highest wins. Two platforms can overlap in `x` — `gate-stair` and `relay-tower` do, and so do
 * `post-yard` and `sail-step` — and the one the courier actually rests on is the upper one, not
 * whichever happens to come first in the authored array.
 */
export function supportAt(x: number, y: number, time: number): PlatformInstance | null {
  let support: PlatformInstance | null = null;
  const instances = platformInstancesNear(x, time);
  for (let index = 0; index < instances.length; index += 1) {
    const platform = instances[index]!;
    const within = Math.abs(x - platform.x) <= platform.definition.width * 0.5 - PLATFORM_EDGE_INSET;
    if (!within || platform.top > y + SUPPORT_REACH) continue;
    if (support === null || platform.top > support.top) support = platform;
  }
  return support;
}

/** Higher than the tallest platform, so `supportAt` reports the highest one rather than the nearest below. */
const ABOVE_THE_COURSE = 1e9;

/**
 * The height of the ground at `x`, or 0 over a gap.
 *
 * This is what the contact shadow, the checkpoint and delivery flags and the landing rings are
 * drawn against. It is deliberately `supportAt` with the height test lifted rather than a second
 * loop of its own: that is what stops the drawn ground and the stood-on ground drifting apart
 * again, which they had.
 */
export function groundTopAt(x: number, time: number): number {
  return supportAt(x, ABOVE_THE_COURSE, time)?.top ?? 0;
}
