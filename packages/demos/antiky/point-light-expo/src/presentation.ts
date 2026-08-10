export type PresentationVec3 = readonly [number, number, number];

function color(red: number, green: number, blue: number): PresentationVec3 {
  return Object.freeze([red, green, blue]);
}

export const RELAY_PRESENTATION = Object.freeze({
  clearColor: Object.freeze([0.035, 0.056, 0.05, 1] as const),
  exposure: 1.24,
  relayLightStrength: 0.66,
  surfaceAmbient: Object.freeze({
    color: color(0.34, 0.4, 0.36),
    strength: 0.96,
  }),
  floorAmbient: Object.freeze({
    color: color(0.3, 0.36, 0.3),
    strength: 1.08,
  }),
  floorDiffuseTint: color(0.78, 0.82, 0.74),
  floorTextureContrast: 0.56,
  catalogMaterial: Object.freeze({
    diffuseLift: 0.14,
    textureContrast: 0.78,
    saturation: 0.9,
    ambientStrength: 1.14,
  }),
  fog: Object.freeze({
    color: color(0.06, 0.085, 0.075),
    start: 10,
    end: 21,
    maximumMix: 0.34,
  }),
  camera: Object.freeze({
    position: Object.freeze([0, 18, 10.5] as const),
    target: Object.freeze([0, 1.2, 0.6] as const),
    fovY: 35 * Math.PI / 180,
    idleDrift: 0,
    dangerShakeThreshold: 0.5,
    maximumShake: 0.1,
  }),
  reliquaryBounds: Object.freeze({
    minimum: Object.freeze([-8.2, -0.7, -5.95] as const),
    maximum: Object.freeze([8.2, 2.75, 5.1] as const),
  }),
  playerPrismMarkers: Object.freeze([
    Object.freeze({
      right: 0.34,
      forward: 0,
      height: 0.48,
      scale: Object.freeze([0.14, 0.09, 0.18] as const),
    }),
    Object.freeze({
      right: -0.34,
      forward: 0,
      height: 0.48,
      scale: Object.freeze([0.14, 0.09, 0.18] as const),
    }),
    Object.freeze({
      right: 0,
      forward: 0.38,
      height: 0.56,
      scale: Object.freeze([0.1, 0.1, 0.15] as const),
    }),
  ]),
  forgeRingScales: Object.freeze([0.82, 1.18, 1.53]),
  palette: Object.freeze({
    stone: color(0.32, 0.35, 0.31),
    darkStone: color(0.18, 0.21, 0.19),
    moss: color(0.2, 0.34, 0.2),
    verdigris: color(0.16, 0.42, 0.35),
    oldBrass: color(0.5, 0.35, 0.17),
    forge: color(0.72, 0.58, 0.28),
    bone: color(0.76, 0.73, 0.61),
    player: color(0.82, 0.84, 0.72),
    shade: color(0.28, 0.2, 0.3),
    contactShadow: color(0.055, 0.07, 0.06),
    danger: color(0.74, 0.08, 0.12),
    integrity: color(0.3, 0.84, 0.43),
  }),
});
