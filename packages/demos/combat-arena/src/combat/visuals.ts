import { ENEMY_HULL_CONTRACTS } from './hulls.ts';
import type { CombatEnemy, CombatSnapshot, EnemyRole, EnemyState } from './state.ts';
import type { Vec3 } from '../render-batches.ts';

export const COMBAT_PALETTE = Object.freeze({
  cyan: [0.045, 0.66, 0.9] as Vec3,
  cyanDeep: [0.018, 0.18, 0.24] as Vec3,
  white: [0.84, 0.91, 1] as Vec3,
  warm: [1, 0.19, 0.035] as Vec3,
  amber: [0.96, 0.48, 0.055] as Vec3,
  steel: [0.22, 0.25, 0.29] as Vec3,
  steelDark: [0.045, 0.052, 0.062] as Vec3,
  shadow: [0.003, 0.005, 0.009] as Vec3,
  /** The near-black the onboarding and defeat cues rule their floor bars in. */
  ink: [0.055, 0.065, 0.075] as Vec3,
});

export type CombatEscalationProfile = Readonly<{
  activeBeacons: number;
  floorEnergy: number;
  hazardEnergy: number;
  structureEnergy: number;
}>;

export type MutableCombatEscalationProfile = {
  activeBeacons: number;
  floorEnergy: number;
  hazardEnergy: number;
  structureEnergy: number;
};

export function projectCombatEscalation(
  state: Pick<CombatSnapshot, 'phase' | 'round' | 'phaseTime' | 'damageTaken'>,
  output: MutableCombatEscalationProfile,
): MutableCombatEscalationProfile {
  if (state.phase === 'intro') {
    const wake = Math.max(0, Math.min(1, 1 - state.phaseTime / 0.85));
    output.activeBeacons = 4 + Math.floor(wake * 3);
    output.floorEnergy = 0.08 + wake * 0.08;
    output.hazardEnergy = 0.025;
    output.structureEnergy = 0.035 + wake * 0.025;
    return output;
  }
  if (state.phase === 'victory') {
    output.activeBeacons = 24;
    output.floorEnergy = 0.5;
    output.hazardEnergy = 0.08;
    output.structureEnergy = 0.2;
    return output;
  }
  if (state.phase === 'defeat') {
    output.activeBeacons = 24;
    output.floorEnergy = 0.06;
    output.hazardEnergy = 0.72;
    output.structureEnergy = 0.05;
    return output;
  }
  const roundStep = Math.max(0, Math.min(2, state.round - 1));
  const clearLift = state.phase === 'clear' ? 0.12 : 0;
  output.activeBeacons = 12 + roundStep * 6;
  output.floorEnergy = 0.24 + roundStep * 0.12 + clearLift;
  output.hazardEnergy = 0.13 + roundStep * 0.2 + Math.min(0.12, state.damageTaken * 0.035);
  output.structureEnergy = 0.08 + roundStep * 0.045 + clearLift;
  return output;
}

export function combatEscalationProfile(
  state: Pick<CombatSnapshot, 'phase' | 'round' | 'phaseTime' | 'damageTaken'>,
): CombatEscalationProfile {
  return Object.freeze(projectCombatEscalation(state, {
    activeBeacons: 0,
    floorEnergy: 0,
    hazardEnergy: 0,
    structureEnergy: 0,
  }));
}

type RoleShape = Readonly<{
  width: number;
  length: number;
  hardpoints: number;
}>;

/**
 * How many emitters a role mounts. This is authored; the hull's width and length are not — they
 * are measured off the shipped GLBs by `scripts/intake-quaternius-ships.mjs` and reach us through
 * `ENEMY_HULL_CONTRACTS[role].span`. They used to be hand-rounded copies here (1.41 against the
 * generated 1.4094126, and so on), which meant a re-intake moved the hulls but left the hit
 * flashes and hardpoint emitters behind.
 */
const ROLE_HARDPOINTS: Readonly<Record<EnemyRole, number>> = Object.freeze({
  rusher: 0,
  gunner: 2,
  'shield-anchor': 2,
  warden: 4,
});

function roleShape(role: EnemyRole): RoleShape {
  const span = ENEMY_HULL_CONTRACTS[role].span;
  return Object.freeze({
    width: span.width,
    length: span.length,
    hardpoints: ROLE_HARDPOINTS[role],
  });
}

function stateEmissive(state: EnemyState): number {
  if (state === 'telegraph') return 0.82;
  if (state === 'attack') return 0.62;
  if (state === 'staggered') return 0.44;
  if (state === 'recovery') return 0.12;
  if (state === 'entry') return 0.18;
  return 0.24;
}

export type EnemyVisualProfile = RoleShape & Readonly<{
  emissive: number;
  tint: Vec3;
}>;

const ENEMY_ROLES: readonly EnemyRole[] = ['rusher', 'gunner', 'shield-anchor', 'warden'];
const ENEMY_STATES: readonly EnemyState[] = [
  'inactive', 'entry', 'tracking', 'telegraph', 'attack', 'recovery', 'staggered', 'defeated',
];
const ROLE_TINTS: Readonly<Record<EnemyRole, Vec3>> = Object.freeze({
  rusher: COMBAT_PALETTE.warm,
  gunner: COMBAT_PALETTE.amber,
  'shield-anchor': [0.76, 0.28, 0.09],
  warden: [0.92, 0.24, 0.035],
});
const ENEMY_VISUAL_PROFILES = {} as Record<EnemyRole, Record<EnemyState, EnemyVisualProfile>>;
for (const role of ENEMY_ROLES) {
  const states = {} as Record<EnemyState, EnemyVisualProfile>;
  for (const state of ENEMY_STATES) {
    states[state] = Object.freeze({
      ...roleShape(role),
      emissive: stateEmissive(state),
      tint: ROLE_TINTS[role],
    });
  }
  ENEMY_VISUAL_PROFILES[role] = states;
}

export function enemyVisualProfile(enemy: Pick<CombatEnemy, 'role' | 'state'>): EnemyVisualProfile {
  return ENEMY_VISUAL_PROFILES[enemy.role][enemy.state];
}
