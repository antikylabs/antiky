export type PresentationVec3 = readonly [number, number, number];

function color(red: number, green: number, blue: number): PresentationVec3 {
  return Object.freeze([red, green, blue]);
}

export const RELAY_PRESENTATION = Object.freeze({
  clearColor: Object.freeze([0.035, 0.056, 0.05, 1] as const),
  exposure: 1.24,
  relayLightStrength: 0.74,
  /**
   * Bloom, in pre-exposure linear units.
   *
   * `threshold` sits above what a lit diffuse surface reaches and below the relays and the forge, so
   * the glow picks out things that are actually emitting rather than everything the sun caught.
   * `radius` is in quarter-resolution texels; `strength` is how much of the blurred result is added
   * back.
   */
  bloom: Object.freeze({
    threshold: 1,
    radius: 5,
    strength: 1.15,
  }),
  /**
   * Goal 08's night grade. §6.1 calls this a night scene whose practicals are the key, and the
   * capture measured a mid-bright frame (encoded p50 0.356 against a 0.18-0.32 band) whose ground
   * texture held 95% of the chromatic pixels in one warm cluster. The ambients drop to true night
   * levels so the practicals' pools read as light arriving, and the floor tint cools into the
   * narrow blue-green band the brief reserves for the environment.
   */
  surfaceAmbient: Object.freeze({
    color: color(0.34, 0.4, 0.36),
    strength: 0.5,
  }),
  floorAmbient: Object.freeze({
    color: color(0.3, 0.36, 0.3),
    strength: 0.55,
  }),
  floorDiffuseTint: color(0.5, 0.62, 0.6),
  catalogMaterial: Object.freeze({
    ambientStrength: 0.62,
  }),
  fog: Object.freeze({
    color: color(0.06, 0.085, 0.075),
    /**
     * Camera distance, and that matters: the eye sits 18 up and 10.5 back, so the whole floor
     * lives between roughly 19 and 26 units from it. The old 10..21 range only worked because the
     * 0.34 cap kept it from finishing; at full mix it drowned the entire scene in one flat green —
     * measured p95 0.298 with local contrast 0.13. 19..26 clears the play area and completes
     * exactly at the plane's far corner, which is the edge the fog exists to dissolve.
     */
    start: 19,
    end: 26,
    /**
     * 1 at the far end, up from 0.34: the fog is finally allowed to finish its job and dissolve
     * the ground plane's boundary into the horizon haze, which is goal 08's fix for the hard-edged
     * quad floating in a void.
     */
    maximumMix: 1,
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
