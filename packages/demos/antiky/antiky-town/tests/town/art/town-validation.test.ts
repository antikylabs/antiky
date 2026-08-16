import { test } from 'vitest';
import {
  TOWN_DETAIL_RESOLUTION,
  VOXEL_SIZE,
  buildTownWorld,
  townGroundHeightAt,
  townGroundKindAt,
} from '../../../src/town/art/town.ts';
import { validateTownDeterminism, validateTownWorld } from '../../../src/town/art/town-validation.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * This test builds the whole town twice, because that is what proves determinism — one build cannot
 * disagree with itself. Two builds cost about 4.5 seconds on an idle machine, against vitest's
 * default 5 second timeout, so the margin was roughly half a second and the test failed whenever
 * anything else was running. Raised well clear of the real cost: a slow machine should make this
 * test slow, not red.
 *
 * If it ever approaches this budget, the fix is to make `buildTownWorld` faster rather than to raise
 * the number again.
 */
const BUILD_TWICE_TIMEOUT_MS = 30_000;

test('the town stays valid and deterministic', () => {
  const first = buildTownWorld();
  const validation = validateTownWorld(first);
  assert(validation.valid, validation.errors.join('\n'));
  assert(validation.duplicateQuadCount === 0, 'town mesh contains duplicate coincident quads');
  assert(first.mesh.stats.coincidentUnitFaceCount === 0, 'town mesh contains duplicate unit faces');
  assert(first.canWalk(first.spawn[0], first.spawn[1]), 'bridge-crown spawn is not walkable');
  assert(first.vegetation.length > 500, 'renderer vegetation metadata is too sparse');
  for (const type of ['grass', 'flower', 'reeds', 'ivy', 'shrub', 'tree-trunk', 'tree-crown'] as const) {
    assert(first.vegetation.some((item) => item.type === type), `missing renderer vegetation type: ${type}`);
  }
  assert(first.awnings.length === 3, 'renderer awning contract must contain the three market canopies');
  for (const style of ['red-cream', 'blue-cream', 'gold-cream'] as const) {
    assert(first.awnings.some((awning) => awning.style === style), `missing renderer awning style: ${style}`);
  }
  assert(first.spriteProps.length === 14, 'bent sprite-prop contract must contain fourteen placements');
  for (const type of [
    'barrel', 'open-chest', 'closed-chest', 'open-book',
    'book-stack', 'map-kit', 'produce-basket', 'crate',
  ] as const) {
    assert(first.spriteProps.some((prop) => prop.type === type), `missing bent sprite prop type: ${type}`);
  }
  assert(first.waterfall.topY > first.waterfall.bottomY, 'waterfall renderer hook has no vertical drop');

  const second = buildTownWorld();
  const deterministicErrors = validateTownDeterminism(first, second);
  assert(deterministicErrors.length === 0, deterministicErrors.join('\n'));

  // Sample every bridge tread at its center and keep the physical rise beneath
  // the 0.30 m character-motor step gate.
  const bridgeStart = 11 - 0.5;
  const bridgeFineSteps = 8 * TOWN_DETAIL_RESOLUTION;
  const bridgeHeights = Array.from({ length: bridgeFineSteps }, (_, step) => {
    const gridZ = bridgeStart + (step + 0.5) / TOWN_DETAIL_RESOLUTION;
    return first.walkSurfaceHeight(0, gridZ * VOXEL_SIZE);
  });
  const maxBridgeRise = Math.max(
    ...bridgeHeights.slice(1).map((height, index) => Math.abs(height - bridgeHeights[index]!)),
  );
  assert(maxBridgeRise <= VOXEL_SIZE / TOWN_DETAIL_RESOLUTION + 1e-6, 'bridge rise exceeds one detail cell');
  assert(maxBridgeRise < 0.3, 'bridge rise exceeds the character-motor step gate');
}, BUILD_TWICE_TIMEOUT_MS);

test('no prop is left standing on the canal', () => {
  // `groundHeightGrid` has no canal case: over open water it falls through to 0, which reads as
  // "ground at height zero" rather than "there is no ground here". A prop placed through it over
  // the canal therefore hovers above the water instead of failing loudly.
  // "Over the canal and not on the bridge". `canWalk` alone is too strict — it is also false
  // wherever a collider sits, and a barrel resting against a market stall is exactly right.
  const world = buildTownWorld();
  const floating = world.spriteProps.filter((prop) => (
    townGroundKindAt(prop.x / VOXEL_SIZE, prop.z / VOXEL_SIZE) === 'canal'
    && !world.canWalk(prop.x, prop.z)
  ));
  assert(
    floating.length === 0,
    floating.map((prop) => (
      `${prop.type} at grid (${(prop.x / VOXEL_SIZE).toFixed(1)}, ${(prop.z / VOXEL_SIZE).toFixed(1)})`
      + ` stands on nothing, at y=${prop.y.toFixed(2)}`
    )).join('\n'),
  );
});

test('every prop rests on the surface the courier walks on', () => {
  // The bug this replaces: object placement read the macro voxel column height and added half a
  // cell, which is the surface everywhere the ground is one cell tall and wrong on the bridge,
  // where the walking surface is the finer tread lattice — up to 1.03 m out. Nothing was standing
  // on the bridge yet, so it was a landmine rather than a visible fault. This asserts the outcome
  // instead of the arithmetic: wherever a prop is, it touches the ground the character motor uses.
  const world = buildTownWorld();
  const tolerance = VOXEL_SIZE / TOWN_DETAIL_RESOLUTION + 1e-6;
  const floating = world.spriteProps
    .map((prop) => ({ prop, walk: world.walkSurfaceHeight(prop.x, prop.z) }))
    .filter(({ prop, walk }) => Math.abs(prop.y - walk) > tolerance);
  assert(
    floating.length === 0,
    floating.map(({ prop, walk }) => (
      `${prop.type} sits at y=${prop.y.toFixed(3)} but the ground there is ${walk.toFixed(3)}`
    )).join('\n'),
  );
});
