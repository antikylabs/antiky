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

test('the production build ships all three BroMetal-parseable catalog model derivatives', async () => {
  const assetDirectory = new URL('../dist/assets/', import.meta.url);
  const files = await readdir(assetDirectory);
  const modelFiles = files.filter((file) => file.endsWith('.glb'));

  assert.equal(modelFiles.length, 3);
  for (const prefix of [
    'dead-tree-trunk-runtime-',
    'rock-moss-set-01-runtime-',
    'tree-stump-01-runtime-',
  ]) {
    const file = modelFiles.find((candidate) => candidate.startsWith(prefix));
    assert.ok(file);
    assert.ok((await stat(new URL(file, assetDirectory))).size > 1_500_000);
  }
});
