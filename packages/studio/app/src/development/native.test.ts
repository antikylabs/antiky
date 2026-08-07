import assert from 'node:assert/strict';
import { invoke } from '@tauri-apps/api/core';
import { test, vi } from 'vitest';

import {
  parseNativeDevelopmentConnection,
  startNativeDevelopmentConnection,
  stopNativeDevelopmentConnection,
} from './native.ts';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

test('native host responses are accepted only with their bounded exact shape', () => {
  const connection = parseNativeDevelopmentConnection({
    schemaVersion: 1,
    developmentSessionId: 'development-studio-001',
    projectRevision: 'project-revision',
    inspectionUrl: 'http://127.0.0.1:3011',
    credential: 'a'.repeat(48),
    ownerPid: 123,
  });
  assert.equal(connection.inspectionUrl, 'http://127.0.0.1:3011');
  assert.equal(connection.developmentSessionId, 'development-studio-001');

  assert.throws(() => parseNativeDevelopmentConnection({
    schemaVersion: 1,
    developmentSessionId: 'development-studio-001',
    projectRevision: 'project-revision',
    inspectionUrl: 'http://localhost:3011',
    credential: 'a'.repeat(48),
    ownerPid: 123,
  }), /incompatible response/);
});

test('native development lifecycle uses bounded start and stop commands', async () => {
  const connection = {
    schemaVersion: 1,
    developmentSessionId: 'development-studio-002',
    projectRevision: 'project-revision',
    inspectionUrl: 'http://127.0.0.1:3011',
    credential: 'b'.repeat(48),
    ownerPid: 456,
  };
  vi.mocked(invoke).mockResolvedValueOnce(connection).mockResolvedValueOnce(undefined);

  assert.equal(
    (await startNativeDevelopmentConnection()).developmentSessionId,
    'development-studio-002',
  );
  await stopNativeDevelopmentConnection();

  assert.deepEqual(vi.mocked(invoke).mock.calls, [
    ['development_start'],
    ['development_stop'],
  ]);
});
