import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Visual budget for antiky-town.
 *
 * Reference look — A lit miniature diorama: sunlight, cast shadows, aerial depth.
 *
 * Run with `npm run demos:verify` after `npm run demos:shoot`. Deliberately not part of
 * `npm test`, which stays green as a regression gate.
 *
 * **The headline measure is local contrast, not luminance spread.** Local contrast is the median,
 * across 32-pixel tiles, of how much perceptual lightness varies inside a tile. It answers "does
 * light model form across surfaces" and is independent of how bright or dark the scene is. A
 * full-frame percentile spread cannot answer that: it tracks peak brightness almost exactly, so a
 * frame that is half black void and half flat grey scores well while a beautifully lit dark scene
 * scores badly.
 *
 * The floor below is **8.5**, which is not an aspiration — `antiky-town` already measures 8.61
 * with no PBR materials and hard-edged shadows. It is the standard this engine is demonstrably
 * capable of today, so a demo under it is behind work already done in this repository.
 *
 * These bounds are provisional and owner-adjustable. If this demo lands a look the owner is happy
 * with and the budget still fails, the budget is wrong.
 */

const LOCAL_CONTRAST_FLOOR = 8.5;
const CLIPPING_CEILING = 0.02;

const metricsPath = path.join(import.meta.dirname, '..', 'visual-metrics.json');

async function readMetrics() {
  const metrics = JSON.parse(await readFile(metricsPath, 'utf8'));

  // A budget judges a capture, so it is only meaningful while the capture still describes the demo.
  // Without this check one good frame keeps a budget green forever: the sidecar carries a
  // `capturedAt` that nothing reads, and the demo underneath it can change completely.
  //
  // `sourceDigest` hashes the demo's whole `src` tree and the capture records it. A mismatch means
  // the numbers below describe code that no longer exists, which is not a pass — it is an unanswered
  // question.
  const { sealMetrics, sourceDigest } = await import('../../../../../scripts/shoot-demos.mjs');

  // The numbers below are read from a committed file, so the cheapest way to pass a budget is to
  // open it and type a bigger one. That was demonstrated and it worked. The seal makes editing a
  // measurement a deliberate act rather than something that looks like a result.
  assert.equal(
    metrics.seal,
    sealMetrics(metrics),
    'visual-metrics.json does not match its own seal — a measured value was edited by hand. '
    + 'Re-run `npm run demos:shoot -- --demo antiky-town` rather than changing the number.',
  );

  const current = await sourceDigest(path.join(import.meta.dirname, '..'));
  assert.equal(
    metrics.source?.digest,
    current.digest,
    'visual-metrics.json was captured from different source than is present now '
    + `(recorded ${metrics.source?.digest ?? 'nothing'}, current ${current.digest}). `
    + 'Re-run `npm run demos:shoot -- --demo antiky-town` and commit the sidecar.',
  );
  return metrics;
}

test('antiky-town models form across its surfaces', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.localContrast.median >= LOCAL_CONTRAST_FLOOR,
    `local contrast was ${metrics.localContrast.median}, floor is ${LOCAL_CONTRAST_FLOOR}. `
    + 'Flat, unlit or untextured surfaces measure near zero here.',
  );
});

test('antiky-town does not blow out its highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.high <= CLIPPING_CEILING,
    `${(metrics.clipping.high * 100).toFixed(2)}% of pixels are fully blown, `
    + `ceiling is ${CLIPPING_CEILING * 100}%.`,
  );
});

test('antiky-town keeps recoverable detail in its darks', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.low <= CLIPPING_CEILING,
    `${(metrics.clipping.low * 100).toFixed(2)}% of pixels are crushed to pure black, `
    + `ceiling is ${CLIPPING_CEILING * 100}%. A void background is the usual cause.`,
  );
});

/**
 * The §7.1 row for this demo (goal 08), which is different in kind from the other three demos'
 * rows: measured from the 2026-08-13 baseline capture and locked as a **regression floor**, not a
 * target to chase. This frame already has the value structure and hue spread the others are
 * chasing — p05 0.145, p50 0.317, p95 0.669, spread 0.523, clipped 0%, five hue clusters with the
 * largest at 42.1% — so the job of these bounds is to make sure goal 08's targeted repairs cannot
 * quietly cost it what it already does right. Margins are for capture noise (the simulation is not
 * stepped to a fixed count), not headroom to spend.
 */
const LOCKED_P50_RANGE = [0.25, 0.38];
const LOCKED_SPREAD_FLOOR = 0.48;
const LOCKED_CLIPPED_CEILING = 0.01;
const LOCKED_CLUSTER_FLOOR = 4;
const LOCKED_DOMINANT_CEILING = 0.5;

test('antiky-town holds the value structure it was locked at', async () => {
  const metrics = await readMetrics();
  const luma = metrics.encodedLuma;
  assert.ok(luma !== undefined, 'the sidecar predates the encoded-luma measurement; re-shoot');
  assert.ok(
    luma.p50 >= LOCKED_P50_RANGE[0] && luma.p50 <= LOCKED_P50_RANGE[1],
    `p50 ${luma.p50} left the locked ${LOCKED_P50_RANGE.join('-')} band.`,
  );
  assert.ok(
    luma.spread >= LOCKED_SPREAD_FLOOR,
    `spread ${luma.spread} fell under the locked ${LOCKED_SPREAD_FLOOR}.`,
  );
  assert.ok(
    luma.clipped <= LOCKED_CLIPPED_CEILING,
    `${(luma.clipped * 100).toFixed(2)}% of pixels are blown; the locked frame had none.`,
  );
});

test('antiky-town keeps the hue spread it was locked at', async () => {
  const metrics = await readMetrics();
  const hue = metrics.hue;
  assert.ok(hue !== undefined, 'the sidecar predates the hue measurement; re-shoot');
  assert.ok(
    hue.clusters >= LOCKED_CLUSTER_FLOOR,
    `${hue.clusters} hue cluster(s) against a locked floor of ${LOCKED_CLUSTER_FLOOR}.`,
  );
  assert.ok(
    hue.dominantShare <= LOCKED_DOMINANT_CEILING,
    `one hue cluster holds ${(hue.dominantShare * 100).toFixed(1)}%, locked ceiling `
    + `${LOCKED_DOMINANT_CEILING * 100}%.`,
  );
});
