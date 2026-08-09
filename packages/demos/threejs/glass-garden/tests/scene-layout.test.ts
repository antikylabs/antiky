import assert from 'node:assert/strict';
import test from 'node:test';

import { createGlassBloomLayout } from '../src/scene-layout.ts';

test('glass garden layout fills foreground, middle distance, and both sides deterministically', () => {
  const first = createGlassBloomLayout();
  const second = createGlassBloomLayout();

  assert.deepEqual(first, second);
  assert.equal(first.length, 13);
  assert.ok(first.some((bloom) => bloom.position[0] < -5));
  assert.ok(first.some((bloom) => bloom.position[0] > 5));
  assert.ok(first.some((bloom) => bloom.position[1] > 1));
  assert.ok(first.some((bloom) => bloom.position[1] < -3));
  assert.deepEqual(new Set(first.map((bloom) => bloom.materialIndex)), new Set([0, 1, 2]));
});
