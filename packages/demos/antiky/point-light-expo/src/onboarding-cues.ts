export type RelayOnboardingCue = Readonly<{
  kind: 'move' | 'identify-relay' | 'charge' | 'deposit';
  label: string;
  relayMarkerCounts: readonly number[] | null;
  field: 'inner-ring' | null;
}>;

export const RELAY_ONBOARDING_CUES: readonly RelayOnboardingCue[] = Object.freeze([
  Object.freeze({
    kind: 'move',
    label: 'WASD / ARROWS  —  MOVE',
    relayMarkerCounts: null,
    field: null,
  }),
  Object.freeze({
    kind: 'identify-relay',
    label: '1 / 2 / 3 STONE BEADS  —  CHOOSE RELAY',
    relayMarkerCounts: Object.freeze([1, 2, 3]),
    field: null,
  }),
  Object.freeze({
    kind: 'charge',
    label: 'STAND INSIDE INNER RING  —  BUILD CHARGE',
    relayMarkerCounts: null,
    field: 'inner-ring',
  }),
  Object.freeze({
    kind: 'deposit',
    label: 'THEN CLICK AT FORGE  —  DEPOSIT',
    relayMarkerCounts: null,
    field: null,
  }),
]);
