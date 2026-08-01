import {
  TOWN_DETAIL_RESOLUTION,
  VOXEL_SIZE,
  buildTownWorld,
} from './town';
import { validateTownDeterminism, validateTownWorld } from './town-validation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const first = buildTownWorld();
const validation = validateTownWorld(first);
assert(validation.valid, validation.errors.join('\n'));
assert(validation.duplicateQuadCount === 0, 'town mesh contains duplicate coincident quads');
assert(first.mesh.stats.coincidentUnitFaceCount === 0, 'town mesh contains duplicate unit faces');

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

export const TOWN_VALIDATION_SNAPSHOT = {
  fingerprint: validation.fingerprint,
  stats: validation.stats,
  maxBridgeRise,
} as const;
