import assert from 'node:assert/strict';
import test from 'node:test';

import { createTraversalCaptureFixture } from '../src/capture-fixture.ts';
import { createTraversalSimulation } from '../src/simulation.ts';

test('traversal capture controls are game-owned and never change simulation state', () => {
  const fixture = createTraversalCaptureFixture();
  const simulation = createTraversalSimulation(() => {});
  const digest = simulation.digest();
  fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [
      { kind: 'scene-visibility', group: 'scene-geometry', visible: false },
      { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } },
      { kind: 'variant', name: 'vignette', enabled: false },
    ],
  });
  assert.equal(simulation.digest(), digest);
  assert.equal(fixture.read().sceneVisibility['scene-geometry'], false);
  assert.throws(() => fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'variant', name: 'renderer', enabled: false }],
  }));
});
