#!/usr/bin/env node
/**
 * Build the tiling detail normal map every demo projects over its surfaces.
 *
 * Why a generated texture rather than a downloaded one: this is surface *tooth*, not a material. It
 * carries no colour, no identity and no authorship worth preserving — it exists so that a flat
 * surface stops reading as a single constant when a light moves across it. Poly Haven material sets
 * arrive later and bring their own normals; this one sits under all of them at a much higher tile
 * rate, and having it in a script means its parameters are legible and its output reproducible.
 *
 * Why the same file is written into four demos rather than shared from one place: each demo is a
 * separate Vite package that resolves assets through `new URL('../assets/…', import.meta.url)`, so a
 * cross-package reference does not survive the build. The generator is the single source of truth and
 * the outputs are byte-identical, which the determinism test asserts.
 *
 * Tileability is structural, not a post-process. Every octave's lattice divides the image size, and
 * lattice lookups wrap with `%`, so the left edge continues into the right edge exactly. A blur or a
 * mirror-fade would leave a visible repeat at the tile rate this is used at.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SIZE = 512;
/** Lattice, amplitude. Each lattice divides SIZE, which is what makes the result tile. */
const OCTAVES = [
  [8, 1],
  [16, 0.5],
  [32, 0.28],
  [64, 0.16],
  [128, 0.09],
];
/**
 * How far the surface tilts. At 8 the map carries an X/Y range of about ±0.5 and a mean tilt of
 * 0.11, which is the range a real detail normal ships with.
 *
 * The texture deliberately holds more relief than any surface wants to show. Each shader scales it
 * down through its own strength uniform, so the amount of tooth is a decision visible at the place
 * it applies rather than baked into a binary nobody can read. Baking the restraint in here instead
 * would leave every surface stuck with one answer and no way to see why.
 */
const RELIEF = 8;

const demosRoot = fileURLToPath(new URL('..', import.meta.url));
const DEMOS = ['antiky-town', 'combat-arena', 'point-light-expo', 'traversal-study'];
const OUTPUT_NAME = 'detail-normal-512.png';

/** Integer hash → [0,1). Deterministic across runs and platforms; no seeded PRNG state to thread. */
function hash(x, y) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value noise on a wrapping lattice, so the field is periodic over `lattice` cells. */
function noise(x, y, lattice) {
  const scale = lattice / SIZE;
  const fx = x * scale;
  const fy = y * scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smootherstep(fx - x0);
  const ty = smootherstep(fy - y0);
  const wrap = (value) => ((value % lattice) + lattice) % lattice;
  const x1 = wrap(x0 + 1);
  const y1 = wrap(y0 + 1);
  const cx0 = wrap(x0);
  const cy0 = wrap(y0);
  const top = hash(cx0, cy0) * (1 - tx) + hash(x1, cy0) * tx;
  const bottom = hash(cx0, y1) * (1 - tx) + hash(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function height(x, y) {
  let total = 0;
  let weight = 0;
  for (const [lattice, amplitude] of OCTAVES) {
    total += noise(x, y, lattice) * amplitude;
    weight += amplitude;
  }
  return total / weight;
}

function build() {
  const heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) heights[y * SIZE + x] = height(x, y);
  }

  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const at = (x, y) => heights[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      // Central differences on a wrapping lookup — the wrap is why the gradient is continuous
      // across the tile edge rather than flattening there.
      const dx = (at(x + 1, y) - at(x - 1, y)) * RELIEF;
      const dy = (at(x, y + 1) - at(x, y - 1)) * RELIEF;
      const length = Math.hypot(dx, dy, 1);
      const index = (y * SIZE + x) * 4;
      pixels[index] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      pixels[index + 1] = Math.round(((-dy / length) * 0.5 + 0.5) * 255);
      pixels[index + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

async function main() {
  const pixels = build();
  const png = await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  const digest = createHash('sha256').update(png).digest('hex');

  const receipt = `${JSON.stringify({
    name: OUTPUT_NAME,
    generator: 'packages/demos/scripts/build-detail-normal.mjs',
    kind: 'tangent-space detail normal, tiling',
    size: SIZE,
    octaves: OCTAVES,
    relief: RELIEF,
    sha256: digest,
  }, null, 2)}\n`;

  for (const demo of DEMOS) {
    const directory = path.join(demosRoot, 'antiky', demo, 'assets', 'textures');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, OUTPUT_NAME), png);
    await writeFile(path.join(directory, `${OUTPUT_NAME.replace(/\.png$/, '')}.json`), receipt);
  }
  process.stdout.write(`${OUTPUT_NAME} ${SIZE}x${SIZE} sha256=${digest.slice(0, 16)} → ${DEMOS.length} demos\n`);
}

await main();
