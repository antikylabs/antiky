import assert from 'node:assert/strict';
import test from 'node:test';

import { createPresentedView } from '../src/presented-view.ts';
import {
  createTraversalSimulation,
  type TraversalInput,
  type TraversalSnapshot,
} from '../src/simulation.ts';

const IDLE: TraversalInput = { horizontal: 0, active: false, jump: false, brake: false, retry: false };

function input(overrides: Partial<TraversalInput> = {}): TraversalInput {
  return { ...IDLE, ...overrides };
}

function liveSimulation() {
  const simulation = createTraversalSimulation(() => {});
  return { simulation, view: simulation.view() as TraversalSnapshot };
}

test('presented positions sit between the previous and current simulation states', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);

  presented.capture();
  const startX = view.player.x;
  for (let step = 0; step < 20; step += 1) {
    simulation.update(1 / 60, input({ horizontal: 1, active: true }));
  }
  const endX = view.player.x;
  assert.notEqual(startX, endX, 'the runner must actually move for this test to mean anything');

  const half = presented.present(0.5).player.x;
  assert.ok(Math.abs(half - (startX + endX) / 2) < 1e-9, `expected the midpoint, got ${half}`);
  assert.equal(presented.present(1).player.x, endX);
  assert.equal(presented.present(0).player.x, startX);
});

test('an alpha outside 0..1 cannot overshoot the simulation', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);
  presented.capture();
  const startX = view.player.x;
  for (let step = 0; step < 20; step += 1) {
    simulation.update(1 / 60, input({ horizontal: 1, active: true }));
  }
  const endX = view.player.x;

  // A dropped frame can push the accumulator ratio past 1. Extrapolating would put the runner
  // somewhere the simulation never placed them — through a wall, in the worst case.
  assert.equal(presented.present(4).player.x, endX);
  assert.equal(presented.present(-3).player.x, startX);
});

test('discrete state is never blended, only position', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);
  presented.capture();
  for (let step = 0; step < 120; step += 1) {
    simulation.update(1 / 60, input({ horizontal: 1, active: true, jump: true }));
  }

  const midway = presented.present(0.5);
  assert.equal(midway.outcome, view.outcome);
  assert.equal(midway.checkpointIndex, view.checkpointIndex);
  assert.equal(midway.player.grounded, view.player.grounded);
  assert.equal(midway.revision, view.revision);
});

test('presenting allocates no new snapshot per frame', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  assert.equal(presented.present(0.5), presented.present(0.25));
  assert.equal(presented.present(0.5).player, presented.present(0.25).player);
});

test('a checkpoint respawn snaps instead of sliding the runner back across the course', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  const player = view.player as { x: number; y: number };
  const startX = player.x;
  presented.capture();

  player.x = startX - 30;
  assert.equal(presented.present(0.5).player.x, startX - 30);

  // A normal step-sized move still blends.
  presented.capture();
  player.x = startX - 29.7;
  assert.ok(Math.abs(presented.present(0.5).player.x - (startX - 29.85)) < 1e-9);
});
