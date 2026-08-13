import assert from 'node:assert/strict';
import test from 'node:test';

import { bakeVertexOcclusion, encodeOpenness } from '../scripts/bake-vertex-occlusion.mjs';

/**
 * The occlusion bake, checked against shapes whose answer is known by looking at them.
 *
 * A bake that runs and produces plausible numbers is not evidence of anything — the first version of
 * this one returned "fully open" for every vertex of every shape, including the underside of a roof,
 * and looked entirely reasonable doing it. These use geometry simple enough that the right answer is
 * not in question.
 */

/** A flat grid at height `y`, spanning `x0..x1` in x and -4..4 in z. */
function plate(vertices, normals, indices, y, x0, x1) {
  const base = vertices.length / 3;
  for (let z = 0; z < 9; z += 1) {
    for (let x = 0; x < 9; x += 1) {
      vertices.push(x0 + ((x1 - x0) * x) / 8, y, z - 4);
      normals.push(0, 1, 0);
    }
  }
  for (let z = 0; z < 8; z += 1) {
    for (let x = 0; x < 8; x += 1) {
      const corner = base + z * 9 + x;
      indices.push(corner, corner + 9, corner + 1, corner + 1, corner + 9, corner + 10);
    }
  }
  return base;
}

const mean = (values) => values.reduce((total, value) => total + value, 0) / values.length;

function bake(vertices, normals, indices) {
  return bakeVertexOcclusion(
    new Float32Array(vertices),
    new Float32Array(normals),
    new Uint32Array(indices),
  );
}

test('a flat plane is open everywhere, because nothing can occlude it', () => {
  const vertices = [];
  const normals = [];
  const indices = [];
  plate(vertices, normals, indices, 0, -4, 4);
  const openness = bake(vertices, normals, indices);
  assert.equal(openness.length, 81);
  for (const value of openness) {
    assert.ok(value > 0.999, `a flat plane returned ${value}, which is not open`);
  }
});

test('ground under a roof is occluded and ground beside it is not', () => {
  // The case the first implementation got wrong. It searched a fixed two-cell neighbourhood around
  // each ray's origin, but the grid is built over the mesh bounds — so a flat model has cells that
  // are wide in x and z and paper-thin in y, and an occluder a fifth of a unit overhead sat
  // twenty-four cells away and was never tested. A neighbourhood measured in cells cannot bound a
  // distance measured in world units.
  const vertices = [];
  const normals = [];
  const indices = [];
  const ground = plate(vertices, normals, indices, 0, -4, 4);
  plate(vertices, normals, indices, 0.3, -4, 0);
  const openness = bake(vertices, normals, indices);

  const covered = [];
  const open = [];
  for (let z = 0; z < 9; z += 1) {
    for (let x = 0; x < 9; x += 1) {
      const worldX = -4 + x;
      const value = openness[ground + z * 9 + x];
      if (worldX < -0.7) covered.push(value);
      else if (worldX > 0.7) open.push(value);
    }
  }
  assert.ok(covered.length > 10 && open.length > 10, 'the sample split found too few vertices');
  assert.ok(mean(open) > 0.999, `ground in the open measured ${mean(open)}`);
  assert.ok(
    1 - mean(covered) / mean(open) > 0.3,
    `ground under the roof was only ${((1 - mean(covered) / mean(open)) * 100).toFixed(1)}% darker`,
  );
});

test('nothing is baked fully black, however enclosed it is', () => {
  // A crevice that reaches zero reads as a hole punched through the model rather than as shade.
  const vertices = [];
  const normals = [];
  const indices = [];
  const ground = plate(vertices, normals, indices, 0, -4, 4);
  plate(vertices, normals, indices, 0.02, -4, 4);
  const openness = bake(vertices, normals, indices);
  let lowest = 1;
  for (let i = ground; i < ground + 81; i += 1) lowest = Math.min(lowest, openness[i]);
  // The floor is 0.35, compared with a float32 tolerance because that is what stores it.
  assert.ok(lowest >= 0.35 - 1e-6, `the most enclosed vertex reached ${lowest}`);
  assert.ok(lowest < 0.6, `a plate 0.02 below another should be strongly occluded, got ${lowest}`);
});

test('the bake is deterministic, so a rerun does not churn the committed file', () => {
  const vertices = [];
  const normals = [];
  const indices = [];
  plate(vertices, normals, indices, 0, -4, 4);
  plate(vertices, normals, indices, 0.3, -4, 0);
  const first = encodeOpenness(bake(vertices, normals, indices));
  const second = encodeOpenness(bake(vertices, normals, indices));
  assert.deepEqual(first, second, 'two bakes of the same mesh produced different bytes');
  // And the encoding is not throwing the answer away.
  assert.ok(new Set(first).size > 3, 'the encoded bytes carry almost no variation');
});

test('openness survives the byte encoding closely enough to be invisible', () => {
  const values = new Float32Array([0.35, 0.5, 0.75, 0.9, 1]);
  const bytes = encodeOpenness(values);
  for (let i = 0; i < values.length; i += 1) {
    assert.ok(
      Math.abs(bytes[i] / 255 - values[i]) < 1 / 255,
      `${values[i]} round-tripped to ${bytes[i] / 255}`,
    );
  }
});
