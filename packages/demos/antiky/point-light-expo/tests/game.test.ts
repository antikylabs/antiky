import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Blackout Relay compiles one playable game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('the production build bundles all three forest-floor material channels', async () => {
  const assetDirectory = new URL('../dist/assets/', import.meta.url);
  const files = await readdir(assetDirectory);
  const materialFiles = files.filter((file) => file.endsWith('.jpg')).sort();

  assert.equal(materialFiles.length, 3);
  assert.ok(materialFiles.some((file) => file.startsWith('forest_floor_diff_1k-')));
  assert.ok(materialFiles.some((file) => file.startsWith('forest_floor_ao_1k-')));
  assert.ok(materialFiles.some((file) => file.startsWith('forest_floor_rough_1k-')));
  for (const file of materialFiles) {
    assert.ok((await stat(new URL(file, assetDirectory))).size > 10_000);
  }
});
