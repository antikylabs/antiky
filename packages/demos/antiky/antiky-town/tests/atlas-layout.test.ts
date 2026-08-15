import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  TOWN_MATERIAL_ATLAS,
  TOWN_PROP_ATLAS,
  TOWN_VEGETATION_ATLAS,
  atlasGridUniform,
  authoredTexel,
  tileIndex,
  tileRect,
  type AtlasLayout,
} from '../src/town/art/atlas-layout.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { TOWN_PROP_TILE_BY_TYPE, buildTownPropBatch } from '../src/town/art/town-dynamic-props.ts';

/**
 * The seam between the packed atlas and everything that samples it.
 *
 * `build-texture-atlas.mjs` writes each tile's inner rectangle into the atlas JSON, and four
 * addressing paths read it: the voxel shader through a grid uniform, the awning shader through one
 * rectangle, and the prop and foliage meshes through per-instance rectangles. What these tests
 * protect is that none of them goes back to working the grid out for itself, because the atlas can
 * be repacked and a hand-derived grid cannot follow it.
 */

const ATLASES: ReadonlyArray<readonly [string, AtlasLayout]> = [
  ['material', TOWN_MATERIAL_ATLAS],
  ['prop', TOWN_PROP_ATLAS],
  ['vegetation', TOWN_VEGETATION_ATLAS],
];

test('every shipped atlas publishes a rectangle per tile inside a gutter', () => {
  for (const [name, layout] of ATLASES) {
    assert.equal(layout.gutter, 64, `${name} atlas does not carry the derived 64px gutter`);
    assert.equal(layout.tileRects.length, layout.tiles.length, `${name} atlas is missing rectangles`);
    assert.equal(layout.uvOrigin, 'bottom-left');
    for (const rect of layout.tileRects) {
      assert.ok(rect.x > 0 && rect.y > 0, `${name}/${rect.name} touches the atlas edge`);
      assert.ok(rect.x + rect.width < 1 && rect.y + rect.height < 1, `${name}/${rect.name} runs off the atlas`);
    }
  }
});

test('the grid a shader derives agrees with every rectangle the packer wrote', () => {
  // `atlasGridUniform` throws on disagreement, so calling it is most of the check. The returned
  // numbers are asserted too, because a uniform that silently came back as zeros would sample the
  // same corner of the atlas for every material.
  const [columns, rows, gutterU, gutterV] = atlasGridUniform(TOWN_MATERIAL_ATLAS);
  assert.equal(columns, 4);
  assert.equal(rows, 3);
  assert.equal(gutterU, 64 / TOWN_MATERIAL_ATLAS.size.width);
  assert.equal(gutterV, 64 / TOWN_MATERIAL_ATLAS.size.height);
  for (const [, layout] of ATLASES) atlasGridUniform(layout);
});

test('a rectangle that has drifted from the grid fails at construction', () => {
  // The whole point of deriving the grid in the shader is that it stays equal to the pixels. Move
  // one rectangle a quarter of a tile and the check must refuse it rather than let the demo ship a
  // fringe that only a screenshot would reveal.
  const drifted = {
    ...TOWN_MATERIAL_ATLAS,
    tileRects: TOWN_MATERIAL_ATLAS.tileRects.map(
      (rect, index) => (index === 5 ? { ...rect, x: rect.x + 0.0625 } : rect),
    ),
  };
  assert.throws(() => atlasGridUniform(drifted), /slate-shingles/);
});

test('a tile is addressed by the rectangle published for it', () => {
  const cloth = tileIndex(TOWN_MATERIAL_ATLAS, 'red-cream-market-cloth');
  assert.equal(cloth, 8);
  const published = TOWN_MATERIAL_ATLAS.tileRects[cloth]!;
  assert.deepEqual(
    tileRect(TOWN_MATERIAL_ATLAS, cloth),
    [published.x, published.y, published.width, published.height],
  );
  assert.throws(() => tileRect(TOWN_MATERIAL_ATLAS, 99), /outside/);
  assert.throws(() => tileIndex(TOWN_MATERIAL_ATLAS, 'no-such-tile'), /no atlas tile named/);
});

test('the height taps still step one authored texel after the repack', () => {
  // Packing resampled the material tiles from 313.5x418 to 384x512. A step measured in packed texels
  // would cover 82% of the material it used to, and every stone and timber face would lose relief
  // for a reason nobody would connect to an atlas rebuild.
  const [stepU, stepV] = authoredTexel(TOWN_MATERIAL_ATLAS);
  const rect = TOWN_MATERIAL_ATLAS.tileRects[0]!;
  const { cell } = TOWN_MATERIAL_ATLAS.source;
  assert.ok(Math.abs(stepU / rect.width - 1 / cell.width) < 1e-9, 'the u step is no longer one authored texel');
  assert.ok(Math.abs(stepV / rect.height - 1 / cell.height) < 1e-9, 'the v step is no longer one authored texel');
});

test('prop cards are cut to the rectangles the prop atlas publishes', () => {
  const batch = buildTownPropBatch([
    { type: 'barrel', x: 0, y: 0, z: 0, scale: 1, yaw: 0, curvature: 0 },
    { type: 'crate', x: 2, y: 0, z: 0, scale: 1, yaw: 0, curvature: 0 },
  ]);
  for (const [index, type] of (['barrel', 'crate'] as const).entries()) {
    const written = Array.from(batch.uvRects.subarray(index * 4, index * 4 + 4));
    const published = tileRect(TOWN_PROP_ATLAS, TOWN_PROP_TILE_BY_TYPE[type]);
    // Float32 rounding, not a difference worth hiding behind a loose epsilon: a half-texel inset on
    // this atlas is 2e-4, two hundred times the tolerance below.
    for (let part = 0; part < 4; part += 1) {
      assert.ok(
        Math.abs(written[part]! - published[part]!) < 1e-6,
        `the ${type} card is not addressing its published rectangle: ${written} against ${published}`,
      );
    }
  }
  // A card is as wide as the tile it shows; a hand-copied cell size would drift from the packed one.
  const aspect = TOWN_PROP_ATLAS.inner.width / TOWN_PROP_ATLAS.inner.height;
  assert.ok(Math.abs(batch.sizes[0]! / batch.sizes[1]! - aspect) < 1e-6);
});
