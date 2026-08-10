import assert from 'node:assert/strict';
import test from 'node:test';

import { createDevelopmentClient } from '@antiky/cli/development';
import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { readCaptureCapabilities } from '../src/host/capture-capability-service.ts';
import type {
  DevelopmentMcpCallLog,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
} from '../src/development/types.ts';

const snapshot: DevelopmentSnapshot = {
  schemaVersion: 1,
  developmentSessionId: 'development-browser-client-001',
  acceptedBuildRevision: 2,
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
  build: { owner: 'cli', revision: 2, changeKind: 'source', result: 'ready' },
  diagnostics: [],
  measurements: { owner: 'cli', launchMilliseconds: 10 },
  inspection: null,
};

const mcpCallLog: DevelopmentMcpCallLog = {
  schemaVersion: 1,
  developmentSessionId: snapshot.developmentSessionId,
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

const snapshotV2: DevelopmentSnapshotV2 = {
  ...snapshot,
  schemaVersion: 2,
  observation: {
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    acceptedBuildRevision: 2,
    runtimeInstanceId: 'runtime-browser-client-001',
    publicationSequence: 6,
    publishedAt: '2026-08-10T17:30:00.000Z',
    connectionState: 'connected',
    freshness: 'current',
    session: null,
    world: null,
  },
};

const captureCapabilities = readCaptureCapabilities({
  configuredWidth: 1280,
  configuredHeight: 720,
  interactiveRuntimeConnected: true,
  probe: () => ({
    playwrightVersion: '1.62.1',
    browserRevision: '1234',
    browserVersion: '151.0.7922.34',
    browserInstalled: true,
  }),
});

const artifact = Object.freeze({
  schemaVersion: 1 as const,
  evidenceId: 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
  artifactId: 'artifact-4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',
  uri: 'antiky-evidence://evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0/artifact-4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',
  kind: 'still' as const,
  role: 'canvas-master',
  mimeType: 'image/png' as const,
  width: 1,
  height: 1,
  byteLength: 8,
  sha256: '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6',
  createdAt: '2026-08-10T17:30:01.000Z',
  observation: snapshotV2.observation!,
  reviewState: 'private-unreviewed' as const,
  retention: Object.freeze({ scope: 'development-session' as const, state: 'retained' as const }),
  privacy: Object.freeze({
    gameCanvasOnly: true as const,
    desktopPixelsPossible: false as const,
    audio: 'none' as const,
    contentScan: 'not-performed' as const,
  }),
});

test('browser client uses an explicit loopback connection without exposing its credential', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const client = createDevelopmentClient({
    inspectionUrl: 'http://127.0.0.1:3011',
    developmentSessionId: snapshot.developmentSessionId,
    credential: 'a'.repeat(48),
  }, {
    fetch: async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith('/v1/development')) {
        return Response.json(snapshot);
      }
      if (String(input).endsWith('/v2/development')) return Response.json(snapshotV2);
      if (String(input).endsWith('/v1/capture-capabilities')) {
        return Response.json(captureCapabilities);
      }
      if (String(input).endsWith('/v2/actions/capture')) return Response.json({
        schemaVersion: 2,
        actionId: 'action-capture-002',
        captureId: 'capture-002',
        source: 'interactive-runtime',
        observation: snapshotV2.observation,
        deviceScaleFactor: 1,
        artifact,
      });
      if (String(input).endsWith('/v3/actions/capture')) return Response.json({
        schemaVersion: 3,
        actionId: 'action-capture-003',
        captureId: 'capture-003',
        source: 'managed-runtime',
        observation: snapshotV2.observation,
        deviceScaleFactor: 1,
        artifact,
      });
      if (String(input).includes('/v1/evidence/')) {
        return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
          headers: { 'content-type': 'image/png', 'content-length': '8' },
        });
      }
      if (String(input).endsWith('/v1/mcp-calls')) return Response.json(mcpCallLog);
      return Response.json({
        schemaVersion: 1,
        actionId: 'action-pause-001',
        developmentSessionId: snapshot.developmentSessionId,
        result: { code: 'PAUSED' },
        session: { mode: 'paused' },
      });
    },
  });

  assert.deepEqual(await client.readDevelopmentSnapshot(), snapshot);
  assert.deepEqual(await client.readDevelopmentSnapshotV2(), snapshotV2);
  assert.deepEqual(await client.getCaptureCapabilities(), captureCapabilities);
  assert.deepEqual(await client.getMcpCallLog(), mcpCallLog);
  await client.pauseSimulation();
  const capture = await client.captureFrameV2({
    schemaVersion: 2,
    expected: {
      developmentSessionId: snapshot.developmentSessionId,
      acceptedBuildRevision: 2,
      runtimeInstanceId: 'runtime-browser-client-001',
    },
    runtimePolicy: 'current-or-managed',
    target: { width: 1, height: 1, deviceScaleFactor: 1 },
    warmUpFrames: 0,
    idempotencyKey: 'browser-client-fixture',
  });
  assert.deepEqual(await client.readEvidenceArtifact(capture.artifact), new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]));
  const managedCapture = await client.captureFrameV3({
    schemaVersion: 3,
    expected: {
      developmentSessionId: snapshot.developmentSessionId,
      acceptedBuildRevision: 2,
      currentRuntimeInstanceId: null,
    },
    runtimePolicy: 'managed-only',
    target: { width: 1, height: 1, deviceScaleFactor: 1 },
    warmUpFrames: 0,
    idempotencyKey: 'browser-client-managed-fixture',
  });
  assert.equal(managedCapture.source, 'managed-runtime');
  assert.deepEqual(requests.map(({ url }) => url), [
    'http://127.0.0.1:3011/v1/development',
    'http://127.0.0.1:3011/v2/development',
    'http://127.0.0.1:3011/v1/capture-capabilities',
    'http://127.0.0.1:3011/v1/mcp-calls',
    'http://127.0.0.1:3011/v1/actions/pause-simulation',
    'http://127.0.0.1:3011/v2/actions/capture',
    `http://127.0.0.1:3011/v1/evidence/${artifact.evidenceId}/${artifact.artifactId}`,
    'http://127.0.0.1:3011/v3/actions/capture',
  ]);
  assert.equal(requests[0]?.init?.headers instanceof Headers, true);
  assert.equal((requests[0]?.init?.headers as Headers).get('authorization'), `Bearer ${'a'.repeat(48)}`);
  assert.equal(JSON.stringify(client).includes('a'.repeat(48)), false);
});

test('browser client rejects incompatible MCP call history', async () => {
  const client = createDevelopmentClient({
    inspectionUrl: 'http://127.0.0.1:3011',
    developmentSessionId: snapshot.developmentSessionId,
    credential: 'a'.repeat(48),
  }, {
    fetch: async () => Response.json({ ...mcpCallLog, owner: 'framework' }),
  });
  await assert.rejects(
    () => client.getMcpCallLog(),
    (error: unknown) => error instanceof AntikyCliError && error.code === 'ANTIKY_SESSION_UNAVAILABLE',
  );
});

test('browser client rejects non-loopback connections and incompatible snapshots', async () => {
  assert.throws(
    () => createDevelopmentClient({
      inspectionUrl: 'https://example.com',
      developmentSessionId: snapshot.developmentSessionId,
      credential: 'a'.repeat(48),
    }),
    (error: unknown) => error instanceof AntikyCliError && error.code === 'ANTIKY_ARGUMENT_INVALID',
  );

  const client = createDevelopmentClient({
    inspectionUrl: 'http://127.0.0.1:3011',
    developmentSessionId: snapshot.developmentSessionId,
    credential: 'a'.repeat(48),
  }, {
    fetch: async () => Response.json({ ...snapshot, developmentSessionId: 'wrong-session' }),
  });
  await assert.rejects(
    () => client.readDevelopmentSnapshot(),
    (error: unknown) => error instanceof AntikyCliError && error.code === 'ANTIKY_SESSION_UNAVAILABLE',
  );
});
