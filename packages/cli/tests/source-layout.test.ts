import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cliSource = join(repositoryRoot, 'packages/cli/src');
const frameworkSource = join(repositoryRoot, 'packages/framework/src');

async function topLevelTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .sort();
}

async function assertFilesExist(root: string, paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => access(join(root, path))));
}

test('CLI source groups implementation files by responsibility', async () => {
  assert.deepEqual(await topLevelTypeScriptFiles(cliSource), [
    'bin.ts',
    'cli.ts',
    'config.ts',
    'errors.ts',
    'index.ts',
  ]);
  await assertFilesExist(cliSource, [
    'development/client.ts',
    'development/types.ts',
    'host/actions.ts',
    'host/build-tracker.ts',
    'host/inspection-server.ts',
    'host/runtime-connection.ts',
    'host/session-descriptor.ts',
    'host/session.ts',
    'mcp/server.ts',
  ]);
});

test('framework inspection code has a domain home as the package grows', async () => {
  assert.deepEqual(await topLevelTypeScriptFiles(frameworkSource), ['index.ts']);
  await assertFilesExist(frameworkSource, [
    'inspection/snapshot.test.ts',
    'inspection/snapshot.ts',
  ]);
});
