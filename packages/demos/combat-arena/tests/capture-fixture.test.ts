import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatCaptureFixture } from '../src/capture-fixture.ts';
import { createCombatSimulation } from '../src/simulation.ts';

test('combat capture controls are game-owned and never change simulation state', () => {
  const fixture = createCombatCaptureFixture();
  const simulation = createCombatSimulation(() => {});
  const digest = simulation.digest();
  const result = fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [
      { kind: 'scene-visibility', group: 'scene-geometry', visible: false },
      { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } },
      { kind: 'variant', name: 'bloom', enabled: false },
    ],
  });
  assert.equal(simulation.digest(), digest);
  assert.deepEqual(result.appliedControls, [
    { kind: 'scene-visibility', group: 'scene-geometry', visible: false },
    { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } },
    { kind: 'variant', name: 'bloom', enabled: false },
  ]);
  assert.throws(() => fixture.apply({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'camera-translation', delta: { x: 0.51, y: 0, z: 0 } }],
  }));
});
