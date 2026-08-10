import type { EnemyRole } from './combat-state.ts';
import { SHIP_FOOTPRINTS } from './ship-footprints.gen.ts';

type HullPresentationProfile = Readonly<{
  x: number;
  y: number;
  z: number;
  offsetY: number;
}>;

type HullSpan = Readonly<{
  width: number;
  length: number;
}>;

type HullContract = Readonly<{
  presentation: HullPresentationProfile;
  span: HullSpan;
  projectileRadius: number;
  bladeRadius: number;
  chargeRadius: number;
}>;

type DerivedFootprint = (typeof SHIP_FOOTPRINTS.ships)[keyof typeof SHIP_FOOTPRINTS.ships];

export const PLAYER_HURT_RADIUS = 0.46;
export const BLADE_EDGE_ALLOWANCE = 0.16;

function createHullContract(
  footprint: DerivedFootprint,
  verticalScale: number,
  offsetY: number,
): HullContract {
  const presentation = Object.freeze({
    x: footprint.scale.x,
    y: verticalScale,
    z: footprint.scale.z,
    offsetY,
  });
  return Object.freeze({
    presentation,
    span: footprint.span,
    projectileRadius: footprint.radialRadius,
    bladeRadius: footprint.radialRadius + BLADE_EDGE_ALLOWANCE,
    // Player damage keeps the existing forgiving core rather than treating the
    // complete rendered player rectangle as vulnerable.
    chargeRadius: footprint.radialRadius + PLAYER_HURT_RADIUS,
  });
}

export const PLAYER_HULL_CONTRACT = createHullContract(
  SHIP_FOOTPRINTS.ships.player,
  0.2,
  0.48,
);

export const ENEMY_HULL_CONTRACTS: Readonly<Record<EnemyRole, HullContract>> = Object.freeze({
  rusher: createHullContract(
    SHIP_FOOTPRINTS.ships.rusher,
    0.25,
    0.42,
  ),
  gunner: createHullContract(
    SHIP_FOOTPRINTS.ships.gunner,
    0.19,
    0.32,
  ),
  'shield-anchor': createHullContract(
    SHIP_FOOTPRINTS.ships.shieldAnchor,
    0.18,
    0.3,
  ),
  warden: createHullContract(
    SHIP_FOOTPRINTS.ships.warden,
    0.42,
    0.38,
  ),
});

export const SHIP_PRESENTATION_SPANS = Object.freeze({
  player: PLAYER_HULL_CONTRACT.span,
  rusher: ENEMY_HULL_CONTRACTS.rusher.span,
  gunner: ENEMY_HULL_CONTRACTS.gunner.span,
  'shield-anchor': ENEMY_HULL_CONTRACTS['shield-anchor'].span,
  warden: ENEMY_HULL_CONTRACTS.warden.span,
});
