import assert from 'node:assert/strict';
import test from 'node:test';

import { combatCameraFrame } from '../src/presentation.ts';
import { createCombatSimulation } from '../src/simulation.ts';

test('combat camera keeps the action framed for wide and portrait canvases', () => {
  const state = createCombatSimulation(() => {}).read();
  const wide = combatCameraFrame(16 / 9, state, { x: 0.5, y: 0.5 });
  const portrait = combatCameraFrame(9 / 16, state, { x: 0.5, y: 0.5 });

  assert.deepEqual(wide.position, [0, 13.4, 14.89]);
  assert.deepEqual(wide.target, [0, 0.3, 1.53]);
  assert.ok(portrait.position[1] > wide.position[1]);
  assert.ok(portrait.position[2] > wide.position[2]);
  assert.ok(portrait.target[2] > wide.target[2]);
});

test('combat camera pointer drift is clamped and deterministic', () => {
  const state = createCombatSimulation(() => {}).read();
  const first = combatCameraFrame(16 / 9, state, { x: 4, y: -3 });
  const second = combatCameraFrame(16 / 9, state, { x: 1, y: 0 });

  assert.deepEqual(first, second);
  assert.equal(first.position[0], 0.85);
  assert.equal(first.position[1], 13.075000000000001);
});
