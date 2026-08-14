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
} from './course.ts';

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

export function supportAt(x: number, y: number, time: number): PlatformInstance | null {
  let support: PlatformInstance | null = null;
  const instances = platformInstancesNear(x, time);
  for (let index = 0; index < instances.length; index += 1) {
    const platform = instances[index]!;
    const within = Math.abs(x - platform.x) <= platform.definition.width * 0.5 - 0.05;
    if (!within || platform.top > y + 0.14) continue;
    if (support === null || platform.top > support.top) support = platform;
  }
  return support;
}

export function groundTopAt(x: number, time: number): number {
  for (let index = 0; index < COURSE_PLATFORMS.length; index += 1) {
    const platform = COURSE_PLATFORMS[index]!;
    if (Math.abs(x - platform.x) <= platform.width * 0.5) return platformTop(platform, time);
  }
  return 0;
}
