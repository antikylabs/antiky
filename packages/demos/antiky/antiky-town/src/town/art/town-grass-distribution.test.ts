import assert from 'node:assert/strict';
import { test } from 'vitest';

import { TOWN_TREE_PLACEMENTS, TOWN_TREE_SPECIES, VOXEL_SIZE, buildTownWorld, townGroundKindAt, townGroundHeightAt } from './town.ts';

/**
 * Goal 08's grass placement contract, measured over the generated instance list — no rendering.
 * The owner's word for the old field was "horrid", and the mechanical cause was placement: a 2 m
 * lattice with 16% dropout and no sub-cell jitter, which the eye reads as a stamped grid. These
 * tests are the definition of "no longer a lattice", and they were written against the lattice
 * first to watch them fail.
 */

const world = buildTownWorld();
const CANAL_BANK_NEAR = 11 - 0.35;
const CANAL_BANK_FAR = 18 + 0.35;
const VOXEL = VOXEL_SIZE;

/** The meadow population: blades in the open field, excluding the authored canal-bank reed rows. */
const meadow = world.vegetation.filter((plant) => {
  if (plant.type !== 'grass' && plant.type !== 'reeds') return false;
  const gz = plant.z / VOXEL;
  if (plant.type === 'reeds' && (Math.abs(gz - CANAL_BANK_NEAR) < 0.2 || Math.abs(gz - CANAL_BANK_FAR) < 0.2)) {
    return false;
  }
  return true;
});

test('the meadow is a real population, with both blade variants present', () => {
  assert.ok(meadow.length >= 250, `only ${meadow.length} blades`);
  const tall = meadow.filter((plant) => plant.type === 'reeds').length;
  assert.ok(tall >= 12, `only ${tall} tall blades — the meadow has no profile`);
  assert.ok(tall <= meadow.length * 0.4, 'the tall variant should season the meadow, not replace it');
});

test('nearest-neighbour spacing is clustered, not a lattice', () => {
  // A jittered lattice has nearly constant nearest-neighbour distance: its coefficient of
  // variation sits near zero. Clustered placement has tight cores and open gaps.
  const distances = meadow.map((plant) => {
    let nearest = Infinity;
    for (const other of meadow) {
      if (other === plant) continue;
      const d = Math.hypot(other.x - plant.x, other.z - plant.z);
      if (d < nearest) nearest = d;
    }
    return nearest;
  });
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const sd = Math.sqrt(distances.reduce((a, b) => a + (b - mean) ** 2, 0) / distances.length);
  const cv = sd / mean;
  assert.ok(cv >= 0.45, `nearest-neighbour CV ${cv.toFixed(3)} — a jittered lattice scores near zero`);

  // Not unimodal: the histogram carries more than one peak (tight in-patch spacing and wide
  // between-patch spacing) with a real valley between them.
  const bins = new Array(12).fill(0);
  const cap = mean + sd * 2.5;
  for (const d of distances) bins[Math.min(11, Math.floor(d / cap * 12))] += 1;
  const peaks = [];
  for (let i = 0; i < 12; i += 1) {
    const left = bins[i - 1] ?? -1;
    const right = bins[i + 1] ?? -1;
    // The goal's wording is "not unimodal", with no peak-size floor of its own. A secondary mode
    // in a clustered field is genuinely small — isolated between-patch spacing — so the floor here
    // is sized to reject single-blade noise (a handful of instances) without demanding the tail
    // rival the in-patch mode.
    if (bins[i] > left && bins[i] >= right && bins[i] >= Math.max(4, meadow.length * 0.008)) peaks.push(i);
  }
  assert.ok(peaks.length >= 2, `nearest-neighbour histogram is unimodal: ${bins.join(',')}`);
});

test('no repeated stamp: identical (scale, yaw, type) triples stay rare', () => {
  const counts = new Map<string, number>();
  for (const plant of meadow) {
    const key = `${plant.scale.toFixed(3)}|${plant.yaw.toFixed(3)}|${plant.type}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const largest = Math.max(...counts.values());
  assert.ok(
    largest <= Math.max(2, meadow.length * 0.02),
    `${largest} blades share one exact (scale, yaw, type) stamp`,
  );
});

test('blade scale spans a real range', () => {
  const scales = meadow.map((plant) => plant.scale).sort((a, b) => a - b);
  const p10 = scales[Math.floor(scales.length * 0.1)]!;
  const p90 = scales[Math.floor(scales.length * 0.9)]!;
  assert.ok(p90 / p10 >= 2, `scale p90/p10 is ${(p90 / p10).toFixed(2)}, under 2:1`);
});

test('grass collects on flats, not on berm faces', () => {
  let steep = 0;
  for (const plant of meadow) {
    const gx = Math.round(plant.x / VOXEL);
    const gz = Math.round(plant.z / VOXEL);
    const here = townGroundHeightAt(gx, gz);
    const steepest = Math.max(
      Math.abs(townGroundHeightAt(gx + 1, gz) - here),
      Math.abs(townGroundHeightAt(gx - 1, gz) - here),
      Math.abs(townGroundHeightAt(gx, gz + 1) - here),
      Math.abs(townGroundHeightAt(gx, gz - 1) - here),
    );
    if (steepest > 0.9) steep += 1;
  }
  assert.ok(
    steep <= meadow.length * 0.1,
    `${steep} of ${meadow.length} blades sit on steep faces, over the 10% bound`,
  );
});

test('the field feathers toward pavement instead of stopping at it', () => {
  const rings = [0, 0, 0];
  const ringCells = [0, 0, 0];
  // Count blades per cell-ring distance from pavement, normalised by how many open cells sit in
  // each ring, so the comparison is density rather than raw count.
  const cellBlades = new Map<string, number>();
  for (const plant of meadow) {
    const key = `${Math.round(plant.x / VOXEL)}|${Math.round(plant.z / VOXEL)}`;
    cellBlades.set(key, (cellBlades.get(key) ?? 0) + 1);
  }
  for (let gz = -34; gz <= 32; gz += 1) {
    for (let gx = -44; gx <= 44; gx += 1) {
      if (townGroundKindAt(gx, gz) !== 'open') continue;
      const pavedAt = (dx: number, dz: number) => townGroundKindAt(gx + dx, gz + dz) === 'paved';
      const ring = (pavedAt(1, 0) || pavedAt(-1, 0) || pavedAt(0, 1) || pavedAt(0, -1)) ? 0
        : (pavedAt(2, 0) || pavedAt(-2, 0) || pavedAt(0, 2) || pavedAt(0, -2)) ? 1
          : 2;
      ringCells[ring] = ringCells[ring]! + 1;
      rings[ring] = rings[ring]! + (cellBlades.get(`${gx}|${gz}`) ?? 0);
    }
  }
  const density = rings.map((count, ring) => count / Math.max(1, ringCells[ring]!));
  assert.ok(
    density[0]! <= density[2]! * 0.5,
    `density beside pavement ${density[0]!.toFixed(3)} is over half the open-field ${density[2]!.toFixed(3)}`,
  );
  assert.ok(
    density[0]! <= density[1]! && density[1]! <= density[2]! * 1.15,
    `feathering is not monotonic: ${density.map((d) => d.toFixed(3)).join(' -> ')}`,
  );
});

test('every paved, canal and collider exclusion still holds', () => {
  for (const plant of meadow) {
    const gx = Math.round(plant.x / VOXEL);
    const gz = Math.round(plant.z / VOXEL);
    assert.equal(
      townGroundKindAt(gx, gz),
      'open',
      `a blade stands on ${townGroundKindAt(gx, gz)} ground at grid (${gx}, ${gz})`,
    );
  }
});

test('every tree resolves to a declared species, and the species set is the table', () => {
  const declared = new Set(Object.keys(TOWN_TREE_SPECIES));
  const used = new Set<string>();
  for (const [, , , species] of TOWN_TREE_PLACEMENTS) {
    assert.ok(declared.has(species), `undeclared species ${species}`);
    used.add(species);
  }
  // The ridge sentinel lives on the skyline, not among the near placements — near trees use the
  // two broadleaf dresses, and the distant rows are authored separately with the sentinel.
  assert.ok(used.has('green-round') && used.has('autumn-round'), 'a broadleaf dress went unused');
  assert.equal(declared.size, 3, 'the species table changed size without this test hearing about it');
  assert.ok(TOWN_TREE_PLACEMENTS.length >= 16, `only ${TOWN_TREE_PLACEMENTS.length} near trees`);
});
