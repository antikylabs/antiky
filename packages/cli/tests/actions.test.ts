import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  parseCommandId,
  parseEntityId,
  parseSessionId,
  parseWorldId,
  type EngineControlResult,
  type EngineSessionStatus,
  type PointLightCommandResult,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createDevelopmentActionBroker } from '../src/host/actions.ts';

const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
const LIGHT_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
const SET_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
const CORRECTION_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');
const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');

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

const pausedSessionStatus: EngineSessionStatus = Object.freeze({
  schemaVersion: 2,
  sessionId: SESSION_ID,
  worldId: WORLD_ID,
  runtimeInstanceId: 'runtime-actions-001',
  mode: 'paused',
  fault: null,
  pauseReasons: Object.freeze(['tool'] as const),
  systemOrder: Object.freeze(['town-update']),
  clock: Object.freeze({
    fixedStepSeconds: 1 / 60,
    maximumFrameElapsedSeconds: 0.05,
    maximumStepsPerFrame: 3,
    accumulatorSeconds: 0,
    completedStepCount: 4,
    inputSequence: 4,
    totalAcceptedElapsedSeconds: 4 / 60,
    totalDiscardedSeconds: 0,
  }),
  revisions: Object.freeze({ commandSequence: 0, controlRevision: 1, worldRevision: 0 }),
  lastCompletedStep: Object.freeze({
    completedStepId: 4,
    inputSequence: 4,
    stateDigest: 'town:fixture',
  }),
});

const pausedControlResult: EngineControlResult = Object.freeze({
  code: 'PAUSED',
  mode: 'paused',
  completedStepCount: 4,
  controlRevision: 1,
  pauseReasons: Object.freeze(['tool'] as const),
  renderRequested: false,
});

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

test('session controls relay one exact action and reject stale browser state', async () => {
  const broker = createBroker();
  const pending = broker.stepSimulation(4);
  void pending.catch(() => {});
  const action = broker.nextAction('runtime-actions-001');

  assert.deepEqual(action && {
    kind: action.kind,
    expectedCompletedStepCount: 'expectedCompletedStepCount' in action
      ? action.expectedCompletedStepCount
      : undefined,
  }, { kind: 'step-simulation', expectedCompletedStepCount: 4 });

  await assert.rejects(
    () => broker.completeSessionControl({
      actionId: action!.actionId,
      runtimeInstanceId: 'runtime-actions-001',
      result: pausedControlResult,
      session: { ...pausedSessionStatus, runtimeInstanceId: 'runtime-stale-001' },
    }),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_ACTION_STALE'
    ),
  );

  const steppedResult = Object.freeze({
    ...pausedControlResult,
    code: 'STEPPED' as const,
    completedStepCount: 5,
    controlRevision: 2,
    renderRequested: true,
  });
  const steppedStatus = Object.freeze({
    ...pausedSessionStatus,
    clock: Object.freeze({
      ...pausedSessionStatus.clock,
      completedStepCount: 5,
      inputSequence: 5,
    }),
    revisions: Object.freeze({
      ...pausedSessionStatus.revisions,
      controlRevision: 2,
    }),
    lastCompletedStep: Object.freeze({
      completedStepId: 5,
      inputSequence: 5,
      stateDigest: 'town:stepped',
    }),
  });
  await broker.completeSessionControl({
    actionId: action!.actionId,
    runtimeInstanceId: 'runtime-actions-001',
    result: steppedResult,
    session: steppedStatus,
  });

  assert.deepEqual(await pending, {
    schemaVersion: 1,
    actionId: action!.actionId,
    developmentSessionId: 'development-actions-001',
    result: steppedResult,
    session: steppedStatus,
  });
  broker.stop();
});

test('a capture completion cannot complete an action started after its timeout', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-action-identity-'));
  const broker = createDevelopmentActionBroker({
    developmentSessionId: 'development-actions-identity-001',
    rootDirectory,
    readRuntimeContext: () => ({
      runtimeInstanceId: 'runtime-actions-001',
      buildRevision: 4,
      connected: true,
    }),
    timeoutMilliseconds: 1_000,
    now: () => '2026-08-05T03:00:00.000Z',
  });
  const capturePromise = broker.captureFrame();
  void capturePromise.catch(() => {});
  const captureAction = broker.nextAction('runtime-actions-001');
  assert.equal(captureAction?.kind, 'capture');

  const completion = broker.completeCapture({
    actionId: captureAction!.actionId,
    runtimeInstanceId: 'runtime-actions-001',
    mimeType: 'image/png',
    canvasWidth: 1,
    canvasHeight: 1,
    dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64'),
  });

  try {
    context.mock.timers.tick(1_000);
    await assert.rejects(
      capturePromise,
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ACTION_TIMEOUT'
      ),
    );

    const laterPromise = broker.pauseSimulation();
    const laterAction = broker.nextAction('runtime-actions-001');
    assert.equal(laterAction?.kind, 'pause-simulation');

    await assert.rejects(
      completion,
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ACTION_STALE'
      ),
    );
    await broker.completeSessionControl({
      actionId: laterAction!.actionId,
      runtimeInstanceId: 'runtime-actions-001',
      result: pausedControlResult,
      session: pausedSessionStatus,
    });
    assert.equal((await laterPromise).actionId, laterAction!.actionId);
  } finally {
    broker.stop();
    context.mock.timers.reset();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('a stopped broker rejects an in-flight capture and removes its late file', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-action-stop-'));
  const broker = createDevelopmentActionBroker({
    developmentSessionId: 'development-actions-stop-001',
    rootDirectory,
    readRuntimeContext: () => ({
      runtimeInstanceId: 'runtime-actions-001',
      buildRevision: 4,
      connected: true,
    }),
    timeoutMilliseconds: 1_000,
  });
  const capturePromise = broker.captureFrame();
  void capturePromise.catch(() => {});
  const captureAction = broker.nextAction('runtime-actions-001');
  assert.ok(captureAction && captureAction.kind === 'capture');
  const completion = broker.completeCapture({
    actionId: captureAction.actionId,
    runtimeInstanceId: 'runtime-actions-001',
    mimeType: 'image/png',
    canvasWidth: 1,
    canvasHeight: 1,
    dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64'),
  });

  try {
    broker.stop();
    await assert.rejects(
      capturePromise,
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
      ),
    );
    await assert.rejects(
      completion,
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ACTION_STALE'
      ),
    );
    await assert.rejects(access(join(
      rootDirectory,
      '.antiky',
      'captures',
      `${captureAction.captureId}.png`,
    )));
    assert.throws(
      () => broker.captureFrame(),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
      ),
    );
  } finally {
    broker.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('a capture persistence failure rejects only that action and frees the broker', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'antiky-action-write-failure-'));
  const rootDirectory = join(temporaryDirectory, 'not-a-directory');
  await writeFile(rootDirectory, 'fixture');
  const broker = createDevelopmentActionBroker({
    developmentSessionId: 'development-actions-write-failure-001',
    rootDirectory,
    readRuntimeContext: () => ({
      runtimeInstanceId: 'runtime-actions-001',
      buildRevision: 4,
      connected: true,
    }),
    timeoutMilliseconds: 1_000,
  });
  const capturePromise = broker.captureFrame();
  void capturePromise.catch(() => {});
  const captureAction = broker.nextAction('runtime-actions-001');
  assert.ok(captureAction && captureAction.kind === 'capture');

  try {
    await assert.rejects(
      () => broker.completeCapture({
        actionId: captureAction.actionId,
        runtimeInstanceId: 'runtime-actions-001',
        mimeType: 'image/png',
        canvasWidth: 1,
        canvasHeight: 1,
        dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64'),
      }),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_CAPTURE_SAVE_FAILED'
        && !error.message.includes('not-a-directory')
      ),
    );
    await assert.rejects(
      capturePromise,
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_CAPTURE_SAVE_FAILED'
      ),
    );

    const laterPromise = broker.setPointLightPower(setCommand);
    const laterAction = broker.nextAction('runtime-actions-001');
    assert.equal(laterAction?.kind, 'set-point-light-power');
    await broker.completePointLightCommand({
      actionId: laterAction!.actionId,
      runtimeInstanceId: 'runtime-actions-001',
      result: acceptedResult,
    });
    assert.deepEqual(await laterPromise, acceptedResult);
  } finally {
    broker.stop();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
