import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRAVERSAL_COLLECTIBLE_IDS,
  TRAVERSAL_DELIVERY_ID,
  TRAVERSAL_HAZARD_IDS,
  TRAVERSAL_PARCEL_ID,
  TRAVERSAL_PLATFORM_IDS,
  TRAVERSAL_STORM_ID,
  createTraversalInspectionModel,
} from '../src/inspection.ts';
import { COYOTE_SECONDS, JUMP_BUFFER_SECONDS, STORM_DURATION_SECONDS, createTraversalSimulation } from '../src/simulation.ts';

const idle = Object.freeze({ horizontal: 0, active: false, jump: false });

test('inspection exposes acts, controls, checkpoints, seals, storm, outcomes, and individual course entities', () => {
  const inspection = createTraversalInspectionModel('traversal-inspection-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  for (let frame = 0; frame < 80 * 60; frame += 1) simulation.update(1 / 60, idle);

  const world = inspection.world(simulation.read());
  const events = inspection.events();
  assert.equal(world.entities.length, 30);
  assert.equal(world.relationships.length, 29);
  assert.equal(world.stores.length, 2);
  assert.ok(TRAVERSAL_PLATFORM_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));
  assert.ok(TRAVERSAL_HAZARD_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));
  assert.ok(TRAVERSAL_COLLECTIBLE_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));

  const storm = world.entities.find((entity) => entity.entityId === TRAVERSAL_STORM_ID)!;
  const delivery = world.entities.find((entity) => entity.entityId === TRAVERSAL_DELIVERY_ID)!;
  assert.match(storm.components[0]!.summary, /seconds remaining/);
  assert.equal(delivery.components[0]!.summary, 'delivered');
  assert.ok(events.events.some((event) => event.type === 'traversal.mode-change'));
  assert.ok(events.events.some((event) => event.type === 'traversal.checkpoint'));
  const collection = events.events.find((event) => event.type === 'traversal.seal-collected')!;
  assert.ok(collection.entityIds.some((entityId) => entityId === TRAVERSAL_COLLECTIBLE_IDS[0]));
  assert.ok(collection.entityIds.some((entityId) => entityId === TRAVERSAL_PARCEL_ID));
  assert.ok(events.events.some((event) => event.type === 'traversal.delivery'));
  assert.ok(events.events.length <= events.retention.capacity);

  const courier = world.entities.find((entity) => entity.label === 'Gale Post Courier')!;
  const controller = courier.components.find((component) => component.typeId === 'antiky.character-controller')!;
  assert.ok(typeof controller.data === 'object' && controller.data !== null && !Array.isArray(controller.data));
  assert.equal((controller.data as Readonly<Record<string, unknown>>).coyoteSeconds, COYOTE_SECONDS);
  assert.equal((controller.data as Readonly<Record<string, unknown>>).jumpBufferSeconds, JUMP_BUFFER_SECONDS);
});

test('inspection event history identifies parcel failure and immediate retry', () => {
  const inspection = createTraversalInspectionModel('traversal-failure-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  const right = Object.freeze({ horizontal: 1, active: true, jump: false });
  for (let frame = 0; frame < 30 * 60 && simulation.view().outcome === 'running'; frame += 1) {
    simulation.update(1 / 60, right);
  }
  simulation.update(1 / 60, { horizontal: 0, active: true, jump: true, retry: true });

  const events = inspection.events();
  const failure = events.events.find((event) => event.type === 'traversal.failure')!;
  assert.ok(failure.entityIds.some((entityId) => entityId === TRAVERSAL_DELIVERY_ID));
  assert.ok(failure.entityIds.some((entityId) => entityId === TRAVERSAL_PARCEL_ID));
  assert.ok(!failure.entityIds.some((entityId) => entityId === TRAVERSAL_STORM_ID));
  assert.ok(typeof failure.data === 'object' && failure.data !== null && !Array.isArray(failure.data));
  assert.equal((failure.data as Readonly<Record<string, unknown>>).reason, 'parcel-seals');
  assert.ok(events.events.some((event) => event.type === 'traversal.retry'));
});

test('storm failure history attaches the failure to the storm rather than the parcel', () => {
  const inspection = createTraversalInspectionModel('traversal-storm-failure-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  const heldBrake = Object.freeze({ horizontal: 0, active: true, jump: false, brake: true, retry: true });
  for (let frame = 0; frame < (STORM_DURATION_SECONDS + 1) * 60 && simulation.view().outcome === 'running'; frame += 1) {
    simulation.update(1 / 60, heldBrake);
  }

  const failure = inspection.events().events.find((event) => event.type === 'traversal.failure')!;
  assert.ok(failure.entityIds.some((entityId) => entityId === TRAVERSAL_STORM_ID));
  assert.ok(!failure.entityIds.some((entityId) => entityId === TRAVERSAL_PARCEL_ID));
});
