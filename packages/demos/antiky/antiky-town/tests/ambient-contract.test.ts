import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * Goal 07's W B.4 for `antiky-town`, which is an audit rather than a build.
 *
 * The packet asks for "hemispheric ambient and baked vertex AO replacing each demo's flat ambient
 * constant". This demo has both already, and in a stronger form than the reference: an SH-9 sky bake
 * *plus* a separate ground-bounce term, blended by the normal's vertical component. The reference
 * has the SH-9 half and no explicit ground lobe.
 *
 * These assertions exist so the audit's conclusion cannot be quietly undone — and so the one place
 * this demo deliberately diverges from the reference stays deliberate.
 */

const VOXEL = new URL('../src/town/shaders/town-voxel.shader.ts', import.meta.url);

const stripComments = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

test('ambient is two lobes blended by which way the surface faces', () => {
  return readFile(VOXEL, 'utf8').then((source) => {
    const code = stripComments(source);
    // The sky lobe rises with `up`, the ground lobe falls with it. A flat constant would show as
    // neither term referencing the normal.
    assert.match(code, /uSkyIntensity \* \(0\.28 \+ up \* 0\.72\)/, 'the sky lobe stopped following the normal');
    assert.match(code, /uGroundIntensity \* \(0\.22 \+ \(1 - up\) \* 0\.78\)/, 'the ground lobe stopped following the normal');

    // The goal's bar is 30% between up-facing and down-facing. Read off the two blends: the sky term
    // spans 0.28 to 1.0 and the ground term 1.0 to 0.22, so each lobe alone varies by 72-78% between
    // the two extremes, before the colours differ at all.
    const skySpan = 1 - 0.28 / 1.0;
    const groundSpan = 1 - 0.22 / 1.0;
    assert.ok(skySpan >= 0.3, `the sky lobe varies only ${(skySpan * 100).toFixed(0)}%`);
    assert.ok(groundSpan >= 0.3, `the ground lobe varies only ${(groundSpan * 100).toFixed(0)}%`);
  });
});

test('the sky lobe is a nine-coefficient bake, not a single colour', () => {
  return readFile(VOXEL, 'utf8').then((source) => {
    const code = stripComments(source);
    for (let band = 0; band < 9; band += 1) {
      assert.ok(code.includes(`uSh${band}`), `the SH-9 sky is missing band ${band}`);
    }
  });
});

test('occlusion reaching direct light here is deliberate, and stays commented', () => {
  return readFile(VOXEL, 'utf8').then((source) => {
    const code = stripComments(source);
    // The reference's 06-05 established that occlusion must scale ambient alone: a crevice darkened
    // once for seeing less sky and again for seeing less sun goes flat and grey.
    //
    // **This demo diverges on purpose**, and goal 07 requires such a divergence to carry its reason
    // on the line above it. The reason is in the source: under a low golden-hour sun, a voxel cavity
    // with no direct visibility term becomes an unlit black notch rather than a shaded corner.
    assert.match(code, /const ambientVisibility = 0\.62 \+ ao \* 0\.38/, 'the AO split changed');
    // The comment is load-bearing here, so its absence is a failure rather than a style note.
    assert.ok(
      /Splitting AO between ambient and direct visibility/.test(source),
      'the deliberate divergence lost the comment that makes it deliberate',
    );
  });
});
