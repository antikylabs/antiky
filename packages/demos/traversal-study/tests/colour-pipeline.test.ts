import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The acceptance test for goal 07's W B.1 in `traversal-study`.
 *
 * Copied in shape from `point-light-expo/tests/colour-pipeline.test.ts`, which goal 07 names as the
 * reference. Colour management needs two halves: undo the display curve when a texture is read, and
 * reapply it when a pixel is written. Goal 04 added the first across all four Antiky demos and left
 * the second undone, so this demo has been doing lighting on correct numbers and then writing them
 * out as though they were already display-encoded — which is why its p95 fell from 0.400 to 0.258.
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
  // This demo is a bright outdoor platformer, so it still spends its shadows where the
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

test('exactly one shader encodes, and it is the post pass', async () => {
  // W B.1 put a copy of the encode in each shader that wrote a final pixel. W B.2 gave the demo one
  // RGBA16F target and one pass that reads it, so those copies collapsed into a single encode there.
  // A material that still encoded would be writing display data into a linear buffer for the post
  // pass to encode a second time.
  const directory = new URL('../src/shaders/', import.meta.url);
  const encoders: string[] = [];
  let scanned = 0;
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts')) continue;
    scanned += 1;
    const source = await readFile(new URL(entry, directory), 'utf8');
    if (source.includes('encodeSrgb(')) encoders.push(entry);
  }
  assert.deepEqual(encoders, ['post.shader.ts'], 'only the post pass may encode');
  assert.ok(scanned >= 4, `expected the demo's shaders, scanned ${scanned}`);
});

test('no material shader tone-maps, and the demo agrees on one sky', async () => {
  const directory = new URL('../src/shaders/', import.meta.url);
  const offenders: string[] = [];
  for (const entry of await readdir(directory)) {
    if (!entry.endsWith('.shader.ts') || entry.endsWith('.gen.ts') || entry === 'post.shader.ts') continue;
    const source = await readFile(new URL(entry, directory), 'utf8');
    if (source.includes('tonemapACES')) offenders.push(entry);
  }
  assert.deepEqual(offenders, [], 'tone-mapping belongs to the post pass alone');

  // The demo used to render three skies in one frame: two shader fog colours and a clear colour.
  // One value now, and the old ones must not come back.
  for (const gone of ['0.55, 0.65, 0.66', '0.52, 0.63, 0.65']) {
    for (const entry of ['traversal-model', 'traversal-surface']) {
      const source = await readFile(new URL(`${entry}.shader.ts`, directory), 'utf8');
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!code.includes(gone), `${entry} still fades to the old sky ${gone}`);
    }
  }
});
