import assert from 'node:assert/strict';
import test from 'node:test';

import { createInspectionSnapshot } from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { createRuntimeConnection } from '../src/runtime-connection.ts';

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
  const connection = createRuntimeConnection({
    timeoutMilliseconds: 20,
    acceptBuild: () => {
      revision = Math.max(revision, 1);
      return revision;
    },
  });
  assert.equal(connection.read().state, 'waiting');
  assert.equal(connection.accept(runtime('runtime-connection-001'), 1), 1);
  assert.equal(connection.read().state, 'connected');

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(connection.read().state, 'unavailable');
  connection.touch('runtime-connection-001');
  assert.equal(connection.read().state, 'connected');

  connection.disconnect('runtime-connection-001', 2);
  assert.equal(connection.read().state, 'unavailable');
  assert.throws(
    () => connection.accept(runtime('runtime-connection-001'), 3),
    (cause: unknown) => (
      cause instanceof AntikyCliError && cause.code === 'ANTIKY_PUBLICATION_STALE'
    ),
  );
  connection.accept(runtime('runtime-connection-002'), 1);
  assert.equal(connection.read().state, 'connected');
  assert.equal(connection.read().runtimeInstanceId, 'runtime-connection-002');
  assert.throws(
    () => connection.accept(runtime('runtime-connection-001'), 4),
    (cause: unknown) => cause instanceof AntikyCliError && cause.code === 'ANTIKY_RUNTIME_STALE',
  );
});
