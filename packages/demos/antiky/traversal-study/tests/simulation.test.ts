import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COURSE_PLATFORMS,
  COURSE_LENGTH,
  MANUAL_TOP_SPEED,
  STORM_DURATION_SECONDS,
  createTraversalSimulation,
  platformInstancesNear,
  type TraversalEvent,
  type TraversalInput,
} from '../src/simulation.ts';
import { canonicalAttractCommand } from '../src/attract-controller.ts';
import { COURSE_BEATS, COURSE_CHECKPOINTS, COURSE_HAZARDS, hazardTop } from '../src/course.ts';

const idleInput = Object.freeze({ horizontal: 0, active: false, jump: false });
const rightInput = Object.freeze({ horizontal: 1, active: true, jump: false, retry: true });

function advance(seconds: number, input: TraversalInput, events: TraversalEvent[] = []) {
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let frame = 0; frame < seconds * 60; frame += 1) simulation.update(1 / 60, input);
  return simulation;
}

function reachOpeningTakeoff(simulation: ReturnType<typeof createTraversalSimulation>): void {
  while (simulation.view().player.x < 6.55) simulation.update(1 / 60, rightInput);
}

function manualDeliveryWithHeldRetry() {
  const simulation = createTraversalSimulation(() => {});
  let held: TraversalInput = { horizontal: 0.2, active: true, jump: false, retry: true };
  let jumpHoldFrames = 0;
  for (let frame = 0; frame < 70 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    const command = canonicalAttractCommand(simulation.view());
    if (command.jump) jumpHoldFrames = 22;
    held = { horizontal: 0.2, active: true, jump: jumpHoldFrames > 0, retry: true };
    simulation.update(1 / 60, held);
    jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);
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
  assert.ok(snapshot.attemptTime >= 35 && snapshot.attemptTime <= 42);
  assert.ok(snapshot.distance / snapshot.attemptTime >= 4.2);
  assert.ok(events.some((event) => event.type === 'traversal.delivery'));
  assert.ok(events.some((event) => event.type === 'traversal.seal-collected'));
});

test('full steering meets the runner response budget within one tenth of a second', () => {
  const simulation = createTraversalSimulation(() => {});
  const startX = simulation.read().player.x;
  for (let frame = 0; frame < 6; frame += 1) simulation.update(1 / 60, rightInput);

  const snapshot = simulation.read();
  assert.ok(snapshot.player.vx >= 5.2, `expected >= 5.2 units/s, received ${snapshot.player.vx}`);
  assert.ok(snapshot.player.x - startX >= 0.3, `expected >= 0.3 units, received ${snapshot.player.x - startX}`);
});

test('release and reversal stay within the grounded response budget', () => {
  const simulation = createTraversalSimulation(() => {});
  for (let frame = 0; frame < 30; frame += 1) simulation.update(1 / 60, rightInput);
  assert.ok(simulation.read().player.vx >= MANUAL_TOP_SPEED * 0.9);

  let releaseFrames = 0;
  while (releaseFrames < 7 && Math.abs(simulation.view().player.vx) > MANUAL_TOP_SPEED * 0.2) {
    simulation.update(1 / 60, idleInput);
    releaseFrames += 1;
  }
  assert.ok(releaseFrames <= 7, `release took ${releaseFrames} frames`);

  for (let frame = 0; frame < 20; frame += 1) simulation.update(1 / 60, rightInput);
  let zeroCrossFrames = 0;
  while (zeroCrossFrames < 6 && simulation.view().player.vx > 0) {
    simulation.update(1 / 60, { horizontal: -1, active: true, jump: false });
    zeroCrossFrames += 1;
  }
  assert.ok(zeroCrossFrames <= 6, `reversal crossed zero in ${zeroCrossFrames} frames`);
  for (let frame = zeroCrossFrames; frame < 13; frame += 1) {
    simulation.update(1 / 60, { horizontal: -1, active: true, jump: false });
  }
  assert.ok(simulation.read().player.vx <= -MANUAL_TOP_SPEED * 0.9);
});

test('releasing jump cuts the manual hop without delaying the accepted step', () => {
  const held = createTraversalSimulation(() => {});
  const tapped = createTraversalSimulation(() => {});
  held.update(1 / 60, { horizontal: 0, active: true, jump: true });
  tapped.update(1 / 60, { horizontal: 0, active: true, jump: true });
  assert.ok(held.read().player.vy > 0);
  assert.ok(tapped.read().player.vy > 0);

  let heldApex = held.read().player.y;
  let tappedApex = tapped.read().player.y;
  for (let frame = 0; frame < 45; frame += 1) {
    held.update(1 / 60, { horizontal: 0, active: true, jump: frame < 14 });
    tapped.update(1 / 60, { horizontal: 0, active: true, jump: false });
    heldApex = Math.max(heldApex, held.read().player.y);
    tappedApex = Math.max(tappedApex, tapped.read().player.y);
  }
  assert.ok(heldApex - tappedApex >= 0.55, `held ${heldApex}, tapped ${tappedApex}`);
});

test('coyote time accepts a jump four fixed steps after leaving a ledge', () => {
  const simulation = createTraversalSimulation(() => {});
  reachOpeningTakeoff(simulation);
  let landed = false;
  for (let frame = 0; frame < 90 && !landed; frame += 1) {
    simulation.update(1 / 60, { horizontal: 1, active: true, jump: frame < 22 });
    landed = frame > 22 && simulation.view().player.grounded;
  }
  assert.equal(landed, true);

  let airborneFrames = 0;
  while (simulation.view().player.grounded || airborneFrames < 4) {
    simulation.update(1 / 60, { horizontal: 1, active: true, jump: false });
    if (!simulation.view().player.grounded) airborneFrames += 1;
  }
  const jumpsBefore = simulation.read().jumps;
  simulation.update(1 / 60, { horizontal: 1, active: true, jump: true });
  assert.equal(simulation.read().jumps, jumpsBefore + 1);
  assert.ok(simulation.read().player.vy > 0);
});

test('jump buffering preserves a press made five fixed steps before landing', () => {
  const landingProbe = createTraversalSimulation(() => {});
  reachOpeningTakeoff(landingProbe);
  let previousGrounded = landingProbe.view().player.grounded;
  let landingFrame = -1;
  for (let frame = 0; frame < 90; frame += 1) {
    landingProbe.update(1 / 60, { horizontal: 1, active: true, jump: frame < 22 });
    if (!previousGrounded && landingProbe.view().player.grounded) {
      landingFrame = frame;
      break;
    }
    previousGrounded = landingProbe.view().player.grounded;
  }
  assert.ok(landingFrame >= 6);

  const buffered = createTraversalSimulation(() => {});
  reachOpeningTakeoff(buffered);
  for (let frame = 0; frame <= landingFrame + 1; frame += 1) {
    const initialHold = frame < 22;
    const bufferedPress = frame >= landingFrame - 5;
    buffered.update(1 / 60, { horizontal: 1, active: true, jump: initialHold || bufferedPress });
  }
  assert.equal(buffered.read().jumps, 2);
  assert.ok(buffered.read().player.vy > 0);
});

test('a clean full-steering manual trace stays readable while beating the storm', () => {
  const simulation = createTraversalSimulation(() => {});
  let jumpHoldFrames = 0;
  for (let frame = 0; frame < 45 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    const command = canonicalAttractCommand(simulation.view());
    if (command.jump) jumpHoldFrames = 22;
    simulation.update(1 / 60, { horizontal: 1, active: true, jump: jumpHoldFrames > 0 });
    jumpHoldFrames = Math.max(0, jumpHoldFrames - 1);
  }
  const snapshot = simulation.read();
  assert.equal(snapshot.outcome, 'delivered');
  assert.equal(snapshot.falls, 0);
  assert.ok(snapshot.attemptTime >= 28 && snapshot.attemptTime <= 36, `manual trace took ${snapshot.attemptTime}s`);
});

test('the opening teaches with a jump and elevated landing in the first four seconds', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  let firstJumpTime = Number.POSITIVE_INFINITY;
  let firstElevatedLandingTime = Number.POSITIVE_INFINITY;

  for (let frame = 0; frame < 8 * 60; frame += 1) {
    simulation.update(1 / 60, idleInput);
    const latest = events.at(-1);
    if (latest?.type === 'traversal.jump' && !Number.isFinite(firstJumpTime)) {
      firstJumpTime = simulation.read().attemptTime;
    }
    if (latest?.type === 'traversal.land' && latest.platformIndex !== undefined) {
      const platform = COURSE_PLATFORMS[latest.platformIndex]!;
      if (platform.top >= 0.5 && !Number.isFinite(firstElevatedLandingTime)) {
        firstElevatedLandingTime = simulation.read().attemptTime;
      }
    }
  }

  assert.ok(firstJumpTime <= 1.6, `first jump arrived at ${firstJumpTime}s`);
  assert.ok(firstElevatedLandingTime <= 4, `first elevated landing arrived at ${firstElevatedLandingTime}s`);
  const firstRaisedPlatform = COURSE_PLATFORMS.find((platform) => platform.top >= 0.5)!;
  const dispatchX = COURSE_CHECKPOINTS[0]!.x;
  assert.ok(firstRaisedPlatform.x - firstRaisedPlatform.width * 0.5 - dispatchX <= 8);
});

test('the canonical route reaches an authored payoff every three to six seconds', () => {
  const simulation = createTraversalSimulation(() => {});
  const beatTimes: number[] = [];
  let nextBeat = 0;
  for (let frame = 0; frame < 50 * 60 && nextBeat < COURSE_BEATS.length; frame += 1) {
    simulation.update(1 / 60, idleInput);
    while (nextBeat < COURSE_BEATS.length && simulation.view().player.x >= COURSE_BEATS[nextBeat]!.x) {
      beatTimes.push(simulation.read().attemptTime);
      nextBeat += 1;
    }
  }
  assert.equal(beatTimes.length, COURSE_BEATS.length);
  assert.ok(beatTimes[0]! <= 1.6);
  for (let index = 1; index < beatTimes.length; index += 1) {
    const interval = beatTimes[index]! - beatTimes[index - 1]!;
    assert.ok(interval >= 3 && interval <= 6, `beat ${index} arrived after ${interval}s`);
  }
});

test('the traversal course reaches an explicit terminal delivery instead of repeating forever', () => {
  const simulation = advance(80, idleInput);
  const delivered = simulation.read();
  assert.equal(delivered.outcome, 'delivered');
  assert.ok(delivered.distance <= COURSE_LENGTH);

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
  const firstPlatform = first[0];
  const second = platformInstancesNear(142, 1.25);
  assert.strictEqual(second, first);
  assert.strictEqual(second[0], firstPlatform);
  assert.deepEqual(first, second);
  assert.equal(first.length, COURSE_PLATFORMS.length);
  assert.ok(first.some((platform) => platform.definition.amplitude > 0));
  assert.ok(first.every((platform) => platform.lap === 0));
});

test('Storm Cut spikes preserve their offset from the moving support at every phase', () => {
  const hazard = COURSE_HAZARDS.find((entry) => entry.id === 'storm-spikes')!;
  const support = COURSE_PLATFORMS.find((entry) => entry.id === 'storm-cut')!;
  const supportIndex = COURSE_PLATFORMS.indexOf(support);
  for (const time of [0, 0.75, 1.5, 2.25]) {
    const supportTop = platformInstancesNear(support.x, time)[supportIndex]?.top;
    assert.ok(supportTop !== undefined);
    assert.ok(Math.abs(hazardTop(hazard, time) - hazard.top - (supportTop - support.top)) < 1e-9);
  }
});

test('steady simulation views reuse the live snapshot envelope', () => {
  const simulation = createTraversalSimulation(() => {});
  const first = simulation.view();
  simulation.update(1 / 60, rightInput);
  const second = simulation.view();
  assert.strictEqual(second, first);
  assert.strictEqual(second.player, first.player);
  assert.strictEqual(second.effects, first.effects);
  assert.strictEqual(second.trail, first.trail);
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

test('one forward trace cannot chain-drain every seal on the teaching hazard', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let frame = 0; frame < 4 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    simulation.update(1 / 60, rightInput);
  }

  const firstHazardIndex = COURSE_HAZARDS.findIndex((hazard) => hazard.id === 'yard-spikes');
  const firstHazardLosses = events.filter(
    (event) => event.type === 'traversal.seal-lost' && event.hazardIndex === firstHazardIndex,
  );
  assert.equal(firstHazardLosses.length, 1);
  assert.equal(simulation.read().outcome, 'running');
  assert.ok(simulation.read().parcelSeals >= 1);
  assert.ok(events.some((event) => event.type === 'traversal.fall'));
});

test('the managed 10 fps KeyD and one-frame W trace keeps every seal through the opening route', () => {
  const events: TraversalEvent[] = [];
  const simulation = createTraversalSimulation((event) => events.push(event));
  for (let presentationFrame = 0; presentationFrame < 36; presentationFrame += 1) {
    for (let fixedStep = 0; fixedStep < 6; fixedStep += 1) {
      simulation.update(1 / 60, {
        horizontal: 1,
        active: true,
        jump: presentationFrame === 8,
      });
    }
  }

  assert.ok(events.some(
    (event) => event.type === 'traversal.mode-change' && event.controlMode === 'manual',
  ));
  assert.ok(events.some((event) => event.type === 'traversal.jump'));
  assert.ok(events.some((event) => event.type === 'traversal.land'));
  assert.equal(simulation.read().outcome, 'running');
  assert.equal(simulation.read().parcelSeals, 3);
  assert.equal(simulation.read().falls, 0);
  assert.ok(simulation.read().player.x >= 24);
});

test('manual steering magnitude creates a deliberate pace choice', () => {
  const cruise = advance(0.65, { horizontal: 0.35, active: true, jump: false }).read();
  const sprint = advance(0.65, rightInput).read();
  assert.ok(sprint.distance > cruise.distance + 0.45);
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
