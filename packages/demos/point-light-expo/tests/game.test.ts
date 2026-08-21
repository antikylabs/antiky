import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Blackout Relay compiles one playable game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('the production build bundles every ground material channel', async () => {
  const assetDirectory = new URL('../dist/assets/', import.meta.url);
  const files = await readdir(assetDirectory);
  const materialFiles = files.filter((file) => file.endsWith('.jpg')).sort();

  // Named rather than counted. The count stood in for "every channel the floor needs" and did that
  // job until the ground gained a second layer; naming them keeps the check meaningful while letting
  // the demo grow, and still fails if one goes missing.
  for (const expected of [
    'forest_floor_diff_1k-',
    'forest_floor_ao_1k-',
    'forest_floor_rough_1k-',
    'forrest-ground-01_diff_1k-',
  ]) {
    assert.ok(
      materialFiles.some((file) => file.startsWith(expected)),
      `the build is missing ${expected}, so a ground channel never reached dist`,
    );
  }
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
