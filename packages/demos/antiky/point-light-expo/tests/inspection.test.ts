import assert from 'node:assert/strict';
import test from 'node:test';

import {
  POINT_LIGHT_EDIT_PERMISSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  inspectPointLightService,
} from '@antiky/framework';
import {
  RELAY_CHARGE_REGION_IDS,
  RELAY_FORGE_ID,
  createRelayInspectionModel,
} from '../src/inspection.ts';
import {
  EMBER_LIGHT_ID,
  EXPO_LIGHT_IDS,
  EXPO_WORLD_ID,
  createExpoLightService,
} from '../src/lights.ts';
import { createBlackoutRelaySimulation } from '../src/simulation.ts';

test('relay inspection exposes gameplay hierarchy, live stores, and bounded events', () => {
  const inspection = createRelayInspectionModel('relay-inspection-test');
  const simulation = createBlackoutRelaySimulation((event) => inspection.record(event), {
    initialPlayer: [-5.2, -2.7],
    initialShades: [],
  });
  const lightPowers = [2.5, 2.7, 2.35] as const;
  const idle = Object.freeze({
    movement: Object.freeze({ x: 0, z: 0, active: false }),
    interact: false,
    lightPowers,
  });
  for (let frame = 0; frame < 180; frame += 1) simulation.update(1 / 60, idle);

  const world = inspection.world(simulation.read());
  const events = inspection.events();
  assert.ok(world.entities.some((entity) => entity.label === 'Prism Drone'));
  assert.ok(world.entities.some((entity) => entity.label === 'Reliquary Forge'));
  for (const entityId of RELAY_CHARGE_REGION_IDS) {
    assert.ok(world.entities.some((entity) => entity.entityId === entityId));
  }
  assert.ok(EXPO_LIGHT_IDS.every((entityId) => (
    world.entities.every((entity) => entity.entityId !== entityId)
  )));
  assert.deepEqual(world.stores.map((store) => store.kind), ['render', 'runtime']);
  assert.ok(events.events.some((event) => event.type === 'relay.charge-ready'));
  assert.ok(events.events.length <= events.retention.capacity);
  assert.equal(events.counts.available, events.counts.retained + events.retention.droppedCount);
});

test('gameplay regions link to authored lights without publishing a conflicting light view', () => {
  const runtimeInstanceId = 'relay-inspection-edit-correct';
  const service = createExpoLightService(runtimeInstanceId);
  const inspection = createRelayInspectionModel(runtimeInstanceId);
  const simulation = createBlackoutRelaySimulation(() => {}, { initialShades: [] });
  const context = {
    principalId: 'relay-inspection-test',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-09T12:00:00.000Z',
    runtimeInstanceId,
  } as const;
  const changedCommandId = '0197f27e-3000-7000-8000-000000000031';
  const changed = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: changedCommandId,
    worldId: EXPO_WORLD_ID,
    entityId: EMBER_LIGHT_ID,
    expectedRevision: 1,
    data: { power: 0.8 },
  }, context);
  assert.equal(changed.code, 'ACCEPTED');

  const world = inspection.world(simulation.read());
  const gameplayRegions = world.entities.filter((entity) => (
    RELAY_CHARGE_REGION_IDS.includes(entity.entityId as typeof RELAY_CHARGE_REGION_IDS[number])
  ));
  assert.equal(gameplayRegions.length, 3);
  assert.deepEqual(
    gameplayRegions.map((entity) => (
      entity.components[0]?.data as Readonly<Record<string, unknown>>
    ).pointLightEntityId),
    EXPO_LIGHT_IDS,
  );
  assert.ok(EXPO_LIGHT_IDS.every((entityId) => (
    world.entities.every((entity) => entity.entityId !== entityId)
  )));
  assert.ok(gameplayRegions.every((entity) => (
    !Object.hasOwn(
      entity.components[0]?.data as Readonly<Record<string, unknown>>,
      'authoredPower',
    )
  )));

  const editedLight = inspectPointLightService(service).authoring.find((light) => (
    light.entityId === EMBER_LIGHT_ID
  ));
  assert.equal(editedLight?.revision, 2);
  assert.equal(editedLight?.pointLight.power, 0.8);

  const corrected = service.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: '0197f27e-3000-7000-8000-000000000032',
    correctedCommandId: changedCommandId,
    expectedRevision: 2,
  }, { ...context, receivedAt: '2026-08-09T12:00:01.000Z' });
  assert.equal(corrected.code, 'ACCEPTED');
  const restoredLight = inspectPointLightService(service).authoring.find((light) => (
    light.entityId === EMBER_LIGHT_ID
  ));
  assert.equal(restoredLight?.revision, 3);
  assert.equal(restoredLight?.pointLight.power, 2.5);
  service.dispose();
});

test('victory events identify the forge and every restored charge region', () => {
  const inspection = createRelayInspectionModel('relay-victory-event-identity');
  inspection.record({ type: 'relay.victory', value: 42 });

  const victory = inspection.events().events.find((event) => event.type === 'relay.victory');
  assert.ok(victory);
  assert.ok(victory.entityIds.some((entityId) => entityId === RELAY_FORGE_ID));
  assert.ok(RELAY_CHARGE_REGION_IDS.every((regionId) => (
    victory.entityIds.some((entityId) => entityId === regionId)
  )));
});
