import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Visual budget for combat-arena.
 *
 * Reference look — Rocket League: a bright arena, glossy surfaces reflecting stadium light.
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
    + 'Re-run `npm run demos:shoot -- --demo combat-arena` rather than changing the number.',
  );

  const current = await sourceDigest(path.join(import.meta.dirname, '..'));
  assert.equal(
    metrics.source?.digest,
    current.digest,
    'visual-metrics.json was captured from different source than is present now '
    + `(recorded ${metrics.source?.digest ?? 'nothing'}, current ${current.digest}). `
    + 'Re-run `npm run demos:shoot -- --demo combat-arena` and commit the sidecar.',
  );
  return metrics;
}

test('combat-arena models form across its surfaces', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.localContrast.median >= LOCAL_CONTRAST_FLOOR,
    `local contrast was ${metrics.localContrast.median}, floor is ${LOCAL_CONTRAST_FLOOR}. `
    + 'Flat, unlit or untextured surfaces measure near zero here.',
  );
});

test('combat-arena does not blow out its highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.high <= CLIPPING_CEILING,
    `${(metrics.clipping.high * 100).toFixed(2)}% of pixels are fully blown, `
    + `ceiling is ${CLIPPING_CEILING * 100}%.`,
  );
});

test('combat-arena keeps recoverable detail in its darks', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.low <= CLIPPING_CEILING,
    `${(metrics.clipping.low * 100).toFixed(2)}% of pixels are crushed to pure black, `
    + `ceiling is ${CLIPPING_CEILING * 100}%. A void background is the usual cause.`,
  );
});

/** Goal 07 W B.3: deck in shadow against deck in key light, on the same material. */
const SHADOW_DARKENING_FLOOR = 0.25;

test('combat-arena casts a shadow that reads on the deck', async () => {
  const metrics = await readMetrics();
  const shadow = metrics.probes?.sunShadow;
  const lit = metrics.probes?.sunLit;
  assert.ok(shadow !== undefined && lit !== undefined, 'the capture recorded no sun probes');
  const darkening = 1 - shadow.meanLuminance / lit.meanLuminance;
  assert.ok(
    darkening >= SHADOW_DARKENING_FLOOR,
    `deck in shadow is ${(darkening * 100).toFixed(1)}% darker than deck in key light, floor is `
    + `${SHADOW_DARKENING_FLOOR * 100}%. Both probes sit on the same deck 186 px apart, so a low `
    + 'number is a shadow that is not arriving rather than two different patches of floor.',
  );
});

test('combat-arena does not stripe its lit deck with shadow acne', async () => {
  const metrics = await readMetrics();
  const lit = metrics.probes?.sunLit;
  assert.ok(lit !== undefined, 'the capture recorded no lit probe');
  // Not the goal's "standard deviation below 0.02" — the arena deck is diamond plate, and at goal
  // 08's low camera the lit probe measures 0.097 with the shadow term switched off entirely, so
  // that bar is unreachable for a reason unrelated to acne. Acne is variance the *shadow* adds,
  // and the control shows the shadow *lowering* it (0.097 -> 0.081). The ceiling is the plate's
  // own no-shadow figure with room to move, and it fails if striping ever appears on top of it.
  assert.ok(
    lit.standardDeviation <= 0.11,
    `lit deck spreads ${lit.standardDeviation}, above the plate's own no-shadow 0.097. Stripes at `
    + 'the shadow-map texel scale are the thing to look for.',
  );
});

/**
 * The §7.1 frame-level value targets (goal 08), in the space that table is written in: Rec. 709
 * luma of the delivered sRGB bytes. The linear percentiles above answer a light-transport
 * question; these answer "what does the delivered frame's value structure look like".
 */
const ENCODED_P05_CEILING = 0.04;
const ENCODED_P50_RANGE = [0.2, 0.34];
const ENCODED_P95_FLOOR = 0.88;
const ENCODED_SPREAD_FLOOR = 0.8;
const ENCODED_CLIPPED_CEILING = 0.025;

test('combat-arena hits its 7.1 value structure', async () => {
  const metrics = await readMetrics();
  const luma = metrics.encodedLuma;
  assert.ok(luma !== undefined, 'the sidecar predates the encoded-luma measurement; re-shoot');
  assert.ok(
    luma.p05 <= ENCODED_P05_CEILING,
    `p05 ${luma.p05} is above ${ENCODED_P05_CEILING} — the frame has no real darks.`,
  );
  assert.ok(
    luma.p50 >= ENCODED_P50_RANGE[0] && luma.p50 <= ENCODED_P50_RANGE[1],
    `p50 ${luma.p50} sits outside ${ENCODED_P50_RANGE.join('-')}.`,
  );
  assert.ok(
    luma.p95 >= ENCODED_P95_FLOOR,
    `p95 ${luma.p95} is under ${ENCODED_P95_FLOOR} — the frame has no real highlights.`,
  );
  assert.ok(
    luma.spread >= ENCODED_SPREAD_FLOOR,
    `spread ${luma.spread} is under ${ENCODED_SPREAD_FLOOR}.`,
  );
  assert.ok(
    luma.clipped <= ENCODED_CLIPPED_CEILING,
    `${(luma.clipped * 100).toFixed(2)}% of pixels are blown, ceiling `
    + `${ENCODED_CLIPPED_CEILING * 100}%.`,
  );
});

test('combat-arena carries at least three distinguishable hues, none dominant', async () => {
  const metrics = await readMetrics();
  const hue = metrics.hue;
  assert.ok(hue !== undefined, 'the sidecar predates the hue measurement; re-shoot');
  assert.ok(
    hue.clusters >= 3,
    `${hue.clusters} hue cluster(s) — the frame reads as monochrome mud below 3.`,
  );
  assert.ok(
    hue.dominantShare <= 0.55,
    `one hue cluster holds ${(hue.dominantShare * 100).toFixed(1)}% of the chromatic pixels, `
    + 'ceiling 55% — the "everything is one colour" failure.',
  );
});
