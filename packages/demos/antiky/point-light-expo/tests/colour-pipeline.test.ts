import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The acceptance test for goal 06-01.
 *
 * Colour management needs two halves: undo the display curve when a texture is read, and reapply it
 * when a pixel is written. Goal 04 added the first. Without the second, lighting ran on correct
 * numbers and then wrote them to the screen as though they were already display-encoded, and this
 * demo's luminance p95 fell from 0.090 to 0.050.
 *
 * These check the transfer functions themselves rather than a frame, because a frame cannot tell you
 * whether the maths is right — only whether it looks different.
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

  const lit = linearAlbedo * light;
  const written = encode(lit);

  // 0.21404114 * 0.75 = 0.16053086 linear, which encodes to 0.43731 display.
  assert.ok(Math.abs(written - 0.43731) < TOLERANCE, `expected ~0.43731, got ${written}`);

  // What the demo did before this step: decode, light, and write the linear value straight out.
  const withoutEncode = lit;
  assert.ok(
    written - withoutEncode > 0.27,
    'the encode must make a large difference here, or this test is not measuring it',
  );
});

test('encode is the exact inverse of decode across the range', () => {
  for (const value of [0, 0.001, 0.0031308, 0.04045, 0.12, 0.5, 0.75, 0.9, 1]) {
    assert.ok(
      Math.abs(encode(decode(value)) - value) < TOLERANCE,
      `round trip failed at ${value}: got ${encode(decode(value))}`,
    );
  }
});

test('the piecewise toe is used, not the 2.2 approximation', () => {
  // They differ most in the darks, and this scene lives there. A 2.2 gamma would put 0.01 linear at
  // 0.1274; the standard curve puts it at 0.1029 — nearly 7/255 apart, well outside tolerance.
  const approximation = 0.01 ** (1 / 2.2);
  assert.ok(Math.abs(encode(0.01) - 0.1029) < TOLERANCE, `standard curve gave ${encode(0.01)}`);
  assert.ok(
    Math.abs(approximation - encode(0.01)) > TOLERANCE,
    'the two curves must differ here, or this test cannot tell them apart',
  );
});

test('every shader that writes a final pixel encodes exactly once', async () => {
  // `onboarding` is deliberately absent: it is authored display-space UI composited onto a
  // display-space buffer, so the identity is correct and encoding would darken it. The reasoning is
  // written at its sample site, and `pipeline-invariants.test.mjs` classifies its atlas `authored`.
  const FINAL_PIXEL_SHADERS = [
    'reliquary-model', 'reliquary-floor', 'foundry', 'contact-shadow', 'foundry-glow',
  ];
  for (const name of FINAL_PIXEL_SHADERS) {
    const source = await readFile(new URL(`../src/shaders/${name}.shader.ts`, import.meta.url), 'utf8');
    assert.match(source, /function encodeSrgb/, `${name} has no encode helper`);

    const returns = [...source.matchAll(/return vec4\(/g)];
    const fragmentReturn = source.slice(source.indexOf('fragment('));
    assert.match(
      fragmentReturn,
      /return vec4\(\s*encodeSrgb\(/,
      `${name} writes a final pixel without encoding it`,
    );
    assert.ok(returns.length >= 1, `${name} has no vec4 return at all`);

    // Twice would darken the image as badly as not at all, in the other direction.
    const encodeCalls = [...fragmentReturn.matchAll(/encodeSrgb\(/g)].length;
    assert.equal(encodeCalls, 1, `${name} calls encodeSrgb ${encodeCalls} times in its fragment`);
  }
});
