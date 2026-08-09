import assert from 'node:assert/strict';
import test from 'node:test';

import { createShardOrbits } from '../src/scene-layout.ts';

test('orbital shard layout is deterministic, bounded, and separated into visible bands', () => {
  const first = createShardOrbits(180);
  const second = createShardOrbits(180);

  assert.deepEqual(first, second);
  assert.equal(first.length, 180);
  assert.ok(first.every((orbit) => orbit.radius >= 2.4 && orbit.radius <= 7.9));
  assert.ok(first.every((orbit) => Math.abs(orbit.height) < 0.75));
  assert.equal(new Set(first.slice(0, 3).map((orbit) => orbit.speed)).size, 3);
});
