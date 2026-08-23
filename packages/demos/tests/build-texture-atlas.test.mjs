import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { ATLAS_DEEPEST_MIP, ATLAS_GUTTER_PIXELS, checkAtlasLayout } from '../scripts/asset-fidelity-policy.mjs';
import {
  buildLayers,
  buildPaddedAtlas,
  measureBorderError,
  pixelRects,
  sourceTileRect,
} from '../scripts/build/texture-atlas.mjs';

/**
 * The slicer, checked on an atlas built to make bleeding obvious.
 *
 * Two tiles of deliberately distant colours — saturated red beside saturated cyan — so any pixel
 * that crosses the boundary is unmistakable rather than a subtle shift that an epsilon could hide.
 * Real art would let a wrong pixel pass for a plausible one.
 */

const TILE_SIZE = 64;

/** Red on the left, cyan on the right, each with a gradient so a flat fill cannot pass for a tile. */
function syntheticSource() {
  const width = TILE_SIZE * 2;
  const height = TILE_SIZE;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      const ramp = 180 + Math.floor((75 * ((x % TILE_SIZE) + y)) / (TILE_SIZE * 2 - 2));
      if (x < TILE_SIZE) {
        data[index] = ramp;
      } else {
        data[index + 1] = ramp;
        data[index + 2] = ramp;
      }
    }
  }
  return sharp(data, { raw: { width, height, channels: 3 } }).png();
}

const isRed = (r, g, b) => r >= 180 && g === 0 && b === 0;
const isCyan = (r, g, b) => r === 0 && g >= 180 && b >= 180;

async function synthetic({ inner = { width: TILE_SIZE, height: TILE_SIZE }, gutter = ATLAS_GUTTER_PIXELS } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'atlas-slicer-'));
  await mkdir(path.join(directory, 'source'), { recursive: true });
  await writeFile(path.join(directory, 'source', 'synthetic.png'), await syntheticSource().toBuffer());
  const descriptorPath = path.join(directory, 'synthetic.json');
  await writeFile(descriptorPath, `${JSON.stringify({
    schemaVersion: 2,
    image: 'synthetic.png',
    gutter,
    inner,
    tiles: ['red', 'cyan'],
    source: { image: 'source/synthetic.png', grid: { columns: 2, rows: 1 } },
    usage: 'A slicer fixture.',
    provenance: { generator: 'build-texture-atlas.test.mjs' },
  }, null, 2)}\n`);
  return { directory, descriptorPath };
}

async function readRaw(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    at(x, y) {
      const index = (y * info.width + x) * info.channels;
      return [data[index], data[index + 1], data[index + 2], info.channels === 4 ? data[index + 3] : 255];
    },
  };
}

test('a fractional grid is sliced without using or skipping a pixel', () => {
  // The material atlas: 1254 across four columns is 313.5, which lands between texels. Rounding each
  // edge independently gives 314/313/314/313 and covers the image exactly once.
  const widths = [0, 1, 2, 3].map(
    (index) => sourceTileRect({ width: 1254, height: 1254 }, { columns: 4, rows: 3 }, index).width,
  );
  assert.deepEqual(widths, [314, 313, 314, 313]);
  assert.equal(widths.reduce((a, b) => a + b, 0), 1254);
  const second = sourceTileRect({ width: 1254, height: 1254 }, { columns: 4, rows: 3 }, 1);
  assert.equal(second.left, 314);
});

test('the gutter holds the tile edge extruded, not black and not transparent', async () => {
  const { directory, descriptorPath } = await synthetic();
  const written = await buildPaddedAtlas(descriptorPath);
  const image = await readRaw(path.join(directory, written.image));

  assert.equal(written.gutter, ATLAS_GUTTER_PIXELS);
  assert.equal(image.width, (TILE_SIZE + ATLAS_GUTTER_PIXELS * 2) * 2);

  // Walk the red tile's left gutter. Every pixel must equal the tile's own leftmost column at that
  // row — the definition of extrusion — and therefore must not be black or transparent.
  const [rect] = pixelRects(written);
  let checked = 0;
  for (let y = rect.top; y < rect.top + rect.height; y += 7) {
    const edge = image.at(rect.left, y);
    for (let x = rect.left - ATLAS_GUTTER_PIXELS; x < rect.left; x += 1) {
      const gutterPixel = image.at(x, y);
      assert.deepEqual(gutterPixel, edge, `gutter at ${x},${y} is not the extruded edge`);
      assert.ok(isRed(...gutterPixel), `gutter at ${x},${y} is not the red tile's own colour`);
      assert.notDeepEqual(gutterPixel.slice(0, 3), [0, 0, 0]);
      checked += 1;
    }
  }
  assert.ok(checked > 500, `expected to walk the whole gutter, walked ${checked} pixels`);

  // The corner is the hardest case for an extrusion written as four separate edge passes.
  const corner = image.at(rect.left - ATLAS_GUTTER_PIXELS, rect.top - ATLAS_GUTTER_PIXELS);
  assert.deepEqual(corner, image.at(rect.left, rect.top));
});

test('the published inner rectangle addresses only the tile it names', async () => {
  const { directory, descriptorPath } = await synthetic();
  const written = await buildPaddedAtlas(descriptorPath);
  const image = await readRaw(path.join(directory, written.image));
  const rects = pixelRects(written);

  assert.deepEqual(written.tileRects.map((rect) => rect.name), ['red', 'cyan']);
  for (const [index, rect] of rects.entries()) {
    const belongs = index === 0 ? isRed : isCyan;
    for (let y = rect.top; y < rect.top + rect.height; y += 1) {
      for (let x = rect.left; x < rect.left + rect.width; x += 1) {
        assert.ok(belongs(...image.at(x, y)), `${rect.name} inner rect holds a foreign pixel at ${x},${y}`);
      }
    }
  }
});

test('a mip-4 average taken across the tile boundary stays inside one tile', async () => {
  const { directory, descriptorPath } = await synthetic();
  const written = await buildPaddedAtlas(descriptorPath);
  const image = await readRaw(path.join(directory, written.image));
  const [red] = pixelRects(written);

  // A mip-4 texel averages 16x16 source pixels. Slide one across the red tile's right-hand boundary
  // and every position must still read as red: inside the tile it is the tile, and outside it is the
  // tile's own edge repeated.
  const span = 16;
  let straddled = 0;
  for (let offset = -span; offset <= ATLAS_GUTTER_PIXELS - span; offset += 4) {
    const left = red.left + red.width + offset;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let y = red.top + 16; y < red.top + 32; y += 1) {
      for (let x = left; x < left + span; x += 1) {
        const pixel = image.at(x, y);
        r += pixel[0];
        g += pixel[1];
        b += pixel[2];
      }
    }
    const count = span * 16;
    assert.ok(r / count >= 180, `average at offset ${offset} lost the red tile: ${r / count}`);
    assert.ok(g / count < 1 && b / count < 1, `cyan bled into the average at offset ${offset}`);
    straddled += 1;
  }
  assert.ok(straddled >= 8, `expected to slide the texel across the boundary, took ${straddled} steps`);
});

test('padding drives the measured border error to nothing', async () => {
  const { directory, descriptorPath } = await synthetic();
  const before = await measureBorderError({
    imagePath: path.join(directory, 'source', 'synthetic.png'),
    rects: pixelRects({
      size: { width: TILE_SIZE * 2, height: TILE_SIZE },
      grid: { columns: 2, rows: 1 },
      tiles: ['red', 'cyan'],
    }),
    mip: 4,
  });
  const written = await buildPaddedAtlas(descriptorPath);
  const after = await measureBorderError({
    imagePath: path.join(directory, written.image),
    rects: pixelRects(written),
    mip: 4,
  });
  // Red against cyan across an unguttered seam is close to the worst case a border error can have.
  assert.ok(before.mean > 30, `the fixture is meant to bleed badly, measured ${before.mean}`);
  assert.equal(after.mean, 0, `a padded, aligned atlas must measure exactly zero, measured ${after.mean}`);
  assert.equal(after.worst, 0);
});

test('the measurement is not satisfied by alignment alone', async () => {
  // The fixture's tiles are 64x64 at x = 0 and x = 64, so every mip texel down to level 6 already
  // sits wholly inside one tile — the grid is perfectly aligned and there is still no gutter. A
  // measurement that only looked inside the rectangle would call this clean, which is the trap the
  // vegetation atlas was already in: 384x512 cells, aligned, tiles hard against each other.
  const { directory } = await synthetic();
  const rects = pixelRects({
    size: { width: TILE_SIZE * 2, height: TILE_SIZE },
    grid: { columns: 2, rows: 1 },
    tiles: ['red', 'cyan'],
  });
  assert.deepEqual(rects.map((rect) => rect.left), [0, 64]);
  for (const mip of [2, 4, 6]) {
    const aligned = await measureBorderError({
      imagePath: path.join(directory, 'source', 'synthetic.png'),
      rects,
      mip,
    });
    assert.ok(aligned.mean > 10, `an aligned but unguttered atlas measured ${aligned.mean} at mip ${mip}`);
  }
});

test('the shared policy rejects an atlas that arrives without a usable gutter', () => {
  // The same shape as the attribute and material-map rules: it takes the facts, so the packer can
  // check before it writes and a test can check what shipped.
  const sound = {
    image: 'sound.png',
    gutter: ATLAS_GUTTER_PIXELS,
    size: { width: 1024, height: 512 },
    tiles: ['a'],
    tileRects: [{ name: 'a', x: 64 / 1024, y: 64 / 512, width: 384 / 1024, height: 384 / 512 }],
  };
  assert.deepEqual(checkAtlasLayout(sound), []);

  assert.match(
    checkAtlasLayout({ ...sound, gutter: undefined }).join('\n'),
    /no gutter declared/,
  );
  // A gutter thinner than the mip it must survive is the same defect with a number attached.
  assert.match(
    checkAtlasLayout({ ...sound, gutter: 8 }).join('\n'),
    new RegExp(`thinner than the ${ATLAS_GUTTER_PIXELS}px`),
  );
  assert.match(
    checkAtlasLayout({ ...sound, tileRects: [] }).join('\n'),
    /publishes no per-tile rectangles/,
  );
  // A rectangle nudged off the mip grid puts gutter pixels into a texel the shader samples, which no
  // gutter width repairs.
  assert.match(
    checkAtlasLayout({
      ...sound,
      tileRects: [{ ...sound.tileRects[0], x: 70 / 1024 }],
    }).join('\n'),
    new RegExp(`whole mip-${ATLAS_DEEPEST_MIP} texels`),
  );
});

test('layers mode writes one image per tile with no cross-tile pixels', async () => {
  const { directory, descriptorPath } = await synthetic();
  const out = path.join(directory, 'layers');
  const { manifest } = await buildLayers(descriptorPath, out);

  assert.equal(manifest.emitMode, 'layers');
  assert.deepEqual(manifest.layers.map((layer) => layer.name), ['red', 'cyan']);
  const files = (await readdir(out)).filter((name) => name.endsWith('.png')).sort();
  assert.deepEqual(files, ['00-red.png', '01-cyan.png']);

  for (const [index, layer] of manifest.layers.entries()) {
    const image = await readRaw(path.join(out, layer.image));
    assert.equal(image.width, manifest.layerSize.width);
    assert.equal(image.height, manifest.layerSize.height);
    const belongs = index === 0 ? isRed : isCyan;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        assert.ok(belongs(...image.at(x, y)), `${layer.name} layer holds a foreign pixel at ${x},${y}`);
      }
    }
  }
});

test('the tool run twice on one input writes the same bytes', async () => {
  const { directory, descriptorPath } = await synthetic();
  const pristine = await readFile(descriptorPath);
  const first = await buildPaddedAtlas(descriptorPath);
  const firstImage = await readFile(path.join(directory, first.image));
  const firstDescriptor = await readFile(descriptorPath);

  // The second run reads the descriptor the first run wrote, which is the case that matters: the
  // tool always slices the authored source, so a rebuild cannot drift by consuming its own output.
  const second = await buildPaddedAtlas(descriptorPath);
  assert.deepEqual(await readFile(path.join(directory, second.image)), firstImage);
  assert.deepEqual(await readFile(descriptorPath), firstDescriptor);

  // And a run from the untouched recipe must land on the same bytes as a rebuild. Without this, a
  // field the tool writes could inherit its position from whatever was already in the file, so the
  // first build of an atlas and every later one would disagree by key order alone.
  await writeFile(descriptorPath, pristine);
  await buildPaddedAtlas(descriptorPath);
  assert.deepEqual(await readFile(descriptorPath), firstDescriptor);
  assert.equal(second.imageSha256, first.imageSha256);
  assert.equal(second.source.sha256, first.source.sha256);

  const layersOne = await buildLayers(descriptorPath, path.join(directory, 'layers-a'));
  const layersTwo = await buildLayers(descriptorPath, path.join(directory, 'layers-b'));
  assert.deepEqual(
    layersTwo.manifest.layers.map((layer) => layer.imageSha256),
    layersOne.manifest.layers.map((layer) => layer.imageSha256),
  );
});

/** The whole of one layer image, as the one rectangle the border measurement should compare. */
function wholeImageRect(name, size) {
  return pixelRects({ size, grid: { columns: 1, rows: 1 }, tiles: [name] });
}

test('layers drive the measured border error to zero with no gutter at all', async () => {
  // The same measurement, the same band reaching one texel past the rectangle, and the same source
  // pixels — the only difference is whether the two tiles share an image. Goal 14 got this number
  // to zero by surrounding each tile with 64 pixels of its own edge. Layers get there by removing
  // the neighbour, so the gutter is 0 and there is nothing left to average in.
  const { directory, descriptorPath } = await synthetic({ gutter: 0 });
  const packed = await measureBorderError({
    imagePath: path.join(directory, 'source', 'synthetic.png'),
    rects: pixelRects({
      size: { width: TILE_SIZE * 2, height: TILE_SIZE },
      grid: { columns: 2, rows: 1 },
      tiles: ['red', 'cyan'],
    }),
    mip: 4,
  });
  assert.ok(packed.mean > 30, `the fixture is meant to bleed badly, measured ${packed.mean}`);

  const out = path.join(directory, 'layers');
  const { manifest } = await buildLayers(descriptorPath, out);
  assert.equal(manifest.layers.length, 2);
  for (const layer of manifest.layers) {
    for (const mip of [2, 4, 6]) {
      const measured = await measureBorderError({
        imagePath: path.join(out, layer.image),
        rects: wholeImageRect(layer.name, manifest.layerSize),
        mip,
      });
      // Not a budget. There is no adjacent tile in this image, so any non-zero reading would mean
      // the layer was cut wrong.
      assert.equal(measured.mean, 0, `${layer.name} measured ${measured.mean} at mip ${mip}`);
      assert.equal(measured.worst, 0);
      assert.ok(measured.samples > 0, `${layer.name} at mip ${mip} compared nothing at all`);
    }
  }
});

test("the town's material atlas measures zero as layers", async () => {
  // The capability against real art rather than a fixture. antiky-town samples these twelve images
  // through a sampler2DArray, one layer per material, and this is the number that says the binding
  // is right: a layer that had picked up any part of its neighbour would not read zero.
  const layersDirectory = new URL(
    '../antiky-town/assets/textures/town-material-atlas-v1-layers/',
    import.meta.url,
  );
  const manifest = JSON.parse(await readFile(new URL('layers.json', layersDirectory), 'utf8'));
  assert.equal(manifest.emitMode, 'layers');
  assert.equal(manifest.layers.length, 12);

  let measured = 0;
  for (const layer of manifest.layers) {
    for (const mip of [2, 4, ATLAS_DEEPEST_MIP]) {
      const result = await measureBorderError({
        imagePath: path.join(path.dirname(fileURLToPath(new URL('layers.json', layersDirectory))), layer.image),
        rects: wholeImageRect(layer.name, manifest.layerSize),
        mip,
      });
      assert.equal(result.mean, 0, `${layer.name} measured ${result.mean} at mip ${mip}`);
      assert.equal(result.worst, 0, `${layer.name} worst ${result.worst} at mip ${mip}`);
      assert.ok(result.samples > 0, `${layer.name} at mip ${mip} compared nothing at all`);
      measured += 1;
    }
  }
  assert.equal(measured, 36);
});

test('a resampled tile lands on the requested power-of-two size', async () => {
  // The material atlas is the reason: 313.5 px tiles cannot carry an exact inset at any mip level,
  // so each tile is resampled to a multiple of 64 before it is laid into its cell.
  const { directory, descriptorPath } = await synthetic({ inner: { width: 128, height: 128 } });
  const written = await buildPaddedAtlas(descriptorPath);
  assert.deepEqual(written.inner, { width: 128, height: 128 });
  assert.deepEqual(written.grid, {
    columns: 2,
    rows: 1,
    cellWidth: 128 + ATLAS_GUTTER_PIXELS * 2,
    cellHeight: 128 + ATLAS_GUTTER_PIXELS * 2,
  });
  const image = await readRaw(path.join(directory, written.image));
  assert.equal(image.width, written.size.width);
  assert.equal(image.height, written.size.height);
  // Resampling happens on the extracted tile, so it can never reach into the neighbour.
  const [red] = pixelRects(written);
  assert.ok(image.at(red.left + red.width - 1, red.top + 64)[1] < 8);
});

test('every cell edge lands on a whole texel at every mip down to the derived level', async () => {
  const { descriptorPath } = await synthetic();
  const written = await buildPaddedAtlas(descriptorPath);
  const texel = 2 ** ATLAS_DEEPEST_MIP;
  for (const value of [
    written.size.width, written.size.height,
    written.grid.cellWidth, written.grid.cellHeight,
    written.inner.width, written.inner.height,
    written.gutter,
  ]) {
    assert.equal(value % texel, 0, `${value} is not a whole number of mip-${ATLAS_DEEPEST_MIP} texels`);
  }
});
