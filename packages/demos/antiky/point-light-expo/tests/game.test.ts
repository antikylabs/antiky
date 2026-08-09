import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Point Light Expo compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});

test('Point Light Expo uses a custom surface shader and visible foundry geometry', async () => {
  const [gameSource, shaderSource] = await Promise.all([
    readFile(new URL('../src/game.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/shaders/foundry.shader.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(gameSource, /createTorusKnot/);
  assert.match(gameSource, /createTorus/);
  assert.match(gameSource, /createCone/);
  assert.match(gameSource, /moteCount = 36/);
  assert.match(gameSource, /createCylinder/);
  assert.match(shaderSource, /aNormal: 'vec3'/);
  assert.match(shaderSource, /uEmberPosition: 'vec3'/);
  assert.match(shaderSource, /uIonPosition: 'vec3'/);
  assert.match(shaderSource, /uVioletPosition: 'vec3'/);
  assert.match(shaderSource, /specGGX/);
});
