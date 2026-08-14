import assert from 'node:assert/strict';
import { expectTypeOf, test } from 'vitest';

import type {
  DevelopmentConnection,
  DevelopmentMcpCallLog,
  DevelopmentSessionControlResult,
  DevelopmentSnapshotV2,
  DevelopmentClient,
} from '@antiky/cli/development';

import {
  StudioControlError,
  createStudioCoordinator,
  type StudioCaptureClient,
  type StudioDevelopmentClient,
} from './coordinator.ts';

test('Studio capture types are the shared browser-safe development contracts', () => {
  expectTypeOf<StudioCaptureClient>().toEqualTypeOf<Pick<DevelopmentClient,
    | 'getCaptureCapabilities'
    | 'captureFrameV3'
    | 'captureGameplaySequence'
    | 'getRenderEvidence'
  >>();
});

const connection = (developmentSessionId: string): DevelopmentConnection => ({
  inspectionUrl: 'http://127.0.0.1:3011',
  developmentSessionId,
  credential: 'a'.repeat(48),
});

function snapshot(developmentSessionId: string, runtimeInstanceId = 'runtime-001') {
  return {
    schemaVersion: 2,
    developmentSessionId,
    acceptedBuildRevision: 1,
    startedAt: '2026-08-05T12:00:00.000Z',
    project: {
      name: 'Test project',
      manifestPath: '/project/test.antiky',
      projectRoot: '/project',
      revision: 'a'.repeat(64),
      gameUrl: 'http://127.0.0.1:3010/demos/antiky-town',
      host: '127.0.0.1',
      gamePort: 3010,
      inspectionPort: 3011,
      viewport: { width: 1280, height: 720 },
    },
    processes: { game: { state: 'running' }, shaders: { state: 'running' } },
    connection: { state: 'connected' },
    cleanup: { state: 'active' },
    build: { owner: 'cli', revision: 1, changeKind: 'initial', result: 'ready' },
    diagnostics: [],
    measurements: { owner: 'cli', launchMilliseconds: 10 },
    inspection: {
      schemaVersion: 1,
      runtime: { instanceId: runtimeInstanceId, lifecycle: 'running' },
      diagnostics: [],
      measurements: {
        runtime: { owner: 'framework', frameCount: 1 },
        render: { owner: 'framework', drawCalls: 1 },
      },
    },
    observation: {
      schemaVersion: 1,
      developmentSessionId,
      acceptedBuildRevision: 1,
      runtimeInstanceId,
      publicationSequence: 1,
      publishedAt: '2026-08-05T12:00:00.000Z',
      connectionState: 'connected',
      freshness: 'current',
      session: null,
      world: null,
    },
  } as DevelopmentSnapshotV2;
}

function callLog(developmentSessionId: string): DevelopmentMcpCallLog {
  return {
    schemaVersion: 1,
    developmentSessionId,
    owner: 'cli',
    retention: {
      scope: 'development-session',
      capacity: 100,
      retainedCount: 0,
      droppedCount: 0,
      firstSequence: null,
      lastSequence: null,
    },
    calls: [],
  };
}

function clientFor(source: DevelopmentSnapshotV2, calls: string[]): StudioDevelopmentClient {
  return {
    async readDevelopmentSnapshotV2() {
      calls.push(`snapshot:${source.developmentSessionId}`);
      return source;
    },
    async getMcpCallLog() {
      calls.push(`mcp:${source.developmentSessionId}`);
      return callLog(source.developmentSessionId);
    },
    async requestReload() {
      calls.push(`reload:${source.developmentSessionId}`);
      return {
        schemaVersion: 1,
        actionId: 'action-reload-001',
        developmentSessionId: source.developmentSessionId,
        buildRevision: source.acceptedBuildRevision,
        oldRuntimeInstanceId: source.inspection?.runtime.instanceId ?? 'runtime-old',
        newRuntimeInstanceId: 'runtime-reloaded',
        result: 'reloaded',
      };
    },
    async pauseSimulation(): Promise<DevelopmentSessionControlResult> {
      throw new Error('not used');
    },
    async resumeSimulation(): Promise<DevelopmentSessionControlResult> {
      throw new Error('not used');
    },
    async stepSimulation(): Promise<DevelopmentSessionControlResult> {
      throw new Error('not used');
    },
  };
}

test('one coordinator owns polling and replaces all live data when the session changes', async () => {
  const calls: string[] = [];
  const scheduled: Array<() => void> = [];
  let discovery = 0;
  const coordinator = createStudioCoordinator({
    async discoverConnection() {
      discovery += 1;
      return connection(discovery === 1 ? 'development-001' : 'development-002');
    },
    createClient(current) {
      return clientFor(snapshot(
        current.developmentSessionId,
        current.developmentSessionId === 'development-001' ? 'runtime-old' : 'runtime-new',
      ), calls);
    },
    schedule(callback) {
      scheduled.push(callback);
      return () => undefined;
    },
  });

  await Promise.all([coordinator.start(), coordinator.start()]);
  assert.equal(discovery, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(coordinator.read().status, 'connected');
  assert.equal(coordinator.read().snapshot?.inspection?.runtime.instanceId, 'runtime-old');

  await coordinator.refresh();
  assert.equal(coordinator.read().developmentSessionId, 'development-002');
  assert.equal(coordinator.read().snapshot?.inspection?.runtime.instanceId, 'runtime-new');
  assert.equal(coordinator.read().mcpCallLog?.developmentSessionId, 'development-002');
  assert.deepEqual(calls, [
    'snapshot:development-001',
    'mcp:development-001',
    'snapshot:development-002',
    'mcp:development-002',
  ]);
  coordinator.stop();
});

test('transient poll failures do not flap a connected workspace and recovery is atomic', async () => {
  let available = true;
  const states: string[] = [];
  const coordinator = createStudioCoordinator({
    async discoverConnection() {
      if (!available) throw { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'No session.' };
      return connection('development-stale-001');
    },
    createClient() { return clientFor(snapshot('development-stale-001'), []); },
    onState: (state) => states.push(state.status),
    schedule: () => () => undefined,
  });
  await coordinator.start();
  available = false;
  await coordinator.refresh();
  await coordinator.refresh();

  assert.equal(coordinator.read().status, 'connected');
  assert.equal(coordinator.read().issue, null);

  await coordinator.refresh();
  assert.equal(coordinator.read().status, 'stale');
  assert.equal(coordinator.read().snapshot?.developmentSessionId, 'development-stale-001');
  assert.equal(coordinator.read().issue?.code, 'ANTIKY_SESSION_UNAVAILABLE');

  const beforeRepeatedFailure = coordinator.read().updateSequence;
  await coordinator.refresh();
  assert.equal(coordinator.read().updateSequence, beforeRepeatedFailure);

  available = true;
  await coordinator.refresh();
  assert.equal(coordinator.read().status, 'connected');
  assert.equal(coordinator.read().issue, null);
  assert.deepEqual(states.filter((status) => status === 'connecting'), ['connecting']);
  coordinator.stop();
});

test('repeated unavailable startup polls publish one stable disconnected state', async () => {
  const coordinator = createStudioCoordinator({
    discoverConnection: async () => {
      throw { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'No session.' };
    },
    schedule: () => () => undefined,
  });

  await coordinator.start();
  assert.equal(coordinator.read().status, 'connecting');
  await coordinator.refresh();
  assert.equal(coordinator.read().status, 'connecting');
  await coordinator.refresh();
  assert.equal(coordinator.read().status, 'disconnected');
  const disconnectedSequence = coordinator.read().updateSequence;
  await coordinator.refresh();
  assert.equal(coordinator.read().updateSequence, disconnectedSequence);
  coordinator.stop();
});

test('Restart game reloads a connected runtime without replacing its project service', async () => {
  const calls: string[] = [];
  let serviceRestarts = 0;
  const source = snapshot('development-restart-001');
  const coordinator = createStudioCoordinator({
    discoverConnection: async () => connection(source.developmentSessionId),
    createClient: () => clientFor(source, calls),
    restartConnection: async () => { serviceRestarts += 1; },
    schedule: () => () => undefined,
    stopConnection: async () => undefined,
  });

  await coordinator.start();
  await coordinator.restartGame();

  assert.equal(serviceRestarts, 0);
  assert.equal(calls.filter((call) => call.startsWith('reload:')).length, 1);
  assert.equal(coordinator.read().status, 'connected');
  assert.equal(coordinator.read().pendingLifecycle, null);
  coordinator.stop();
});

test('Stop game releases the managed service and Restart game starts a fresh session', async () => {
  const calls: string[] = [];
  const lifecycle: string[] = [];
  let sessionId = 'development-stop-001';
  const coordinator = createStudioCoordinator({
    discoverConnection: async () => connection(sessionId),
    createClient: (current) => clientFor(snapshot(current.developmentSessionId), calls),
    restartConnection: async () => {
      lifecycle.push('restart');
      sessionId = 'development-stop-002';
    },
    schedule: () => () => undefined,
    stopConnection: async () => { lifecycle.push('stop'); },
  });

  await coordinator.start();
  await coordinator.stopGame();

  assert.deepEqual(lifecycle, ['stop']);
  assert.equal(coordinator.read().status, 'stopped');
  assert.equal(coordinator.read().snapshot, null);
  assert.equal(coordinator.read().developmentSessionId, null);
  assert.equal(coordinator.read().pendingLifecycle, null);

  await coordinator.restartGame();

  assert.deepEqual(lifecycle, ['stop', 'restart']);
  assert.equal(coordinator.read().status, 'connected');
  assert.equal(coordinator.read().developmentSessionId, 'development-stop-002');
  assert.equal(coordinator.read().snapshot?.developmentSessionId, 'development-stop-002');
  assert.equal(coordinator.read().pendingLifecycle, null);
  coordinator.stop();
});

test('controls serialize calls and refresh immediately after an accepted result', async () => {
  const source = snapshot('development-control-001');
  let releasePause: (() => void) | undefined;
  let reads = 0;
  const accepted = {
    schemaVersion: 1,
    actionId: 'action-pause-001',
    developmentSessionId: source.developmentSessionId,
    result: {
      code: 'PAUSED',
      mode: 'paused',
      completedStepCount: 0,
      controlRevision: 1,
      pauseReasons: ['tool'],
      renderRequested: false,
    },
    session: {
      schemaVersion: 2,
      sessionId: '018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
      worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
      runtimeInstanceId: 'runtime-001',
      mode: 'paused',
      fault: null,
      pauseReasons: ['tool'],
      systemOrder: ['town-update'],
      clock: {
        fixedStepSeconds: 1 / 60,
        maximumFrameElapsedSeconds: 0.05,
        maximumStepsPerFrame: 3,
        accumulatorSeconds: 0,
        completedStepCount: 0,
        inputSequence: 0,
        totalAcceptedElapsedSeconds: 0,
        totalDiscardedSeconds: 0,
      },
      revisions: { commandSequence: 0, controlRevision: 1, worldRevision: 0 },
      lastCompletedStep: null,
    },
  } as unknown as DevelopmentSessionControlResult;
  const client: StudioDevelopmentClient = {
    async readDevelopmentSnapshotV2() { reads += 1; return source; },
    async getMcpCallLog() { return callLog(source.developmentSessionId); },
    async requestReload() { throw new Error('not used'); },
    async pauseSimulation() {
      await new Promise<void>((resolve) => { releasePause = resolve; });
      return accepted;
    },
    async resumeSimulation() { return accepted; },
    async stepSimulation() { return accepted; },
  };
  const coordinator = createStudioCoordinator({
    discoverConnection: async () => connection(source.developmentSessionId),
    createClient: () => client,
    schedule: () => () => undefined,
  });
  await coordinator.start();

  const pending = coordinator.pause();
  await Promise.resolve();
  assert.equal(coordinator.read().pendingControl, 'pause');
  await assert.rejects(
    () => coordinator.resume(),
    (error: unknown) => error instanceof StudioControlError && error.code === 'CONTROL_BUSY',
  );
  releasePause?.();
  assert.equal((await pending).result.code, 'PAUSED');
  assert.equal(coordinator.read().pendingControl, null);
  assert.equal(reads, 2);
  coordinator.stop();
});
