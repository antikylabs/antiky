import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCommandId,
  parseEntityId,
  parseWorldId,
  type PointLightCommandResult,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createDevelopmentActionBroker } from '../src/host/actions.ts';

const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
const LIGHT_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
const SET_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
const CORRECTION_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');

const setCommand = Object.freeze({
  protocolVersion: 1 as const,
  commandVersion: 1 as const,
  type: 'antiky.authoring.set-point-light-power' as const,
  commandId: SET_COMMAND_ID,
  worldId: WORLD_ID,
  entityId: LIGHT_ID,
  expectedRevision: 1,
  data: Object.freeze({ power: 2 }),
});

const acceptedResult: PointLightCommandResult = Object.freeze({
  schemaVersion: 1,
  code: 'ACCEPTED',
  accepted: true,
  commandId: SET_COMMAND_ID,
  worldId: WORLD_ID,
  entityId: LIGHT_ID,
  currentRevision: 1,
  resultingRevision: 2,
  eventSequence: 1,
  runtimeInstanceId: 'runtime-actions-001',
  fact: Object.freeze({
    schemaVersion: 1,
    type: 'antiky.authoring.point-light-power-set',
    eventSequence: 1,
    sourceCommandId: SET_COMMAND_ID,
    worldId: WORLD_ID,
    entityId: LIGHT_ID,
    oldPower: 1.05,
    newPower: 2,
    resultingRevision: 2,
    receivedAt: '2026-08-05T03:00:00.000Z',
  }),
});

function createBroker() {
  return createDevelopmentActionBroker({
    developmentSessionId: 'development-actions-001',
    rootDirectory: '/tmp/antiky-action-test-unused',
    readRuntimeContext: () => ({
      runtimeInstanceId: 'runtime-actions-001',
      buildRevision: 4,
      connected: true,
    }),
    timeoutMilliseconds: 1000,
    now: () => '2026-08-05T03:00:00.000Z',
  });
}

test('the host relays a set-power command with separate trusted context and validates its result', async () => {
  const broker = createBroker();
  const pending = broker.setPointLightPower(setCommand);
  const action = broker.nextAction('runtime-actions-001');

  assert.equal(action?.kind, 'set-point-light-power');
  assert.deepEqual(action?.command, setCommand);
  assert.deepEqual(action?.context, {
    principalId: 'antiky-local-development',
    permissions: ['world.light.edit'],
    receivedAt: '2026-08-05T03:00:00.000Z',
    runtimeInstanceId: 'runtime-actions-001',
  });
  assert.doesNotMatch(JSON.stringify(action?.command), /principal|permission|receivedAt/);

  await broker.completePointLightCommand({
    actionId: action!.actionId,
    runtimeInstanceId: 'runtime-actions-001',
    result: acceptedResult,
  });
  assert.deepEqual(await pending, acceptedResult);
  broker.stop();
});

test('correction relay rejects a stale or malformed browser result without completing the action', async () => {
  const broker = createBroker();
  const pending = broker.correctPointLightPower({
    protocolVersion: 1,
    commandVersion: 1,
    commandId: CORRECTION_COMMAND_ID,
    correctedCommandId: SET_COMMAND_ID,
    expectedRevision: 2,
  });
  void pending.catch(() => {});
  const action = broker.nextAction('runtime-actions-001');
  assert.equal(action?.kind, 'correct-point-light-power');

  await assert.rejects(
    () => broker.completePointLightCommand({
      actionId: action!.actionId,
      runtimeInstanceId: 'another-runtime',
      result: acceptedResult,
    }),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_ACTION_STALE'
    ),
  );
  await assert.rejects(
    () => broker.completePointLightCommand({
      actionId: action!.actionId,
      runtimeInstanceId: 'runtime-actions-001',
      result: { ...acceptedResult, credential: 'must-not-cross' },
    }),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_ACTION_STALE'
    ),
  );

  broker.stop();
  await assert.rejects(
    pending,
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
    ),
  );
});

