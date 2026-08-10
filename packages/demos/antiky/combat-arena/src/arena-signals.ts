import type { CombatSnapshot } from './combat-state.ts';
import type { GlowBatch, SurfaceBatch, Vec3 } from './render-batches.ts';

const CYAN: Vec3 = [0.08, 0.72, 0.92];
const WHITE: Vec3 = [0.82, 0.9, 1];
const WARM: Vec3 = [1, 0.24, 0.07];
const DARK: Vec3 = [0.055, 0.065, 0.075];
const GAUGE_START = 28;
const RING_START = 24;

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

function onboarding(gauges: SurfaceBatch, rings: GlowBatch, time: number): void {
  // Two floor-read rows: a compact cyan cannon pulse marks the first target,
  // then a long white blade arrow crosses the second marked target.
  gauges.set(GAUGE_START, [-2.3, 0.1, -2.55], [0.42, 0.045, 0.08], CYAN, [0.3, 0, 0]);
  gauges.set(GAUGE_START + 1, [-1.72, 0.1, -2.55], [0.22, 0.025, 0.035], CYAN, [0.2, 0, 0]);
  gauges.set(GAUGE_START + 2, [-1.22, 0.1, -2.55], [0.17, 0.07, 0.17], WHITE, [0.34, 0, 0]);
  gauges.set(GAUGE_START + 3, [-0.35, 0.1, -1.55], [1.25, 0.04, 0.055], WHITE, [0.34, 0, 0]);
  gauges.set(GAUGE_START + 4, [0.78, 0.1, -1.78], [0.42, 0.04, 0.055], WHITE, [0.34, 0, -0.58]);
  gauges.set(GAUGE_START + 5, [0.78, 0.1, -1.32], [0.42, 0.04, 0.055], WHITE, [0.34, 0, 0.58]);
  gauges.set(GAUGE_START + 6, [1.3, 0.1, -1.55], [0.19, 0.07, 0.19], WARM, [0.26, 0, 0]);
  gauges.set(GAUGE_START + 7, [-0.45, 0.08, -2.05], [0.035, 0.025, 0.35], DARK, [0, 0, 0]);
  rings.set(RING_START, [-1.22, 0.035, -2.55], [0.4, 0.4, 0.4], CYAN, 0.62, 0, time);
  rings.set(RING_START + 1, [1.3, 0.035, -1.55], [0.44, 0.44, 0.44], CYAN, 0.7, 0, time + 1.2);
}

function retryCue(
  gauges: SurfaceBatch,
  rings: GlowBatch,
  color: Vec3,
  time: number,
): void {
  rings.set(RING_START + 1, [0, 0.04, 2.25], [0.72, 0.72, 0.72], WHITE, 0.62, 0, time);
  rings.set(RING_START + 2, [0, 0.045, 2.25], [0.45, 0.45, 0.45], color, 0.26, 0, time + 0.9);
  gauges.set(GAUGE_START + 5, [0.57, 0.1, 1.93], [0.34, 0.055, 0.075], WHITE, [0.36, 0, -0.62]);
  gauges.set(GAUGE_START + 6, [0.72, 0.1, 2.3], [0.34, 0.055, 0.075], WHITE, [0.36, 0, 0.55]);
  gauges.set(GAUGE_START + 7, [0, 0.08, 2.25], [0.13, 0.045, 0.13], color, [0.24, 0, 0]);
}

function victory(gauges: SurfaceBatch, rings: GlowBatch, time: number): void {
  gauges.set(GAUGE_START, [-0.46, 0.13, -0.1], [0.72, 0.065, 0.1], CYAN, [0.4, 0, 0.68]);
  gauges.set(GAUGE_START + 1, [0.46, 0.13, -0.1], [0.72, 0.065, 0.1], WHITE, [0.4, 0, -0.68]);
  gauges.set(GAUGE_START + 2, [0, 0.12, -0.88], [0.48, 0.05, 0.08], WHITE, [0.35, 0, 0]);
  rings.set(RING_START, [0, 0.035, -0.1], [1.3, 1.3, 1.3], CYAN, 0.36, 0, time);
  retryCue(gauges, rings, CYAN, time);
}

function defeat(gauges: SurfaceBatch, rings: GlowBatch, time: number): void {
  gauges.set(GAUGE_START, [0, 0.13, -0.25], [1.0, 0.07, 0.11], WARM, [0.34, 0, 0.7]);
  gauges.set(GAUGE_START + 1, [0, 0.13, -0.25], [1.0, 0.07, 0.11], WARM, [0.34, 0, -0.7]);
  gauges.set(GAUGE_START + 2, [-0.72, 0.09, -1.15], [0.24, 0.06, 0.15], DARK, [0, 0, 0]);
  gauges.set(GAUGE_START + 3, [0, 0.09, -1.15], [0.24, 0.06, 0.15], DARK, [0, 0, 0]);
  gauges.set(GAUGE_START + 4, [0.72, 0.09, -1.15], [0.24, 0.06, 0.15], DARK, [0, 0, 0]);
  retryCue(gauges, rings, WARM, time);
}

export function setCombatSignals(
  gauges: SurfaceBatch,
  rings: GlowBatch,
  state: CombatSnapshot,
): void {
  const mode = combatSignalMode(state);
  if (mode === 'mark-then-dash') onboarding(gauges, rings, state.time);
  else if (mode === 'victory-retry') victory(gauges, rings, state.time);
  else if (mode === 'defeat-retry') defeat(gauges, rings, state.time);
}
