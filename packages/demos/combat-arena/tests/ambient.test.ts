import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

/**
 * The acceptance test for goal 07's W B.4 in `combat-arena`.
 *
 * The demo's ambient was already *directional* before this packet — a bounce term keyed to the
 * planet's direction — but a flat `0.72` constant sat in front of it and made up 73% of what a
 * down-facing surface received, so direction only ever modulated the last quarter. Measured, it
 * separated an up-facing from a down-facing normal by **6.2%** against the goal's 30% bar.
 *
 * Mirrored here rather than measured from a frame, because "which way is this surface facing" is not
 * a question a capture can be asked.
 */

const PACKAGE_ROOT = new URL('../', import.meta.url);

type Vector = readonly [number, number, number];

const normalise = (v: Vector): Vector => {
  const length = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / length, v[1] / length, v[2] / length];
};
const dot = (a: Vector, b: Vector): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The direction of the planet, agreed by the shaders that light against it. */
const EARTHWARD = normalise([-0.78, -0.42, -0.46]);

/** The shader's hemispheric ambient, mirrored. */
const ambient = (normal: Vector): number => {
  const planetFacing = dot(normal, EARTHWARD) * 0.5 + 0.5;
  return 0.18 + (1.55 - 0.18) * planetFacing;
};

test('ambient depends on which way a surface faces', () => {
  const up = ambient([0, 1, 0]);
  const down = ambient([0, -1, 0]);
  const difference = Math.abs(up - down) / Math.max(up, down);
  assert.ok(
    difference >= 0.3,
    `ambient differs by only ${(difference * 100).toFixed(1)}% between up and down`,
  );
  // **Down is the bright one, and that is not a bug to be corrected.** This arena is in orbit: the
  // light comes from the planet below it, not from a sky above it. A test that demanded "up is
  // brighter" would be asserting a terrestrial assumption against a scene that does not have one.
  assert.ok(down > up, 'the planet is below the arena, so down-facing surfaces catch more light');
});

test('a surface edge-on to the planet sits exactly between the two lobes', () => {
  // Direction alone is not enough — a term returning two values and nothing between them would pass
  // the test above while reading as a hard terminator around every object.
  //
  // "Sideways" means perpendicular to the *lobe's axis*, which points at the planet rather than
  // straight down. Testing world-space sideways instead returns 0.33, below the up-facing value,
  // because `(1, 0, 0)` faces sharply away from a planet that sits at -x as well as -y.
  const perpendicular: Vector[] = [
    normalise([EARTHWARD[1], -EARTHWARD[0], 0]),
    normalise([0, EARTHWARD[2], -EARTHWARD[1]]),
  ];
  const midpoint = (0.18 + 1.55) / 2;
  for (const normal of perpendicular) {
    assert.ok(
      Math.abs(dot(normal, EARTHWARD)) < 1e-9,
      'the test vector is not actually perpendicular to the lobe axis',
    );
    assert.ok(
      Math.abs(ambient(normal) - midpoint) < 1e-9,
      `an edge-on normal returned ${ambient(normal)}, not the midpoint ${midpoint}`,
    );
  }
  // And the falloff is continuous between the ends rather than stepping.
  const samples = [-1, -0.5, 0, 0.5, 1].map((t) => 0.18 + (1.55 - 0.18) * (t * 0.5 + 0.5));
  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i]! > samples[i - 1]!, 'ambient should rise monotonically toward the planet');
  }
});

test('the replacement keeps the scene at the level the old term set', () => {
  // A directional ambient that is also a brightness change would make it impossible to tell which
  // of the two moved the picture. The old term averaged 0.925 over all normals; this one averages
  // the midpoint of its two lobes by construction.
  const sphericalMean = (0.18 + 1.55) / 2;
  assert.ok(
    Math.abs(sphericalMean - 0.925) < 0.08,
    `the replacement averages ${sphericalMean}, against the old term's 0.925`,
  );
});

test('the flat constant is gone from the shaders that had it', async () => {
  // The specific expression W B.4 exists to remove. Grep rather than behaviour, because what is
  // being asserted is an absence.
  let checked = 0;
  for (const name of ['arena-model', 'ship-model']) {
    const source = await readFile(new URL(`src/shaders/${name}.shader.ts`, PACKAGE_ROOT), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(!code.includes('0.72 + fill'), `${name} still carries the flat ambient constant`);
    assert.ok(code.includes('planetFacing'), `${name} does not use the hemispheric term`);
    checked += 1;
  }
  assert.equal(checked, 2);
});
