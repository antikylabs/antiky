import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { isUniformFrame, readFrameStats } from './frame-stats.mjs';

/**
 * These tests need no GPU and no demo. They run against synthetic images with known
 * histograms, so the measuring instrument is verified independently of anything it measures.
 */

async function writePng(directory, name, { width, height, fill }) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y);
      const offset = (y * width + x) * 3;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
    }
  }
  const file = path.join(directory, name);
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(file);
  return file;
}

test('a uniform mid-grey frame has no luminance spread', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'grey.png', {
    width: 32,
    height: 32,
    fill: () => [128, 128, 128],
  });
  const stats = await readFrameStats(file);

  assert.equal(stats.width, 32);
  assert.equal(stats.height, 32);
  assert.equal(stats.luminanceP05, stats.luminanceP95);
  assert.equal(stats.luminanceSpread, 0);
  assert.equal(stats.clippedHigh, 0);
  assert.equal(stats.clippedLow, 0);
  // Mid grey is ~0.216 in linear light, not 0.5. This is the whole reason the module linearises.
  assert.ok(Math.abs(stats.meanLuminance - 0.2158) < 0.001, `got ${stats.meanLuminance}`);
});

test('a black to white ramp reaches both ends of the range', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'ramp.png', {
    width: 256,
    height: 8,
    fill: (x) => [x, x, x],
  });
  const stats = await readFrameStats(file);

  assert.ok(stats.luminanceP05 < 0.1, `p05 was ${stats.luminanceP05}`);
  // The ramp is linear in sRGB bytes, so it is not linear in light. Byte 242 sits at the 95th
  // percentile and decodes to ~0.89, not ~0.95. That gap is the sRGB curve doing its job, and a
  // threshold of 0.9 here would be asserting that the module fails to linearise.
  assert.ok(stats.luminanceP95 > 0.85, `p95 was ${stats.luminanceP95}`);
  assert.ok(stats.luminanceSpread > 0.8, `spread was ${stats.luminanceSpread}`);
});

test('a fully blown frame reports complete high clipping', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'white.png', {
    width: 16,
    height: 16,
    fill: () => [255, 255, 255],
  });
  const stats = await readFrameStats(file);

  assert.equal(stats.clippedHigh, 1);
  assert.equal(stats.clippedLow, 0);
  assert.equal(stats.meanLuminance, 1);
});

test('a fully black frame reports complete low clipping', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'black.png', {
    width: 16,
    height: 16,
    fill: () => [0, 0, 0],
  });
  const stats = await readFrameStats(file);

  assert.equal(stats.clippedLow, 1);
  assert.equal(stats.clippedHigh, 0);
  assert.equal(stats.meanLuminance, 0);
});

test('saturation separates a grey frame from a coloured one', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const grey = await writePng(directory, 'grey.png', {
    width: 8,
    height: 8,
    fill: () => [120, 120, 120],
  });
  const red = await writePng(directory, 'red.png', {
    width: 8,
    height: 8,
    fill: () => [200, 0, 0],
  });

  assert.equal((await readFrameStats(grey)).meanSaturation, 0);
  assert.equal((await readFrameStats(red)).meanSaturation, 1);
});

test('named probes measure their own rectangle, not the whole frame', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Left half black, right half white. This is the shape of a shadow probe assertion.
  const file = await writePng(directory, 'split.png', {
    width: 64,
    height: 16,
    fill: (x) => (x < 32 ? [0, 0, 0] : [255, 255, 255]),
  });
  const stats = await readFrameStats(file, {
    probes: {
      inShadow: { x: 0, y: 0, width: 32, height: 16 },
      lit: { x: 32, y: 0, width: 32, height: 16 },
    },
  });

  assert.equal(stats.probes.inShadow.meanLuminance, 0);
  assert.equal(stats.probes.lit.meanLuminance, 1);
  assert.equal(stats.probes.inShadow.pixels, 32 * 16);
  // A flat probe has no internal variation. Shadow acne would show up here.
  assert.equal(stats.probes.lit.luminanceStandardDeviation, 0);
});

test('a probe outside the frame is an error rather than a silent empty result', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'small.png', {
    width: 8,
    height: 8,
    fill: () => [10, 10, 10],
  });

  await assert.rejects(
    readFrameStats(file, { probes: { offFrame: { x: 100, y: 100, width: 4, height: 4 } } }),
    /outside the 8x8 frame/,
  );
});

test('uniform frame detection catches the blank capture failure mode', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const blank = await writePng(directory, 'blank.png', {
    width: 16,
    height: 16,
    fill: () => [255, 255, 255],
  });
  const rendered = await writePng(directory, 'rendered.png', {
    width: 16,
    height: 16,
    fill: (x) => [x * 8, 40, 90],
  });

  assert.equal(await isUniformFrame(blank), true);
  assert.equal(await isUniformFrame(rendered), false);
});
