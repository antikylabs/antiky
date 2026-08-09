import assert from 'node:assert/strict';
import test from 'node:test';

import { traversalCameraFrame } from '../src/presentation.ts';
import { createTraversalSimulation } from '../src/simulation.ts';

test('traversal camera leads the runner and expands for portrait canvases', () => {
  const state = createTraversalSimulation(() => {}).read();
  const wide = traversalCameraFrame(16 / 9, state, { x: 0.5, y: 0.5 });
  const portrait = traversalCameraFrame(9 / 16, state, { x: 0.5, y: 0.5 });

  assert.deepEqual(wide.position, [3.15, 4.65, 10.9]);
  assert.deepEqual(wide.target, [1.55, 1.25, -0.25]);
  assert.ok(portrait.position[1] > wide.position[1]);
  assert.ok(portrait.position[2] > wide.position[2]);
  assert.ok(portrait.position[0] < wide.position[0]);
});

test('traversal camera clamps pointer lift', () => {
  const state = createTraversalSimulation(() => {}).read();
  assert.deepEqual(
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 8 }),
    traversalCameraFrame(16 / 9, state, { x: 0.5, y: 1 }),
  );
});
