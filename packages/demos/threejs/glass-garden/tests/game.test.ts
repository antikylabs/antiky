import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Glass Garden compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Glass Garden combines transmission lighting, procedural terrain, and bloom composition', async () => {
  const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');

  assert.match(source, /new ImprovedNoise/);
  assert.match(source, /new RoomEnvironment/);
  assert.match(source, /new PMREMGenerator/);
  assert.match(source, /terrainPosition\.setZ/);
  assert.match(source, /new EffectComposer/);
  assert.match(source, /new UnrealBloomPass/);
  assert.match(source, /composer\.render\(\)/);
});
