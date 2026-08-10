export type RelayOnboardingCue = Readonly<{
  kind: 'move' | 'identify-relay' | 'charge' | 'deposit';
  label: string;
  relayMarkerCounts: readonly number[] | null;
  field: 'inner-ring' | null;
}>;

export const RELAY_ONBOARDING_CUES: readonly RelayOnboardingCue[] = Object.freeze([
  Object.freeze({
    kind: 'move',
    label: 'WASD / ARROWS — MOVE',
    relayMarkerCounts: null,
    field: null,
  }),
  Object.freeze({
    kind: 'identify-relay',
    label: '1 / 2 / 3 BEADS — RELAY ID',
    relayMarkerCounts: Object.freeze([1, 2, 3]),
    field: null,
  }),
  Object.freeze({
    kind: 'charge',
    label: 'STAND IN INNER RING — BUILD CHARGE',
    relayMarkerCounts: null,
    field: 'inner-ring',
  }),
  Object.freeze({
    kind: 'deposit',
    label: 'CLICK AT FORGE — DEPOSIT',
    relayMarkerCounts: null,
    field: null,
  }),
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
