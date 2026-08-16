import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

import { isUniformFrame, readFrameStats, readSequenceStats } from '../frame-stats.mjs';

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

test('local contrast separates a modelled frame from a flat one at the same brightness', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const encode = (linear) => Math.round(255 * Math.max(0, Math.min(1, linear)) ** (1 / 2.2));
  // A genuinely low-key but well-modelled scene: a lit falloff peaking at 0.10 linear.
  const modelled = await writePng(directory, 'modelled.png', {
    width: 256,
    height: 128,
    fill: (x, y) => {
      const distance = Math.hypot(x - 90, y - 60) / 60;
      const byte = encode(Math.max(0, 1 - distance * distance) * 0.1);
      return [byte, byte, byte];
    },
  });
  const flat = await writePng(directory, 'flat.png', {
    width: 256,
    height: 128,
    fill: () => [encode(0.018), encode(0.018), encode(0.018)],
  });

  const modelledStats = await readFrameStats(modelled);
  const flatStats = await readFrameStats(flat);

  // Full-frame spread cannot tell these apart from a dark-but-fine scene; local contrast can.
  assert.ok(modelledStats.localContrastMedian > 1, `modelled scored ${modelledStats.localContrastMedian}`);
  // Summing squares over a uniform tile leaves floating-point residue rather than exact zero.
  assert.ok(flatStats.localContrastMedian < 0.001, `flat scored ${flatStats.localContrastMedian}`);
});

test('local contrast rejects the frame that games full-frame spread', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Half black void, half flat grey. Wide spread, no form anywhere. This is the case that makes
  // a full-frame percentile spread unusable as a quality target.
  const file = await writePng(directory, 'void.png', {
    width: 256,
    height: 128,
    fill: (x) => (x < 128 ? [0, 0, 0] : [200, 200, 200]),
  });
  const stats = await readFrameStats(file);

  assert.ok(stats.luminanceSpread > 0.5, `spread was ${stats.luminanceSpread}`);
  assert.ok(stats.localContrastMedian < 0.001, `local contrast was ${stats.localContrastMedian}`);
});

test('a probe that falls partly outside the frame is an error, not a shifted window', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const file = await writePng(directory, 'split.png', {
    width: 64,
    height: 16,
    fill: (x) => (x < 32 ? [0, 0, 0] : [255, 255, 255]),
  });

  // Clamping would return a plausible pixel count from the wrong region, so every probe-based
  // assertion downstream would silently measure somewhere the test never named.
  await assert.rejects(
    readFrameStats(file, { probes: { straddling: { x: -2, y: 0, width: 4, height: 16 } } }),
    /falls outside the 64x16 frame/,
  );
});

test('saturated colour is not reported as a blown highlight', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const vivid = await writePng(directory, 'vivid.png', {
    width: 16,
    height: 16,
    fill: () => [255, 10, 10],
  });
  const blown = await writePng(directory, 'blown.png', {
    width: 16,
    height: 16,
    fill: () => [255, 255, 255],
  });

  // A fully saturated red sits at mid luminance. Counting it as over-exposure would punish
  // exactly the vivid effects these demos are supposed to have.
  assert.equal((await readFrameStats(vivid)).clippedHigh, 0);
  assert.equal((await readFrameStats(blown)).clippedHigh, 1);
});

test('saturation is weighted by luminance so invisible pixels cannot carry it', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Half visible neutral grey, half near-black saturated red. An unweighted mean reports ~0.5.
  const file = await writePng(directory, 'mixed.png', {
    width: 64,
    height: 64,
    fill: (x) => (x < 32 ? [180, 180, 180] : [2, 0, 0]),
  });
  const stats = await readFrameStats(file);
  assert.ok(stats.meanSaturation < 0.01, `weighted saturation was ${stats.meanSaturation}`);
});

test('sequence statistics report one entry per frame and per adjacent pair', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const files = [];
  for (let frame = 0; frame < 4; frame += 1) {
    files.push(await writePng(directory, `f${frame}.png`, {
      width: 32,
      height: 32,
      fill: (x) => (x < 16 + frame ? [200, 200, 200] : [20, 20, 20]),
    }));
  }
  const stats = await readSequenceStats(files);

  assert.equal(stats.frameCount, 4);
  assert.equal(stats.frames.length, 4);
  assert.equal(stats.temporalDifference.length, 3);
  assert.equal(stats.series.meanLuminance.length, 4);
  assert.ok(stats.temporalDifference.every((entry) => entry.standardDeviation > 0));
});

test('temporal difference ignores a uniform brightness shift, which is not motion', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Two frames identical apart from every pixel being lifted by the same amount: a fade, an
  // exposure change, a light coming on. The mean difference rises; the deviation must not.
  const before = await writePng(directory, 'a.png', {
    width: 32,
    height: 32,
    fill: (x) => (x < 16 ? [100, 100, 100] : [140, 140, 140]),
  });
  const after = await writePng(directory, 'b.png', {
    width: 32,
    height: 32,
    fill: (x) => (x < 16 ? [130, 130, 130] : [170, 170, 170]),
  });
  const [shift] = (await readSequenceStats([before, after])).temporalDifference;

  assert.ok(shift.mean > 0.01, `a brightness shift should move the mean, got ${shift.mean}`);
  assert.ok(
    shift.standardDeviation < shift.mean * 0.5,
    `deviation ${shift.standardDeviation} should stay well under the mean ${shift.mean}: nothing moved`,
  );
});

test('a sequence of mismatched sizes is an error rather than a silent comparison', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const small = await writePng(directory, 'small.png', { width: 8, height: 8, fill: () => [10, 10, 10] });
  const large = await writePng(directory, 'large.png', { width: 16, height: 16, fill: () => [10, 10, 10] });

  await assert.rejects(readSequenceStats([small, large]), /differ in size/);
});

test('hard edges separate an aliased silhouette from an anti-aliased one', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // The same disc twice: once point-sampled, once averaged from a 4x4 grid per pixel. That is
  // what a 4x multisampled pass approximates, so the two frames differ in exactly the way losing
  // multisampling makes a real frame differ, and in nothing else.
  //
  // **What this test is honest about.** The separation on one silhouette is small — around 1.2x.
  // A single high-contrast edge stays hard however it is sampled, because even the midpoint of a
  // big jump is a big jump. The measure earns its keep across a whole frame, where thousands of
  // edges sit at many contrasts and averaging pushes the middle of that population under the
  // threshold: point-light-expo measured 0.68% multisampled against 1.03% not, on the same scene.
  //
  // So this is a directional indicator, not a classifier, and it is used the way the other budgets
  // are used — against a demo's own recorded number. Asserting a large ratio here would mean
  // choosing a synthetic image that flatters the instrument.
  const DARK = 20;
  const LIGHT = 140;
  const RADIUS = 40;
  const isInside = (x, y) => Math.hypot(x - 64, y - 64) <= RADIUS;
  const aliased = await writePng(directory, 'aliased.png', {
    width: 128,
    height: 128,
    fill: (x, y) => {
      const value = isInside(x + 0.5, y + 0.5) ? LIGHT : DARK;
      return [value, value, value];
    },
  });
  const smooth = await writePng(directory, 'smooth.png', {
    width: 128,
    height: 128,
    fill: (x, y) => {
      let covered = 0;
      for (let sampleY = 0; sampleY < 4; sampleY += 1) {
        for (let sampleX = 0; sampleX < 4; sampleX += 1) {
          if (isInside(x + (sampleX + 0.5) / 4, y + (sampleY + 0.5) / 4)) covered += 1;
        }
      }
      const value = Math.round(DARK + (covered / 16) * (LIGHT - DARK));
      return [value, value, value];
    },
  });

  const aliasedStats = await readFrameStats(aliased);
  const smoothStats = await readFrameStats(smooth);
  assert.ok(
    aliasedStats.hardEdgeFraction > smoothStats.hardEdgeFraction,
    `point-sampled ${aliasedStats.hardEdgeFraction} should exceed multisampled `
    + `${smoothStats.hardEdgeFraction}`,
  );
  // Both frames carry the same silhouette at the same size, so the difference has to come from the
  // edge treatment. Bounding it from above says the metric is not merely counting edge pixels,
  // which would score the two identically.
  assert.ok(
    smoothStats.hardEdgeFraction > aliasedStats.hardEdgeFraction * 0.5,
    'the two frames share a silhouette, so the gap should be a shift and not a collapse',
  );
});

test('a gradient is not counted as a hard edge however far it travels', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Black to white across the full width. The total range is maximal and the local step is one
  // byte, which is the distinction the metric exists to make.
  const file = await writePng(directory, 'ramp.png', {
    width: 256,
    height: 64,
    fill: (x) => [x, x, x],
  });
  const stats = await readFrameStats(file);
  assert.equal(stats.hardEdgeFraction, 0);
});

test('encoded luma measures the delivered bytes, not linear light', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Mid grey: 0.502 as delivered, 0.216 in linear light. The §7.1 value targets are written
  // against the delivered image, so the two scales must not be conflated.
  const file = await writePng(directory, 'grey.png', {
    width: 32,
    height: 32,
    fill: () => [128, 128, 128],
  });
  const stats = await readFrameStats(file);
  assert.ok(Math.abs(stats.encodedLumaP50 - 128 / 255) < 0.001, `got ${stats.encodedLumaP50}`);
  assert.ok(Math.abs(stats.meanLuminance - 0.2158) < 0.001, 'the linear measure must not move');
  assert.equal(stats.encodedLumaSpread, 0);
});

test('encoded luma clipping counts blown luma, not saturated colour', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Left tenth pure white, the rest pure red. Saturated red carries maximal bytes in one channel
  // at mid luma, so a per-channel definition would call the whole frame blown.
  const file = await writePng(directory, 'red.png', {
    width: 100,
    height: 10,
    fill: (x) => (x < 10 ? [255, 255, 255] : [255, 0, 0]),
  });
  const stats = await readFrameStats(file);
  assert.ok(Math.abs(stats.encodedLumaClipped - 0.1) < 0.001, `got ${stats.encodedLumaClipped}`);
  assert.ok(Math.abs(stats.encodedLumaP50 - 0.2126) < 0.01, 'red sits at luma 0.2126, unclipped');
});

test('hue clusters count distinguishable colour populations', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // Three equal patches at 0°, 120° and 240° — the clearest possible three-cluster frame.
  const three = await writePng(directory, 'three.png', {
    width: 96,
    height: 32,
    fill: (x) => (x < 32 ? [255, 0, 0] : x < 64 ? [0, 255, 0] : [0, 0, 255]),
  });
  const threeStats = await readFrameStats(three);
  assert.equal(threeStats.hueClusterCount, 3);
  assert.ok(threeStats.hueDominantShare < 0.55, `got ${threeStats.hueDominantShare}`);

  // Two patches 15° apart merge: the separation is inside the 25° window.
  const merged = await writePng(directory, 'merged.png', {
    width: 64,
    height: 32,
    fill: (x) => (x < 32 ? [255, 0, 0] : [255, 64, 0]),
  });
  const mergedStats = await readFrameStats(merged);
  assert.equal(mergedStats.hueClusterCount, 1);

  // 70/30 between two well-separated hues: two clusters, and the dominant one carries 70%.
  const dominant = await writePng(directory, 'dominant.png', {
    width: 100,
    height: 32,
    fill: (x) => (x < 70 ? [255, 0, 0] : [0, 255, 0]),
  });
  const dominantStats = await readFrameStats(dominant);
  assert.equal(dominantStats.hueClusterCount, 2);
  assert.ok(Math.abs(dominantStats.hueDominantShare - 0.7) < 0.02, `got ${dominantStats.hueDominantShare}`);
});

test('grey and near-black pixels do not vote on hue', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-frame-stats-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  // An achromatic frame has no hue clusters at all rather than a spurious one.
  const grey = await writePng(directory, 'grey.png', {
    width: 32,
    height: 32,
    fill: () => [120, 120, 120],
  });
  const greyStats = await readFrameStats(grey);
  assert.equal(greyStats.hueClusterCount, 0);
  assert.equal(greyStats.hueDominantShare, 0);
  assert.equal(greyStats.chromaticFraction, 0);

  // A hue carried only by near-black pixels is invisible and must not count. Half the frame is
  // near-black red, half is visible green: one cluster, green.
  const dark = await writePng(directory, 'dark.png', {
    width: 64,
    height: 32,
    fill: (x) => (x < 32 ? [24, 0, 0] : [0, 200, 0]),
  });
  const darkStats = await readFrameStats(dark);
  assert.equal(darkStats.hueClusterCount, 1);
  assert.ok(Math.abs(darkStats.chromaticFraction - 0.5) < 0.01, `got ${darkStats.chromaticFraction}`);
});
