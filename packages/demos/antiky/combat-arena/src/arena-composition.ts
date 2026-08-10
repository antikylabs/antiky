import type { ArenaCatalogResources } from './arena-assets.ts';
import { enemyVisualProfile } from './combat-visuals.ts';
import type { CombatSnapshot } from './combat-state.ts';
import type { Vec3 } from './render-batches.ts';

export const ARENA_CATALOG_CAPACITY = Object.freeze({
  room: 1,
  floor: 25,
  cables: 28,
  targets: 18,
  grenades: 24,
});

export const ARENA_CATALOG_INSTANCES = Object.values(ARENA_CATALOG_CAPACITY)
  .reduce((total, capacity) => total + capacity, 0);

const STEEL: Vec3 = [0.42, 0.45, 0.49];
const STEEL_DARK: Vec3 = [0.22, 0.24, 0.27];
export const ARENA_ROOM_PROFILE = Object.freeze({
  offsetY: -1.02,
  horizontalScale: 1.5,
  verticalScale: 0.69,
  sourceHeight: 4.25,
});

export function initializeArenaCatalog(catalog: ArenaCatalogResources): void {
  catalog.room.clear();
  catalog.room.set(
    0,
    [0, ARENA_ROOM_PROFILE.offsetY, 0],
    [ARENA_ROOM_PROFILE.horizontalScale, ARENA_ROOM_PROFILE.verticalScale, ARENA_ROOM_PROFILE.horizontalScale],
    [0.2, 0.245, 0.3],
    [0.012, 0, 0],
  );
  catalog.room.upload();

  catalog.floorTiles.clear();
  let floorIndex = 0;
  for (let zIndex = -2; zIndex <= 2; zIndex += 1) {
    for (let xIndex = -2; xIndex <= 2; xIndex += 1) {
      const edge = Math.max(Math.abs(xIndex), Math.abs(zIndex));
      const tint = edge === 2 ? STEEL_DARK : edge === 1 ? [0.34, 0.37, 0.4] as Vec3 : STEEL;
      catalog.floorTiles.set(
        floorIndex,
        [xIndex * 3.72, -0.205, zIndex * 3.72],
        [0.9, 0.72, 0.9],
        tint,
        [edge === 0 ? 0.028 : 0.012, 0, (xIndex + zIndex) % 2 === 0 ? 0 : Math.PI / 2],
      );
      floorIndex += 1;
    }
  }
  catalog.floorTiles.upload();

  catalog.cables.clear();
  for (let index = 0; index < 24; index += 1) {
    const angle = index / 24 * Math.PI * 2 + Math.PI / 24;
    const outer = index % 3 !== 0;
    const radius = outer ? 8.25 : 6.85;
    const scale = outer ? 0.88 : 0.62;
    catalog.cables.set(
      index,
      [Math.cos(angle) * radius, -0.115, Math.sin(angle) * radius],
      [scale, scale, scale],
      outer ? [0.34, 0.36, 0.39] : [0.22, 0.27, 0.3],
      [0.012, 0, angle + Math.PI / 2],
    );
  }
  for (let index = 24; index < ARENA_CATALOG_CAPACITY.cables; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor((index - 24) / 2);
    catalog.cables.set(
      index,
      [side * (4.9 + lane * 0.72), -0.11, 7.05],
      [0.58, 0.58, 0.58],
      [0.3, 0.33, 0.36],
      [0.01, 0, side < 0 ? Math.PI * 0.08 : -Math.PI * 0.08],
    );
  }
  catalog.cables.upload();
}

function enemyFacing(state: CombatSnapshot, enemyIndex: number): number {
  const enemy = state.enemies[enemyIndex]!;
  return -Math.atan2(state.player.x - enemy.x, state.player.z - enemy.z);
}

export function projectArenaCatalog(catalog: ArenaCatalogResources, state: CombatSnapshot): void {
  catalog.targets.clear();
  let targetIndex = 0;
  for (let display = 0; display < 8; display += 1) {
    const angle = display / 8 * Math.PI * 2 + Math.PI / 8;
    const tint = display % 2 === 0 ? STEEL : STEEL_DARK;
    catalog.targets.setValues(
      targetIndex,
      Math.cos(angle) * 8.55, 1.04, Math.sin(angle) * 8.55,
      3.4, 3.4, 3.4,
      tint,
      0.035, 0, angle + Math.PI,
    );
    targetIndex += 1;
  }
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    if (!enemy.active || (enemy.role !== 'shield-anchor' && enemy.role !== 'warden')) continue;
    const profile = enemyVisualProfile(enemy);
    const facing = enemyFacing(state, enemyIndex);
    const emitters = enemy.role === 'warden' ? 6 : 4;
    for (let part = 0; part < emitters; part += 1) {
      const around = part / emitters * Math.PI * 2 + facing;
      const radiusX = profile.width * 0.42;
      const radiusZ = profile.length * 0.31;
      const scale = enemy.role === 'warden' ? 3.2 : 2.55;
      catalog.targets.setValues(
        targetIndex,
        enemy.x + Math.cos(around) * radiusX, 0.25, enemy.z + Math.sin(around) * radiusZ,
        scale, scale, scale,
        profile.tint,
        profile.emissive + (enemy.mark > 0 ? 0.16 : 0), enemy.hit, around + Math.PI,
      );
      targetIndex += 1;
    }
  }
  catalog.targets.upload();

  catalog.grenades.clear();
  let grenadeIndex = 0;
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2 + Math.PI / 16;
    const tint = index % 4 === 0 ? STEEL : STEEL_DARK;
    catalog.grenades.setValues(
      grenadeIndex,
      Math.cos(angle) * 8.45, 0.02 + (index % 2) * 0.18, Math.sin(angle) * 8.45,
      3.8, 3.8, 3.8,
      tint,
      index % 4 === 0 ? 0.07 : 0.018, 0, angle,
    );
    grenadeIndex += 1;
  }
  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    if (!enemy.active || (enemy.role !== 'gunner' && enemy.role !== 'shield-anchor' && enemy.role !== 'warden')) continue;
    const profile = enemyVisualProfile(enemy);
    const facing = enemyFacing(state, enemyIndex);
    const rightX = Math.cos(facing);
    const rightZ = -Math.sin(facing);
    for (let hardpoint = 0; hardpoint < profile.hardpoints; hardpoint += 1) {
      const side = hardpoint % 2 === 0 ? -1 : 1;
      const bank = Math.floor(hardpoint / 2);
      const distance = profile.width * (0.27 + bank * 0.16);
      const scale = enemy.role === 'warden' ? 4.2 : enemy.role === 'shield-anchor' ? 3.2 : 2.75;
      catalog.grenades.setValues(
        grenadeIndex,
        enemy.x + rightX * distance * side, 0.46 + bank * 0.13, enemy.z + rightZ * distance * side,
        scale, scale, scale,
        profile.tint,
        profile.emissive * 0.7, enemy.hit, facing,
      );
      grenadeIndex += 1;
    }
  }
  catalog.grenades.upload();
}
