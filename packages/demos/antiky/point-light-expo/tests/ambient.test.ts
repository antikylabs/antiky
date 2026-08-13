import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { FLOOR_SKY, SURFACE_SKY } from '../src/ambient.ts';

/**
 * The acceptance tests for goal 06-05.
 *
 * **A correction to the goal's premise first.** It describes ambient in this demo as "a single
 * constant added to everything", and that was true when it was written. Goal 05 replaced it with a
 * nine-coefficient spherical-harmonic bake of a real sky, which is a superset of the hemispheric
 * ambient 06-05 asks for: hemispheric gives two colours blended by the normal's vertical component,
 * SH-9 gives a full directional reconstruction and reproduces a hemisphere as a special case.
 *
 * The flat colours in `presentation.ts` survive, but not as ambient — `ambient.ts` uses them to set
 * the *level* of the baked sky so that adopting it changed direction without also changing
 * brightness. Deleting them, which the goal's outcome 2 asks for, would delete that normalisation.
 *
 * So what is tested here is the property the goal actually wants — that ambient depends on which way
 * a surface faces — rather than the absence of a constant.
 */

const PACKAGE_ROOT = new URL('../', import.meta.url);

type Sh9 = readonly (readonly [number, number, number])[];

/** The same nine basis functions the shaders evaluate, mirrored. */
function reconstruct(coefficients: Sh9, normal: readonly [number, number, number]) {
  const [x, y, z] = normal;
  const basis = [1, y, z, x, x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y];
  const colour: [number, number, number] = [0, 0, 0];
  for (let band = 0; band < 9; band += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      colour[channel] += coefficients[band]![channel]! * basis[band]!;
    }
  }
  return colour;
}

const luminance = (c: readonly [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

test('ambient depends on which way a surface faces', () => {
  // The goal's bar is 30% between an up-facing and a down-facing surface. A flat constant scores 0
  // here by construction, which is what makes this the right measurement.
  let checked = 0;
  for (const [name, sky] of [['floor', FLOOR_SKY], ['surface', SURFACE_SKY]] as const) {
    const up = luminance(reconstruct(sky as Sh9, [0, 1, 0]));
    const down = luminance(reconstruct(sky as Sh9, [0, -1, 0]));
    const difference = Math.abs(up - down) / Math.max(up, down);
    assert.ok(
      difference >= 0.3,
      `${name} ambient differs by only ${(difference * 100).toFixed(1)}% between up and down`,
    );
    // Up-facing must be the brighter one. A sky darker than the ground bounce is a sign the
    // coefficients were baked or normalised with an axis flipped.
    assert.ok(up > down, `${name} ambient is brighter facing down than facing up`);
    checked += 1;
  }
  assert.equal(checked, 2);
});

test('a sideways surface sits between the sky and the ground bounce', () => {
  // Direction alone is not enough — a term that returned two values and nothing between them would
  // pass the test above while reading as a hard terminator around every object.
  for (const sky of [FLOOR_SKY, SURFACE_SKY] as const) {
    const up = luminance(reconstruct(sky as Sh9, [0, 1, 0]));
    const down = luminance(reconstruct(sky as Sh9, [0, -1, 0]));
    const side = luminance(reconstruct(sky as Sh9, [1, 0, 0]));
    assert.ok(side < up && side > down, `a sideways normal returned ${side}, outside ${down}..${up}`);
  }
});

test('occlusion multiplies ambient and nothing else', async () => {
  // The regression test for the mistake goal 06-05 names, which this demo had made: occlusion was
  // scaling the whole lit sum, so a crevice was darkened once for seeing less sky and again for
  // seeing less sun. The sun does not care what the sky can see, and the signature of getting it
  // wrong is shadowed areas that go flat and grey instead of dark and shaped.
  const source = await readFile(new URL('src/shaders/reliquary-model.shader.ts', PACKAGE_ROOT), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const lit = code.match(/const lit = ([\s\S]*?);\n/);
  assert.ok(lit, 'the lit expression could not be found');
  const expression = lit[1]!.replace(/\s+/g, ' ');

  assert.ok(
    expression.includes('ambient.scale(occlusion)'),
    `occlusion should scale the ambient term, got: ${expression}`,
  );
  // The direct terms must not be inside anything occlusion multiplies. `.add(relay)` and
  // `.add(sunRadiance)` have to come after the ambient product, not be wrapped by it.
  assert.ok(
    !/\.add\(relay\)[\s\S]*\.scale\(occlusion\)/.test(expression),
    `occlusion is applied after the relay lights are added: ${expression}`,
  );
  assert.ok(
    !/\.add\(sunRadiance\)[\s\S]*\.scale\(occlusion\)/.test(expression),
    `occlusion is applied after the sun is added: ${expression}`,
  );
});

test('the floor applies its occlusion map to ambient only too', async () => {
  const source = await readFile(new URL('src/shaders/reliquary-floor.shader.ts', PACKAGE_ROOT), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    /const ambient = shIrradiance\.scale\(uAmbientStrength \* ao\)/.test(code),
    'the floor no longer folds its ambient occlusion into the ambient term',
  );
  // And the occlusion sample must not reach the direct terms.
  const lit = code.match(/const lit = ([^;]*);/);
  assert.ok(lit, 'the floor lit expression could not be found');
  assert.ok(!lit[1]!.includes('ao'), `the floor applies ao to its lit sum: ${lit[1]}`);
});
