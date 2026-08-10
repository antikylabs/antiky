export const COURSE_LENGTH = 170;
export const DELIVERY_X = 166;

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

export const COURSE_PLATFORMS: readonly PlatformDefinition[] = Object.freeze([
  { id: 'post-yard', label: 'Gale Post Yard', act: 1, x: 7.5, top: 0, width: 15, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'grass' },
  { id: 'chalk-step', label: 'Chalk Step', act: 1, x: 21, top: 0.35, width: 10, amplitude: 0, speed: 0, phase: 0.2, accent: 1, asset: 'grass' },
  { id: 'bell-ledge', label: 'Bell Ledge', act: 1, x: 32, top: 0.85, width: 10, amplitude: 0, speed: 0, phase: 0.4, accent: 2, asset: 'overhang' },
  { id: 'clay-walk', label: 'Clay Walk', act: 1, x: 43.5, top: 0.35, width: 11, amplitude: 0, speed: 0, phase: 0.6, accent: 1, asset: 'grass' },
  { id: 'west-flag', label: 'West Flag Landing', act: 1, x: 55, top: 1.05, width: 11, amplitude: 0, speed: 0, phase: 0.8, accent: 0, asset: 'overhang' },
  { id: 'wind-lift', label: 'Wind Lift', act: 2, x: 66.5, top: 1.5, width: 10, amplitude: 0.3, speed: 1, phase: 0.2, accent: 2, asset: 'moving' },
  { id: 'salt-bridge', label: 'Salt Bridge', act: 2, x: 78, top: 0.8, width: 11, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
  { id: 'gull-lift', label: 'Gull Lift', act: 2, x: 89.5, top: 1.45, width: 10, amplitude: 0.28, speed: 0.82, phase: 1.4, accent: 1, asset: 'moving' },
  { id: 'seal-perch', label: 'Courier Seal Perch', act: 2, x: 101.5, top: 1.1, width: 11, amplitude: 0, speed: 0, phase: 0, accent: 2, asset: 'grass' },
  { id: 'east-flag', label: 'East Flag Landing', act: 2, x: 113, top: 1.6, width: 11, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
  { id: 'tower-stair', label: 'Tower Stair', act: 3, x: 124.5, top: 2.2, width: 10, amplitude: 0, speed: 0, phase: 0, accent: 1, asset: 'grass' },
  { id: 'storm-shelf', label: 'Storm Shelf', act: 3, x: 136, top: 1.4, width: 11, amplitude: 0, speed: 0, phase: 0, accent: 2, asset: 'overhang' },
  { id: 'gate-approach', label: 'Gate Approach', act: 3, x: 148, top: 2.25, width: 11, amplitude: 0, speed: 0, phase: 0, accent: 1, asset: 'grass' },
  { id: 'relay-tower', label: 'Skyline Relay Tower', act: 3, x: 162, top: 2.8, width: 17, amplitude: 0, speed: 0, phase: 0, accent: 0, asset: 'overhang' },
]);

export const COURSE_HAZARDS: readonly HazardDefinition[] = Object.freeze([
  { id: 'yard-spikes', label: 'Yard Spikes', act: 1, x: 11, top: 0, width: 0.72 },
  { id: 'salt-spikes', label: 'Salt Bridge Spikes', act: 2, x: 80, top: 0.8, width: 0.72 },
  { id: 'storm-spikes', label: 'Storm Shelf Spikes', act: 3, x: 137, top: 1.4, width: 0.78 },
  { id: 'gate-spikes', label: 'Gate Approach Spikes', act: 3, x: 150.5, top: 2.25, width: 0.72 },
]);

export const COURSE_CHECKPOINTS: readonly CheckpointDefinition[] = Object.freeze([
  { id: 'post-yard-checkpoint', label: 'Gale Post Dispatch', act: 1, x: 2 },
  { id: 'west-flag-checkpoint', label: 'West Flag', act: 2, x: 55 },
  { id: 'east-flag-checkpoint', label: 'East Flag', act: 3, x: 113 },
]);

export const COURSE_COLLECTIBLES: readonly CollectibleDefinition[] = Object.freeze([
  { id: 'courier-seal', label: 'Golden Courier Seal', act: 2, x: 101.5, y: 1.72 },
]);

export function actAt(x: number): TraversalAct {
  if (x < COURSE_CHECKPOINTS[1]!.x) return 1;
  if (x < COURSE_CHECKPOINTS[2]!.x) return 2;
  return 3;
}

export function platformTop(definition: PlatformDefinition, time: number): number {
  return definition.top + Math.sin(time * definition.speed + definition.phase) * definition.amplitude;
}
