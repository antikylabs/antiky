import {
  ROUND_DEFINITIONS,
  roleKind,
  type CombatEnemy,
  type CombatPlayer,
  type EnemyRole,
} from './state.ts';

export function nearestActiveEnemy(
  enemies: readonly CombatEnemy[],
  x: number,
  z: number,
): { enemy: CombatEnemy; index: number } | null {
  let nearest: { enemy: CombatEnemy; index: number } | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  enemies.forEach((enemy, index) => {
    if (!enemy.active) return;
    const distance = Math.hypot(enemy.x - x, enemy.z - z);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = { enemy, index };
    }
  });
  return nearest;
}

export function populateRound(
  enemies: CombatEnemy[],
  round: number,
): Readonly<{ enemyCount: number; openingRole: EnemyRole }> {
  const definition = ROUND_DEFINITIONS[round - 1]!;
  enemies.forEach((enemy, index) => {
    const authored = definition[index];
    if (authored === undefined) {
      enemy.active = false;
      enemy.state = 'inactive';
      enemy.hull = 0;
      enemy.mark = 0;
      enemy.stagger = 0;
      enemy.revision += 1;
      return;
    }
    enemy.active = true;
    enemy.x = authored.x;
    enemy.z = authored.z;
    enemy.vx = 0;
    enemy.vz = 0;
    enemy.hull = authored.hull;
    enemy.maxHull = authored.hull;
    enemy.shield = authored.shield ?? 0;
    enemy.mark = 0;
    enemy.stagger = 0;
    enemy.hit = 0;
    enemy.state = 'entry';
    enemy.stateTime = 0.42 + index * 0.08;
    enemy.cooldown = 0.65 + index * 0.18;
    enemy.role = authored.role;
    enemy.kind = roleKind(authored.role);
    enemy.pattern = 0;
    enemy.lastDash = -1;
    enemy.revision += 1;
  });
  return Object.freeze({ enemyCount: definition.length, openingRole: definition[0]!.role });
}

export function resetCombatants(player: CombatPlayer, enemies: CombatEnemy[]): void {
  player.x = 0;
  player.z = 1.5;
  player.vx = 0;
  player.vz = 0;
  player.facingX = 0;
  player.facingZ = -1;
  player.hull = player.maxHull;
  player.drive = player.maxDrive;
  player.dash = 0;
  player.dashCooldown = 0;
  player.invulnerable = 0;
  player.revision += 1;
  enemies.forEach((enemy) => {
    enemy.active = false;
    enemy.state = 'inactive';
    enemy.hull = 0;
    enemy.revision += 1;
  });
}
