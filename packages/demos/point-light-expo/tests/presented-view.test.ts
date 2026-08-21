import assert from 'node:assert/strict';
import test from 'node:test';

import { createPresentedView } from '../src/presented-view.ts';
import {
  createBlackoutRelaySimulation,
  type RelayInput,
  type RelaySnapshot,
} from '../src/simulation.ts';

const IDLE: RelayInput = {
  movement: { x: 0, z: 0, active: false },
  interact: false,
  lightPowers: [1, 1, 1],
};

function input(overrides: Partial<RelayInput> = {}): RelayInput {
  return { ...IDLE, ...overrides };
}

function liveSimulation() {
  const simulation = createBlackoutRelaySimulation(() => {});
  return { simulation, view: simulation.view() as RelaySnapshot };
}

test('presented positions sit between the previous and current simulation states', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);

  presented.capture();
  const startX = view.player.x;
  for (let step = 0; step < 40; step += 1) {
    simulation.update(1 / 60, input({ movement: { x: 1, z: 0, active: true } }));
  }
  const endX = view.player.x;
  assert.notEqual(startX, endX, 'the player must actually move for this test to mean anything');

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
  for (let step = 0; step < 30; step += 1) {
    simulation.update(1 / 60, input({ movement: { x: 1, z: 0, active: true } }));
  }
  const endX = view.player.x;

  // A dropped frame can push the accumulator ratio past 1. Extrapolating would put the player
  // somewhere the simulation never placed them.
  assert.equal(presented.present(4).player.x, endX);
  assert.equal(presented.present(-3).player.x, startX);
});

test('discrete state is never blended, only positions', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);
  presented.capture();
  for (let step = 0; step < 240; step += 1) {
    simulation.update(1 / 60, input({ interact: true }));
  }

  const midway = presented.present(0.5);
  assert.equal(midway.status, view.status);
  assert.equal(midway.run, view.run);
  assert.equal(midway.revision, view.revision);
  assert.equal(midway.integrity, view.integrity);
});

test('presenting allocates no new snapshot per frame', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  assert.equal(presented.present(0.5), presented.present(0.25));
  assert.equal(presented.present(0.5).player, presented.present(0.25).player);
});

test('a teleport snaps instead of dragging a shade across the arena', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  const shade = view.shades[0] as { x: number; z: number };
  const spawnX = shade.x;
  presented.capture();

  shade.x = spawnX + 40;
  assert.equal(presented.present(0.5).shades[0]!.x, spawnX + 40);

  presented.capture();
  shade.x = spawnX + 40.3;
  assert.ok(Math.abs(presented.present(0.5).shades[0]!.x - (spawnX + 40.15)) < 1e-9);
});
