import type { CombatSnapshot } from './combat-state.ts';

const numberBuffer = new ArrayBuffer(Float64Array.BYTES_PER_ELEMENT);
const numberView = new DataView(numberBuffer);

type Hasher = {
  first: number;
  second: number;
  third: number;
  fourth: number;
};

const hasher: Hasher = { first: 0, second: 0, third: 0, fourth: 0 };

function resetHash(): void {
  hasher.first = 0x811c9dc5;
  hasher.second = 0x9e3779b9;
  hasher.third = 0x85ebca6b;
  hasher.fourth = 0xc2b2ae35;
}

function hashByte(value: number): void {
  hasher.first = Math.imul(hasher.first ^ value, 0x01000193) >>> 0;
  hasher.second = Math.imul(hasher.second ^ value, 0x01000193) >>> 0;
  hasher.third = Math.imul(hasher.third ^ value, 0x01000193) >>> 0;
  hasher.fourth = Math.imul(hasher.fourth ^ value, 0x01000193) >>> 0;
}

function hashNumber(value: number): void {
  numberView.setFloat64(0, value, true);
  for (let index = 0; index < Float64Array.BYTES_PER_ELEMENT; index += 1) {
    hashByte(numberView.getUint8(index));
  }
}

function hashBoolean(value: boolean): void {
  hashByte(value ? 1 : 0);
}

function hashString(value: string): void {
  hashNumber(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashByte(code & 0xff);
    hashByte(code >>> 8);
  }
}

function finishHash(): string {
  return hasher.first.toString(16).padStart(8, '0')
    + hasher.second.toString(16).padStart(8, '0')
    + hasher.third.toString(16).padStart(8, '0')
    + hasher.fourth.toString(16).padStart(8, '0');
}

export function combatDigest(state: CombatSnapshot): string {
  resetHash();
  hashNumber(state.time);
  hashNumber(state.revision);
  hashString(state.phase);
  hashNumber(state.phaseTime);
  hashNumber(state.round);
  hashNumber(state.maxRounds);
  hashNumber(state.score);
  hashNumber(state.combo);
  hashNumber(state.shotsFired);
  hashNumber(state.dashes);
  hashNumber(state.deflections);
  hashNumber(state.damageTaken);
  hashNumber(state.impact);
  hashNumber(state.fireCooldown);
  hashNumber(state.dashSequence);
  hashBoolean(state.pendingVictory);
  hashNumber(state.projectileCursor);
  hashNumber(state.particleCursor);

  const player = state.player;
  hashNumber(player.x);
  hashNumber(player.z);
  hashNumber(player.vx);
  hashNumber(player.vz);
  hashNumber(player.facingX);
  hashNumber(player.facingZ);
  hashNumber(player.hull);
  hashNumber(player.maxHull);
  hashNumber(player.drive);
  hashNumber(player.maxDrive);
  hashNumber(player.dash);
  hashNumber(player.dashCooldown);
  hashNumber(player.invulnerable);
  hashBoolean(player.attackHeld);
  hashNumber(player.revision);

  for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
    const enemy = state.enemies[enemyIndex]!;
    hashBoolean(enemy.active);
    hashNumber(enemy.x);
    hashNumber(enemy.z);
    hashNumber(enemy.vx);
    hashNumber(enemy.vz);
    hashNumber(enemy.hull);
    hashNumber(enemy.maxHull);
    hashNumber(enemy.shield);
    hashNumber(enemy.mark);
    hashNumber(enemy.stagger);
    hashNumber(enemy.hit);
    hashString(enemy.state);
    hashNumber(enemy.stateTime);
    hashNumber(enemy.cooldown);
    hashString(enemy.role);
    hashNumber(enemy.kind);
    hashNumber(enemy.phase);
    hashNumber(enemy.pattern);
    hashNumber(enemy.lastDash);
    hashNumber(enemy.revision);
  }
  for (let projectileIndex = 0; projectileIndex < state.projectiles.length; projectileIndex += 1) {
    const projectile = state.projectiles[projectileIndex]!;
    hashNumber(projectile.x);
    hashNumber(projectile.z);
    hashNumber(projectile.previousX);
    hashNumber(projectile.previousZ);
    hashNumber(projectile.vx);
    hashNumber(projectile.vz);
    hashNumber(projectile.life);
    hashBoolean(projectile.enemy);
    hashString(projectile.kind);
    hashNumber(projectile.ownerIndex);
  }
  return `starbreaker-v1:${finishHash()}`;
}
