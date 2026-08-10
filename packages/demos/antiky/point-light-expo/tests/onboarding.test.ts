import assert from 'node:assert/strict';
import test from 'node:test';

import { RELAY_ONBOARDING_CUES } from '../src/onboarding-cues.ts';

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
