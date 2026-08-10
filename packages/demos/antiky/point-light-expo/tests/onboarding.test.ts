import assert from 'node:assert/strict';
import test from 'node:test';

import * as onboardingCues from '../src/onboarding-cues.ts';

const { RELAY_ONBOARDING_CUES, relayOnboardingOpacity } = onboardingCues;

test('onboarding teaches relay identity, charge, and deposit in playable order', () => {
  assert.deepEqual(
    RELAY_ONBOARDING_CUES.map((cue) => cue.kind),
    ['move', 'identify-relay', 'charge', 'deposit'],
  );
  const identityCue = RELAY_ONBOARDING_CUES.find((cue) => cue.kind === 'identify-relay');
  assert.deepEqual(identityCue?.relayMarkerCounts, [1, 2, 3]);
  const chargeCue = RELAY_ONBOARDING_CUES.find((cue) => cue.kind === 'charge');
  assert.equal(chargeCue?.field, 'inner-ring');
});

test('onboarding occupies a compact strip and clears before active relay play', () => {
  const presentation = (
    onboardingCues as typeof onboardingCues & {
      RELAY_ONBOARDING_PRESENTATION?: Readonly<{
        scale: readonly [number, number];
        offset: readonly [number, number];
        fullVisibleSeconds: number;
        fadeSeconds: number;
      }>;
      RELAY_ONBOARDING_ROWS?: readonly (readonly unknown[])[];
    }
  ).RELAY_ONBOARDING_PRESENTATION;
  const rows = onboardingCues.RELAY_ONBOARDING_ROWS;

  assert.ok(presentation);
  assert.ok(rows);
  assert.ok(rows.length <= 2);
  assert.equal(rows.flat().length, RELAY_ONBOARDING_CUES.length);
  assert.ok(presentation.scale[1] <= 0.1);
  assert.ok(presentation.offset[1] <= -0.84);
  const lifetime = presentation.fullVisibleSeconds + presentation.fadeSeconds;
  assert.ok(lifetime <= 6);
  assert.equal(relayOnboardingOpacity(0, false, 'playing'), 1);
  assert.equal(relayOnboardingOpacity(presentation.fullVisibleSeconds, false, 'playing'), 1);
  assert.equal(relayOnboardingOpacity(
    presentation.fullVisibleSeconds + presentation.fadeSeconds / 2,
    false,
    'playing',
  ), 0.5);
  assert.equal(relayOnboardingOpacity(lifetime, false, 'playing'), 0);
  assert.equal(relayOnboardingOpacity(0, true, 'playing'), 0);
});
