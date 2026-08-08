import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore The build output intentionally has no published type declaration.
import game from '../dist/antiky.game.js';

test('Shader Study compiles one game-module entry', () => {
  assert.equal(typeof game, 'function');
});
