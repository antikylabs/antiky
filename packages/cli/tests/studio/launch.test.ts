import assert from 'node:assert/strict';
import test from 'node:test';

import { AntikyCliError } from '../../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { launchGamePage } from '../../src/game-launch.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { launchStudioProject } from '../../src/studio/launch.ts';

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

test('the game launcher opens only an exact loopback game URL on supported platforms', async () => {
  const calls: Array<{ file: string; args: readonly string[] }> = [];
  await launchGamePage('http://127.0.0.1:3010/', {
    platform: 'darwin',
    execute: async (file, args) => { calls.push({ file, args }); },
  });
  assert.deepEqual(calls, [{ file: 'open', args: ['http://127.0.0.1:3010/'] }]);

  for (const url of [
    'https://127.0.0.1:3010/',
    'http://localhost:3010/',
    'http://example.test:3010/',
    'file:///private/example',
  ]) {
    await assert.rejects(
      () => launchGamePage(url, { platform: 'darwin', execute: async () => {} }),
      (error: unknown) => error instanceof AntikyCliError
        && error.code === 'ANTIKY_GAME_LAUNCH_FAILED',
    );
  }
});

test('the game launcher reports a safe recovery when the OS cannot open the page', async () => {
  await assert.rejects(
    () => launchGamePage('http://127.0.0.1:3010/', {
      platform: 'darwin',
      execute: async () => { throw new Error('/Users/private OS detail'); },
    }),
    (error: unknown) => error instanceof AntikyCliError
      && error.code === 'ANTIKY_GAME_LAUNCH_FAILED'
      && error.message === 'The game could not be opened. Open http://127.0.0.1:3010/ manually.',
  );
});
