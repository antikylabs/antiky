import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/shaders/luminous-reef.shader.ts', import.meta.url), 'utf8');

test('plankton are shaded by distance to a point inside their cell, not by cell selection alone', () => {
  const block = source.slice(source.indexOf('const particleGrid'), source.indexOf('const background'));
  assert.ok(block.length > 0, 'failed to locate the plankton term');

  // Thresholding a cell hash with no local-distance test fills the whole cell, which is what made
  // every plankton a solid axis-aligned square. The cell must place a point and shade by distance
  // to it — the construction `bubbleGlow` already uses in this same shader.
  assert.match(block, /const particleLocal = /);
  assert.match(block, /const particleDistance = length\(particleLocal\.sub\(particlePoint\)\)/);
  assert.match(block, /smoothstep\([\d.]+, [\d.]+, particleDistance\)/);
});

test('the plankton and bubble terms use the same cell construction', () => {
  // Two ways to scatter specks in one shader is one way too many, and the divergence is what let
  // the broken one survive review beside the correct one.
  for (const prefix of ['bubble', 'particle']) {
    assert.match(source, new RegExp(`const ${prefix}Grid = `));
    assert.match(source, new RegExp(`const ${prefix}Local = `));
    assert.match(source, new RegExp(`const ${prefix}Distance = length\\(${prefix}Local\\.sub\\(${prefix}Point\\)\\)`));
  }
});
