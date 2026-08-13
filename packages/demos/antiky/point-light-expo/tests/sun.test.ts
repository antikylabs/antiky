import assert from 'node:assert/strict';
import test from 'node:test';

import { RELAY_PRESENTATION } from '../src/presentation.ts';
import { SHADOW_MAP_SIZE, createRelaySunShadow, createSunShadow } from '../src/sun.ts';

/**
 * The shadow map's geometry, checked as arithmetic rather than by looking at a frame.
 *
 * A shadow map fails in ways that all look alike in a capture: shadows missing, shadows floating,
 * shadows in the wrong place. These separate the causes. Every case below is a scene the demo does
 * not have, so what is under test is the derivation and not the numbers it produces today.
 */

const BOUNDS = RELAY_PRESENTATION.reliquaryBounds;

type Vector = readonly [number, number, number];

function corners(minimum: Vector, maximum: Vector): Vector[] {
  const points: Vector[] = [];
  for (const x of [minimum[0], maximum[0]]) {
    for (const y of [minimum[1], maximum[1]]) {
      for (const z of [minimum[2], maximum[2]]) points.push([x, y, z]);
    }
  }
  return points;
}

/** Column-major, matching BroMetal's `mat4`. */
function project(matrix: Float32Array, point: Vector): [number, number, number, number] {
  const [x, y, z] = point;
  return [
    matrix[0]! * x + matrix[4]! * y + matrix[8]! * z + matrix[12]!,
    matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!,
    matrix[2]! * x + matrix[6]! * y + matrix[10]! * z + matrix[14]!,
    matrix[3]! * x + matrix[7]! * y + matrix[11]! * z + matrix[15]!,
  ];
}

const distance = (a: Vector, b: Vector): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('every corner of the scene lands inside the light frustum', () => {
  // A corner outside the frustum is geometry that casts no shadow, and the symptom is a prop whose
  // shadow simply is not there — which reads as "shadows are broken" rather than "the frustum is
  // too small".
  const shadow = createRelaySunShadow();
  let checked = 0;
  for (const corner of corners(BOUNDS.minimum, BOUNDS.maximum)) {
    const [x, y, z, w] = project(shadow.viewProjection, corner);
    assert.ok(w > 0, `corner ${corner} is behind the light`);
    assert.ok(Math.abs(x / w) <= 1, `corner ${corner} is off the map horizontally at ${x / w}`);
    assert.ok(Math.abs(y / w) <= 1, `corner ${corner} is off the map vertically at ${y / w}`);
    // WebGPU clip depth is 0..1, not -1..1.
    assert.ok(z / w >= 0 && z / w <= 1, `corner ${corner} is outside near/far at ${z / w}`);
    checked += 1;
  }
  assert.equal(checked, 8);
});

test('no part of the scene is further from the light than the range', () => {
  // `shadowDepth` divides by `range`, and the lookup compares against a value read from a texture
  // that cannot hold more than 1. A corner beyond `range` writes a clamped depth and stops
  // occluding anything behind it.
  const shadow = createRelaySunShadow();
  for (const corner of corners(BOUNDS.minimum, BOUNDS.maximum)) {
    const fraction = distance(corner, shadow.position) / shadow.range;
    assert.ok(fraction <= 1, `corner ${corner} sits at ${fraction.toFixed(3)} of the range`);
    // And it should use most of the range rather than crowding the near end, or the stored value
    // spends its precision on empty space.
    assert.ok(fraction > 0.2, `corner ${corner} sits at only ${fraction.toFixed(3)} of the range`);
  }
});

test('the depth quantum stays small enough to keep a shadow attached to its caster', () => {
  // The failure this guards is the one the goal file calls out by name. Depth is stored as a
  // fraction of `range` in a 16-bit float, whose mantissa gives about 1 part in 2048 near the top
  // of its range. A `range` of 400 puts the quantum near 0.2 world units, and a contact shadow
  // detaches from the foot of the thing casting it.
  const shadow = createRelaySunShadow();
  const quantum = shadow.range / 2048;
  assert.ok(quantum < 0.03, `one depth step is ${quantum.toFixed(4)} world units`);
  // The rule the goal states, checked directly rather than through its consequence.
  assert.ok(
    shadow.range <= 4 * shadow.radius,
    `range ${shadow.range.toFixed(2)} exceeds 4x the scene radius ${shadow.radius.toFixed(2)}`,
  );
});

test('the light frustum does not waste its depth precision', () => {
  // The same rule `pipeline-invariants.test.mjs` applies to the demo cameras. A far/near ratio in
  // the thousands is how a depth buffer becomes unusable.
  const shadow = createRelaySunShadow();
  const near = shadow.range - 2 * shadow.radius;
  assert.ok(near > 0, `the near plane is at ${near.toFixed(2)}, which is behind the light`);
  assert.ok(shadow.range / near < 10, `far/near is ${(shadow.range / near).toFixed(1)}`);
});

test('moving the scene moves the shadow map with it', () => {
  // Required outcome 4: derived from the bounds, not typed in. Shifting the scene ten units must
  // shift the light by exactly ten units and change nothing else.
  const shifted = createSunShadow(
    [BOUNDS.minimum[0] + 10, BOUNDS.minimum[1], BOUNDS.minimum[2]],
    [BOUNDS.maximum[0] + 10, BOUNDS.maximum[1], BOUNDS.maximum[2]],
  );
  const original = createRelaySunShadow();
  assert.ok(Math.abs(shifted.position[0] - original.position[0] - 10) < 1e-4);
  assert.ok(Math.abs(shifted.position[1] - original.position[1]) < 1e-4);
  assert.ok(Math.abs(shifted.range - original.range) < 1e-4);
});

test('a scene twice the size gets a frustum twice the size, not a clipped one', () => {
  const small = createSunShadow([-1, -1, -1], [1, 1, 1]);
  const large = createSunShadow([-2, -2, -2], [2, 2, 2]);
  assert.ok(Math.abs(large.radius / small.radius - 2) < 1e-6);
  assert.ok(Math.abs(large.range / small.range - 2) < 1e-6);
  // And the larger scene still fits, which is the property that matters.
  for (const corner of corners([-2, -2, -2], [2, 2, 2])) {
    const [x, y, z, w] = project(large.viewProjection, corner);
    assert.ok(Math.abs(x / w) <= 1 && Math.abs(y / w) <= 1 && z / w >= 0 && z / w <= 1);
  }
});

test('the frustum is proven able to be too small', () => {
  // The containment assertions above are only worth something if a frustum sized for a smaller
  // scene actually fails them. This builds one for a scene half the size and checks the real
  // scene's corners fall outside it.
  const tooSmall = createSunShadow(
    [BOUNDS.minimum[0] / 2, BOUNDS.minimum[1] / 2, BOUNDS.minimum[2] / 2],
    [BOUNDS.maximum[0] / 2, BOUNDS.maximum[1] / 2, BOUNDS.maximum[2] / 2],
  );
  const escaped = corners(BOUNDS.minimum, BOUNDS.maximum).filter((corner) => {
    const [x, y, z, w] = project(tooSmall.viewProjection, corner);
    return w <= 0 || Math.abs(x / w) > 1 || Math.abs(y / w) > 1 || z / w < 0 || z / w > 1;
  });
  assert.ok(escaped.length > 0, 'an undersized frustum contained the whole scene, so the test above proves nothing');
});

test('the shadow map is square and its texel matches its size', () => {
  const shadow = createRelaySunShadow();
  assert.equal(shadow.texel, 1 / SHADOW_MAP_SIZE);
  // World units per texel, which is what decides whether a contact reads as a contact.
  const worldPerTexel = (2 * shadow.radius) / SHADOW_MAP_SIZE;
  assert.ok(worldPerTexel < 0.02, `each texel covers ${worldPerTexel.toFixed(4)} world units`);
});

test('the light projection uses WebGPU depth, not OpenGL depth', () => {
  // The regression test for a real defect, found by this goal and fixed inside it.
  //
  // BroMetal's `mat4.perspective` is OpenGL convention: near maps to z = -w and far to z = +w.
  // WebGPU clips at 0 <= z <= w, so the near half of any frustum built with it is discarded before
  // it is drawn. On a camera running near 0.1 and far 1000 that costs a 0.1-unit sliver and nobody
  // notices. On this shadow frustum it costs 27%, starting with whatever is closest to the light —
  // which is exactly the geometry whose shadow matters most.
  //
  // Asserted at the planes rather than by comparing against a copy of the formula, so a different
  // correct projection would still pass.
  const shadow = createRelaySunShadow();
  const forward = [
    shadow.centre[0] - shadow.position[0],
    shadow.centre[1] - shadow.position[1],
    shadow.centre[2] - shadow.position[2],
  ];
  const length = Math.hypot(forward[0]!, forward[1]!, forward[2]!);
  const axis = forward.map((value) => value / length) as unknown as Vector;

  const depthAt = (axialDistance: number) => {
    const point: Vector = [
      shadow.position[0] + axis[0] * axialDistance,
      shadow.position[1] + axis[1] * axialDistance,
      shadow.position[2] + axis[2] * axialDistance,
    ];
    const [, , z, w] = project(shadow.viewProjection, point);
    return z / w;
  };

  const near = shadow.range - 2 * shadow.radius;
  assert.ok(Math.abs(depthAt(near)) < 1e-3, `the near plane maps to ${depthAt(near)}, not 0`);
  assert.ok(
    Math.abs(depthAt(shadow.range) - 1) < 1e-3,
    `the far plane maps to ${depthAt(shadow.range)}, not 1`,
  );
  // The midpoint is where an OpenGL projection crosses zero. Anything at or below zero here is
  // geometry WebGPU would discard.
  const midpoint = (2 * shadow.range * near) / (shadow.range + near);
  assert.ok(depthAt(midpoint) > 0.2, `the OpenGL zero-crossing maps to ${depthAt(midpoint)}`);
});
