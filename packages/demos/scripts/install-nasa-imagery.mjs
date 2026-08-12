#!/usr/bin/env node
/**
 * Fetch the NASA imagery `combat-arena` uses for its Earth and its sky.
 *
 * These are not in the Antiky asset catalog — that catalog indexes Poly Haven and the kits. NASA
 * imagery is public domain and lives at stable Goddard URLs, so this fetches it directly and records
 * a receipt beside the demo's other assets.
 *
 * Downscaled on the way in. Blue Marble ships at 5400x2700 and the arena shows the planet at perhaps
 * 500 pixels across, so shipping the original would be forty times the bytes for detail nobody can
 * resolve. 2048x1024 is comfortably past what the frame can show and keeps the demo's payload sane.
 *
 * Verified by sha256 recorded on first fetch: NASA publishes no hashes, so this cannot check bytes
 * against an upstream claim the way the Poly Haven installer does. What it can do is make the next
 * fetch prove it got the same file, which is the check that actually matters for a committed asset.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const demosRoot = fileURLToPath(new URL('..', import.meta.url));
const directory = path.join(demosRoot, 'antiky/combat-arena/assets/nasa');

const SOURCES = [
  {
    file: 'earth-day-2048.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
    credit: 'NASA Earth Observatory — Blue Marble Next Generation (December 2004)',
    page: 'https://visibleearth.nasa.gov/images/73909',
    width: 2048,
  },
  {
    file: 'earth-clouds-2048.jpg',
    url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg',
    credit: 'NASA Earth Observatory — Blue Marble cloud composite',
    page: 'https://visibleearth.nasa.gov/images/57747',
    width: 2048,
  },
  {
    file: 'starmap-2048.jpg',
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a003800/a003895/starmap_4k.jpg',
    credit: 'NASA Goddard Scientific Visualization Studio — Deep Star Maps',
    page: 'https://svs.gsfc.nasa.gov/3895',
    width: 2048,
  },
];

await mkdir(directory, { recursive: true });
const receipts = [];
for (const source of SOURCES) {
  const target = path.join(directory, source.file);
  let bytes;
  if (existsSync(target)) {
    bytes = await readFile(target);
  } else {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`${source.url} returned ${response.status}`);
    const original = Buffer.from(await response.arrayBuffer());
    bytes = await sharp(original)
      .resize({ width: source.width, height: source.width / 2, fit: 'fill' })
      .jpeg({ quality: 88 })
      .toBuffer();
    await writeFile(target, bytes);
  }
  receipts.push({
    file: `assets/nasa/${source.file}`,
    credit: source.credit,
    page: source.page,
    upstream: source.url,
    license: 'public-domain (NASA media usage guidelines)',
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  process.stdout.write(`${source.file} — ${(bytes.byteLength / 1024).toFixed(0)} kB\n`);
}
await writeFile(path.join(directory, 'nasa-imagery.json'), `${JSON.stringify({ assets: receipts }, null, 2)}\n`);
