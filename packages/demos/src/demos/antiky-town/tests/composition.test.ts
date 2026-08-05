import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIXED_STEP_SECONDS,
  POINT_LIGHT_EDIT_PERMISSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  inspectPointLightService,
  parseSessionId,
  type SessionId,
} from '@antiky/framework';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { findDemo } from '../../../catalog.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import type { DemoSetup } from '../../../runtime.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import type {
  TownRuntime,
  TownRuntimeBuilder,
} from '../../brometal-town/town-runtime.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createAntikyTownDemoFactory } from '../composition.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MARKET_LAMP_WEST_01_ID,
} from '../content/point-lights.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  captureTownSemanticInput,
  getAntikyTownGameHost,
} from '../gameplay/game-host.ts';

const RUNTIME_ID = 'runtime-antiky-town-002';
const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
const COMMAND_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789ac2';

function setup(runtimeInstanceId = RUNTIME_ID): DemoSetup {
  return {
    renderer: {} as DemoSetup['renderer'],
    pointer: { x: 0.5, y: 0.5, down: false, active: false, dragX: 0, dragY: 0, clicked: false },
    movement: { x: 0, z: 0, active: false },
    mode: 'interactive',
    runtimeInstanceId,
    report() {},
  };
}

type RuntimeEvidence = {
  updates: Array<{
    deltaSeconds: number;
    movement: { x: number; z: number; active: boolean };
  }>;
  renders: number;
  disposals: number;
  observedPower: number;
};

function createReferenceTownBuilder(evidenceByRuntime: Map<string, RuntimeEvidence>): TownRuntimeBuilder {
  return (options) => async (townSetup): Promise<TownRuntime> => {
    const evidence: RuntimeEvidence = {
      updates: [],
      renders: 0,
      disposals: 0,
      observedPower: 1.05,
    };
    evidenceByRuntime.set(townSetup.runtimeInstanceId, evidence);
    let total = 0;
    return Object.freeze({
      update(deltaSeconds, movement) {
        assert.ok(Object.isFrozen(movement));
        evidence.updates.push({
          deltaSeconds,
          movement: { x: movement.x, z: movement.z, active: movement.active },
        });
        total += movement.x + movement.z;
      },
      render() {
        evidence.renders += 1;
        const replacement = options.slotZeroPower?.readPendingBasePower();
        if (replacement !== undefined) {
          evidence.observedPower = replacement;
          options.slotZeroPower?.commitPendingBasePower(replacement);
        }
      },
      readStateDigest() {
        return `town-test-v1:${total}`;
      },
      dispose() {
        evidence.disposals += 1;
      },
    });
  };
}

function fixedSessionId(): SessionId {
  return SESSION_ID;
}

test('the Town input adapter normalizes active movement and clears inactive device state', () => {
  const active = captureTownSemanticInput({ x: 3, z: 4, active: true });
  assert.ok(Math.abs(active.movement.x - 0.6) < Number.EPSILON);
  assert.equal(active.movement.z, 0.8);
  assert.equal(active.movement.active, true);
  assert.deepEqual(
    captureTownSemanticInput({ x: 1, z: -1, active: false }),
    { movement: { x: 0, z: 0, active: false } },
  );
  assert.deepEqual(
    captureTownSemanticInput({ x: 0.005, z: 0, active: true }),
    { movement: { x: 0, z: 0, active: false } },
  );
});

test('Antiky Town advances through one private session and renders once per presentation', async () => {
  const evidenceByRuntime = new Map<string, RuntimeEvidence>();
  const townSetup = setup();
  const instance = await createAntikyTownDemoFactory(
    createReferenceTownBuilder(evidenceByRuntime),
    { createSessionId: fixedSessionId },
  )(townSetup);
  const service = instance.pointLightService;
  const host = getAntikyTownGameHost(instance);
  const evidence = evidenceByRuntime.get(RUNTIME_ID);

  assert.ok(service);
  assert.ok(host);
  assert.ok(evidence);
  assert.equal(inspectPointLightService(service).runtime.instanceId, RUNTIME_ID);
  assert.deepEqual(host.readStatus().systemOrder, ['town-update']);
  assert.equal(host.readStatus().sessionId, SESSION_ID);

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
  assert.equal(host.readStatus().revisions.worldRevision, 1);
  assert.equal(evidence.observedPower, 1.05);

  const noOp = service.submitPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
    commandId: '018f0f3a-7b2c-7a1d-8e2f-123456789ac4',
    worldId: service.worldId,
    entityId: MARKET_LAMP_WEST_01_ID,
    expectedRevision: 2,
    data: { power: 2 },
  }, {
    principalId: 'developer-001',
    permissions: [POINT_LIGHT_EDIT_PERMISSION],
    receivedAt: '2026-08-05T02:00:00.500Z',
    runtimeInstanceId: RUNTIME_ID,
  });
  assert.equal(noOp.code, 'NO_OP');
  assert.deepEqual(host.readStatus().revisions, {
    commandSequence: 2,
    controlRevision: 0,
    worldRevision: 1,
  });

  instance.frame(10);
  assert.equal(evidence.updates.length, 0);
  assert.equal(evidence.renders, 1);
  assert.equal(evidence.observedPower, 2);
  assert.deepEqual(service.readPointLightState().render.dirtySlots, []);

  townSetup.movement.x = 0.25;
  townSetup.movement.z = -0.5;
  townSetup.movement.active = true;
  instance.frame(10 + FIXED_STEP_SECONDS / 2);
  assert.equal(evidence.updates.length, 0);
  assert.equal(evidence.renders, 2);
  instance.frame(10 + FIXED_STEP_SECONDS);
  assert.equal(evidence.updates.length, 1);
  assert.equal(evidence.renders, 3);
  assert.deepEqual(evidence.updates[0], {
    deltaSeconds: FIXED_STEP_SECONDS,
    movement: { x: 0.25, z: -0.5, active: true },
  });

  instance.frame(11);
  assert.equal(evidence.updates.length, 4);
  assert.equal(evidence.renders, 4);
  assert.equal(host.readStatus().clock.totalDiscardedSeconds > 0.9, true);

  instance.dispose();
  instance.dispose();
  assert.equal(evidence.disposals, 1);
  assert.equal(host.readStatus().mode, 'disposed');
  assert.equal(host.present(12).code, 'SESSION_DISPOSED');
  assert.equal(evidence.renders, 4);
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

test('Town pause reasons, retry-safe step, and resumed platform time preserve state', async () => {
  const evidenceByRuntime = new Map<string, RuntimeEvidence>();
  const townSetup = setup('runtime-antiky-town-controls');
  townSetup.movement.x = 1;
  townSetup.movement.active = true;
  const instance = await createAntikyTownDemoFactory(
    createReferenceTownBuilder(evidenceByRuntime),
    { createSessionId: fixedSessionId },
  )(townSetup);
  const host = getAntikyTownGameHost(instance);
  const evidence = evidenceByRuntime.get(townSetup.runtimeInstanceId);
  assert.ok(host);
  assert.ok(evidence);

  instance.frame(1);
  instance.frame(1 + FIXED_STEP_SECONDS);
  assert.equal(host.readStatus().clock.completedStepCount, 1);
  assert.equal(evidence.renders, 2);

  assert.equal(host.pause('user').code, 'PAUSED');
  assert.equal(host.pause('visibility').code, 'PAUSED');
  assert.equal(host.resume('visibility').code, 'RESUMED');
  assert.equal(host.readStatus().mode, 'paused');
  assert.deepEqual(host.readStatus().pauseReasons, ['user']);
  instance.frame(100);
  assert.equal(evidence.renders, 2);

  const stepped = host.step(1);
  assert.equal(stepped.code, 'STEPPED');
  assert.equal(evidence.updates.length, 2);
  assert.equal(evidence.renders, 3);
  assert.equal(host.step(1).code, 'STALE_COMPLETED_STEP');
  assert.equal(evidence.updates.length, 2);
  assert.equal(evidence.renders, 3);

  assert.equal(host.resume('user').code, 'RESUMED');
  instance.frame(100);
  assert.equal(host.readStatus().clock.completedStepCount, 2);
  assert.equal(evidence.renders, 4);
  instance.dispose();
});

test('equal Town sessions produce equal state digests for equal input and platform time', async () => {
  const evidenceByRuntime = new Map<string, RuntimeEvidence>();
  const buildTown = createReferenceTownBuilder(evidenceByRuntime);
  const leftSetup = setup('runtime-antiky-town-left');
  const rightSetup = setup('runtime-antiky-town-right');
  const factory = createAntikyTownDemoFactory(buildTown, { createSessionId: fixedSessionId });
  const left = await factory(leftSetup);
  const right = await factory(rightSetup);

  for (const time of [2, 2 + 1 / 120, 2 + 1 / 60, 2 + 0.05]) {
    leftSetup.movement.x = 0.5;
    leftSetup.movement.z = -0.25;
    leftSetup.movement.active = true;
    Object.assign(rightSetup.movement, leftSetup.movement);
    left.frame(time);
    right.frame(time);
  }

  const leftStatus = getAntikyTownGameHost(left)?.readStatus();
  const rightStatus = getAntikyTownGameHost(right)?.readStatus();
  assert.equal(leftStatus?.clock.completedStepCount, rightStatus?.clock.completedStepCount);
  assert.equal(
    leftStatus?.lastCompletedStep?.stateDigest,
    rightStatus?.lastCompletedStep?.stateDigest,
  );
  left.dispose();
  right.dispose();
});

test('the product catalog exposes Antiky Town while keeping Town Study', () => {
  assert.equal(findDemo('antiky-town')?.title, 'Antiky Town');
  assert.equal(findDemo('town-study')?.title, 'Town Study');
});
