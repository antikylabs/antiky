import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { SET_POINT_LIGHT_POWER_COMMAND_TYPE } from '../../src/point-light/commands.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { inspectPointLightWorld } from '../../src/point-light/world-inspection.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createPointLightAuthoringService } from '../../src/point-light/service.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const VISIBLE_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';
const HEADLESS_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abe';

function commandId(index: number): string {
  return `018f0f3a-7b2c-7a1d-8e2f-${(0xac0 + index).toString(16).padStart(12, '0')}`;
}

function createService() {
  return createPointLightAuthoringService({
    worldId: WORLD_ID,
    pointLights: [
      {
        entityId: HEADLESS_ID,
        label: 'Headless Lamp',
        revision: 1,
        transform: { schemaVersion: 1, position: [0, 1, 2] },
        pointLight: { schemaVersion: 1, color: [1, 1, 1], radius: 3, power: 0.5 },
      },
      {
        entityId: VISIBLE_ID,
        label: 'Visible Lamp',
        revision: 1,
        transform: { schemaVersion: 1, position: [3, 4, 5] },
        pointLight: { schemaVersion: 1, color: [1, 0.5, 0.25], radius: 4, power: 1 },
      },
    ],
    runtimeInstanceId: 'runtime-world-001',
    renderBindings: [{ entityId: VISIBLE_ID, renderSlot: 4 }],
  });
}

function context(receivedAt: string) {
  return {
    principalId: 'local-developer',
    permissions: ['world.light.edit'],
    receivedAt,
    runtimeInstanceId: 'runtime-world-001',
  };
}

test('point-light adapter publishes semantic entities and all three state stores', () => {
  const views = inspectPointLightWorld(createService());

  assert.equal(views.world.worldId, WORLD_ID);
  assert.equal(views.world.runtimeInstanceId, 'runtime-world-001');
  assert.equal(views.world.revision, 0);
  assert.equal(views.world.incomplete, false);
  assert.deepEqual(views.world.entities.map((entity) => entity.entityId), [
    VISIBLE_ID,
    HEADLESS_ID,
  ]);
  assert.deepEqual(views.world.entities[0]?.components.map((component) => component.typeId), [
    'antiky.point-light',
    'antiky.transform',
  ]);
  assert.deepEqual(views.world.relationships, []);
  assert.deepEqual(views.world.stores.map((store) => [store.storeId, store.kind]), [
    ['antiky.point-lights.authoring', 'authoring'],
    ['antiky.point-lights.render', 'render'],
    ['antiky.point-lights.runtime', 'runtime'],
  ]);
  assert.equal(views.world.stores[1]?.entries.length, 1);
  assert.equal(views.world.stores[1]?.entries[0]?.entityId, VISIBLE_ID);
  assert.equal(views.world.stores[2]?.entries.length, 2);
  assert.deepEqual(views.world.counts, {
    entities: { available: 2, retained: 2 },
    components: { available: 4, retained: 4 },
    relationships: { available: 0, retained: 0 },
    stores: { available: 3, retained: 3 },
  });
  assert.deepEqual(views.events.events, []);
  assert.equal(views.events.retention.lifetime, 'runtime-instance');
  assert.equal(views.events.retention.overflow, 'reject-new');
  assert.equal(views.events.retention.capacity, 256);
});

test('point-light adapter exposes two ordered accepted facts and matching stores', () => {
  const service = createService();
  const first = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: commandId(1),
    worldId: WORLD_ID,
    entityId: VISIBLE_ID,
    expectedRevision: 1,
    data: { power: 2 },
  }, context('2026-08-05T03:00:01.000Z'));
  const second = service.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: commandId(2),
    correctedCommandId: commandId(1),
    expectedRevision: 2,
  }, context('2026-08-05T03:00:02.000Z'));
  assert.equal(first.code, 'ACCEPTED');
  assert.equal(second.code, 'ACCEPTED');

  const views = inspectPointLightWorld(service);
  assert.equal(views.world.revision, 2);
  assert.deepEqual(views.events.events.map((event) => ({
    sequence: event.sequence,
    commandId: event.commandId,
    revision: event.revision,
    correctionOf: (event.data as { correctionOf?: string }).correctionOf,
  })), [
    { sequence: 1, commandId: commandId(1), revision: 2, correctionOf: undefined },
    { sequence: 2, commandId: commandId(2), revision: 3, correctionOf: commandId(1) },
  ]);
  const authoring = views.world.stores.find((store) => (
    store.storeId === 'antiky.point-lights.authoring'
  ));
  const runtime = views.world.stores.find((store) => (
    store.storeId === 'antiky.point-lights.runtime'
  ));
  const render = views.world.stores.find((store) => (
    store.storeId === 'antiky.point-lights.render'
  ));
  assert.equal((authoring?.entries[0]?.data as { revision: number }).revision, 3);
  assert.equal((runtime?.entries[0]?.data as { revision: number }).revision, 3);
  assert.equal((render?.entries[0]?.data as { revision: number }).revision, 3);
  assert.ok(Object.isFrozen(views));
  assert.ok(Object.isFrozen(views.world));
  assert.ok(Object.isFrozen(views.events));
});
