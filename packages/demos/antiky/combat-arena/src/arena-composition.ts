import type { ArenaCatalogResources } from './arena-assets.ts';
import { enemyVisualProfile } from './combat-visuals.ts';
import type { CombatSnapshot } from './combat-state.ts';
import type { Vec3 } from './render-batches.ts';

export const ARENA_CATALOG_CAPACITY = Object.freeze({
  walls: 9,
  wallDetails: 3,
  room: 1,
  floor: 25,
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

/**
 * The wall ring, from the kit's own 4 x 4.25 panels.
 *
 * The arena used to be one `room-small` shell scaled 1.5 horizontally — a single mesh stretched into
 * a shape it was not modelled for, which is why the walls read as smooth featureless banks. The kit
 * ships proper wall pieces and this uses them: sixteen plain panels forming the ring, with eight
 * detailed panels alternating in so the perimeter has some rhythm rather than repeating one profile.
 *
 * The panels are one unit deep and four wide, so a radius of 9 gives sixteen of them a comfortable
 * ring with the play area (roughly 8 across) inside it.
 */
function setArenaWalls(catalog: ArenaCatalogResources): void {
  catalog.walls.clear();
  catalog.wallDetails.clear();
  // The room shell is a 12 x 12 box scaled 1.5 horizontally, so its walls stand at x = +-9 and
  // z = +-9. The panels go just inside that line, which reads as the wall being *panelled* rather
  // than as a second wall standing next to the first.
  //
  // A first attempt laid them on a circle of radius 9 and nothing appeared: the circle touched the
  // square exactly at the side midpoints, so every panel was buried in the shell it was meant to
  // dress. The shell is square; the panelling has to be square too.
  const WALL_LINE = 8.55;
  // Darker than the deck so the walls sit behind the play area rather than competing with it. The
  // first pass used 0.62 and the panels read as bright white slabs — a wall should frame the space,
  // not be the brightest thing in it.
  const PANEL_TINT: readonly [number, number, number] = [0.26, 0.31, 0.4];
  // Panels are four units wide, so four to a side covers sixteen of the eighteen-unit span and
  // leaves the corners to the shell's own curve.
  const SPAN = [-6, -2, 2, 6];
  // The near side is deliberately absent. The camera looks down the +Z axis, so a wall there stands
  // between the viewer and the arena — the room shell's own low lip already closes the composition
  // from that angle, and the panels are for the three sides the player actually sees behind play.
  const SIDES = [
    { axis: 'z' as const, sign: -1, rotation: 0 },
    { axis: 'x' as const, sign: 1, rotation: -Math.PI / 2 },
    { axis: 'x' as const, sign: -1, rotation: Math.PI / 2 },
  ];

  let plain = 0;
  let detail = 0;
  for (let sideIndex = 0; sideIndex < SIDES.length; sideIndex += 1) {
    const side = SIDES[sideIndex]!;
    for (let slot = 0; slot < SPAN.length; slot += 1) {
      const along = SPAN[slot]!;
      const x = side.axis === 'x' ? WALL_LINE * side.sign : along;
      const z = side.axis === 'z' ? WALL_LINE * side.sign : along;
      // One detailed panel per side, so the ring has a beat without becoming busy.
      const detailed = slot === (sideIndex % 2 === 0 ? 1 : 2) && detail < 3;
      const batch = detailed ? catalog.wallDetails : catalog.walls;
      const index = detailed ? detail : plain;
      batch.setValues(
        index, x, ARENA_ROOM_PROFILE.offsetY, z, 1, 1, 1,
        PANEL_TINT, 0, 0, side.rotation,
      );
      if (detailed) detail += 1;
      else plain += 1;
    }
  }
  // Written is not drawn. A batch whose instance data never reaches the GPU renders nothing at all,
  // and the demo looks exactly as it did before — which is how this went unnoticed through two
  // captures, and how the same mistake shipped in an earlier goal.
  catalog.walls.upload();
  catalog.wallDetails.upload();
}

export function initializeArenaCatalog(catalog: ArenaCatalogResources): void {
  setArenaWalls(catalog);
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
