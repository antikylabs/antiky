import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Visual budget for antiky-town.
 *
 * Reference look — A lit miniature diorama: sunlight, cast shadows, aerial depth.
 *
 * These bounds are the TARGET, not the current state. They fail today, on purpose. A budget that
 * passes the day it is written measures nothing. At the time of writing the captured frame reports
 * spread 0.343, p95 0.370 — the strongest of the four, and the closest to its budget.
 *
 * Run with `npm run demos:budget` after `npm run demos:shoot`. These are deliberately not part of
 * `npm test`, which stays green as a regression gate.
 */

const metricsPath = path.join(import.meta.dirname, '..', 'visual-metrics.json');

async function readMetrics() {
  return JSON.parse(await readFile(metricsPath, 'utf8'));
}

test('antiky-town frame reaches a real luminance spread', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.luminance.spread >= 0.38,
    `luminance spread was ${metrics.luminance.spread}, budget is >= 0.38. `
    + 'A narrow spread is what "flat" and "muddy" measure as.',
  );
});

test('antiky-town frame reaches genuine highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.luminance.p95 >= 0.42,
    `p95 luminance was ${metrics.luminance.p95}, budget is >= 0.42.`,
  );
});

test('antiky-town frame does not blow out its highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.high <= 0.02,
    `${(metrics.clipping.high * 100).toFixed(2)}% of pixels are clipped high, budget is <= 2.0%. `
    + 'Reaching highlights must not mean clipping them.',
  );
});

test('antiky-town frame keeps its colour', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.saturation.mean >= 0.2,
    `mean saturation was ${metrics.saturation.mean}, budget is >= 0.2.`,
  );
});
