import { EXPO_LIGHT_DEFINITIONS } from './lights.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import { RELAY_PARTICLE_CAPACITY, SHADE_COUNT } from './simulation.ts';

export type RenderSlotRange = Readonly<{
  start: number;
  count: number;
  endExclusive: number;
}>;

function createSlotRanges<const Counts extends Readonly<Record<string, number>>>(
  counts: Counts,
): Readonly<{ [Key in keyof Counts]: RenderSlotRange }> {
  let cursor = 0;
  const entries = Object.entries(counts).map(([name, count]) => {
    const range = Object.freeze({ start: cursor, count, endExclusive: cursor + count });
    cursor = range.endExclusive;
    return [name, range] as const;
  });
  return Object.freeze(Object.fromEntries(entries)) as Readonly<{
    [Key in keyof Counts]: RenderSlotRange;
  }>;
}

export function renderSlot(range: RenderSlotRange, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= range.count) {
    throw new RangeError(`Render slot ${index} is outside a range of ${range.count}.`);
  }
  return range.start + index;
}

const RELAY_COUNT = EXPO_LIGHT_DEFINITIONS.length;
const RELAY_IDENTITY_MARKER_COUNT = EXPO_LIGHT_DEFINITIONS.reduce(
  (total, _, index) => total + index + 1,
  0,
);

export const RELAY_VISUAL_COUNTS = Object.freeze({
  relay: RELAY_COUNT,
  shade: SHADE_COUNT,
  particle: RELAY_PARTICLE_CAPACITY,
  integrityMarker: 5,
  chargeMote: 8,
  playerPrismMarker: RELAY_PRESENTATION.playerPrismMarkers.length,
  forgeRing: RELAY_PRESENTATION.forgeRingScales.length,
  terminalRing: RELAY_COUNT,
  relayIdentityMarker: RELAY_IDENTITY_MARKER_COUNT,
  surfaceAmbience: 6,
  ringAmbience: 8,
  glowAmbience: 13,
});

export const RELAY_RENDER_SLOTS = Object.freeze({
  forms: createSlotRanges({
    player: 1,
  }),
  creatures: createSlotRanges({
    shades: SHADE_COUNT,
  }),
  // Contact shadows are their own group because they are drawn unlit and alpha-blended. They used
  // to be the first two ranges of `orbs`, which meant the demo's full PBR material lit them.
  contacts: createSlotRanges({
    player: 1,
    shades: SHADE_COUNT,
  }),
  orbs: createSlotRanges({
    playerCore: 1,
    playerPrismMarkers: RELAY_VISUAL_COUNTS.playerPrismMarker,
    shadeCores: SHADE_COUNT,
    relayCores: RELAY_COUNT,
    forgeCore: 1,
    forgeSockets: RELAY_COUNT,
    relayIdentityMarkers: RELAY_IDENTITY_MARKER_COUNT,
    ambience: RELAY_VISUAL_COUNTS.surfaceAmbience,
  }),
  rings: createSlotRanges({
    relaySafe: RELAY_COUNT,
    relayCharge: RELAY_COUNT,
    forge: RELAY_VISUAL_COUNTS.forgeRing,
    forgeSockets: RELAY_COUNT,
    player: 1,
    shades: SHADE_COUNT,
    terminal: RELAY_VISUAL_COUNTS.terminalRing,
    ambience: RELAY_VISUAL_COUNTS.ringAmbience,
  }),
  glows: createSlotRanges({
    particles: RELAY_PARTICLE_CAPACITY,
    relays: RELAY_COUNT,
    integrity: RELAY_VISUAL_COUNTS.integrityMarker,
    charge: RELAY_VISUAL_COUNTS.chargeMote,
    forgeSockets: RELAY_COUNT,
    shades: SHADE_COUNT,
    ambience: RELAY_VISUAL_COUNTS.glowAmbience,
  }),
  organic: createSlotRanges({
    backArchPillars: 6,
    backArchCrowns: 3,
  }),
  rocks: createSlotRanges({
    relayMassing: RELAY_COUNT * 3,
    forgeMassing: 8,
    ruinClusters: 10,
  }),
  stumps: createSlotRanges({
    relayShrines: RELAY_COUNT,
    forgeHeart: 1,
    ruinAnchors: 4,
  }),
});

function endOf(ranges: Readonly<Record<string, RenderSlotRange>>): number {
  const values = Object.values(ranges);
  return values.at(-1)?.endExclusive ?? 0;
}

const capacities = Object.freeze(Object.fromEntries(
  Object.entries(RELAY_RENDER_SLOTS).map(([name, ranges]) => [name, endOf(ranges)]),
)) as Readonly<Record<keyof typeof RELAY_RENDER_SLOTS, number>>;

export const RELAY_RENDER_PASSES = Object.freeze({
  nonInstanced: Object.freeze({ floor: 1, onboarding: 1, status: 1 }),
  instanced: Object.freeze(Object.keys(RELAY_RENDER_SLOTS)),
});

const nonInstancedCount = Object.values(RELAY_RENDER_PASSES.nonInstanced).reduce(
  (total, count) => total + count,
  0,
);
const instancedCount = Object.values(capacities).reduce((total, count) => total + count, 0);
const dynamicSurfaceInstances = capacities.forms
  + capacities.creatures
  + capacities.orbs
  + capacities.rings;
const surfaceBytesPerInstance = 13 * Float32Array.BYTES_PER_ELEMENT;
// Contact shadows upload offset, scale and colour only: no material, no yaw channel of its own.
const contactBytesPerInstance = 9 * Float32Array.BYTES_PER_ELEMENT;
const glowBytesPerInstance = 10 * Float32Array.BYTES_PER_ELEMENT;

export const RELAY_RENDER_PROFILE = Object.freeze({
  capacities,
  measurements: Object.freeze({
    instances: nonInstancedCount + instancedCount,
    drawCalls: nonInstancedCount + RELAY_RENDER_PASSES.instanced.length,
    uploadBytesPerFrame: dynamicSurfaceInstances * surfaceBytesPerInstance
      + capacities.contacts * contactBytesPerInstance
      + capacities.glows * glowBytesPerInstance,
  }),
});
