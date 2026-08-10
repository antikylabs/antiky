import type { CombatSnapshot } from './combat-state.ts';

const HASH_SEEDS = Object.freeze([
  0x811c9dc5,
  0x9e3779b9,
  0x85ebca6b,
  0xc2b2ae35,
]);

function hashState(serialized: string): string {
  const lanes = [...HASH_SEEDS];
  for (let index = 0; index < serialized.length; index += 1) {
    const codeUnit = serialized.charCodeAt(index);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      lanes[lane] = Math.imul(lanes[lane]! ^ codeUnit, 0x01000193) >>> 0;
    }
  }
  return lanes.map((lane) => lane.toString(16).padStart(8, '0')).join('');
}

export function combatDigest(state: CombatSnapshot): string {
  const serialized = JSON.stringify({
    time: state.time,
    revision: state.revision,
    phase: state.phase,
    phaseTime: state.phaseTime,
    round: state.round,
    maxRounds: state.maxRounds,
    score: state.score,
    combo: state.combo,
    shotsFired: state.shotsFired,
    dashes: state.dashes,
    deflections: state.deflections,
    damageTaken: state.damageTaken,
    impact: state.impact,
    fireCooldown: state.fireCooldown,
    dashSequence: state.dashSequence,
    pendingVictory: state.pendingVictory,
    projectileCursor: state.projectileCursor,
    particleCursor: state.particleCursor,
    player: state.player,
    enemies: state.enemies.map((enemy) => ({
      active: enemy.active,
      x: enemy.x,
      z: enemy.z,
      vx: enemy.vx,
      vz: enemy.vz,
      hull: enemy.hull,
      maxHull: enemy.maxHull,
      shield: enemy.shield,
      mark: enemy.mark,
      stagger: enemy.stagger,
      hit: enemy.hit,
      state: enemy.state,
      stateTime: enemy.stateTime,
      cooldown: enemy.cooldown,
      role: enemy.role,
      kind: enemy.kind,
      phase: enemy.phase,
      pattern: enemy.pattern,
      lastDash: enemy.lastDash,
      revision: enemy.revision,
    })),
    projectiles: state.projectiles.map((projectile) => ({
      x: projectile.x,
      z: projectile.z,
      previousX: projectile.previousX,
      previousZ: projectile.previousZ,
      vx: projectile.vx,
      vz: projectile.vz,
      life: projectile.life,
      enemy: projectile.enemy,
      kind: projectile.kind,
      ownerIndex: projectile.ownerIndex,
    })),
  });
  return `starbreaker-v1:${hashState(serialized)}`;
}
