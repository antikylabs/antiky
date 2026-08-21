import assert from 'node:assert/strict';
import test from 'node:test';

import { createPresentedView } from '../src/presented-view.ts';
import { type CombatInput } from '../src/combat/state.ts';
import { createCombatSimulation, type CombatSnapshot } from '../src/simulation.ts';

const IDLE: CombatInput = {
  movement: { x: 0, z: 0, active: false },
  aim: { x: 0, z: 1 },
  attack: false,
};

function input(overrides: Partial<CombatInput> = {}): CombatInput {
  return { ...IDLE, ...overrides };
}

/** Runs past the intro so the player can actually move. */
function liveSimulation() {
  const simulation = createCombatSimulation(() => {});
  const view = simulation.view() as CombatSnapshot;
  while (view.phase !== 'combat') simulation.update(1 / 60, IDLE);
  return { simulation, view };
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

  // A dropped frame can make the accumulator ratio exceed 1 before the caller's own guard runs.
  // Extrapolating would put the player somewhere the simulation never placed them.
  assert.equal(presented.present(4).player.x, endX);
  assert.equal(presented.present(-3).player.x, startX);
});

test('discrete state is never blended, only positions', () => {
  const { simulation, view } = liveSimulation();
  const presented = createPresentedView(view);
  presented.capture();
  for (let step = 0; step < 300; step += 1) {
    simulation.update(1 / 60, input({ attack: true }));
  }

  const midway = presented.present(0.5);
  // Half a phase is not a phase, and half an integer hull is not a hull count.
  assert.equal(midway.phase, view.phase);
  assert.equal(midway.player.hull, view.player.hull);
  assert.equal(Number.isInteger(midway.player.hull), true);
  assert.equal(midway.round, view.round);
  assert.equal(midway.revision, view.revision);
});

test('presenting allocates no new snapshot per frame', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  // The render loop calls this every frame. Returning a fresh object each time would make the
  // demo's garbage proportional to frame rate.
  assert.equal(presented.present(0.5), presented.present(0.25));
  assert.equal(presented.present(0.5).player, presented.present(0.25).player);
});

test('a teleport snaps instead of dragging the enemy across the arena', () => {
  const { view } = liveSimulation();
  const presented = createPresentedView(view);
  const enemy = view.enemies[0] as { x: number; z: number };
  const spawnX = enemy.x;
  presented.capture();

  enemy.x = spawnX + 40;
  const midway = presented.present(0.5).enemies[0]!;
  assert.equal(midway.x, spawnX + 40, 'a jump larger than any step must not be interpolated');

  // A normal step-sized move still blends.
  presented.capture();
  enemy.x = spawnX + 40.3;
  assert.ok(Math.abs(presented.present(0.5).enemies[0]!.x - (spawnX + 40.15)) < 1e-9);
});
