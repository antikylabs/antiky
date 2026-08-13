import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The acceptance test for goal 06-03.
 *
 * BroMetal's `specGGX` is the GGX distribution term on its own — no Fresnel, no geometry term, and a
 * hard-coded `0.25` where `1 / (4 · N·L · N·V)` belongs. All three call sites in this demo wrapped it
 * in a ceiling and scaled it down by hand to keep highlights from blowing out.
 *
 * The claim to establish is that the replacement needs none of that. A frame cannot answer it — a
 * frame only says whether the picture changed. It is a question about the function, so the function
 * is what gets integrated here.
 *
 * **A correction, because this file was first written around a guess that measurement refuted.** The
 * expectation was that `specGGX` returns more light than arrives and that the ceilings existed to
 * contain that. It does not: integrated over the hemisphere it stays under 1 everywhere, as the
 * table in `outgoing energy` below shows. What is actually wrong with it is worse and less obvious —
 * see `a constant cannot correct the term the ceilings were containing`.
 *
 * The model is mirrored in TypeScript rather than executed as WGSL, in the same shape as
 * `colour-pipeline.test.ts` mirrors the sRGB curve. `pipeline-invariants.test.mjs` asserts the three
 * shader copies are identical to each other; the last test here asserts this mirror still names the
 * same terms as the shader, so a change made to one and not the other is visible.
 */

const PACKAGE_ROOT = new URL('../', import.meta.url);

const SHADERS = [
  'src/shaders/reliquary-model.shader.ts',
  'src/shaders/reliquary-floor.shader.ts',
  'src/shaders/foundry.shader.ts',
] as const;

type Vector = readonly [number, number, number];

const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const normalize = (v: Vector): Vector => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
};

const NORMAL: Vector = [0, 0, 1];

/** The GGX distribution on its own, shared by the model below and by the `specGGX` comparison. */
function distributionGGX(nDotH: number, roughness: number): number {
  const alpha = roughness * roughness;
  const alphaSq = alpha * alpha;
  const denominator = nDotH * nDotH * (alphaSq - 1) + 1;
  return alphaSq / (Math.PI * denominator * denominator);
}

/** The shader's `specularGGX`, mirrored. `f0` is scalar because every case below is grey. */
function specularGGX(
  normal: Vector,
  light: Vector,
  view: Vector,
  roughness: number,
  f0: number,
): number {
  const halfway = normalize([light[0] + view[0], light[1] + view[1], light[2] + view[2]]);
  const nDotL = Math.max(dot(normal, light), 0);
  const nDotV = Math.max(dot(normal, view), 0.0001);
  const nDotH = Math.max(dot(normal, halfway), 0);
  const vDotH = Math.max(dot(view, halfway), 0);
  const alpha = roughness * roughness;
  const alphaSq = alpha * alpha;
  const distribution = distributionGGX(nDotH, roughness);
  const occlusionTowardView = nDotL * Math.sqrt(nDotV * nDotV * (1 - alphaSq) + alphaSq);
  const occlusionTowardLight = nDotV * Math.sqrt(nDotL * nDotL * (1 - alphaSq) + alphaSq);
  const visibility = 0.5 / Math.max(occlusionTowardView + occlusionTowardLight, 0.0001);
  const grazing = 1 - vDotH;
  const grazingSq = grazing * grazing;
  const fresnelWeight = grazingSq * grazingSq * grazing;
  const fresnel = f0 + (1 - f0) * fresnelWeight;
  return fresnel * distribution * visibility * nDotL;
}

/**
 * Total light leaving toward `view` for one unit arriving from every direction — the white-furnace
 * integral. A model returning more than 1 here is inventing light.
 *
 * Importance-sampled against the GGX distribution rather than swept on a uniform grid. That is not
 * a refinement: at roughness 0.08 the lobe is about 0.006 radians wide, so a 256-step uniform sweep
 * lands roughly one sample inside it and reports whatever that one sample happened to hit. The first
 * version of this test did exactly that and read 1.0211, which looked like a real energy violation
 * and was quadrature error.
 *
 * The sample sequence is Hammersley, so the number is deterministic and a rerun cannot drift.
 */
function outgoingEnergy(
  view: Vector,
  roughness: number,
  f0: number,
  term: 'model' | 'distribution-only' = 'model',
  samples = 16384,
): number {
  let total = 0;
  const alpha = roughness * roughness;
  for (let index = 0; index < samples; index += 1) {
    const uniform = (index + 0.5) / samples;
    let bits = index;
    let reversed = 0;
    for (let bit = 0; bit < 16; bit += 1) {
      reversed = (reversed << 1) | (bits & 1);
      bits >>= 1;
    }
    const radialUniform = reversed / 65536;

    // Sample a half-vector from the GGX distribution, then mirror the view about it to get a light
    // direction. This puts the samples where the lobe actually is.
    const cosTheta = Math.sqrt((1 - uniform) / (1 + (alpha * alpha - 1) * uniform));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = 2 * Math.PI * radialUniform;
    const halfway: Vector = [sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta];

    const vDotH = dot(view, halfway);
    if (vDotH <= 0) continue;
    const light: Vector = [
      2 * vDotH * halfway[0] - view[0],
      2 * vDotH * halfway[1] - view[1],
      2 * vDotH * halfway[2] - view[2],
    ];
    const nDotL = light[2];
    if (nDotL <= 0) continue;

    const nDotH = halfway[2];
    const probabilityDensity = (distributionGGX(nDotH, roughness) * nDotH) / (4 * vDotH);
    const value = term === 'model'
      ? specularGGX(NORMAL, light, view, roughness, f0)
      : distributionGGX(nDotH, roughness) * nDotL * 0.25;
    total += value / probabilityDensity;
  }
  return total / samples;
}

/** Head-on through to nearly edge-on, so nothing is checked at one convenient angle. */
const VIEWS: readonly Vector[] = [
  normalize([0, 0, 1]),
  normalize([0.5, 0, 1]),
  normalize([1, 0, 1]),
  normalize([1, 0, 0.35]),
  normalize([1, 0, 0.12]),
];

const ROUGHNESSES = [0.08, 0.18, 0.3, 0.5, 0.7, 0.9, 1] as const;

test('outgoing energy never exceeds incoming, at any roughness or view angle', () => {
  let checked = 0;
  for (const roughness of ROUGHNESSES) {
    for (const view of VIEWS) {
      // f0 = 1 is the worst case: a perfect mirror, the most a Fresnel term can ever weight the
      // lobe by. Conserved here means conserved for the 0.04 dielectrics and albedo-tinted metals
      // this demo actually uses.
      const energy = outgoingEnergy(view, roughness, 1);
      assert.ok(
        energy <= 1.0001,
        `roughness ${roughness}, view ${view.map((v) => v.toFixed(2)).join(',')} `
        + `returned ${energy.toFixed(4)} for one unit arriving`,
      );
      checked += 1;
    }
  }
  assert.equal(checked, ROUGHNESSES.length * VIEWS.length);
});

test('the integral is tight enough to detect a model that does invent light', () => {
  // The proof that the assertion above is measuring something. Scaling the model by 1.05 has to be
  // caught; if the integrator were as coarse as the first version of this file it would not be.
  const inflated = outgoingEnergy(normalize([0.5, 0, 1]), 0.18, 1) * 1.05;
  assert.ok(inflated > 1.0001, `an inflated model measured ${inflated.toFixed(4)}, which passes`);
  // And a smooth surface should reach almost exactly 1 rather than merely landing under it — a
  // sloppy integrator reading 0.6 would pass the ceiling while measuring nothing.
  const smooth = outgoingEnergy(normalize([0.5, 0, 1]), 0.08, 1);
  assert.ok(smooth > 0.99, `a near-mirror returned only ${smooth.toFixed(4)} of the light it got`);
});

test('a constant cannot correct the term the ceilings were containing', () => {
  // This is the justification for deleting `* 0.12` and `* (0.16 + metalness * 0.84)`.
  //
  // `specGGX` puts a constant 0.25 where `1 / (4 · N·L · N·V)` belongs. Both of those follow the
  // view, so the error is not a fixed factor — it is an angular one. Measured on a near-mirror, the
  // distribution-only term delivers essentially all of the arriving light head-on and about 1.5% of
  // it edge-on, while the full model stays flat across the same range.
  //
  // A per-call-site scale factor can only ever be right at one angle. That is why the three call
  // sites had three different numbers and still needed ceilings on top.
  const headOn = normalize([0, 0, 1]);
  const grazing = normalize([1, 0, 0.12]);

  const oldHeadOn = outgoingEnergy(headOn, 0.08, 1, 'distribution-only');
  const oldGrazing = outgoingEnergy(grazing, 0.08, 1, 'distribution-only');
  const newHeadOn = outgoingEnergy(headOn, 0.08, 1);
  const newGrazing = outgoingEnergy(grazing, 0.08, 1);

  assert.ok(
    oldHeadOn / oldGrazing > 20,
    `the distribution-only term varied only ${(oldHeadOn / oldGrazing).toFixed(1)}x with view angle`,
  );
  assert.ok(
    newHeadOn / newGrazing < 1.05,
    `the model varied ${(newHeadOn / newGrazing).toFixed(3)}x with view angle, which is not flat`,
  );
});

test('a rougher surface gives a wider, dimmer highlight', () => {
  const view = normalize([0.6, 0, 1]);
  // Sweep the light across the whole plane containing the normal and the view. Both sides, because
  // the specular peak sits at the view mirrored about the normal — on the far side from the view.
  const describe = (roughness: number) => {
    let peak = 0;
    let lit = 0;
    const samples = 4096;
    for (let index = 0; index < samples; index += 1) {
      const theta = -Math.PI / 2 + ((index + 0.5) / samples) * Math.PI;
      const light: Vector = [Math.sin(theta), 0, Math.cos(theta)];
      const value = specularGGX(NORMAL, light, view, roughness, 0.04);
      peak = Math.max(peak, value);
      lit += value > 0.001 ? 1 : 0;
    }
    return { peak, width: lit / samples };
  };

  let previous = describe(0.1);
  let compared = 0;
  for (const roughness of [0.2, 0.35, 0.5, 0.7, 0.9]) {
    const current = describe(roughness);
    assert.ok(
      current.peak < previous.peak,
      `roughness ${roughness} peaked at ${current.peak.toFixed(5)}, not below `
      + `${previous.peak.toFixed(5)}`,
    );
    assert.ok(
      current.width > previous.width,
      `roughness ${roughness} lit ${current.width.toFixed(4)} of the sweep, not wider than `
      + `${previous.width.toFixed(4)}`,
    );
    previous = current;
    compared += 1;
  }
  assert.equal(compared, 5);
});

test('Fresnel brightens a dielectric seen edge-on', () => {
  // The same material under the same light, viewed head-on and then nearly edge-on. Light and view
  // stay mirrored about the normal so the distribution term is at its peak in both cases, leaving
  // only the view-dependent terms to explain the difference.
  const reflectanceAt = (angleFromNormal: number, f0: number) => {
    const sin = Math.sin(angleFromNormal);
    const cos = Math.cos(angleFromNormal);
    return specularGGX(NORMAL, [-sin, 0, cos], [sin, 0, cos], 0.35, f0);
  };

  const dielectricFaceOn = reflectanceAt(0.1, 0.04);
  const dielectricGrazing = reflectanceAt(1.45, 0.04);
  assert.ok(
    dielectricGrazing > dielectricFaceOn,
    `grazing ${dielectricGrazing.toFixed(4)} should exceed face-on ${dielectricFaceOn.toFixed(4)}`,
  );

  // Isolating Fresnel from the visibility term, which also rises at grazing angles. With f0 = 1 the
  // Fresnel factor is 1 at every angle and cannot contribute, so whatever rise remains belongs to
  // visibility. The dielectric rises far harder, and that difference is Fresnel's alone.
  const dielectricRise = dielectricGrazing / dielectricFaceOn;
  const mirrorRise = reflectanceAt(1.45, 1) / reflectanceAt(0.1, 1);
  assert.ok(
    dielectricRise > mirrorRise * 5,
    `a dielectric rose ${dielectricRise.toFixed(1)}x and a mirror ${mirrorRise.toFixed(1)}x; `
    + 'Fresnel should account for most of the gap',
  );
});

test('no call site clamps or scales the specular term', async () => {
  let scanned = 0;
  for (const relativePath of SHADERS) {
    const source = await readFile(new URL(relativePath, PACKAGE_ROOT), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(
      !code.includes('specGGX('),
      `${relativePath} still calls specGGX, which is the distribution term alone`,
    );
    assert.ok(!/min\s*\(\s*spec/i.test(code), `${relativePath} still ceilings its specular term`);
    assert.ok(
      !/specularGGX\([^)]*\)\s*[*.]/.test(code.replace(/\s+/g, ' ')),
      `${relativePath} scales the specular term after computing it`,
    );
    assert.ok(code.includes('specularGGX('), `${relativePath} does not use the model`);
    scanned += 1;
  }
  assert.equal(scanned, SHADERS.length, 'every shader named above must have been read');
});

test('the mirror above still names the same terms as the shader', async () => {
  // The maths here is a copy, so it can drift from the shader it claims to describe. Nothing in
  // this process can execute WGSL, so the next best thing is to require the shader still contain
  // each named step. A term renamed or deleted there fails here rather than leaving these tests
  // quietly exercising a function nobody runs.
  const source = await readFile(new URL(SHADERS[0], PACKAGE_ROOT), 'utf8');
  const terms = [
    'const distributionDenominator = nDotH * nDotH * (alphaSq - 1) + 1;',
    'const distribution = alphaSq / (3.14159265 * distributionDenominator * distributionDenominator);',
    'const occlusionTowardView = nDotL * sqrt(nDotV * nDotV * (1 - alphaSq) + alphaSq);',
    'const occlusionTowardLight = nDotV * sqrt(nDotL * nDotL * (1 - alphaSq) + alphaSq);',
    'const visibility = 0.5 / max(occlusionTowardView + occlusionTowardLight, 0.0001);',
    'const fresnelWeight = grazingSq * grazingSq * grazing;',
    'return fresnel.scale(distribution * visibility * nDotL);',
  ];
  for (const term of terms) {
    assert.ok(source.includes(term), `the shader no longer contains: ${term}`);
  }
  assert.equal(terms.length, 7);
});
