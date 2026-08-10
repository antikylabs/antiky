import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineSession,
  createInspectionSnapshot,
  parseSessionId,
  parseWorldId,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  projectDevelopmentSessionStatus,
  projectDevelopmentSessionStatusV2,
} from '../src/development/sessions.ts';
import type { DevelopmentSnapshot, DevelopmentSnapshotV2 } from '../src/development/types.ts';

const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');

function snapshot(publishSession = true): DevelopmentSnapshot {
  const session = createEngineSession({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-session-projection-001',
    systems: [{ id: 'town-update', run: () => undefined }],
    captureInput: () => Object.freeze({}),
  });
  const inspection = createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId: 'runtime-session-projection-001', lifecycle: 'running' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 1 },
      render: { owner: 'framework', drawCalls: 1 },
    },
    ...(publishSession ? { session: session.readStatus() } : {}),
  });
  return {
    schemaVersion: 1,
    developmentSessionId: 'development-session-projection-001',
    acceptedBuildRevision: 1,
    startedAt: '2026-08-05T03:00:00.000Z',
    project: {
      name: 'Test game',
      manifestPath: '/game/test.antiky',
      projectRoot: '/game',
      revision: 'a'.repeat(64),
      gameUrl: 'http://127.0.0.1:3010/game',
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
    inspection,
  };
}

function snapshotV2(): DevelopmentSnapshotV2 {
  const source = snapshot();
  const session = source.inspection!.session!;
  return {
    ...source,
    schemaVersion: 2,
    observation: {
      schemaVersion: 1,
      developmentSessionId: source.developmentSessionId,
      acceptedBuildRevision: 1,
      runtimeInstanceId: session.runtimeInstanceId,
      publicationSequence: 3,
      publishedAt: '2026-08-10T17:20:00.000Z',
      connectionState: 'connected',
      freshness: 'current',
      session: {
        sessionId: session.sessionId,
        worldId: session.worldId,
        mode: session.mode,
        completedStepCount: session.clock.completedStepCount,
        controlRevision: session.revisions.controlRevision,
        worldRevision: session.revisions.worldRevision,
        stateDigest: session.lastCompletedStep?.stateDigest ?? null,
      },
      world: { worldId: session.worldId, revision: null, eventSequence: null },
    },
  };
}

test('session status projects the one framework inspection source', () => {
  const source = snapshot();
  const projected = projectDevelopmentSessionStatus(source);

  assert.deepEqual(projected, {
    schemaVersion: 1,
    developmentSessionId: source.developmentSessionId,
    session: source.inspection?.session,
  });
  assert.ok(Object.isFrozen(projected));
  assert.ok(Object.isFrozen(projected.session));
});

test('session status reports an unavailable runtime when no session is published', () => {
  assert.throws(
    () => projectDevelopmentSessionStatus(snapshot(false)),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_RUNTIME_UNAVAILABLE'
    ),
  );
});

test('version-two session status carries the exact accepted observation', () => {
  const source = snapshotV2();
  const projected = projectDevelopmentSessionStatusV2(source);
  assert.equal(projected.schemaVersion, 2);
  assert.equal(projected.observation, source.observation);
  assert.deepEqual(projected.session, source.inspection?.session);
});
