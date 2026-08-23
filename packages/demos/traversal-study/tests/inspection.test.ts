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
import { COURSE_HAZARDS, hazardTop } from '../src/course.ts';
import {
  COYOTE_SECONDS,
  GROUND_ACCELERATION,
  JUMP_BUFFER_SECONDS,
  JUMP_RELEASE_VELOCITY_MULTIPLIER,
  MANUAL_TOP_SPEED,
  RESET_RECOVERY_SECONDS,
  STORM_DURATION_SECONDS,
  createTraversalSimulation,
} from '../src/simulation.ts';

const idle = Object.freeze({ horizontal: 0, active: false, jump: false });

test('inspection exposes acts, controls, checkpoints, seals, storm, outcomes, and individual course entities', () => {
  const inspection = createTraversalInspectionModel('traversal-inspection-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  for (let frame = 0; frame < 80 * 60; frame += 1) simulation.update(1 / 60, idle);

  const world = inspection.world(simulation.read());
  const events = inspection.events();
  assert.equal(new Set(world.entities.map((entity) => entity.entityId)).size, world.entities.length);
  assert.equal(world.relationships.length, world.entities.length - 1);
  assert.equal(world.stores.length, 2);
  assert.ok(TRAVERSAL_PLATFORM_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));
  assert.ok(TRAVERSAL_HAZARD_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));
  assert.ok(TRAVERSAL_COLLECTIBLE_IDS.every((id) => world.entities.some((entity) => entity.entityId === id)));

  const renderStore = world.stores.find((store) => store.storeId === 'antiky.traversal.render')!;
  const courierRender = renderStore.entries.find((entry) => entry.key === 'courier')!;
  const environmentRender = renderStore.entries.find((entry) => entry.key === 'environment')!;
  assert.deepEqual(courierRender.data, {
    layer: 5,
    visible: true,
    catalog: 'quaternius:ultimateplatformer',
    asset: 'courier.glb',
  });
  assert.deepEqual(environmentRender.data, {
    layer: 1,
    visible: true,
    catalogs: [
      {
        catalogId: 'quaternius:ultimateplatformer',
        assets: ['cloud-small.glb', 'cloud-large.glb', 'coastal-cliff.glb', 'coastal-tree.glb', 'relay-tower.glb'],
      },
      {
        catalogId: 'kenney:platformer-kit',
        assets: ['tree.glb'],
      },
    ],
  });

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
  assert.equal((controller.data as Readonly<Record<string, unknown>>).manualTopSpeed, MANUAL_TOP_SPEED);
  assert.equal((controller.data as Readonly<Record<string, unknown>>).groundAcceleration, GROUND_ACCELERATION);
  assert.equal(
    (controller.data as Readonly<Record<string, unknown>>).jumpReleaseVelocityMultiplier,
    JUMP_RELEASE_VELOCITY_MULTIPLIER,
  );
  assert.equal((controller.data as Readonly<Record<string, unknown>>).resetRecoverySeconds, RESET_RECOVERY_SECONDS);

  const stormCutIndex = COURSE_HAZARDS.findIndex((hazard) => hazard.id === 'storm-spikes');
  const stormCut = world.entities.find((entity) => entity.entityId === TRAVERSAL_HAZARD_IDS[stormCutIndex])!;
  const transform = stormCut.components.find((component) => component.typeId === 'antiky.transform')!;
  const transformData = transform.data as Readonly<{ position: readonly number[] }>;
  assert.equal(transformData.position[1], hazardTop(COURSE_HAZARDS[stormCutIndex]!, simulation.read().time));
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

test('post-contact snapshot, digest, and inspection expose the consumed hazard as disarmed', () => {
  const inspection = createTraversalInspectionModel('traversal-damaged-hazard-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  const right = Object.freeze({ horizontal: 1, active: true, jump: false });
  const pristineDigest = simulation.digest();
  while (simulation.view().falls === 0) simulation.update(1 / 60, right);

  const snapshot = simulation.read();
  const yardHazardIndex = COURSE_HAZARDS.findIndex((hazard) => hazard.id === 'yard-spikes');
  assert.equal(snapshot.damagedHazardMask, 1 << yardHazardIndex);
  assert.notEqual(simulation.digest(), pristineDigest);
  assert.equal(Number(simulation.digest().split(':').at(-1)), snapshot.damagedHazardMask);

  const world = inspection.world(snapshot);
  const yardHazard = world.entities.find(
    (entity) => entity.entityId === TRAVERSAL_HAZARD_IDS[yardHazardIndex],
  )!;
  const damage = yardHazard.components.find(
    (component) => component.typeId === 'antiky.parcel-damage-hazard',
  )!;
  assert.equal((damage.data as Readonly<Record<string, unknown>>).armed, false);
  const runtime = world.stores.find((store) => store.storeId === 'antiky.traversal.runtime')!;
  const yardRuntime = runtime.entries.find((entry) => entry.key === 'hazard-yard-spikes')!;
  assert.equal((yardRuntime.data as Readonly<Record<string, unknown>>).armed, false);
  const gullRuntime = runtime.entries.find((entry) => entry.key === 'hazard-gull-spikes')!;
  assert.equal((gullRuntime.data as Readonly<Record<string, unknown>>).armed, true);
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
