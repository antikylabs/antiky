import { RELIQUARY_SH9_IRRADIANCE } from './sh9-irradiance.gen.ts';
import { RELAY_PRESENTATION } from './presentation.ts';

export type Sh9 = readonly (readonly [number, number, number])[];

function luminance(colour: readonly [number, number, number]): number {
  return 0.2126 * colour[0] + 0.7152 * colour[1] + 0.0722 * colour[2];
}

/**
 * The baked sky, rescaled to the brightness the demo was already tuned for.
 *
 * The bake measures a real sky in absolute terms, and `dikhololo-night` is genuinely dark — its
 * average irradiance is about a quarter of the flat constant it replaces. Dropping it in unscaled
 * would change two things at once: which way the light comes from, and how much of it there is. If
 * the frame then looked wrong there would be no way to tell which half was responsible.
 *
 * So this keeps the direction and the hue, and takes the level from what was there before. The
 * spherical average of an SH-9 reconstruction is exactly its band-0 term — every other basis
 * function integrates to zero over the sphere — so matching that one term to the old flat ambient
 * matches the averages, and a single luminance-based factor leaves the sky-to-ground hue shift
 * intact rather than flattening it per channel.
 *
 * Exposure belongs to goal 06, which moves it to a post pass. This is deliberately not that.
 */
export function normalisedSkyIrradiance(
  coefficients: Sh9 = RELIQUARY_SH9_IRRADIANCE,
  reference: readonly [number, number, number] = RELAY_PRESENTATION.floorAmbient.color,
): readonly (readonly [number, number, number])[] {
  const band0 = luminance(coefficients[0]!);
  if (band0 <= 0) throw new Error('The baked sky has no light in it, which means the bake is wrong.');
  const scale = luminance(reference) / band0;
  return Object.freeze(coefficients.map((channelValues) => Object.freeze([
    channelValues[0] * scale,
    channelValues[1] * scale,
    channelValues[2] * scale,
  ] as const)));
}
