import assert from 'node:assert/strict';
import test from 'node:test';

import { TRAVERSAL_LIGHTING_RAMP } from '../src/lighting-ramp.gen.ts';

/**
 * Goal 07's shading-response measurement for `traversal-study`, which the goal notes is checkable
 * without rendering — the ramp *is* the demo's lighting model, so its contrast is its shading
 * response.
 *
 * **The goal file's premise is stale, and the shader's comment overstates the fix.** The goal
 * records the ramp as `0.54 + smoothstep(0.18, 0.25, d) * 0.2 + smoothstep(0.62, 0.7, d) * 0.24` —
 * three bands spanning 0.54 to 0.98, a **1.81:1** range with no hue movement — and asks for ≥ 6:1.
 * An earlier goal already replaced it. The replacement measures **6.69:1**, which clears the bar.
 *
 * The comment above the ramp lookup in `traversal-model.shader.ts` says 14.8:1. That is not what the
 * committed stops measure by luminance, and this test is the number to trust: it reads the data
 * rather than describing it.
 */

const luminance = (c: readonly number[]): number => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

test('the shading response spans at least six to one', () => {
  const levels = TRAVERSAL_LIGHTING_RAMP.map(luminance);
  const darkest = Math.min(...levels);
  const brightest = Math.max(...levels);
  const ratio = brightest / darkest;
  assert.ok(
    ratio >= 6,
    `the ramp spans ${ratio.toFixed(2)}:1, and the bar is 6:1. The band form it replaced was 1.81:1.`,
  );
  // Not open-ended: a ramp reaching pure black would clip every shadow in the demo and would also
  // clear the assertion above by dividing by almost nothing.
  assert.ok(darkest > 0.05, `the darkest stop is ${darkest.toFixed(4)}, which crushes the shadows`);
});

test('the ramp moves in hue, not only in brightness', () => {
  // The specific failure of the band form: shadow and light differed only in how much grey they
  // had. A ramp that shifts hue is what makes a stylised scene read as lit rather than as tinted.
  const hue = (c: readonly number[]): number => {
    const high = Math.max(c[0]!, c[1]!, c[2]!);
    const low = Math.min(c[0]!, c[1]!, c[2]!);
    if (high === low) return 0;
    const span = high - low;
    const raw = high === c[0]! ? (c[1]! - c[2]!) / span
      : high === c[1]! ? 2 + (c[2]! - c[0]!) / span
        : 4 + (c[0]! - c[1]!) / span;
    return ((raw * 60) + 360) % 360;
  };
  const dark = hue(TRAVERSAL_LIGHTING_RAMP[0]!);
  const light = hue(TRAVERSAL_LIGHTING_RAMP[TRAVERSAL_LIGHTING_RAMP.length - 1]!);
  const shift = Math.min(Math.abs(dark - light), 360 - Math.abs(dark - light));
  assert.ok(shift > 90, `the ramp shifts only ${shift.toFixed(0)} degrees of hue`);
});

test('the ramp rises monotonically, so more light never means a darker surface', () => {
  const levels = TRAVERSAL_LIGHTING_RAMP.map(luminance);
  let falls = 0;
  for (let i = 1; i < levels.length; i += 1) if (levels[i]! < levels[i - 1]! - 1e-6) falls += 1;
  assert.equal(falls, 0, `${falls} of ${levels.length} ramp steps go backwards`);
  assert.ok(levels.length >= 32, `a ${levels.length}-stop ramp will band visibly`);
});
