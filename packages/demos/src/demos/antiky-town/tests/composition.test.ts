import assert from 'node:assert/strict';
import test from 'node:test';

import {
  POINT_LIGHT_EDIT_PERMISSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  inspectPointLightService,
} from '@antiky/framework';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { findDemo } from '../../../catalog.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import type { DemoFactory, DemoSetup } from '../../../runtime.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import type { TownDemoOptions } from '../../brometal-town/practical-light-input.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createAntikyTownDemoFactory } from '../composition.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MARKET_LAMP_WEST_01_ID,
} from '../content/point-lights.ts';

const RUNTIME_ID = 'runtime-antiky-town-002';
const COMMAND_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac2';

function setup(): DemoSetup {
  return {
    renderer: {} as DemoSetup['renderer'],
    pointer: { x: 0.5, y: 0.5, down: false, active: false, dragX: 0, dragY: 0, clicked: false },
    movement: { x: 0, z: 0, active: false },
    mode: 'interactive',
    runtimeInstanceId: RUNTIME_ID,
    report() {},
  };
}

test('Antiky Town composes the shared service, reference renderer seam, and one runtime identity', async () => {
  let townDisposals = 0;
  let observedPower = 1.05;
  const buildReferenceTown = (options: TownDemoOptions): DemoFactory => async () => ({
    frame() {
      const replacement = options.slotZeroPower?.readPendingBasePower();
      if (replacement !== undefined) {
        observedPower = replacement;
        options.slotZeroPower?.commitPendingBasePower(replacement);
      }
    },
    dispose() {
      townDisposals += 1;
    },
  });
  const instance = await createAntikyTownDemoFactory(buildReferenceTown)(setup());
  const service = instance.pointLightService;

  assert.ok(service);
  assert.equal(inspectPointLightService(service).runtime.instanceId, RUNTIME_ID);
  const result = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: COMMAND_ID,
    worldId: service.worldId,
    entityId: MARKET_LAMP_WEST_01_ID,
    expectedRevision: 1,
    data: { power: 2 },
  }, {
    principalId: 'developer-001',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-05T02:00:00.000Z',
    runtimeInstanceId: RUNTIME_ID,
  });
  assert.equal(result.code, 'ACCEPTED');
  assert.equal(observedPower, 1.05);

  instance.frame(1 / 60);
  assert.equal(observedPower, 2);
  assert.deepEqual(service.readPointLightState().render.dirtySlots, []);

  instance.dispose();
  instance.dispose();
  assert.equal(townDisposals, 1);
  assert.equal(service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ac3',
    worldId: service.worldId,
    entityId: MARKET_LAMP_WEST_01_ID,
    expectedRevision: 2,
    data: { power: 3 },
  }, {
    principalId: 'developer-001',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-05T02:00:01.000Z',
    runtimeInstanceId: RUNTIME_ID,
  }).code, 'INVALID_COMMAND');
});

test('the product catalog exposes Antiky Town while keeping Town Study', () => {
  assert.equal(findDemo('antiky-town')?.title, 'Antiky Town');
  assert.equal(findDemo('town-study')?.title, 'Town Study');
});
