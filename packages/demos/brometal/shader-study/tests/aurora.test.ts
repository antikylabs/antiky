import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/shaders/aurora.shader.ts', import.meta.url), 'utf8');

test('craters are shaded by distance to a point inside their cell, not by cell selection alone', () => {
  const block = source.slice(source.indexOf('const craterGrid'), source.indexOf('const curtainA'));
  assert.ok(block.length > 0, 'failed to locate the crater term');

  // Point-sampling a hash over a floored grid gives every selected cell a hard axis-aligned square,
  // which is what turned the moon's craters into pixels.
  assert.match(block, /const craterLocal = /);
  assert.match(block, /const craterDistance = length\(craterLocal\.sub\(craterPoint\)\)/);
  assert.match(block, /smoothstep\([\d.]+, [\d.]+, craterDistance\)/);
});

test('dither is applied after the tone-map, not before it', () => {
  const toneMapLine = source.split('\n').findIndex((line) => line.includes('tonemapACES'));
  const grainLine = source.split('\n').findIndex((line) => line.includes('filmGrain('));
  assert.ok(toneMapLine >= 0 && grainLine >= 0, 'failed to locate both terms');

  // ACES compresses the dark range hardest, which is exactly where dither is needed to break up
  // banding. Adding grain first means the tone curve squashes the thing meant to survive it.
  assert.ok(
    grainLine > toneMapLine,
    `filmGrain (line ${grainLine + 1}) must come after tonemapACES (line ${toneMapLine + 1})`,
  );
});
