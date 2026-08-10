import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';

export const CHARGE_FIELD_THRESHOLD = 0.34;
export const SAFE_FIELD_THRESHOLD = 0.14;

export function sampleAuthoritativeRelayField(
  x: number,
  z: number,
  lightPowers: readonly [number, number, number],
): readonly [number, number, number] {
  return EXPO_LIGHT_DEFINITIONS.map((light, index) => {
    const dx = x - light.transform.position[0];
    const dz = z - light.transform.position[2];
    const distance = Math.hypot(dx, dz);
    const range = Math.max(0, 1 - distance / light.pointLight.radius);
    const powerScale = Math.max(0, lightPowers[index] ?? 0) / light.pointLight.power;
    return range * range * powerScale;
  }) as [number, number, number];
}

export function authoritativeRelayRegionRadii(relayIndex: number, power: number): Readonly<{
  safe: number;
  charge: number;
}> {
  const light = EXPO_LIGHT_DEFINITIONS[relayIndex];
  if (light === undefined) return Object.freeze({ safe: 0, charge: 0 });
  const powerScale = Math.max(0, power) / light.pointLight.power;
  const radiusAt = (threshold: number): number => powerScale <= threshold
    ? 0
    : light.pointLight.radius * (1 - Math.sqrt(threshold / powerScale));
  return Object.freeze({
    safe: radiusAt(SAFE_FIELD_THRESHOLD),
    charge: radiusAt(CHARGE_FIELD_THRESHOLD),
  });
}

export function strongestAuthoritativeRelayField(values: readonly [number, number, number]): {
  index: number;
  value: number;
  total: number;
} {
  let index = 0;
  let value = values[0];
  for (let candidate = 1; candidate < values.length; candidate += 1) {
    if (values[candidate]! > value) {
      index = candidate;
      value = values[candidate]!;
    }
  }
  return { index, value, total: values[0] + values[1] + values[2] };
}
