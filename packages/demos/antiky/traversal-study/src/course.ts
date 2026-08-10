export const COURSE_LENGTH = 190;
export const DELIVERY_X = 180;

export type TraversalAct = 1 | 2 | 3;

export type PlatformDefinition = Readonly<{
  id: string;
  label: string;
  act: TraversalAct;
  x: number;
  top: number;
  width: number;
  amplitude: number;
  speed: number;
  phase: number;
  accent: number;
  asset: 'grass' | 'overhang' | 'moving';
}>;

export type HazardDefinition = Readonly<{
  id: string;
  label: string;
  act: TraversalAct;
  x: number;
  top: number;
  width: number;
  collisionHeight?: number;
  supportId?: string;
}>;

export type CheckpointDefinition = Readonly<{
  id: string;
  label: string;
  act: TraversalAct;
  x: number;
}>;

export type CollectibleDefinition = Readonly<{
  id: string;
  label: string;
  act: TraversalAct;
  x: number;
  y: number;
}>;

export type CourseBeatDefinition = Readonly<{
  id: string;
  act: TraversalAct;
  x: number;
  kind: 'risk' | 'traversal' | 'checkpoint' | 'reward' | 'finale' | 'delivery';
}>;

export const COURSE_PLATFORMS: readonly PlatformDefinition[] = Object.freeze([
  { id: 'post-yard', label: 'Gale Post Yard', act: 1, x: 5, top: 0, width: 10, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'grass' },
  { id: 'sail-step', label: 'Sail Step', act: 1, x: 14, top: 0.5, width: 11.5, amplitude: 0, speed: 0, phase: 0.2, accent: 1, asset: 'overhang' },
  { id: 'gull-run', label: 'Gull Run', act: 1, x: 25, top: 0.15, width: 8, amplitude: 0, speed: 0, phase: 0.4, accent: 2, asset: 'grass' },
  { id: 'ochre-rise', label: 'Ochre Rise', act: 1, x: 35, top: 1.05, width: 8, amplitude: 0, speed: 0, phase: 0.6, accent: 1, asset: 'grass' },
  { id: 'bell-drop', label: 'Bell Drop', act: 1, x: 46, top: 0.25, width: 9, amplitude: 0, speed: 0, phase: 0.7, accent: 2, asset: 'grass' },
  { id: 'west-flag', label: 'West Flag Landing', act: 1, x: 58, top: 0.65, width: 10, amplitude: 0, speed: 0, phase: 0.8, accent: 0, asset: 'overhang' },
  { id: 'wind-skip', label: 'Wind Skip', act: 2, x: 69, top: 1.35, width: 7.5, amplitude: 0.28, speed: 1.3, phase: 0.2, accent: 2, asset: 'moving' },
  { id: 'salt-narrows', label: 'Salt Narrows', act: 2, x: 79, top: 0.45, width: 8.5, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
  { id: 'gull-lift', label: 'Gull Lift', act: 2, x: 89, top: 1.45, width: 10, amplitude: 0.38, speed: 1.05, phase: 1.4, accent: 1, asset: 'moving' },
  { id: 'seal-perch', label: 'Courier Seal Perch', act: 2, x: 101, top: 2.25, width: 10, amplitude: 0, speed: 0, phase: 0, accent: 2, asset: 'grass' },
  { id: 'dive-walk', label: 'Dive Walk', act: 2, x: 112, top: 0.65, width: 9, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
  { id: 'east-flag', label: 'East Flag Landing', act: 2, x: 123, top: 1.35, width: 9, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
  { id: 'tower-hop', label: 'Tower Hop', act: 3, x: 133, top: 2.15, width: 9, amplitude: 0, speed: 0, phase: 0, accent: 1, asset: 'grass' },
  { id: 'storm-cut', label: 'Storm Cut', act: 3, x: 144, top: 0.8, width: 7, amplitude: 0.22, speed: 1.5, phase: 2.1, accent: 2, asset: 'moving' },
  { id: 'mast-stairs', label: 'Mast Stairs', act: 3, x: 154, top: 1.55, width: 9, amplitude: 0, speed: 0, phase: 0, accent: 2, asset: 'overhang' },
  { id: 'gate-stair', label: 'Gate Stair', act: 3, x: 164, top: 2.35, width: 7, amplitude: 0, speed: 0, phase: 0, accent: 1, asset: 'grass' },
  { id: 'relay-tower', label: 'Skyline Relay Tower', act: 3, x: 181.5, top: 3, width: 30, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
]);

export const COURSE_HAZARDS: readonly HazardDefinition[] = Object.freeze([
  { id: 'yard-spikes', label: 'Dispatch Spikes', act: 1, x: 8.4, top: 0, width: 0.82, collisionHeight: 0.28 },
  { id: 'gull-spikes', label: 'Gull Run Spikes', act: 1, x: 28.7, top: 0.15, width: 0.78 },
  { id: 'salt-spikes', label: 'Salt Narrows Spikes', act: 2, x: 82.7, top: 0.45, width: 0.82 },
  { id: 'perch-spikes', label: 'Seal Perch Spikes', act: 2, x: 105.6, top: 2.25, width: 0.76 },
  { id: 'storm-spikes', label: 'Storm Cut Spikes', act: 3, x: 147.1, top: 0.8, width: 0.86, supportId: 'storm-cut' },
  { id: 'gate-spikes', label: 'Gate Stair Spikes', act: 3, x: 165.2, top: 2.35, width: 0.82 },
]);

export const COURSE_CHECKPOINTS: readonly CheckpointDefinition[] = Object.freeze([
  { id: 'post-yard-checkpoint', label: 'Gale Post Dispatch', act: 1, x: 2 },
  { id: 'west-flag-checkpoint', label: 'West Flag', act: 2, x: 58 },
  { id: 'east-flag-checkpoint', label: 'East Flag', act: 3, x: 123 },
]);

export const COURSE_COLLECTIBLES: readonly CollectibleDefinition[] = Object.freeze([
  { id: 'courier-seal', label: 'Golden Courier Seal', act: 2, x: 100.3, y: 3.2 },
]);

export const COURSE_BEATS: readonly CourseBeatDefinition[] = Object.freeze([
  { id: 'dispatch-hop-beat', act: 1, x: 8.4, kind: 'risk' },
  { id: 'ochre-rise-beat', act: 1, x: 35, kind: 'traversal' },
  { id: 'west-flag-beat', act: 2, x: 58, kind: 'checkpoint' },
  { id: 'wind-lifts-beat', act: 2, x: 79, kind: 'traversal' },
  { id: 'courier-seal-beat', act: 2, x: 101, kind: 'reward' },
  { id: 'east-flag-beat', act: 3, x: 123, kind: 'checkpoint' },
  { id: 'storm-cut-beat', act: 3, x: 147.1, kind: 'finale' },
  { id: 'gate-stair-beat', act: 3, x: 165.2, kind: 'finale' },
  { id: 'delivery-beat', act: 3, x: DELIVERY_X, kind: 'delivery' },
]);

export function actAt(x: number): TraversalAct {
  if (x < COURSE_CHECKPOINTS[1]!.x) return 1;
  if (x < COURSE_CHECKPOINTS[2]!.x) return 2;
  return 3;
}

export function platformTop(definition: PlatformDefinition, time: number): number {
  return definition.top + Math.sin(time * definition.speed + definition.phase) * definition.amplitude;
}

const PLATFORM_BY_ID = new Map(COURSE_PLATFORMS.map((platform) => [platform.id, platform]));

export function hazardTop(definition: HazardDefinition, time: number): number {
  if (definition.supportId === undefined) return definition.top;
  const support = PLATFORM_BY_ID.get(definition.supportId);
  return support === undefined
    ? definition.top
    : definition.top + platformTop(support, time) - support.top;
}
