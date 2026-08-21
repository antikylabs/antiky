import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelayCaptureFixture } from '../src/capture-fixture.ts';
import { createBlackoutRelaySimulation } from '../src/simulation.ts';

test('relay capture controls are game-owned and never change simulation state', () => {
  const fixture = createRelayCaptureFixture();
  const simulation = createBlackoutRelaySimulation(() => {});
  const digest = simulation.digest();
  fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [
      { kind: 'scene-visibility', group: 'scene-geometry', visible: false },
      { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } },
    ],
  });
  assert.equal(simulation.digest(), digest);
  assert.deepEqual(fixture.read().cameraTranslation, { x: 0.5, y: 0, z: 0 });
  assert.throws(() => fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'variant', name: 'bloom', enabled: false }],
  }));
});
