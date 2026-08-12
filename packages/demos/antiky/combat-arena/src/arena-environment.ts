import { projectCombatEscalation, COMBAT_PALETTE, type MutableCombatEscalationProfile } from './combat-visuals.ts';
import type { CombatSnapshot } from './combat-state.ts';
import type { GlowBatch, SurfaceBatch } from './render-batches.ts';

export const ARENA_STRUCTURE_INSTANCES = 25;
export const ARENA_ENVIRONMENT_LAYERS = 3;
const STRUCTURE_LIGHT = [0.25, 0.27, 0.3] as const;
const STRUCTURE_DARK = [0.105, 0.12, 0.14] as const;
const STRUCTURE_BEAM = [0.18, 0.2, 0.23] as const;
const escalation: MutableCombatEscalationProfile = {
  activeBeacons: 0,
  floorEnergy: 0,
  hazardEnergy: 0,
  structureEnergy: 0,
};

export function setArenaStructure(structure: SurfaceBatch, start = 0): number {
  let index = start;
  for (let segment = 0; segment < 16; segment += 1) {
    const angle = segment / 16 * Math.PI * 2;
    const color = segment % 4 === 0 ? STRUCTURE_LIGHT : STRUCTURE_DARK;
    structure.setValues(
      index,
      Math.cos(angle) * 8.88, 0.94, Math.sin(angle) * 8.88,
      0.22, 0.74 + (segment % 3) * 0.12, 0.78,
      color[0], color[1], color[2],
      segment % 4 === 0 ? 0.025 : 0.008, 0, angle,
    );
    index += 1;
  }
  for (let beam = 0; beam < 9; beam += 1) {
    const angle = beam / 9 * Math.PI * 2 + Math.PI / 9;
    structure.setValues(
      index,
      Math.cos(angle) * 8.34, 1.22, Math.sin(angle) * 8.34,
      1.12, 0.08, 0.11,
      STRUCTURE_BEAM[0], STRUCTURE_BEAM[1], STRUCTURE_BEAM[2],
      0.018, 0, angle + Math.PI / 2,
    );
    index += 1;
  }
  return index;
}

export function setArenaEnergy(
  lights: GlowBatch,
  start: number,
  state: CombatSnapshot,
): number {
  projectCombatEscalation(state, escalation);
  let index = start;
  for (let beacon = 0; beacon < escalation.activeBeacons; beacon += 1) {
    const angle = beacon / 24 * Math.PI * 2 + Math.PI / 24;
    const danger = state.round > 1 && beacon % Math.max(2, 5 - state.round) === 0;
    const color = state.phase === 'defeat'
      ? COMBAT_PALETTE.warm
      : state.phase === 'victory'
        ? COMBAT_PALETTE.white
        : danger
          ? COMBAT_PALETTE.amber
          : COMBAT_PALETTE.cyan;
    lights.setValues(
      index,
      Math.cos(angle) * 8.12, 0.11 + (beacon % 2) * 0.16, Math.sin(angle) * 8.12,
      0.055, 0.055, 0.2,
      color[0], color[1], color[2],
      0.32 + escalation.structureEnergy,
      angle,
      beacon * 0.31,
    );
    index += 1;
  }
  for (let lane = 0; lane < 8; lane += 1) {
    const angle = lane / 8 * Math.PI * 2;
    lights.setValues(
      index,
      Math.cos(angle) * 4.7, -0.015, Math.sin(angle) * 4.7,
      0.035, 0.018, 1.25,
      COMBAT_PALETTE.cyan[0], COMBAT_PALETTE.cyan[1], COMBAT_PALETTE.cyan[2],
      escalation.floorEnergy * (lane % 2 === 0 ? 0.7 : 0.42),
      angle,
      lane * 0.43,
    );
    index += 1;
  }
  for (let hazard = 0; hazard < 4; hazard += 1) {
    const angle = hazard / 4 * Math.PI * 2 + Math.PI / 4;
    const color = state.phase === 'victory' ? COMBAT_PALETTE.white : COMBAT_PALETTE.warm;
    lights.setValues(
      index,
      Math.cos(angle) * 7.22, 0.015, Math.sin(angle) * 7.22,
      0.045, 0.02, 0.72,
      color[0], color[1], color[2],
      escalation.hazardEnergy * 0.78,
      angle + Math.PI / 2,
      hazard * 0.71,
    );
    index += 1;
  }
  return index;
}
