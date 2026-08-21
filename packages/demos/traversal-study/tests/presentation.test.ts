import assert from 'node:assert/strict';
import test from 'node:test';

import { createCamera } from 'brometal';

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
  assert.ok(moving.target[0] - standing.target[0] >= 3);
  assert.ok(moving.target[1] - standing.target[1] >= 0.65);
  assert.ok(moving.position[2] - standing.position[2] >= 0.55);
  assert.ok(portrait.position[1] > standing.position[1]);
  assert.ok(portrait.position[2] > standing.position[2]);
});

test('camera rig eases ordinary motion but snaps on a checkpoint reset', () => {
  const initial = createTraversalSimulation(() => {}).read();
  const rig = createTraversalCameraRig();
  const first = rig.update(16 / 9, initial, { x: 0.5, y: 0.5 }, 1 / 60);
  const firstPositionX = first.position[0];
  const moved = { ...initial, player: { ...initial.player, x: initial.player.x + 20 } };
  const eased = rig.update(16 / 9, moved, { x: 0.5, y: 0.5 }, 1 / 60);
  const ideal = traversalCameraFrame(16 / 9, moved, { x: 0.5, y: 0.5 });
  assert.ok(eased.position[0] > firstPositionX);
  assert.ok(eased.position[0] < ideal.position[0]);

  const reset = rig.update(16 / 9, { ...moved, resetSerial: 1 }, { x: 0.5, y: 0.5 }, 1 / 60);
  assert.deepEqual(reset, ideal);
});

test('camera rig reuses its frame and vector storage across steady presentation updates', () => {
  const state = createTraversalSimulation(() => {}).read();
  const rig = createTraversalCameraRig();
  const first = rig.update(16 / 9, state, { x: 0.5, y: 0.5 }, 1 / 60);
  const position = first.position;
  const target = first.target;
  const second = rig.update(16 / 9, state, { x: 0.5, y: 0.5 }, 1 / 60);

  assert.strictEqual(second, first);
  assert.strictEqual(second.position, position);
  assert.strictEqual(second.target, target);
});

test('portrait sprint framing keeps the courier inside the projected safe area', () => {
  const aspect = 9 / 16;
  const state = createTraversalSimulation(() => {}).read();
  const sprint = {
    ...state,
    player: { ...state.player, x: 80, y: 0.43, vx: 6.35, vy: 0 },
  };
  const frame = traversalCameraFrame(aspect, sprint, { x: 0.5, y: 0.5 });
  const camera = createCamera({ position: frame.position, fovY: Math.PI / 3.6, near: 0.1, far: 240 });
  camera.lookAt(...frame.target);
  const matrix = camera.viewProjection(aspect);
  const clipX = matrix[0]! * sprint.player.x + matrix[4]! * sprint.player.y + matrix[12]!;
  const clipW = matrix[3]! * sprint.player.x + matrix[7]! * sprint.player.y + matrix[15]!;
  const ndcX = clipX / clipW;

  assert.ok(ndcX >= -0.82 && ndcX <= 0.82, `portrait courier projected to ${ndcX}`);
});

test('traversal camera clamps pointer lift', () => {
  const state = createTraversalSimulation(() => {}).read();
  assert.deepEqual(
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 8 }),
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 1 }),
  );
});
