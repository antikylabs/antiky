import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The grade and the vignette from goal 06-06, checked as functions.
 *
 * The vignette cannot be measured from the frame the way the shadow probe is. It is a multiplier on
 * radius, and this scene's corners are the black void — a corner probe reads 89% below centre and
 * almost all of that is "the floor does not reach here". So the function is mirrored and asserted,
 * in the same shape as `colour-pipeline.test.ts` mirrors the sRGB curve, and the last test keeps the
 * mirror and the shader from drifting apart.
 */

const PACKAGE_ROOT = new URL('../', import.meta.url);

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** The shader's vignette, mirrored. `radius` is distance from the frame centre in uv. */
const vignette = (radius: number) => 1 - smoothstep(0.28, 0.78, radius) * 0.22;

/** The shader's contrast curve, mirrored. */
const shapeContrast = (channel: number) => 0.18 * (Math.max(channel, 0) / 0.18) ** 1.22;

test('the vignette darkens the corners by between 10 and 25 per cent', () => {
  // Both ends of that range are real: under 10% is invisible and over 25% is heavy-handed.
  const centre = vignette(0);
  // A 16:9 frame's corner sits at sqrt(0.5^2 + 0.5^2) in uv.
  const corner = vignette(Math.hypot(0.5, 0.5));
  const darkening = 1 - corner / centre;
  assert.ok(centre === 1, `the centre should be untouched, got ${centre}`);
  assert.ok(darkening >= 0.1, `the corner is only ${(darkening * 100).toFixed(1)}% down`);
  assert.ok(darkening <= 0.25, `the corner is ${(darkening * 100).toFixed(1)}% down, which is heavy`);
});

test('the vignette falls off monotonically and leaves the middle of the frame alone', () => {
  let previous = 1;
  for (const radius of [0, 0.1, 0.2, 0.28, 0.4, 0.55, 0.7, 0.707]) {
    const value = vignette(radius);
    assert.ok(value <= previous + 1e-12, `vignette rose at radius ${radius}`);
    previous = value;
  }
  // Nothing inside the inner edge is touched, so the subject never sits in the falloff.
  assert.equal(vignette(0.27), 1);
});

test('the contrast curve maps black to black, which the straight-line form does not', () => {
  // The regression test for a defect this step made and measured. The obvious form,
  // `pivot + (v - pivot) * gain`, sends everything below `pivot / gain` negative; clamping that at
  // zero turned this scene's void into a plateau of pure black and took `clippedLow` from 0 to
  // **33.5%** against a 2% ceiling — while local contrast read 8.54 and looked like a pass.
  assert.equal(shapeContrast(0), 0);
  const straightLine = (v: number) => Math.max(0, 0.18 + (v - 0.18) * 1.22);
  // The void sits near here, and it is exactly what the straight line destroys.
  const voidLevel = 0.008;
  assert.ok(shapeContrast(voidLevel) > 0, 'the curve crushed the void to black');
  assert.equal(straightLine(voidLevel), 0, 'the straight-line form should be shown to crush it');
});

test('the contrast curve pivots at mid grey and separates the lit from the unlit', () => {
  // The pivot is fixed, so a change to the gain cannot brighten or darken the scene overall — it
  // only changes how far apart the two ends sit.
  assert.ok(Math.abs(shapeContrast(0.18) - 0.18) < 1e-9);
  assert.ok(shapeContrast(0.05) < 0.05, 'darks should compress');
  assert.ok(shapeContrast(0.5) > 0.5, 'lit surfaces should lift');
});

test('the mirrors above still match the shader', async () => {
  const source = await readFile(new URL('src/shaders/post.shader.ts', PACKAGE_ROOT), 'utf8');
  const terms = [
    'return 0.18 * pow(max(channel, 0) / 0.18, 1.22);',
    'const vignette = 1 - smoothstep(0.28, 0.78, radius) * 0.22;',
  ];
  for (const term of terms) assert.ok(source.includes(term), `the shader no longer contains: ${term}`);
  assert.equal(terms.length, 2);
});
