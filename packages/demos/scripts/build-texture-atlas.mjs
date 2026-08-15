/**
 * Slice an authored atlas into tiles, then emit those tiles in a form that cannot bleed.
 *
 * ## What bleeding is
 *
 * An atlas packs many textures into one image. The GPU shrinks that image to draw distant surfaces,
 * and shrinking averages neighbouring pixels — so near a tile's edge the average reaches into **the
 * tile next door**. Stone picks up the grass beside it in the file and shows a wrong-coloured fringe.
 *
 * ## Why the gutter is 64 pixels, derived rather than guessed
 *
 * A texel at mip N is the average of 2^N source texels, so a tile stays clean to mip N if it carries
 * at least 2^N pixels of its own material outside the rectangle anything samples. The deepest mip a
 * town surface selects therefore sets the gutter:
 *
 * - `town-voxel.shader.ts` scales its world-space UV by 0.82 and takes `fract`, so one tile repeat
 *   spans 1 / 0.82 world units.
 * - A material tile is 1254 / 4 = 313.5 px, giving 313.5 x 0.82 ~= 257 texels per world unit.
 * - The capture pose is fovY 0.57 into a 720 px viewport, and `FAR_DEPTH` is 180 (`src/town/art/town.ts`).
 * - At the far plane one pixel covers 2 * 180 * tan(0.57 / 2) / 720 ~= 0.1465 world units, so a pixel
 *   covers 257 * 0.1465 ~= 37.7 texels. log2(37.7) = 5.24.
 *
 * Round up: a tile must stay clean to **mip 6**, and 2^6 = **64 pixels** of gutter.
 *
 * ## Why the gutter is extruded, not transparent and not black
 *
 * The obvious thing is to leave the gutter empty. Do not. The gutter is not a barrier — it is the
 * material that a mip average finds when it reaches past the tile edge, and it must therefore look
 * like more of the same tile. A transparent or black gutter turns a colour fringe into a dark or
 * see-through fringe, which is the same defect with a different tint, and on an alpha-tested atlas a
 * transparent gutter also eats the silhouette as the mip chain descends. So every cell repeats its
 * tile's outermost row and column outward: clamp-to-edge, baked into the pixels.
 *
 * ## Why power-of-two cells
 *
 * 1254 / 4 = 313.5, so the authored material grid does not even land on a pixel boundary, and no
 * inset can be expressed exactly. Each tile is therefore resampled to an inner size that is a
 * multiple of 64 and laid into a cell that is also a multiple of 64. Every cell boundary and every
 * inner-rectangle edge then lands on an integer texel at every mip level down to 6, so a mip texel
 * inside the rectangle is built only from that tile's pixels.
 *
 * ## The two emit modes
 *
 * - `--padded` re-lays the tiles into one atlas with the gutter above. This is what BroMetal can
 *   consume today.
 * - `--layers` writes each tile as its own image plus a manifest. Separate images cannot bleed into
 *   each other at all; this is the shape an array texture consumes.
 *
 * Both run over the same slicer, which is the part built to last.
 *
 * ## The descriptor is both the recipe and the receipt
 *
 * The tool reads its inputs from the same JSON companion it writes: `source` names the authored
 * image and its grid, `gutter` and `inner` say how to lay it out. Everything else in the file is
 * output — the built image's hash, its size, and each tile's inner rectangle in normalised
 * coordinates. Running the tool again on an already-built descriptor reproduces the same bytes,
 * because it always slices the authored source rather than its own output.
 *
 * Published rectangles use the renderer's UV convention: v = 0 at the **bottom** of the image, which
 * is why row 0 of the grid gets the highest v. The descriptor states this as `uvOrigin`.
 *
 * ## Usage
 *
 *   node packages/demos/scripts/build-texture-atlas.mjs --padded <descriptor.json>
 *   node packages/demos/scripts/build-texture-atlas.mjs --layers <descriptor.json> --out <dir>
 *   node packages/demos/scripts/build-texture-atlas.mjs --measure <descriptor.json> [--mip 6]
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

// The gutter width and the mip level it is derived from live in the shared asset policy, so the
// packer that writes an atlas and the rule that rejects one cannot drift apart.
import { ATLAS_DEEPEST_MIP, checkAtlasLayout } from './asset-fidelity-policy.mjs';

/** PNG settings pinned so two runs on the same input produce the same bytes. */
const PNG = Object.freeze({ compressionLevel: 9, effort: 10, palette: false });

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Raw pixels plus the shape needed to index them. */
async function readRaw(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

/**
 * Where tile `index` sits in the authored image, in whole pixels.
 *
 * An authored grid need not divide its image evenly — the material atlas is 1254 px across four
 * columns, so its columns are 313.5 px wide. Rounding each edge independently is the honest read of
 * that: neighbouring columns come out 314 and 313 px wide and no pixel is used twice or skipped.
 */
export function sourceTileRect(size, grid, index) {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  const left = Math.round((column * size.width) / grid.columns);
  const right = Math.round(((column + 1) * size.width) / grid.columns);
  const top = Math.round((row * size.height) / grid.rows);
  const bottom = Math.round(((row + 1) * size.height) / grid.rows);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * The slicer: one clean tile per entry, at the requested size.
 *
 * This is the only place that reads the authored image, and it is what both emit modes are built on.
 * Each tile is extracted before it is resampled, so a resample filter can never reach across a tile
 * boundary and pull in the neighbour.
 */
export async function sliceTiles(sourcePath, grid, tileNames, inner) {
  const source = sharp(sourcePath);
  const { width, height, hasAlpha } = await source.metadata();
  const cell = { width: width / grid.columns, height: height / grid.rows };
  const tiles = [];
  for (let index = 0; index < tileNames.length; index += 1) {
    const rect = sourceTileRect({ width, height }, grid, index);
    let pipeline = sharp(sourcePath).extract(rect);
    if (rect.width !== inner.width || rect.height !== inner.height) {
      pipeline = pipeline.resize(inner.width, inner.height, { kernel: 'lanczos3', fit: 'fill' });
    }
    const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
    tiles.push({
      name: tileNames[index],
      index,
      column: index % grid.columns,
      row: Math.floor(index / grid.columns),
      sourceRect: rect,
      data,
      width: info.width,
      height: info.height,
      channels: info.channels,
    });
  }
  return { tiles, hasAlpha: Boolean(hasAlpha), size: { width, height }, cell };
}

/**
 * What the tool read, so a consumer can tell how far the art was resampled.
 *
 * `cell` is the authored tile size and may be fractional — 1254 / 4 = 313.5 is exactly the defect
 * this tool exists to remove. A shader that steps a fixed distance across the material needs the
 * ratio between this and `inner` to keep stepping the same distance after the resample.
 */
function sourceReceipt(descriptor, sliced, bytes) {
  // The fields below are rebuilt every run. Anything else the block carries — the vegetation
  // atlas records how it was keyed for transparency — is authored provenance and is kept as is.
  const owned = new Set(['image', 'grid', 'size', 'cell', 'sha256']);
  const authored = Object.fromEntries(
    Object.entries(descriptor.source).filter(([key]) => !owned.has(key)),
  );
  return {
    image: descriptor.source.image,
    grid: descriptor.source.grid,
    size: sliced.size,
    cell: { width: sliced.cell.width, height: sliced.cell.height },
    ...authored,
    sha256: sha256(bytes),
  };
}

/**
 * Write one tile into its cell, repeating the tile's own edge outward across the gutter.
 *
 * Every pixel of the cell — gutter included — is read from the tile with its coordinates clamped
 * into the tile, so the gutter is literally the tile's outermost row and column continued. There is
 * no separate "fill the border" pass and therefore no corner case to get wrong.
 */
function stampCell(atlas, atlasWidth, channels, tile, cellLeft, cellTop, cellWidth, cellHeight, gutter) {
  for (let y = 0; y < cellHeight; y += 1) {
    const sourceY = Math.min(tile.height - 1, Math.max(0, y - gutter));
    for (let x = 0; x < cellWidth; x += 1) {
      const sourceX = Math.min(tile.width - 1, Math.max(0, x - gutter));
      const from = (sourceY * tile.width + sourceX) * tile.channels;
      const to = ((cellTop + y) * atlasWidth + cellLeft + x) * channels;
      for (let c = 0; c < channels; c += 1) atlas[to + c] = tile.data[from + c];
    }
  }
}

/** Read the build inputs a descriptor carries, failing loudly rather than guessing at a default. */
function buildPlan(descriptor, descriptorPath) {
  const directory = path.dirname(descriptorPath);
  const source = descriptor.source;
  if (!source?.image) throw new Error(`${descriptorPath}: no source.image to slice`);
  if (!source.grid?.columns || !source.grid?.rows) throw new Error(`${descriptorPath}: no source.grid`);
  if (!descriptor.inner?.width || !descriptor.inner?.height) {
    throw new Error(`${descriptorPath}: no inner size for the resampled tile`);
  }
  const gutter = descriptor.gutter;
  if (!Number.isInteger(gutter) || gutter < 0) throw new Error(`${descriptorPath}: gutter must be a whole number`);
  return {
    directory,
    sourcePath: path.join(directory, source.image),
    grid: source.grid,
    inner: descriptor.inner,
    gutter,
    tileNames: descriptor.tiles ?? [],
  };
}

/**
 * A descriptor is written with a stable key order so a rebuild produces a clean diff, and so two
 * runs are byte-identical rather than merely equivalent.
 */
function serialiseDescriptor(descriptor) {
  const ORDER = [
    'schemaVersion', 'emitMode', 'image', 'imageSha256', 'size', 'grid', 'gutter', 'inner',
    'uvOrigin', 'tiles', 'tileRects', 'source', 'transparency', 'usage', 'provenance',
  ];
  const ordered = {};
  for (const key of ORDER) if (descriptor[key] !== undefined) ordered[key] = descriptor[key];
  for (const key of Object.keys(descriptor)) if (ordered[key] === undefined) ordered[key] = descriptor[key];
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** Round a normalised coordinate so the JSON does not carry float noise that differs between runs. */
const normalised = (value, total) => Number((value / total).toFixed(9));

/**
 * Re-lay an authored atlas into power-of-two cells with an extruded gutter.
 *
 * Returns what it wrote, so a caller or a test can assert on it without re-reading the disk.
 */
export async function buildPaddedAtlas(descriptorPath) {
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const plan = buildPlan(descriptor, descriptorPath);
  const sourceBytes = await readFile(plan.sourcePath);
  const sliced = await sliceTiles(plan.sourcePath, plan.grid, plan.tileNames, plan.inner);
  const { tiles, hasAlpha } = sliced;

  const channels = hasAlpha ? 4 : 3;
  const cellWidth = plan.inner.width + plan.gutter * 2;
  const cellHeight = plan.inner.height + plan.gutter * 2;
  const atlasWidth = cellWidth * plan.grid.columns;
  const atlasHeight = cellHeight * plan.grid.rows;
  const atlas = Buffer.alloc(atlasWidth * atlasHeight * channels);

  const tileRects = [];
  for (const tile of tiles) {
    const cellLeft = tile.column * cellWidth;
    const cellTop = tile.row * cellHeight;
    stampCell(atlas, atlasWidth, channels, tile, cellLeft, cellTop, cellWidth, cellHeight, plan.gutter);
    const innerLeft = cellLeft + plan.gutter;
    const innerTop = cellTop + plan.gutter;
    tileRects.push({
      name: tile.name,
      // v = 0 at the bottom of the image, so a row near the top of the file gets a high v.
      x: normalised(innerLeft, atlasWidth),
      y: normalised(atlasHeight - innerTop - plan.inner.height, atlasHeight),
      width: normalised(plan.inner.width, atlasWidth),
      height: normalised(plan.inner.height, atlasHeight),
    });
  }

  const png = await sharp(atlas, { raw: { width: atlasWidth, height: atlasHeight, channels } })
    .png(PNG)
    .toBuffer();
  const imageName = descriptor.image ?? path.basename(plan.sourcePath);
  await writeFile(path.join(plan.directory, imageName), png);

  const written = {
    ...descriptor,
    schemaVersion: 2,
    emitMode: 'padded',
    image: imageName,
    imageSha256: sha256(png),
    size: { width: atlasWidth, height: atlasHeight },
    grid: { columns: plan.grid.columns, rows: plan.grid.rows, cellWidth, cellHeight },
    gutter: plan.gutter,
    inner: { width: plan.inner.width, height: plan.inner.height },
    uvOrigin: 'bottom-left',
    tileRects,
    source: sourceReceipt(descriptor, sliced, sourceBytes),
  };
  // The packer holds itself to the same rule that rejects an atlas arriving from anywhere else.
  const failures = checkAtlasLayout(written, imageName);
  if (failures.length > 0) throw new Error(failures.join('\n'));

  await writeFile(descriptorPath, serialiseDescriptor(written));
  return written;
}

/**
 * Write every tile as its own image plus a manifest.
 *
 * Layers are emitted at the same `inner` size as the padded mode uses, because an array texture
 * requires every layer to share one size and because it keeps the two modes describing the same
 * tiles rather than two different resamplings of them.
 */
export async function buildLayers(descriptorPath, outDirectory) {
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const plan = buildPlan(descriptor, descriptorPath);
  const sourceBytes = await readFile(plan.sourcePath);
  const sliced = await sliceTiles(plan.sourcePath, plan.grid, plan.tileNames, plan.inner);
  const { tiles, hasAlpha } = sliced;
  await mkdir(outDirectory, { recursive: true });

  const layers = [];
  for (const tile of tiles) {
    const png = await sharp(tile.data, {
      raw: { width: tile.width, height: tile.height, channels: tile.channels },
    }).png(PNG).toBuffer();
    const file = `${String(tile.index).padStart(2, '0')}-${tile.name}.png`;
    await writeFile(path.join(outDirectory, file), png);
    layers.push({ name: tile.name, index: tile.index, image: file, imageSha256: sha256(png) });
  }

  const manifest = {
    schemaVersion: 2,
    emitMode: 'layers',
    layerSize: { width: plan.inner.width, height: plan.inner.height },
    channels: hasAlpha ? 4 : 3,
    layers,
    source: sourceReceipt(descriptor, sliced, sourceBytes),
  };
  const manifestPath = path.join(outDirectory, 'layers.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath };
}

/** Average one mip texel's block of the image, ignoring any part that falls outside it. */
function atlasBlock(image, blockX, blockY, size) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = blockY; y < blockY + size; y += 1) {
    if (y < 0 || y >= image.height) continue;
    for (let x = blockX; x < blockX + size; x += 1) {
      if (x < 0 || x >= image.width) continue;
      const i = (y * image.width + x) * image.channels;
      r += image.data[i];
      g += image.data[i + 1];
      b += image.data[i + 2];
      n += 1;
    }
  }
  return n === 0 ? null : [r / n, g / n, b / n];
}

/** The same block, read as if the tile were alone in its own image: outside it, its edge repeats. */
function isolatedBlock(image, blockX, blockY, size, rect) {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let y = blockY; y < blockY + size; y += 1) {
    const clampedY = Math.min(rect.top + rect.height - 1, Math.max(rect.top, y));
    for (let x = blockX; x < blockX + size; x += 1) {
      const clampedX = Math.min(rect.left + rect.width - 1, Math.max(rect.left, x));
      const i = (clampedY * image.width + clampedX) * image.channels;
      r += image.data[i];
      g += image.data[i + 1];
      b += image.data[i + 2];
    }
  }
  const n = size * size;
  return [r / n, g / n, b / n];
}

/**
 * How wrong a tile's border goes when it is mipped inside the atlas rather than on its own.
 *
 * The honest measurement of bleeding, and the one this goal is judged on. Mip the tile inside the
 * atlas, mip the same tile in isolation, compare their borders; the isolated tile is ground truth
 * because it has no neighbour to bleed from.
 *
 * The band compared is the two-texel-wide ring straddling the tile's rectangle — one texel in, one
 * texel out — because that is what filtering at the tile edge can actually read. The inner texel is
 * what a mip average lands on, and the outer texel is what bilinear filtering blends toward. Both
 * halves matter and they fail for different reasons: an unaligned grid spoils the inner texel, and a
 * missing gutter spoils the outer one. A ring of only inner texels scores zero on any atlas whose
 * cells happen to be 64-aligned, which would have called the vegetation atlas clean while its tile
 * edges sat directly against their neighbours.
 *
 * An earlier metric compared the average of two neighbouring tiles against the colours already seen
 * in them. That measures palette overlap: extruding each tile's edge made it *worse*, and the only
 * thing that scored zero was flattening every tile to one colour.
 */
export async function measureBorderError({ imagePath, rects, mip = ATLAS_DEEPEST_MIP }) {
  const image = await readRaw(imagePath);
  const size = 2 ** mip;
  let sum = 0;
  let count = 0;
  let worst = 0;
  const perTile = [];
  for (const rect of rects) {
    const firstX = Math.floor(rect.left / size);
    const firstY = Math.floor(rect.top / size);
    const lastX = Math.ceil((rect.left + rect.width) / size) - 1;
    const lastY = Math.ceil((rect.top + rect.height) / size) - 1;
    let tileSum = 0;
    let tileCount = 0;
    let tileWorst = 0;
    for (let ty = firstY - 1; ty <= lastY + 1; ty += 1) {
      for (let tx = firstX - 1; tx <= lastX + 1; tx += 1) {
        const wellInside = tx > firstX && tx < lastX && ty > firstY && ty < lastY;
        if (wellInside) continue;
        const inAtlas = atlasBlock(image, tx * size, ty * size, size);
        if (!inAtlas) continue;
        const alone = isolatedBlock(image, tx * size, ty * size, size, rect);
        for (let c = 0; c < 3; c += 1) {
          const error = Math.abs(inAtlas[c] - alone[c]);
          tileSum += error;
          tileCount += 1;
          if (error > tileWorst) tileWorst = error;
        }
      }
    }
    perTile.push({ name: rect.name, mean: tileSum / tileCount, worst: tileWorst });
    sum += tileSum;
    count += tileCount;
    if (tileWorst > worst) worst = tileWorst;
  }
  return { mip, mean: sum / count, worst, samples: count, perTile };
}

/**
 * Every tile's rectangle in image pixels, from published rectangles when the atlas has them and from
 * the bare grid when it does not.
 *
 * Reading `tileRects` when they exist is the point: it measures what the shader actually samples,
 * rather than re-deriving a grid the shader might not agree with.
 */
export function pixelRects(descriptor) {
  const { width, height } = descriptor.size;
  if (descriptor.tileRects) {
    return descriptor.tileRects.map((rect) => ({
      name: rect.name,
      left: Math.round(rect.x * width),
      // Published rectangles are v-up; pixel rows are y-down.
      top: Math.round((1 - rect.y - rect.height) * height),
      width: Math.round(rect.width * width),
      height: Math.round(rect.height * height),
    }));
  }
  const grid = descriptor.grid;
  const names = descriptor.tiles ?? [];
  const count = names.length || grid.columns * grid.rows;
  const rects = [];
  for (let index = 0; index < count; index += 1) {
    rects.push({ name: names[index] ?? `tile-${index}`, ...sourceTileRect({ width, height }, grid, index) });
  }
  return rects;
}

async function main(argv) {
  const mode = ['--padded', '--layers', '--measure'].find((flag) => argv.includes(flag));
  if (!mode) {
    process.stderr.write('usage: build-texture-atlas.mjs --padded|--layers|--measure <descriptor.json>\n');
    process.exitCode = 1;
    return;
  }
  const descriptorPath = path.resolve(argv[argv.indexOf(mode) + 1]);

  if (mode === '--padded') {
    const written = await buildPaddedAtlas(descriptorPath);
    process.stdout.write(
      `${written.image}: ${written.size.width}x${written.size.height}, `
      + `${written.grid.columns}x${written.grid.rows} cells of ${written.grid.cellWidth}x`
      + `${written.grid.cellHeight}, gutter ${written.gutter}, sha ${written.imageSha256.slice(0, 12)}\n`,
    );
    return;
  }

  if (mode === '--layers') {
    const outIndex = argv.indexOf('--out');
    const outDirectory = outIndex === -1
      ? path.join(path.dirname(descriptorPath), `${path.basename(descriptorPath, '.json')}-layers`)
      : path.resolve(argv[outIndex + 1]);
    const { manifest, manifestPath } = await buildLayers(descriptorPath, outDirectory);
    process.stdout.write(
      `${manifestPath}: ${manifest.layers.length} layers of `
      + `${manifest.layerSize.width}x${manifest.layerSize.height}\n`,
    );
    return;
  }

  const mipIndex = argv.indexOf('--mip');
  const mip = mipIndex === -1 ? ATLAS_DEEPEST_MIP : Number(argv[mipIndex + 1]);
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8'));
  const imagePath = path.join(path.dirname(descriptorPath), descriptor.image);
  const result = await measureBorderError({ imagePath, rects: pixelRects(descriptor), mip });
  process.stdout.write(
    `${descriptor.image} mip ${result.mip}: mean ${result.mean.toFixed(2)}/255, `
    + `worst ${result.worst.toFixed(0)}/255 over ${result.samples} samples\n`,
  );
  for (const tile of result.perTile) {
    process.stdout.write(`  ${tile.name}: mean ${tile.mean.toFixed(2)} worst ${tile.worst.toFixed(0)}\n`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main(process.argv.slice(2));
}
