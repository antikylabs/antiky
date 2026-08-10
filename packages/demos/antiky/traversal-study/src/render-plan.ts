import { COURSE_HAZARDS, COURSE_PLATFORMS } from './course.ts';
import {
  BACKGROUND_CATALOG_LANDMARKS,
  type EnvironmentAsset,
} from './environment.ts';
import { summarizeTraversalMeasurements } from './measurements.ts';
import { HUD_LABEL_CELL_COUNT } from './visual-layout.ts';

export const TRAVERSAL_PRESENTATION_BUDGET = Object.freeze({
  drawCalls: 18,
  instances: 360,
  uploadBytesPerFrame: 24 * 1024,
});

const routeCount = (asset: 'grass' | 'overhang' | 'moving'): number => (
  COURSE_PLATFORMS.filter((platform) => platform.asset === asset).length
);
const backgroundCount = (asset: EnvironmentAsset): number => (
  BACKGROUND_CATALOG_LANDMARKS.filter((landmark) => landmark.asset === asset).length
);

export const TRAVERSAL_BATCH_CAPACITIES = Object.freeze({
  grass: routeCount('grass'),
  overhang: routeCount('overhang'),
  moving: routeCount('moving'),
  flag: 6,
  coin: 2,
  spikes: COURSE_HAZARDS.length,
  tree: backgroundCount('tree'),
  courier: 1,
  'cloud-small': backgroundCount('cloud-small'),
  'cloud-large': backgroundCount('cloud-large'),
  'coastal-cliff': backgroundCount('coastal-cliff'),
  'coastal-tree': backgroundCount('coastal-tree'),
  'relay-tower': backgroundCount('relay-tower'),
  contactShadow: 1,
  hud: 20 + HUD_LABEL_CELL_COUNT,
  trail: 102,
  effects: 8,
});

export const TRAVERSAL_CATALOG_DRAW_CALLS = Object.freeze({
  grass: 1,
  overhang: 1,
  moving: 1,
  flag: 1,
  coin: 1,
  spikes: 2,
  tree: 1,
  courier: 1,
  'cloud-small': 1,
  'cloud-large': 1,
  'coastal-cliff': 1,
  'coastal-tree': 1,
  'relay-tower': 1,
});

const catalogIds = [
  'grass',
  'overhang',
  'moving',
  'flag',
  'coin',
  'spikes',
  'tree',
  'courier',
  'cloud-small',
  'cloud-large',
  'coastal-cliff',
  'coastal-tree',
  'relay-tower',
] as const;
const surfaceIds = ['contactShadow', 'hud'] as const;
const glowIds = ['trail', 'effects'] as const;

export const TRAVERSAL_PLANNED_MEASUREMENTS = summarizeTraversalMeasurements([
  ...catalogIds.map((id) => ({
    capacity: TRAVERSAL_BATCH_CAPACITIES[id],
    drawCalls: TRAVERSAL_CATALOG_DRAW_CALLS[id],
    uploadBytes: TRAVERSAL_BATCH_CAPACITIES[id] * 36 * TRAVERSAL_CATALOG_DRAW_CALLS[id],
  })),
  ...surfaceIds.map((id) => ({ capacity: TRAVERSAL_BATCH_CAPACITIES[id], drawCalls: 1, uploadBytes: TRAVERSAL_BATCH_CAPACITIES[id] * 48 })),
  ...glowIds.map((id) => ({ capacity: TRAVERSAL_BATCH_CAPACITIES[id], drawCalls: 1, uploadBytes: TRAVERSAL_BATCH_CAPACITIES[id] * 48 })),
]);
