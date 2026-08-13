import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The acceptance test for goal 07's W B.1 in `combat-arena`.
 *
 * Copied in shape from `point-light-expo/tests/colour-pipeline.test.ts`, which goal 07 names as the
 * reference. Colour management needs two halves: undo the display curve when a texture is read, and
 * reapply it when a pixel is written. Goal 04 added the first across all four Antiky demos and left
 * the second undone, so this demo has been doing lighting on correct numbers and then writing them
 * out as though they were already display-encoded — which is why its p95 fell from 0.101 to 0.081.
 *
 * These check the transfer functions rather than a frame, because a frame cannot tell you whether
 * the maths is right, only whether it looks different.
 */

const TOLERANCE = 2 / 255;

/** The curve the shaders run, mirrored here. Both directions are asserted against it below. */
const decode = (channel: number): number => (channel <= 0.04045
  ? channel / 12.92
  : ((channel + 0.055) / 1.055) ** 2.4);

const encode = (linear: number): number => {
  const safe = Math.max(linear, 0);
  return safe <= 0.0031308 ? safe * 12.92 : 1.055 * safe ** (1 / 2.4) - 0.055;
};

test('a known albedo under a known light lands within 2/255 of the analytic answer', () => {
  // Mid grey as authored, lit by a light of 0.75. Every number below is computed by hand from the
  // sRGB standard, not read back from the implementation.
  const authored = 0.5;
  const light = 0.75;

  // 0.5 sRGB is 0.21404114 linear — the single fact the whole pipeline turns on. Treating 0.5 as
  // linear, which is what a missing decode does, is a 134% error before a light is even applied.
  const linearAlbedo = decode(authored);
  assert.ok(Math.abs(linearAlbedo - 0.21404114) < 1e-6, `mid grey decoded to ${linearAlbedo}`);

  const written = encode(linearAlbedo * light);
  // 0.21404114 * 0.75 = 0.16053086 linear, which encodes to 0.43731 display.
  assert.ok(Math.abs(written - 0.43731) < TOLERANCE, `expected ~0.43731, got ${written}`);
});

test('the two halves compose to the identity, which is what "managed" means', () => {
  // If they did not, every texture would come back a different colour than it went in, and the
  // error would look like an art choice rather than a bug.
  for (const value of [0, 0.02, 0.04, 0.1, 0.25, 0.5, 0.75, 1]) {
    assert.ok(Math.abs(encode(decode(value)) - value) < 1e-9, `${value} did not round trip`);
  }
});

test('the standard does not quite close at its own join, and by how much', () => {
  // Worth stating rather than stepping around. The sRGB curve switches branches at 0.04045 going
  // down and 0.0031308 coming back, and those two published constants are rounded rather than
  // exactly reciprocal: decode(0.04045) is 0.0031308049…, a hair above the encode threshold, so the
  // value crosses on the linear branch and returns on the power branch.
  //
  // The gap it opens is 0.00001/255 — five orders of magnitude below anything a frame can hold. It
  // is asserted here so a future round-trip failure at the join reads as this known property of the
  // standard rather than as a new bug in the shaders.
  const join = 0.04045;
  const error = Math.abs(encode(decode(join)) - join) * 255;
  assert.ok(error > 0, 'the join is expected not to close exactly');
  assert.ok(error < 0.001, `the join drifted by ${error}/255, which is far more than rounding`);
});

test('the piecewise curve is not the 2.2 approximation, and the difference lives in the darks', () => {
  // This demo is a night scene lit by three point lights, so it spends its time exactly where the
  // two curves disagree most.
  const gamma22 = (channel: number) => channel ** 2.2;
  const nearBlack = 0.03;
  assert.ok(
    Math.abs(decode(nearBlack) - gamma22(nearBlack)) > 0.0005,
    'the two curves should differ measurably near black',
  );
  // And agree closely at the top, which is why the approximation survives as long as it does.
  assert.ok(Math.abs(decode(0.9) - gamma22(0.9)) < 0.01);
});

test('every shader that writes a final pixel encodes, and does it last', async () => {
  const directory = new URL('../src/shaders/', import.meta.url);
  // The shaders that write a pixel the viewer sees directly. The blended passes are excluded and
  // named, so adding one cannot quietly opt out of colour management.
  const blended = new Set(['arena-glow.shader.ts', 'arena-hud.shader.ts', 'contact-shadow.shader.ts']);
  const missing: string[] = [];
  let checked = 0;
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts')) continue;
    if (blended.has(entry)) continue;
    const source = await readFile(new URL(entry, directory), 'utf8');
    checked += 1;
    if (!source.includes('encodeSrgb(')) { missing.push(entry); continue; }
    // Last, not merely present: the encode has to wrap everything else the shader returns.
    const returned = source.slice(source.lastIndexOf('return vec4('));
    if (!returned.includes('vec4(encodeSrgb(')) missing.push(`${entry} (encodes, but not last)`);
  }
  assert.deepEqual(missing, []);
  assert.ok(checked >= 5, `expected several final-pixel shaders, checked ${checked}`);
});
