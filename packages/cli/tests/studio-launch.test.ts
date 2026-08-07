import assert from 'node:assert/strict';
import test from 'node:test';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { launchStudioProject } from '../src/studio-launch.ts';

test('the macOS launcher opens the manifest with the Antiky Studio bundle', async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];

  await launchStudioProject('/projects/harbor-lights.antiky', {
    platform: 'darwin',
    execute: async (file, args) => { calls.push({ file, args }); },
  });

  assert.deepEqual(calls, [{
    file: 'open',
    args: ['-b', 'dev.antiky.studio', '/projects/harbor-lights.antiky'],
  }]);
});

test('the Studio launcher returns stable errors for unsupported or unavailable apps', async () => {
  await assert.rejects(
    () => launchStudioProject('/projects/harbor-lights.antiky', {
      platform: 'linux',
      execute: async () => {},
    }),
    (error: unknown) => error instanceof AntikyCliError
      && error.code === 'ANTIKY_STUDIO_UNAVAILABLE',
  );

  await assert.rejects(
    () => launchStudioProject('/projects/harbor-lights.antiky', {
      platform: 'darwin',
      execute: async () => { throw new Error('private OS details'); },
    }),
    (error: unknown) => error instanceof AntikyCliError
      && error.code === 'ANTIKY_STUDIO_UNAVAILABLE'
      && !error.message.includes('private OS details'),
  );
});
