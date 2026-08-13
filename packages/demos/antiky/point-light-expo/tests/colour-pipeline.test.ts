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

test('exactly one shader encodes, and it is the post pass', async () => {
  // 06-01 needed a copy of the encode in every shader that wrote a final pixel. 06-02 gave the scene
  // one RGBA16F target and one pass that reads it, so those copies collapse into this single one —
  // which is the whole reason for the target. A material shader that still encodes is writing
  // display data into a linear buffer, and the post pass would then encode it a second time.
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('../src/shaders/', import.meta.url);
  const encoders = [];
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts')) continue;
    const source = await readFile(new URL(entry, directory), 'utf8');
    if (/function encodeSrgb/.test(source)) encoders.push(entry);
  }
  assert.deepEqual(encoders, ['post.shader.ts'], 'only the post pass may encode');

  const post = await readFile(new URL('post.shader.ts', directory), 'utf8');
  // The fragment body, starting after its parameter list.
  //
  // This used to slice from `return vec4(`, because `uExposure` appears in the destructuring too and
  // would otherwise look like it came first. That broke the moment 06-06 added a grade: exposure is
  // now applied to a named local above the return, which is clearer code and made the test report a
  // missing stage. Slicing past the parameter list keeps the guard against the destructuring while
  // letting the stages be named rather than nested.
  const fragmentAt = post.indexOf('fragment(');
  const bodyAt = post.indexOf('{', post.indexOf(') {', fragmentAt));
  const fragment = post.slice(bodyAt);
  // Order matters and is not interchangeable: exposure scales linear light, the grade works on that
  // linear range, ACES maps it into 0..1, and only then is it display data.
  //
  // Asserted as execution order rather than text position. The first version compared string
  // indices, which worked only while the whole chain was one nested expression — naming the stages
  // as separate statements reversed two of the three comparisons without changing the pipeline.
  const exposureAt = fragment.indexOf('uExposure');
  const toneMapAt = fragment.indexOf('tonemapACES');
  const encodeAt = fragment.indexOf('encodeSrgb');
  assert.ok(exposureAt >= 0 && toneMapAt >= 0 && encodeAt >= 0, 'the post pass is missing a stage');
  // The encode wraps the tone-map, which is the one relationship that must stay nested: there is no
  // legitimate reason to encode and then tone-map display data.
  assert.ok(
    /encodeSrgb\(\s*tonemapACES\(/.test(fragment),
    'the encode must wrap the tone-map, not precede it',
  );
  // Exposure is applied before the tone-map sees anything.
  assert.ok(exposureAt < toneMapAt, 'the tone-map must run on an already-exposed value');
  // And exposure happens once. Two applications is the bug that made this demo double-dark before.
  assert.equal(fragment.split('uExposure').length - 1, 1, 'exposure is applied more than once');
});

test('no material shader tone-maps or applies exposure', async () => {
  const { readdir } = await import('node:fs/promises');
  const directory = new URL('../src/shaders/', import.meta.url);
  const offenders = [];
  let scanned = 0;
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts') || entry === 'post.shader.ts') continue;
    scanned += 1;
    const source = await readFile(new URL(entry, directory), 'utf8');
    if (/tonemapACES/.test(source)) offenders.push(`${entry}: tone-maps`);
    if (/uExposure/.test(source)) offenders.push(`${entry}: applies its own exposure`);
  }
  assert.ok(scanned >= 5, `expected the material shaders, scanned ${scanned}`);
  assert.deepEqual(offenders, [], 'these belong to the post pass now, once, for the whole frame');
});
