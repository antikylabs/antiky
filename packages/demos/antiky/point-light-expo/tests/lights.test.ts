import assert from 'node:assert/strict';
import test from 'node:test';

import {
  POINT_LIGHT_EDIT_PERMISSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  inspectPointLightService,
} from '@antiky/framework';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  EMBER_LIGHT_ID,
  EXPO_LIGHT_IDS,
  EXPO_WORLD_ID,
  createExpoLightService,
} from '../src/lights.ts';

test('Blackout Relay publishes three stable authored render bindings', () => {
  const service = createExpoLightService('runtime-point-light-expo-test');
  assert.equal(service.worldId, EXPO_WORLD_ID);
  assert.deepEqual(service.listPointLights().map((light) => light.entityId), EXPO_LIGHT_IDS);
  assert.deepEqual(
    service.readPointLightState().render.pointLights.map(({ entityId, renderSlot }) => ({
      entityId,
      renderSlot,
    })),
    EXPO_LIGHT_IDS.map((entityId, renderSlot) => ({ entityId, renderSlot })),
  );
  assert.equal(inspectPointLightService(service).authoring.length, 3);
  service.dispose();
});

test('an accepted light edit becomes one bounded render change', () => {
  const runtimeInstanceId = 'runtime-point-light-expo-edit';
  const service = createExpoLightService(runtimeInstanceId);
  const accepted = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: '0197f27e-1000-7000-8000-000000000010',
    worldId: EXPO_WORLD_ID,
    entityId: EMBER_LIGHT_ID,
    expectedRevision: 1,
    data: { power: 3.6 },
  }, {
    principalId: 'release-demo-test',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-08T12:00:00.000Z',
    runtimeInstanceId,
  });

  assert.equal(accepted.code, 'ACCEPTED');
  const changes = service.readPointLightRenderChanges();
  assert.deepEqual(changes.pointLights, [{
    entityId: EMBER_LIGHT_ID,
    renderSlot: 0,
    revision: 2,
    power: 3.6,
  }]);
  service.acknowledgePointLightRenderChanges(changes.eventSequence);
  assert.deepEqual(service.readPointLightRenderChanges().pointLights, []);
  service.dispose();
});
