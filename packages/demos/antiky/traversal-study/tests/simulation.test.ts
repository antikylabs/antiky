import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COURSE_PLATFORMS,
  STORM_DURATION_SECONDS,
  createTraversalSimulation,
  platformInstancesNear,
  type TraversalEvent,
  type TraversalInput,
} from '../src/simulation.ts';
import { canonicalAttractCommand } from '../src/attract-controller.ts';

const idleInput = Object.freeze({ horizontal: 0, active: false, jump: false });
const rightInput = Object.freeze({ horizontal: 1, active: true, jump: false, retry: true });

function advance(seconds: number, input: TraversalInput, events: TraversalEvent[] = []) {
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let frame = 0; frame < seconds * 60; frame += 1) simulation.update(1 / 60, input);
  return simulation;
}

function manualDeliveryWithHeldRetry() {
  const simulation = createTraversalSimulation(() => {});
  let held: TraversalInput = { horizontal: 0.2, active: true, jump: false, retry: true };
  for (let frame = 0; frame < 70 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    const command = canonicalAttractCommand(simulation.view());
    held = { horizontal: 0.2, active: true, jump: command.jump, retry: true };
    simulation.update(1 / 60, held);
  }
  return { simulation, held };
}

test('the canonical attract trace does not collapse into a repeated fall-reset loop', () => {
  const events: TraversalEvent[] = [];
  const simulation = advance(80, idleInput, events);
  const snapshot = simulation.read();

  assert.equal(snapshot.outcome, 'delivered');
  assert.equal(snapshot.falls, 0);
  assert.equal(snapshot.parcelSeals, 3);
  assert.equal(snapshot.checkpointIndex, 2);
  assert.equal(snapshot.collectedSeal, true);
  assert.ok(snapshot.attemptTime >= 45 && snapshot.attemptTime <= 70);
  assert.ok(events.some((event) => event.type === 'traversal.delivery'));
  assert.ok(events.some((event) => event.type === 'traversal.seal-collected'));
});

test('the traversal course reaches an explicit terminal delivery instead of repeating forever', () => {
  const simulation = advance(80, idleInput);
  const delivered = simulation.read();
  assert.equal(delivered.outcome, 'delivered');
  assert.ok(delivered.distance <= 170);

  for (let frame = 0; frame < 10 * 60; frame += 1) simulation.update(1 / 60, idleInput);
  assert.deepEqual(simulation.read().player, delivered.player);
});

test('movement held through delivery preserves the result until release and a fresh edge', () => {
  const { simulation, held } = manualDeliveryWithHeldRetry();
  assert.equal(simulation.read().outcome, 'delivered');
  const deliveredAttempt = simulation.read().attempt;

  for (let frame = 0; frame < 5; frame += 1) simulation.update(1 / 60, held);
  assert.equal(simulation.read().outcome, 'delivered');
  assert.equal(simulation.read().attempt, deliveredAttempt);

  simulation.update(1 / 60, idleInput);
  simulation.update(1 / 60, { horizontal: 1, active: true, jump: false, retry: true });
  assert.equal(simulation.read().outcome, 'running');
  assert.equal(simulation.read().attempt, deliveredAttempt + 1);
});

test('moving platforms are deterministic members of one finite authored course', () => {
  const first = platformInstancesNear(42, 1.25);
  const second = platformInstancesNear(142, 1.25);
  assert.deepEqual(first, second);
  assert.equal(first.length, COURSE_PLATFORMS.length);
  assert.ok(first.some((platform) => platform.definition.amplitude > 0));
  assert.ok(first.every((platform) => platform.lap === 0));
});

test('player input immediately takes manual authority and never auto-jumps', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let frame = 0; frame < 7 * 60 && !events.some((event) => event.type === 'traversal.seal-lost'); frame += 1) {
    simulation.update(1 / 60, rightInput);
  }
  const snapshot = simulation.read();
  assert.equal(snapshot.controlMode, 'manual');
  assert.equal(snapshot.jumps, 0);
  assert.ok(events.some((event) => event.type === 'traversal.seal-lost'));
  assert.ok(Number.isFinite(snapshot.player.y));
});

test('manual steering magnitude creates a deliberate pace choice', () => {
  const cruise = advance(1, { horizontal: 0.35, active: true, jump: false }).read();
  const sprint = advance(1, rightInput).read();
  assert.ok(sprint.distance > cruise.distance + 0.7);
  assert.ok(sprint.player.vx > cruise.player.vx);
});

test('three lost parcel seals fail the run and any fresh player action retries immediately', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let frame = 0; frame < 30 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    simulation.update(1 / 60, rightInput);
  }
  assert.equal(simulation.read().outcome, 'failed');
  assert.equal(simulation.read().failureReason, 'parcel-seals');
  assert.equal(simulation.read().parcelSeals, 0);

  simulation.update(1 / 60, { ...rightInput, retry: true });
  assert.equal(simulation.read().outcome, 'failed');

  simulation.update(1 / 60, idleInput);
  simulation.update(1 / 60, { horizontal: 0, active: true, jump: true, retry: true });
  const retried = simulation.read();
  assert.equal(retried.outcome, 'running');
  assert.equal(retried.attempt, 2);
  assert.equal(retried.parcelSeals, 3);
  assert.equal(retried.checkpointIndex, 0);
  assert.ok(events.some((event) => event.type === 'traversal.retry'));
});

test('a stationary manual attempt fails when the storm timer expires', () => {
  const simulation = createTraversalSimulation(() => {});
  const heldBrake = { horizontal: 0, active: true, jump: false, brake: true, retry: true };
  simulation.update(1 / 60, heldBrake);
  for (let frame = 0; frame < (STORM_DURATION_SECONDS + 1) * 60; frame += 1) {
    simulation.update(1 / 60, heldBrake);
    if (simulation.view().outcome === 'failed') break;
  }
  assert.equal(simulation.read().outcome, 'failed');
  assert.equal(simulation.read().failureReason, 'storm');
  assert.equal(simulation.read().remainingTime, 0);
  const failedAttempt = simulation.read().attempt;
  simulation.update(1 / 60, heldBrake);
  assert.equal(simulation.read().outcome, 'failed');
  assert.equal(simulation.read().attempt, failedAttempt);

  simulation.update(1 / 60, idleInput);
  simulation.update(1 / 60, heldBrake);
  assert.equal(simulation.read().outcome, 'running');
  assert.equal(simulation.read().attempt, failedAttempt + 1);
});
