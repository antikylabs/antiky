import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

/**
 * Visual budget for point-light-expo.
 *
 * Reference look — League of Legends: a strong key light, deep shadows, saturated ability effects.
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

/**
 * Anti-aliasing ceiling, against a measured 0.68% with the scene multisampled.
 *
 * Set from the failure rather than from taste: 06-02 moved the scene onto a render target, which
 * defaults to one sample, and that read 1.03% on the same frame. The ceiling sits between the two
 * with room for content to change, because this number is content-dependent and the scene will keep
 * gaining geometry.
 */
const HARD_EDGE_CEILING = 0.0095;

/**
 * Raised from 0.0085 by goal 06-04, on measurement rather than on convenience.
 *
 * 06-02 set this against a scene with no key light, and adding one raises it: a brighter frame has
 * more pairs of neighbouring pixels separated by more than a quarter of the range, whatever their
 * edges are made of. The question is whether the rise is that, or shadow edges too hard to be
 * called anti-aliased — which is the defect this budget exists to catch.
 *
 * Separated by capturing the same sun with the shadow term forced to fully lit:
 *
 * | | edges.hard |
 * | --- | --- |
 * | no sun (06-03) | 0.00681 |
 * | sun, shadows off | 0.00936 |
 * | sun, shadows on | 0.00946 |
 *
 * The shadows account for **0.0001 of the 0.0027 rise** — under 4%. The rest is the key light, and
 * this ceiling is re-derived for a lit scene rather than loosened to admit a defect.
 */

/**
 * How far the onboarding panel must spread the light inside its own rectangle.
 *
 * The panel is a near-black plate carrying bright text, so it measures 0.143 while the lit floor it
 * covers measures 0.081. The floor is the number this sees when the panel does not draw, which is
 * what happened: the post pass wrote depth across the canvas and everything drawn after it failed
 * the depth test. No whole-frame metric noticed.
 */
const ONBOARDING_SPREAD_FLOOR = 0.11;

/** Goal 06-04's shadow probe: ground in shadow against ground in sun, on the same material. */
const SHADOW_DARKENING_FLOOR = 0.25;

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
    + 'Re-run `npm run demos:shoot -- --demo point-light-expo` rather than changing the number.',
  );

  const current = await sourceDigest(path.join(import.meta.dirname, '..'));
  assert.equal(
    metrics.source?.digest,
    current.digest,
    'visual-metrics.json was captured from different source than is present now '
    + `(recorded ${metrics.source?.digest ?? 'nothing'}, current ${current.digest}). `
    + 'Re-run `npm run demos:shoot -- --demo point-light-expo` and commit the sidecar.',
  );
  return metrics;
}

test('point-light-expo models form across its surfaces', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.localContrast.median >= LOCAL_CONTRAST_FLOOR,
    `local contrast was ${metrics.localContrast.median}, floor is ${LOCAL_CONTRAST_FLOOR}. `
    + 'Flat, unlit or untextured surfaces measure near zero here.',
  );
});

test('point-light-expo does not blow out its highlights', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.high <= CLIPPING_CEILING,
    `${(metrics.clipping.high * 100).toFixed(2)}% of pixels are fully blown, `
    + `ceiling is ${CLIPPING_CEILING * 100}%.`,
  );
});

test('point-light-expo keeps recoverable detail in its darks', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.clipping.low <= CLIPPING_CEILING,
    `${(metrics.clipping.low * 100).toFixed(2)}% of pixels are crushed to pure black, `
    + `ceiling is ${CLIPPING_CEILING * 100}%. A void background is the usual cause.`,
  );
});

test('point-light-expo still anti-aliases its scene', async () => {
  const metrics = await readMetrics();
  assert.ok(
    metrics.edges.hard <= HARD_EDGE_CEILING,
    `${(metrics.edges.hard * 100).toFixed(3)}% of pixels sit on an unsampled edge, ceiling is `
    + `${(HARD_EDGE_CEILING * 100).toFixed(3)}%. Drawing the scene into a render target without `
    + '`samples: 4` is the cause worth checking first — targets default to one sample.',
  );
});

test('point-light-expo still draws its onboarding panel', async () => {
  const metrics = await readMetrics();
  const panel = metrics.probes?.onboarding;
  assert.ok(panel !== undefined, 'the capture recorded no onboarding probe');
  assert.ok(
    panel.standardDeviation >= ONBOARDING_SPREAD_FLOOR,
    `the onboarding rectangle spreads ${panel.standardDeviation}, floor is `
    + `${ONBOARDING_SPREAD_FLOOR}. At around 0.08 the panel is not drawing and this is measuring `
    + 'the floor behind it.',
  );
});

test('point-light-expo casts a shadow that reads on the ground', async () => {
  const metrics = await readMetrics();
  const shadow = metrics.probes?.sunShadow;
  const lit = metrics.probes?.sunLit;
  assert.ok(shadow !== undefined && lit !== undefined, 'the capture recorded no sun probes');
  const darkening = 1 - shadow.meanLuminance / lit.meanLuminance;
  assert.ok(
    darkening >= SHADOW_DARKENING_FLOOR,
    `ground in shadow is ${(darkening * 100).toFixed(1)}% darker than ground in sun, floor is `
    + `${SHADOW_DARKENING_FLOOR * 100}%. Both probes sit on the same floor 205 px apart, so a low `
    + 'number here is a shadow that is not arriving rather than two different patches of ground.',
  );
});

test('point-light-expo does not stripe its lit ground with shadow acne', async () => {
  const metrics = await readMetrics();
  const lit = metrics.probes?.sunLit;
  assert.ok(lit !== undefined, 'the capture recorded no lit probe');
  // **This is not the check goal 06-04 specified, and the reason is worth stating.**
  //
  // That check was "luminance standard deviation inside a probe on a flat lit plane facing the sun
  // is < 0.02", which assumes the plane is plain. This floor is a photoscanned forest floor: its
  // litter alone measures 0.063 with the shadow term switched off entirely, so 0.02 is unreachable
  // for a reason that has nothing to do with acne.
  //
  // Acne is variance the *shadow* adds, so that is what is measured. With shadows on the probe
  // reads 0.063065; with the same sun and the shadow forced to fully lit it reads 0.063065. The
  // shadow adds nothing, which is what "no acne" means. The ceiling below is the texture's own
  // figure with room to move, and it fails if striping ever appears on top of it.
  assert.ok(
    lit.standardDeviation <= 0.075,
    `lit ground spreads ${lit.standardDeviation}, which is above the forest floor's own 0.063. `
    + 'Stripes at the shadow-map texel scale are the thing to look for.',
  );
});
