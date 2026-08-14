/**
 * The overlay draws these strings and nothing else.
 *
 * They used to be four-field descriptors carrying a `kind`, a `field` and a `relayMarkerCounts`.
 * Only the label was ever drawn. The relay identity markers derive their own 1/2/3 counts from the
 * light index at `relay-visuals.ts:237-239`, so the counts here were a second copy that happened to
 * agree rather than the source anything read.
 */
export const RELAY_ONBOARDING_CUES: readonly string[] = Object.freeze([
  'WASD / ARROWS — MOVE',
  '1 / 2 / 3 BEADS — RELAY ID',
  'STAND IN INNER RING — BUILD CHARGE',
  'CLICK AT FORGE — DEPOSIT',
]);

export const RELAY_ONBOARDING_ROWS = Object.freeze([
  Object.freeze([RELAY_ONBOARDING_CUES[0]!, RELAY_ONBOARDING_CUES[1]!]),
  Object.freeze([RELAY_ONBOARDING_CUES[2]!, RELAY_ONBOARDING_CUES[3]!]),
]);

export const RELAY_ONBOARDING_PRESENTATION = Object.freeze({
  scale: Object.freeze([0.49, 0.09] as const),
  offset: Object.freeze([-0.49, -0.88] as const),
  fullVisibleSeconds: 3.5,
  fadeSeconds: 1.5,
});

export function relayOnboardingOpacity(
  time: number,
  hasDeposited: boolean,
  status: 'playing' | 'won' | 'lost',
): number {
  if (status !== 'playing' || hasDeposited) return 0;
  if (time <= RELAY_ONBOARDING_PRESENTATION.fullVisibleSeconds) return 1;
  const remaining = RELAY_ONBOARDING_PRESENTATION.fullVisibleSeconds
    + RELAY_ONBOARDING_PRESENTATION.fadeSeconds
    - time;
  return Math.max(0, Math.min(1, remaining / RELAY_ONBOARDING_PRESENTATION.fadeSeconds));
}
