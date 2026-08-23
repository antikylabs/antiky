import {
  clampToArena,
  normalized,
  segmentDistanceSquared,
  type CombatEnemy,
  type CombatPlayer,
} from './state.ts';
import { ENEMY_HULL_CONTRACTS } from './hulls.ts';

export type EnemyBehaviorPort = Readonly<{
  fireHostile(enemy: CombatEnemy, enemyIndex: number, spread?: number): void;
  damagePlayer(source: 'charge'): void;
}>;

function beginEnemyAttack(
  enemy: CombatEnemy,
  enemyIndex: number,
  player: CombatPlayer,
  port: EnemyBehaviorPort,
): void {
  enemy.state = 'attack';
  enemy.pattern += 1;
  if (enemy.role === 'rusher' || (enemy.role === 'warden' && enemy.pattern % 2 === 0)) {
    const [directionX, directionZ] = normalized(player.x - enemy.x, player.z - enemy.z);
    const speed = enemy.role === 'warden' ? 12.2 : 10.8;
    enemy.vx = directionX * speed;
    enemy.vz = directionZ * speed;
    enemy.stateTime = enemy.role === 'warden' ? 0.5 : 0.62;
  } else if (enemy.role === 'shield-anchor') {
    [-0.36, -0.12, 0.12, 0.36].forEach((spread) => port.fireHostile(enemy, enemyIndex, spread));
    enemy.stateTime = 0.2;
  } else {
    const spreads = enemy.role === 'warden' ? [-0.25, 0, 0.25] : [0];
    spreads.forEach((spread) => port.fireHostile(enemy, enemyIndex, spread));
    enemy.stateTime = 0.2;
  }
  enemy.revision += 1;
}

export function updateEnemyBehavior(
  enemy: CombatEnemy,
  enemyIndex: number,
  deltaSeconds: number,
  player: CombatPlayer,
  port: EnemyBehaviorPort,
): void {
  if (!enemy.active) return;
  enemy.hit = Math.max(0, enemy.hit - deltaSeconds * 4.4);
  enemy.mark = Math.max(0, enemy.mark - deltaSeconds);
  enemy.stagger = Math.max(0, enemy.stagger - deltaSeconds);
  enemy.stateTime = Math.max(0, enemy.stateTime - deltaSeconds);

  if (enemy.state === 'entry') {
    if (enemy.stateTime <= 0) {
      enemy.state = 'tracking';
      enemy.cooldown = 0.45 + enemyIndex * 0.12;
    }
    return;
  }
  if (enemy.state === 'staggered') {
    enemy.vx *= Math.exp(-9 * deltaSeconds);
    enemy.vz *= Math.exp(-9 * deltaSeconds);
    if (enemy.stateTime <= 0) {
      enemy.state = 'tracking';
      enemy.cooldown = Math.max(enemy.cooldown, 0.25);
    }
    return;
  }
  if (enemy.state === 'telegraph') {
    enemy.vx *= Math.exp(-8 * deltaSeconds);
    enemy.vz *= Math.exp(-8 * deltaSeconds);
    if (enemy.stateTime <= 0) beginEnemyAttack(enemy, enemyIndex, player, port);
    return;
  }
  if (enemy.state === 'attack') {
    if (enemy.role === 'rusher' || (enemy.role === 'warden' && enemy.pattern % 2 === 0)) {
      const previousX = enemy.x;
      const previousZ = enemy.z;
      enemy.x += enemy.vx * deltaSeconds;
      enemy.z += enemy.vz * deltaSeconds;
      clampToArena(enemy, 7.3);
      const contactRadius = ENEMY_HULL_CONTRACTS[enemy.role].chargeRadius;
      if (segmentDistanceSquared(previousX, previousZ, enemy.x, enemy.z, player.x, player.z) <= contactRadius ** 2) {
        port.damagePlayer('charge');
        enemy.stateTime = 0;
      }
    }
    if (enemy.stateTime <= 0) {
      enemy.state = 'recovery';
      enemy.stateTime = enemy.role === 'warden' ? 0.75 : 0.62;
      enemy.vx *= 0.18;
      enemy.vz *= 0.18;
    }
    return;
  }
  if (enemy.state === 'recovery') {
    enemy.vx *= Math.exp(-6 * deltaSeconds);
    enemy.vz *= Math.exp(-6 * deltaSeconds);
    if (enemy.stateTime <= 0) {
      enemy.state = 'tracking';
      enemy.cooldown = enemy.role === 'warden' ? 0.65 : 0.85;
    }
    return;
  }

  enemy.cooldown -= deltaSeconds;
  const dx = player.x - enemy.x;
  const dz = player.z - enemy.z;
  const distance = Math.max(0.1, Math.hypot(dx, dz));
  const desiredRadius = enemy.role === 'rusher' ? 2.7 : enemy.role === 'warden' ? 3.6 : 5.1;
  const tangentX = -dz / distance;
  const tangentZ = dx / distance;
  const radial = (distance - desiredRadius) * (enemy.role === 'rusher' ? 1.5 : 0.7);
  const orbit = enemy.role === 'shield-anchor' ? 0.25 : 0.75;
  enemy.vx += (dx / distance * radial + tangentX * orbit - enemy.vx * 3.4) * deltaSeconds;
  enemy.vz += (dz / distance * radial + tangentZ * orbit - enemy.vz * 3.4) * deltaSeconds;
  enemy.x += enemy.vx * deltaSeconds;
  enemy.z += enemy.vz * deltaSeconds;
  clampToArena(enemy, 7.25);
  if (enemy.cooldown <= 0) {
    enemy.state = 'telegraph';
    enemy.stateTime = enemy.role === 'rusher'
      ? 0.72
      : enemy.role === 'warden'
        ? 0.78
        : 0.92;
    enemy.revision += 1;
  }
}
