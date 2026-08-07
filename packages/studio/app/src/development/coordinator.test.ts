import assert from 'node:assert/strict';
import { test } from 'vitest';

import type {
  DevelopmentConnection,
  DevelopmentMcpCallLog,
  DevelopmentSessionControlResult,
  DevelopmentSnapshot,
} from '@antiky/cli/development';

import {
  StudioControlError,
  createStudioCoordinator,
  type StudioDevelopmentClient,
} from './coordinator.ts';

const connection = (developmentSessionId: string): DevelopmentConnection => ({
  inspectionUrl: 'http://127.0.0.1:3011',
  developmentSessionId,
  credential: 'a'.repeat(48),
});

function snapshot(developmentSessionId: string, runtimeInstanceId = 'runtime-001') {
  return {
    schemaVersion: 1,
    developmentSessionId,
    acceptedBuildRevision: 1,
    startedAt: '2026-08-05T12:00:00.000Z',
    project: {
      name: 'Test project',
      manifestPath: '/project/test.antiky',
      projectRoot: '/project',
      revision: 'a'.repeat(64),
      gameUrl: 'http://127.0.0.1:3010/demos/town-study',
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
  } as DevelopmentSnapshot;
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

function clientFor(source: DevelopmentSnapshot, calls: string[]): StudioDevelopmentClient {
  return {
    async readDevelopmentSnapshot() {
      calls.push(`snapshot:${source.developmentSessionId}`);
      return source;
    },
    async getMcpCallLog() {
      calls.push(`mcp:${source.developmentSessionId}`);
      return callLog(source.developmentSessionId);
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

test('a disconnected poll retains the last view only as visibly stale data', async () => {
  let available = true;
  const coordinator = createStudioCoordinator({
    async discoverConnection() {
      if (!available) throw { code: 'ANTIKY_SESSION_UNAVAILABLE', message: 'No session.' };
      return connection('development-stale-001');
    },
    createClient() { return clientFor(snapshot('development-stale-001'), []); },
    schedule: () => () => undefined,
  });
  await coordinator.start();
  available = false;
  await coordinator.refresh();

  const state = coordinator.read();
  assert.equal(state.status, 'stale');
  assert.equal(state.snapshot?.developmentSessionId, 'development-stale-001');
  assert.equal(state.issue?.code, 'ANTIKY_SESSION_UNAVAILABLE');
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
    async readDevelopmentSnapshot() { reads += 1; return source; },
    async getMcpCallLog() { return callLog(source.developmentSessionId); },
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
