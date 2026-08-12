import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createResizeGuard } from '../src/resize-guard.ts';

test('a fixed canvas size reallocates the drawing buffer exactly once across 100 frames', () => {
  const calls: [number, number][] = [];
  const resize = createResizeGuard((width, height) => calls.push([width, height]));

  for (let frame = 0; frame < 100; frame += 1) resize(1280, 720);

  // The defect: comparing device pixels against CSS pixels meant the guard never matched, so
  // `setSize` ran on every frame and reallocated the buffer sixty times a second.
  assert.equal(calls.length, 1, `expected one resize, got ${calls.length}`);
  assert.deepEqual(calls[0], [1280, 720]);
});

test('a genuine size change still resizes, and only once per change', () => {
  const calls: [number, number][] = [];
  const resize = createResizeGuard((width, height) => calls.push([width, height]));

  for (let frame = 0; frame < 20; frame += 1) resize(1280, 720);
  for (let frame = 0; frame < 20; frame += 1) resize(800, 600);
  for (let frame = 0; frame < 20; frame += 1) resize(800, 600);

  assert.deepEqual(calls, [[1280, 720], [800, 600]]);
});

test('an unmeasured canvas falls back rather than collapsing to zero', () => {
  const calls: [number, number][] = [];
  const resize = createResizeGuard((width, height) => calls.push([width, height]));

  // A detached or display:none canvas reports 0. Sizing to 0 would divide by zero in the aspect.
  resize(0, 0);
  assert.deepEqual(calls, [[1280, 720]]);
});

test('the game module never compares device pixels against CSS pixels', async () => {
  const source = await readFile(new URL('../src/game.ts', import.meta.url), 'utf8');
  assert.ok(
    !/canvas\.width === /.test(source),
    '`canvas.width` is device pixels; comparing it to clientWidth is the defect this guard replaced',
  );
  assert.match(source, /createResizeGuard\(/);
});
