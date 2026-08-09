import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Luminous Reef compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Luminous Reef layers articulated jellyfish, fish schools, bubbles, kelp, and procedural coral', async () => {
  const source = await readFile(new URL('../src/shaders/luminous-reef.shader.ts', import.meta.url), 'utf8');
  assert.match(source, /function jellyGlow/);
  assert.match(source, /function kelpBlade/);
  assert.match(source, /godRays/);
  assert.match(source, /fishBodyNear/);
  assert.match(source, /bubbleGlow/);
  assert.match(source, /coralStem/);
});
