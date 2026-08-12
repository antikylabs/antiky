import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Visual budget for traversal-study.
 *
 * Reference look — LittleBigPlanet: warm daylight, tactile materials, a real sky.
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
  const { sourceDigest } = await import('../../../../../scripts/shoot-demos.mjs');
  const current = await sourceDigest(path.join(import.meta.dirname, '..'));
  assert.equal(
    metrics.source?.digest,
    current.digest,
    'visual-metrics.json was captured from different source than is present now '
    + `(recorded ${metrics.source?.digest ?? 'nothing'}, current ${current.digest}). `
    + 'Re-run `npm run demos:shoot -- --demo traversal-study` and commit the sidecar.',
  );
  return metrics;
}

test('traversal-study models form across its surfaces', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.localContrast.median >= LOCAL_CONTRAST_FLOOR,
    `local contrast was ${metrics.localContrast.median}, floor is ${LOCAL_CONTRAST_FLOOR}. `
    + 'Flat, unlit or untextured surfaces measure near zero here.',
  );
});

test('traversal-study does not blow out its highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.high <= CLIPPING_CEILING,
    `${(metrics.clipping.high * 100).toFixed(2)}% of pixels are fully blown, `
    + `ceiling is ${CLIPPING_CEILING * 100}%.`,
  );
});

test('traversal-study keeps recoverable detail in its darks', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.low <= CLIPPING_CEILING,
    `${(metrics.clipping.low * 100).toFixed(2)}% of pixels are crushed to pure black, `
    + `ceiling is ${CLIPPING_CEILING * 100}%. A void background is the usual cause.`,
  );
});
