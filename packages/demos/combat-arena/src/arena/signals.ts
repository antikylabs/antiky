import type { CombatSnapshot } from '../combat/state.ts';
import { COMBAT_PALETTE } from '../combat/visuals.ts';
import type { GlowBatch, SurfaceBatch, Vec3 } from '../render-batches.ts';

const { cyan: CYAN, white: WHITE, warm: WARM, ink: DARK } = COMBAT_PALETTE;
type SignalOffsets = Readonly<{ gauge: number; ring: number }>;

function surface(
  gauges: SurfaceBatch,
  index: number,
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  color: Vec3,
  emissive: number, rotation = 0,
): void {
  gauges.setValues(index, x, y, z, sx, sy, sz, color[0], color[1], color[2], emissive, 0, rotation);
}

function ring(
  rings: GlowBatch,
  index: number,
  x: number, y: number, z: number,
  scale: number,
  color: Vec3,
  alpha: number,
  time: number,
): void {
  rings.setValues(index, x, y, z, scale, scale, scale, color[0], color[1], color[2], alpha, 0, time);
}

export type CombatSignalMode = 'mark-then-dash' | 'victory-retry' | 'defeat-retry' | 'none';

export function combatSignalMode(state: CombatSnapshot): CombatSignalMode {
  if (state.phase === 'victory') return 'victory-retry';
  if (state.phase === 'defeat') return 'defeat-retry';
  if (state.phase === 'intro') return 'mark-then-dash';
  if (state.phase === 'combat' && state.round === 1 && state.score === 0 && state.dashes === 0) {
    return 'mark-then-dash';
  }
  return 'none';
}

function onboarding(
  gauges: SurfaceBatch,
  rings: GlowBatch,
  time: number,
  offsets: SignalOffsets,
): void {
  // Two floor-read rows: a compact cyan cannon pulse marks the first target,
  // then a long white blade arrow crosses the second marked target.
  surface(gauges, offsets.gauge, -2.3, 0.1, -2.55, 0.42, 0.045, 0.08, CYAN, 0.3);
  surface(gauges, offsets.gauge + 1, -1.72, 0.1, -2.55, 0.22, 0.025, 0.035, CYAN, 0.2);
  surface(gauges, offsets.gauge + 2, -1.22, 0.1, -2.55, 0.17, 0.07, 0.17, WHITE, 0.34);
  surface(gauges, offsets.gauge + 3, -0.35, 0.1, -1.55, 1.25, 0.04, 0.055, WHITE, 0.34);
  surface(gauges, offsets.gauge + 4, 0.78, 0.1, -1.78, 0.42, 0.04, 0.055, WHITE, 0.34, -0.58);
  surface(gauges, offsets.gauge + 5, 0.78, 0.1, -1.32, 0.42, 0.04, 0.055, WHITE, 0.34, 0.58);
  surface(gauges, offsets.gauge + 6, 1.3, 0.1, -1.55, 0.19, 0.07, 0.19, WARM, 0.26);
  surface(gauges, offsets.gauge + 7, -0.45, 0.08, -2.05, 0.035, 0.025, 0.35, DARK, 0);
  ring(rings, offsets.ring, -1.22, 0.035, -2.55, 0.4, CYAN, 0.62, time);
  ring(rings, offsets.ring + 1, 1.3, 0.035, -1.55, 0.44, CYAN, 0.7, time + 1.2);
}

function retryCue(
  gauges: SurfaceBatch,
  rings: GlowBatch,
  color: Vec3,
  time: number,
  offsets: SignalOffsets,
): void {
  ring(rings, offsets.ring + 1, 0, 0.04, 2.25, 0.72, WHITE, 0.62, time);
  ring(rings, offsets.ring + 2, 0, 0.045, 2.25, 0.45, color, 0.26, time + 0.9);
  surface(gauges, offsets.gauge + 5, 0.57, 0.1, 1.93, 0.34, 0.055, 0.075, WHITE, 0.36, -0.62);
  surface(gauges, offsets.gauge + 6, 0.72, 0.1, 2.3, 0.34, 0.055, 0.075, WHITE, 0.36, 0.55);
  surface(gauges, offsets.gauge + 7, 0, 0.08, 2.25, 0.13, 0.045, 0.13, color, 0.24);
}

function victory(gauges: SurfaceBatch, rings: GlowBatch, time: number, offsets: SignalOffsets): void {
  surface(gauges, offsets.gauge, -0.46, 0.13, -0.1, 0.72, 0.065, 0.1, CYAN, 0.4, 0.68);
  surface(gauges, offsets.gauge + 1, 0.46, 0.13, -0.1, 0.72, 0.065, 0.1, WHITE, 0.4, -0.68);
  surface(gauges, offsets.gauge + 2, 0, 0.12, -0.88, 0.48, 0.05, 0.08, WHITE, 0.35);
  ring(rings, offsets.ring, 0, 0.035, -0.1, 1.3, CYAN, 0.36, time);
  retryCue(gauges, rings, CYAN, time, offsets);
}

function defeat(gauges: SurfaceBatch, rings: GlowBatch, time: number, offsets: SignalOffsets): void {
  surface(gauges, offsets.gauge, 0, 0.13, -0.25, 1, 0.07, 0.11, WARM, 0.34, 0.7);
  surface(gauges, offsets.gauge + 1, 0, 0.13, -0.25, 1, 0.07, 0.11, WARM, 0.34, -0.7);
  surface(gauges, offsets.gauge + 2, -0.72, 0.09, -1.15, 0.24, 0.06, 0.15, DARK, 0);
  surface(gauges, offsets.gauge + 3, 0, 0.09, -1.15, 0.24, 0.06, 0.15, DARK, 0);
  surface(gauges, offsets.gauge + 4, 0.72, 0.09, -1.15, 0.24, 0.06, 0.15, DARK, 0);
  retryCue(gauges, rings, WARM, time, offsets);
}

export function setCombatSignals(
  gauges: SurfaceBatch,
  rings: GlowBatch,
  state: CombatSnapshot,
  offsets: SignalOffsets,
): void {
  const mode = combatSignalMode(state);
  if (mode === 'mark-then-dash') onboarding(gauges, rings, state.time, offsets);
  else if (mode === 'victory-retry') victory(gauges, rings, state.time, offsets);
  else if (mode === 'defeat-retry') defeat(gauges, rings, state.time, offsets);
}
