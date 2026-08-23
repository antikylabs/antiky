import { COURSE_SH9_IRRADIANCE } from './sh9-irradiance.gen.ts';
import { TRAVERSAL_LIGHTING_RAMP } from './lighting-ramp.gen.ts';

function luminance(colour: readonly [number, number, number] | readonly number[]): number {
  return 0.2126 * colour[0]! + 0.7152 * colour[1]! + 0.0722 * colour[2]!;
}

/**
 * The baked sky, scaled to sit at the ramp's shadow end.
 *
 * This demo is the one place where SH-9 and a lighting ramp both want to decide the same thing, so
 * the split is explicit: **the ramp decides level, the sky decides colour.** The ramp is an authored
 * curve from deep shadow to warm highlight and it is the demo's whole visual identity — replacing it
 * with measured irradiance would throw that away for physical correctness nobody asked for.
 *
 * So the sky is normalised until its spherical average matches the ramp's darkest step, and the
 * shader adds it only in proportion to how *un*lit a surface is. A face in full sun sees the ramp
 * alone. A face turned away picks up real sky direction and hue instead of one hand-picked blue —
 * which is what makes the shadow side of a rock differ from the shadow side of an overhang.
 *
 * `kloofendal` is a bright midday sky, so its raw band-0 luminance is about eleven times the ramp's
 * shadow end. Dropping it in unscaled would wash the shadows out completely.
 */
function normalisedSky(): readonly (readonly [number, number, number])[] {
  const band0 = luminance(COURSE_SH9_IRRADIANCE[0]!);
  if (band0 <= 0) throw new Error('The baked sky has no light in it, which means the bake is wrong.');
  const scale = luminance(TRAVERSAL_LIGHTING_RAMP[0]!) / band0;
  return Object.freeze(COURSE_SH9_IRRADIANCE.map((values) => Object.freeze([
    values[0] * scale, values[1] * scale, values[2] * scale,
  ] as const)));
}

export const COURSE_SKY = normalisedSky();
