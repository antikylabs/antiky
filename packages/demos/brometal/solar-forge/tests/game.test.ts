import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Solar Forge compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Solar Forge combines polar lensing, Doppler color, and a point-shaped deterministic star field', async () => {
  const source = await readFile(new URL('../src/shaders/solar-forge.shader.ts', import.meta.url), 'utf8');
  assert.match(source, /atan\(center\.y, center\.x\)/);
  assert.match(source, /hash21\(starCell\)/);
  assert.match(source, /starDistance/);
  assert.match(source, /approachingDisk/);
  assert.match(source, /frontDisk/);
  assert.match(source, /photonRing/);
});
