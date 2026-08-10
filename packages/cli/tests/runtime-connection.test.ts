import assert from 'node:assert/strict';
import test from 'node:test';

import { createInspectionSnapshot } from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { createRuntimeConnection } from '../src/host/runtime-connection.ts';

function runtime(instanceId: string) {
  return createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId, lifecycle: 'ready' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 2 },
      render: { owner: 'framework' },
    },
  });
}

test('runtime timeouts, explicit disconnects, reconnects, and stale publications are distinct', async () => {
  let revision = 0;
  const diagnostics: unknown[] = [];
  const connection = createRuntimeConnection({
    developmentSessionId: 'development-runtime-connection-001',
    diagnosticSink: (event: unknown) => diagnostics.push(event),
    timeoutMilliseconds: 20,
    now: () => '2026-08-10T17:00:00.000Z',
    acceptBuild: () => {
      revision = Math.max(revision, 1);
      return revision;
    },
  });
  assert.equal(connection.read().state, 'waiting');
  assert.equal(connection.accept(runtime('runtime-connection-001'), 1), 1);
  assert.equal(connection.read().state, 'connected');
  assert.deepEqual(connection.read().observation, {
    schemaVersion: 1,
    developmentSessionId: 'development-runtime-connection-001',
    acceptedBuildRevision: 1,
    runtimeInstanceId: 'runtime-connection-001',
    publicationSequence: 1,
    publishedAt: '2026-08-10T17:00:00.000Z',
    connectionState: 'connected',
    freshness: 'current',
    session: null,
    world: null,
  });

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(connection.read().state, 'unavailable');
  assert.equal(connection.read().observation?.freshness, 'retained-unavailable');
  connection.touch('runtime-connection-001');
  assert.equal(connection.read().state, 'connected');

  connection.disconnect('runtime-connection-001', 2);
  assert.equal(connection.read().state, 'unavailable');
  assert.equal(connection.read().observation?.publicationSequence, 1);
  assert.throws(
    () => connection.accept(runtime('runtime-connection-001'), 3),
    (cause: unknown) => (
      cause instanceof AntikyCliError && cause.code === 'ANTIKY_PUBLICATION_STALE'
    ),
  );
  connection.accept(runtime('runtime-connection-002'), 1);
  assert.equal(connection.read().state, 'connected');
  assert.equal(connection.read().runtimeInstanceId, 'runtime-connection-002');
  assert.equal(connection.read().observation?.runtimeInstanceId, 'runtime-connection-002');
  assert.throws(
    () => connection.accept(runtime('runtime-connection-001'), 4),
    (cause: unknown) => cause instanceof AntikyCliError && cause.code === 'ANTIKY_RUNTIME_STALE',
  );

  const diagnosticCodes = diagnostics.flatMap((event) => (
    typeof event === 'object' && event !== null && 'code' in event && typeof event.code === 'string'
      ? [event.code]
      : []
  ));
  assert.ok(diagnosticCodes.includes('ANTIKY_RUNTIME_CONNECTED'));
  assert.ok(diagnosticCodes.includes('ANTIKY_RUNTIME_TIMED_OUT'));
  assert.ok(diagnosticCodes.includes('ANTIKY_RUNTIME_DISCONNECTED'));
  assert.ok(diagnostics.every((event) => (
    typeof event === 'object'
    && event !== null
    && 'developmentSessionId' in event
    && event.developmentSessionId === 'development-runtime-connection-001'
  )));
  assert.match(JSON.stringify(diagnostics), /runtime-connection-002/);
});
