import assert from 'node:assert/strict';
import test from 'node:test';

import { createDevelopmentClient } from '@antiky/cli/development';
import { AntikyCliError } from '../src/errors.ts';
import type {
  DevelopmentMcpCallLog,
  DevelopmentSnapshot,
} from '../src/development/types.ts';

const snapshot: DevelopmentSnapshot = {
  schemaVersion: 1,
  developmentSessionId: 'development-browser-client-001',
  acceptedBuildRevision: 2,
  startedAt: '2026-08-05T03:00:00.000Z',
  config: {
    path: '/game/antiky.config.json',
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
  assert.deepEqual(await client.getMcpCallLog(), mcpCallLog);
  await client.pauseSimulation();
  assert.deepEqual(requests.map(({ url }) => url), [
    'http://127.0.0.1:3011/v1/development',
    'http://127.0.0.1:3011/v1/mcp-calls',
    'http://127.0.0.1:3011/v1/actions/pause-simulation',
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
