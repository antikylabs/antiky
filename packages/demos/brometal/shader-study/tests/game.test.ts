import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Shader Study compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Shader Study layers star points, aurora curtains, mountains, and reflected water', async () => {
  const source = await readFile(new URL('../src/shaders/aurora.shader.ts', import.meta.url), 'utf8');
  assert.match(source, /function auroraCurtain/);
  assert.match(source, /starPoint/);
  assert.match(source, /nearMountain/);
  assert.match(source, /reflection/);
});
