import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  parseNativeDevelopmentConnection,
  parseStudioContext,
} from './native.ts';

test('native host responses are accepted only with their bounded exact shape', () => {
  assert.deepEqual(parseStudioContext({
    projectDirectory: '/project',
    projectName: 'antiky-town',
  }), {
    projectDirectory: '/project',
    projectName: 'antiky-town',
  });
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

  assert.throws(() => parseStudioContext({
    projectDirectory: '/project',
    projectName: 'antiky-town',
    credential: 'must-not-cross',
  }), /incompatible response/);
  assert.throws(() => parseNativeDevelopmentConnection({
    schemaVersion: 1,
    developmentSessionId: 'development-studio-001',
    projectRevision: 'project-revision',
    inspectionUrl: 'http://localhost:3011',
    credential: 'a'.repeat(48),
    ownerPid: 123,
  }), /incompatible response/);
});
