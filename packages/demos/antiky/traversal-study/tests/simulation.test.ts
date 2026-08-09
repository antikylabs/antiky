import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTraversalSimulation,
  platformInstancesNear,
  type TraversalEvent,
} from '../src/simulation.ts';

const attractInput = Object.freeze({ horizontal: 0, active: false, jump: false });

test('the attract loop runs, jumps, lands, and advances through the course', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  let maximumHeight = 0;
  for (let frame = 0; frame < 360; frame += 1) {
    simulation.update(1 / 60, attractInput);
    maximumHeight = Math.max(maximumHeight, simulation.view().player.y);
  }

  const snapshot = simulation.read();
  assert.ok(snapshot.distance > 8);
  assert.ok(snapshot.jumps >= 2);
  assert.ok(maximumHeight > 1.6);
  assert.ok(events.some((event) => event.type === 'traversal.jump'));
  assert.ok(events.some((event) => event.type === 'traversal.land'));
});

test('moving platform positions are deterministic and repeat around the runner', () => {
  const first = platformInstancesNear(42, 1.25);
  const second = platformInstancesNear(42, 1.25);
  assert.deepEqual(first, second);
  assert.equal(first.length, 24);
  assert.ok(first.some((platform) => platform.definition.amplitude > 0));
});

test('manual left input reverses the runner without producing invalid coordinates', () => {
  const simulation = createTraversalSimulation(() => {});
  const left = Object.freeze({ horizontal: -1, active: true, jump: false });
  for (let frame = 0; frame < 90; frame += 1) simulation.update(1 / 60, left);
  const snapshot = simulation.read();
  assert.ok(snapshot.player.x < 0);
  assert.ok(Number.isFinite(snapshot.player.y));
  assert.equal(snapshot.player.facing, -1);
});
