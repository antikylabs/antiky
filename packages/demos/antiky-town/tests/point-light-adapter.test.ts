import assert from 'node:assert/strict';
import test from 'node:test';

import {
  POINT_LIGHT_EDIT_PERMISSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  createPointLightAuthoringService,
} from '@antiky/framework';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  ANTIKY_TOWN_WORLD_ID,
  MARKET_LAMP_WEST_01_ID,
  PROOF_POINT_LIGHT_ID,
  createAntikyTownPointLightService,
} from '../src/content/point-lights.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createTownPointLightAdapter } from '../src/render/point-light-adapter.ts';

const RUNTIME_ID = 'runtime-antiky-town-001';
const COMMAND_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac0';
const CORRECTION_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac1';

function context() {
  return {
    principalId: 'developer-001',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-05T02:00:00.000Z',
    runtimeInstanceId: RUNTIME_ID,
  };
}

test('authored Antiky Town lights keep the fixed market identity and one slot-zero binding', () => {
  const service = createAntikyTownPointLightService(RUNTIME_ID);
  const market = service.getPointLight(MARKET_LAMP_WEST_01_ID);
  const proof = service.getPointLight(PROOF_POINT_LIGHT_ID);

  assert.equal(service.worldId, ANTIKY_TOWN_WORLD_ID);
  assert.deepEqual(market, {
    worldId: ANTIKY_TOWN_WORLD_ID,
    entityId: MARKET_LAMP_WEST_01_ID,
    label: 'Market Lamp West 01',
    revision: 1,
    transform: { schemaVersion: 1, position: [-3.565, 4.237, 6.82] },
    pointLight: {
      schemaVersion: 1,
      color: [1, 0.52, 0.22],
      radius: 4,
      power: 1.05,
    },
  });
  assert.equal(proof?.pointLight.power, 0.5);
  assert.deepEqual(service.readPointLightState().render.pointLights, [{
    entityId: MARKET_LAMP_WEST_01_ID,
    renderSlot: 0,
    revision: 1,
    power: 1.05,
  }]);
});

test('the adapter applies only market slot zero on the next frame and acknowledges it afterward', () => {
  const service = createAntikyTownPointLightService(RUNTIME_ID);
  const adapter = createTownPointLightAdapter(service);

  assert.equal(adapter.readPendingBasePower(), undefined);
  const accepted = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: COMMAND_ID,
    worldId: ANTIKY_TOWN_WORLD_ID,
    entityId: MARKET_LAMP_WEST_01_ID,
    expectedRevision: 1,
    data: { power: 2 },
  }, context());

  assert.equal(accepted.code, 'ACCEPTED');
  assert.deepEqual(service.readPointLightState().render.dirtySlots, [0]);
  assert.equal(adapter.readPendingBasePower(), 2);
  assert.deepEqual(service.readPointLightState().render.dirtySlots, [0]);
  adapter.commitPendingBasePower(2);
  assert.deepEqual(service.readPointLightState().render.dirtySlots, []);
  assert.equal(adapter.readPendingBasePower(), undefined);
  assert.equal(service.getPointLight(PROOF_POINT_LIGHT_ID)?.pointLight.power, 0.5);
  assert.deepEqual(service.getPointLight(MARKET_LAMP_WEST_01_ID)?.transform.position, [-3.565, 4.237, 6.82]);
  assert.deepEqual(service.getPointLight(MARKET_LAMP_WEST_01_ID)?.pointLight.color, [1, 0.52, 0.22]);
  assert.equal(service.getPointLight(MARKET_LAMP_WEST_01_ID)?.pointLight.radius, 4);

  const corrected = service.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: CORRECTION_ID,
    correctedCommandId: COMMAND_ID,
    expectedRevision: 2,
  }, context());
  assert.equal(corrected.code, 'ACCEPTED');
  assert.equal(adapter.readPendingBasePower(), 1.05);
  adapter.commitPendingBasePower(1.05);
  assert.equal(service.getPointLight(MARKET_LAMP_WEST_01_ID)?.revision, 3);
});

test('the adapter rejects a town binding that does not resolve the fixed market lamp to slot zero', () => {
  const service = createPointLightAuthoringService({
    worldId: ANTIKY_TOWN_WORLD_ID,
    pointLights: [{
      entityId: MARKET_LAMP_WEST_01_ID,
      label: 'Market Lamp West 01',
      revision: 1,
      transform: { schemaVersion: 1, position: [-3.565, 4.237, 6.82] },
      pointLight: { schemaVersion: 1, color: [1, 0.52, 0.22], radius: 4, power: 1.05 },
    }],
    runtimeInstanceId: RUNTIME_ID,
    renderBindings: [{ entityId: MARKET_LAMP_WEST_01_ID, renderSlot: 1 }],
  });

  assert.throws(
    () => createTownPointLightAdapter(service),
    /Market Lamp West 01.*slot 0/i,
  );
});

test('a runtime rebuild keeps authored IDs and restores authored power in a new runtime', () => {
  const first = createAntikyTownPointLightService(RUNTIME_ID);
  first.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: COMMAND_ID,
    worldId: ANTIKY_TOWN_WORLD_ID,
    entityId: MARKET_LAMP_WEST_01_ID,
    expectedRevision: 1,
    data: { power: 2 },
  }, context());

  const rebuilt = createAntikyTownPointLightService('runtime-antiky-town-rebuilt');
  assert.equal(rebuilt.worldId, first.worldId);
  assert.deepEqual(
    rebuilt.listPointLights().map((light) => light.entityId),
    first.listPointLights().map((light) => light.entityId),
  );
  assert.equal(rebuilt.getPointLight(MARKET_LAMP_WEST_01_ID)?.revision, 1);
  assert.equal(rebuilt.getPointLight(MARKET_LAMP_WEST_01_ID)?.pointLight.power, 1.05);
  assert.equal(rebuilt.readPointLightState().runtime.instanceId, 'runtime-antiky-town-rebuilt');
  assert.deepEqual(rebuilt.listPointLightPowerFacts(), []);
});
