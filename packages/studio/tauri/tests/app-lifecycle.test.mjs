import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const hostSource = readFile(resolve(packageDirectory, 'src/lib.rs'), 'utf8');

test('application exit does not destroy AppKit terminal state from the Tao event callback', async () => {
  const source = await hostSource;
  const runCallback = source.match(/app\.run\((?:move )?\|[\s\S]*?\);/)?.[0];

  assert.ok(runCallback, 'the Tauri run callback must remain explicit and inspectable');
  assert.doesNotMatch(runCallback, /native::close\(\)/);
});

test('Studio builds its native menu before launch and refreshes recents after state initialization', async () => {
  const source = await hostSource;
  const recentState = source.indexOf('.recent_projects\n                .set');
  const recentRefresh = source.indexOf('studio_menu::refresh_recent_projects(app.handle())');

  assert.match(source, /\.menu\(studio_menu::build\)/);
  assert.notEqual(recentState, -1, 'recent-project state must be initialized in setup');
  assert.ok(
    recentState < recentRefresh,
    'the menu cannot read recent projects until their store has been initialized',
  );
});
