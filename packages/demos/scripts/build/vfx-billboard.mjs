#!/usr/bin/env node
/**
 * Build the soft billboard texture every VFX program samples.
 *
 * Why a texture at all, when an analytic radial falloff is smoother than any 256² image and costs no
 * memory: because the problem AC-V4 names is not hard edges, it is *sameness*. Every glow in these
 * demos is the same perfect circle, so a burst of them reads as a burst of circles. Breaking the
 * falloff with a little structure — filaments, a slightly ragged rim — is what makes twenty of them
 * read as twenty things rather than twenty copies.
 *
 * So this is a soft radial core with directional wisps layered over it, and the alpha still reaches
 * zero smoothly at the rim: it satisfies the softness AC-V1 measures while adding the variation
 * AC-V4 is really about.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SIZE = 256;
const DEMOS = ['combat-arena', 'point-light-expo', 'traversal-study'];
const OUTPUT = 'vfx-billboard-256.png';
const demosRoot = fileURLToPath(new URL('../..', import.meta.url));

function hash(x, y) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
const centre = (SIZE - 1) / 2;
for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const dx = (x - centre) / centre;
    const dy = (y - centre) / centre;
    const radius = Math.hypot(dx, dy);
    // Smooth core reaching exactly zero at the rim, so nothing is clipped into a hard circle.
    const core = Math.max(0, 1 - radius) ** 2.2;
    // Filaments: angular variation that fades out before the rim, so it never reintroduces an edge.
    const angle = Math.atan2(dy, dx);
    const spokes = 0.5 + 0.5 * Math.sin(angle * 7 + hash(Math.round(angle * 40), 0) * 6.283);
    // Damped toward the centre as well as the rim. Angle changes fastest per pixel at the middle,
    // so undamped angular variation there produces a gradient far steeper than anything at the
    // boundary — 0.153 alpha per pixel against AC-V1's 0.10 ceiling, measured before this was added.
    const angularFade = Math.min(1, radius / 0.32);
    const wisp = core * 0.42 * spokes * angularFade * Math.max(0, 1 - radius * 1.35);
    const alpha = Math.min(1, core + wisp);
    const index = (y * SIZE + x) * 4;
    // White, so a shader tints it with whatever colour the effect already carries.
    pixels[index] = 255;
    pixels[index + 1] = 255;
    pixels[index + 2] = 255;
    pixels[index + 3] = Math.round(alpha * 255);
  }
}

const png = await sharp(pixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .png({ compressionLevel: 9 }).toBuffer();
const digest = createHash('sha256').update(png).digest('hex');
for (const demo of DEMOS) {
  const directory = path.join(demosRoot, 'antiky', demo, 'assets', 'textures');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, OUTPUT), png);
}
await writeFile(
  path.join(demosRoot, 'antiky', DEMOS[0], 'assets', 'textures', 'vfx-billboard-256.json'),
  `${JSON.stringify({ name: OUTPUT, generator: 'packages/demos/scripts/build-vfx-billboard.mjs', size: SIZE, sha256: digest }, null, 2)}\n`,
);
process.stdout.write(`${OUTPUT} ${SIZE}x${SIZE} sha256=${digest.slice(0, 16)} → ${DEMOS.length} demos\n`);
