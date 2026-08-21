import { TOWN_SH9_IRRADIANCE } from '../sh9-irradiance.gen.ts';

function luminance(colour: readonly number[]): number {
  return 0.2126 * colour[0]! + 0.7152 * colour[1]! + 0.0722 * colour[2]!;
}

/**
 * The baked sky, scaled to the level the town was already lit at.
 *
 * The existing `uSkyColor` term averaged about `luminance(SKY_COLOR) * uSkyIntensity` over the
 * sphere. Matching the bake's band-0 to that keeps the change about direction rather than exposure,
 * which is the only way to tell whether the second band — the part two colours cannot express — is
 * doing anything visible.
 */
export const TOWN_SKY = Object.freeze(
  ((): readonly (readonly [number, number, number])[] => {
    const reference = luminance([0.24, 0.38, 0.68]);
    const band0 = luminance(TOWN_SH9_IRRADIANCE[0]!);
    if (band0 <= 0) throw new Error('The baked sky has no light in it, which means the bake is wrong.');
    const scale = reference / band0;
    return TOWN_SH9_IRRADIANCE.map((values) => Object.freeze([
      values[0] * scale, values[1] * scale, values[2] * scale,
    ] as const));
  })(),
);
