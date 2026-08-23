import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NODE_RUNTIME_DEPENDENCY,
  cacheMatchesNodeRuntimeDependency,
} from '../scripts/node-runtime/dependency.mjs';

test('the packaged Node runtime is pinned, hash-verified, and cache-safe', () => {
  assert.deepEqual(NODE_RUNTIME_DEPENDENCY, {
    version: '24.19.0',
    archive: 'node-v24.19.0-darwin-arm64.tar.gz',
    archiveSha256: '8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d',
    target: 'darwin-arm64',
  });
  assert.equal(cacheMatchesNodeRuntimeDependency(NODE_RUNTIME_DEPENDENCY), true);
  assert.equal(
    cacheMatchesNodeRuntimeDependency({ ...NODE_RUNTIME_DEPENDENCY, version: 'latest' }),
    false,
  );
  assert.equal(
    cacheMatchesNodeRuntimeDependency({ ...NODE_RUNTIME_DEPENDENCY, target: '../escape' }),
    false,
  );
});
