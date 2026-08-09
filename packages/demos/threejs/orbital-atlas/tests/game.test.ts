import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Orbital Atlas compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Orbital Atlas keeps its dynamic instancing path active', async () => {
  const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

  assert.match(source, /new InstancedMesh/);
  assert.match(source, /DynamicDrawUsage/);
  assert.match(source, /instanceMatrix\.needsUpdate = true/);
  assert.match(source, /instanceColor\.needsUpdate = true/);
});
