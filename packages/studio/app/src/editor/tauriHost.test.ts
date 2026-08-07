import assert from 'node:assert/strict';

import { test } from 'vitest';

import {
  parseNativeProjectEvent,
  parseNativeProjectEventOrError,
  parseNativeRecentProjects,
  parseNativeProjectSource,
  parseValidatedProjectBoundary,
} from './tauriHost.ts';

const source = {
  schemaVersion: 1,
  selectionId: 7,
  manifestPath: '/projects/harbor/harbor.antiky',
  projectRoot: '/projects/harbor',
  revision: 'a'.repeat(64),
  source: '{"schemaVersion":1}',
};

test('Tauri project responses require one bounded exact bridge shape', () => {
  assert.deepEqual(parseNativeProjectSource(source), source);
  assert.deepEqual(parseNativeProjectEvent({ kind: 'opened', project: source }), {
    kind: 'opened',
    project: source,
  });
  assert.deepEqual(parseNativeProjectEvent({
    kind: 'error',
    error: { code: 'ANTIKY_PROJECT_INVALID', message: 'Invalid project.' },
  }), {
    kind: 'error',
    error: { code: 'ANTIKY_PROJECT_INVALID', message: 'Invalid project.' },
  });
  assert.deepEqual(parseValidatedProjectBoundary({
    selectionId: 7,
    manifestPath: source.manifestPath,
    projectRoot: source.projectRoot,
    revision: source.revision,
    developmentWorkingDirectory: source.projectRoot,
    buildWorkingDirectory: source.projectRoot,
  }), {
    selectionId: 7,
    manifestPath: source.manifestPath,
    projectRoot: source.projectRoot,
    revision: source.revision,
    developmentWorkingDirectory: source.projectRoot,
    buildWorkingDirectory: source.projectRoot,
  });

  for (const invalid of [
    { ...source, selectionId: 0 },
    { ...source, revision: 'short' },
    { ...source, manifestPath: '/projects/harbor/bad\nname.antiky' },
    { ...source, source: ' '.repeat(65_537) },
    { ...source, unknown: true },
  ]) assert.throws(() => parseNativeProjectSource(invalid), /incompatible response/);

  assert.deepEqual(parseNativeProjectEventOrError({ kind: 'opened', project: { ...source, unknown: true } }), {
    kind: 'error',
    error: {
      code: 'ANTIKY_NATIVE_UNAVAILABLE',
      message: 'The Studio native host returned an incompatible project event.',
    },
  });
});

test('Tauri recent-project responses are bounded and exact', () => {
  const recent = {
    available: true,
    lastOpenedAt: 1_786_089_600_000,
    manifestPath: source.manifestPath,
    projectRoot: source.projectRoot,
  };
  assert.deepEqual(parseNativeRecentProjects([recent]), [recent]);

  assert.throws(() => parseNativeRecentProjects([{ ...recent, lastOpenedAt: -1 }]));
  assert.throws(() => parseNativeRecentProjects([{ ...recent, unknown: true }]));
  assert.throws(() => parseNativeRecentProjects(Array.from({ length: 21 }, () => recent)));
});
