import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const hostSource = readFile(resolve(packageDirectory, 'src/lib.rs'), 'utf8');

test('application exit does not destroy AppKit terminal state from the Tao event callback', async () => {
  const source = await hostSource;
  const runCallback = source.match(/app\.run\(\|[\s\S]*?\);/)?.[0];

  assert.ok(runCallback, 'the Tauri run callback must remain explicit and inspectable');
  assert.doesNotMatch(runCallback, /native::close\(\)/);
});
