import {
  normalized,
  segmentDistanceSquared,
  type CombatEnemy,
  type CombatPlayer,
  type CombatProjectile,
} from './combat-state.ts';
import { ENEMY_HULL_CONTRACTS, PLAYER_HURT_RADIUS } from './combat-hulls.ts';

export type ProjectileCollisionPort = Readonly<{
  onPlayerHit(): void;
  onEnemyHit(enemy: CombatEnemy, enemyIndex: number, kind: 'cannon' | 'deflected'): void;
  onDeflection(projectile: CombatProjectile): void;
}>;

function nearestEnemy(
  enemies: CombatEnemy[],
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

export function updateCombatProjectiles(
  projectiles: CombatProjectile[],
  enemies: CombatEnemy[],
  player: CombatPlayer,
  deltaSeconds: number,
  previousPlayerX: number,
  previousPlayerZ: number,
  port: ProjectileCollisionPort,
): void {
  projectiles.forEach((projectile) => {
    if (projectile.life <= 0) return;
    projectile.life -= deltaSeconds;
    projectile.previousX = projectile.x;
    projectile.previousZ = projectile.z;
    projectile.x += projectile.vx * deltaSeconds;
    projectile.z += projectile.vz * deltaSeconds;
    if (projectile.life <= 0 || Math.hypot(projectile.x, projectile.z) > 9.6) {
      projectile.life = 0;
      return;
    }

    if (projectile.enemy) {
      const bladeDistance = segmentDistanceSquared(
        previousPlayerX,
        previousPlayerZ,
        player.x,
        player.z,
        projectile.x,
        projectile.z,
      );
      if (player.dash > 0 && bladeDistance < 0.82 ** 2) {
        const target = nearestEnemy(enemies, projectile.x, projectile.z);
        const [directionX, directionZ] = target === null
          ? normalized(-projectile.vx, -projectile.vz)
          : normalized(target.enemy.x - projectile.x, target.enemy.z - projectile.z);
        projectile.vx = directionX * 11;
        projectile.vz = directionZ * 11;
        projectile.enemy = false;
        projectile.kind = 'deflected';
        projectile.ownerIndex = -1;
        port.onDeflection(projectile);
        return;
      }
      if (segmentDistanceSquared(
        projectile.previousX,
        projectile.previousZ,
        projectile.x,
        projectile.z,
        player.x,
        player.z,
      ) < PLAYER_HURT_RADIUS ** 2) {
        projectile.life = 0;
        port.onPlayerHit();
      }
      return;
    }

    for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex += 1) {
      const enemy = enemies[enemyIndex]!;
      if (!enemy.active) continue;
      const radius = ENEMY_HULL_CONTRACTS[enemy.role].projectileRadius;
      if (segmentDistanceSquared(
        projectile.previousX,
        projectile.previousZ,
        projectile.x,
        projectile.z,
        enemy.x,
        enemy.z,
      ) > radius ** 2) continue;
      projectile.life = 0;
      port.onEnemyHit(enemy, enemyIndex, projectile.kind === 'deflected' ? 'deflected' : 'cannon');
      break;
    }
  });
}
