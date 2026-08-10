import assert from 'node:assert/strict';
import test from 'node:test';

import { createTraversalCameraRig, traversalCameraFrame } from '../src/presentation.ts';
import { createTraversalSimulation } from '../src/simulation.ts';

test('traversal camera uses velocity look-ahead, vertical anticipation, and portrait expansion', () => {
  const state = createTraversalSimulation(() => {}).read();
  const standing = traversalCameraFrame(16 / 9, state, { x: 0.5, y: 0.5 });
  const moving = traversalCameraFrame(16 / 9, {
    player: { ...state.player, vx: 4, vy: 5 },
  }, { x: 0.5, y: 0.5 });
  const portrait = traversalCameraFrame(9 / 16, state, { x: 0.5, y: 0.5 });

  assert.ok(moving.target[0] > standing.target[0]);
  assert.ok(moving.target[1] > standing.target[1]);
  assert.ok(portrait.position[1] > standing.position[1]);
  assert.ok(portrait.position[2] > standing.position[2]);
});

test('camera rig eases ordinary motion but snaps on a checkpoint reset', () => {
  const initial = createTraversalSimulation(() => {}).read();
  const rig = createTraversalCameraRig();
  const first = rig.update(16 / 9, initial, { x: 0.5, y: 0.5 }, 1 / 60);
  const moved = { ...initial, player: { ...initial.player, x: initial.player.x + 20 } };
  const eased = rig.update(16 / 9, moved, { x: 0.5, y: 0.5 }, 1 / 60);
  const ideal = traversalCameraFrame(16 / 9, moved, { x: 0.5, y: 0.5 });
  assert.ok(eased.position[0] > first.position[0]);
  assert.ok(eased.position[0] < ideal.position[0]);

  const reset = rig.update(16 / 9, { ...moved, resetSerial: 1 }, { x: 0.5, y: 0.5 }, 1 / 60);
  assert.deepEqual(reset, ideal);
});

test('traversal camera clamps pointer lift', () => {
  const state = createTraversalSimulation(() => {}).read();
  assert.deepEqual(
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 8 }),
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 1 }),
  );
});
