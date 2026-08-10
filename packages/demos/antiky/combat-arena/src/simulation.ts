import {
  CLEAR_DURATION,
  DASH_COST,
  DASH_DURATION,
  INTRO_DURATION,
  MAX_ROUNDS,
  clampToArena,
  createCombatStatePools,
  normalized,
  segmentDistanceSquared,
  type CombatEnemy,
  type CombatEvent,
  type CombatInput,
  type CombatPhase,
  type CombatProjectile,
  type CombatSimulation,
  type CombatSnapshot,
  type EnemyRole,
  type ProjectileKind,
} from './combat-state.ts';
import { updateEnemyBehavior } from './combat-ai.ts';
import { ENEMY_HULL_CONTRACTS } from './combat-hulls.ts';
import { nearestActiveEnemy, populateRound, resetCombatants } from './combat-encounter.ts';
import { combatDigest } from './combat-digest.ts';
import { createParticlePool, createProjectilePool } from './combat-pools.ts';
import { updateCombatProjectiles } from './combat-projectiles.ts';

export {
  ARENA_RADIUS,
  DASH_COST,
  ENEMY_COUNT,
  MAX_ROUNDS,
  PARTICLE_CAPACITY,
  PROJECTILE_CAPACITY,
  ROUND_DEFINITIONS,
} from './combat-state.ts';
export type {
  CombatEnemy,
  CombatEvent,
  CombatInput,
  CombatParticle,
  CombatPhase,
  CombatPlayer,
  CombatProjectile,
  CombatSimulation,
  CombatSnapshot,
  EnemyRole,
  EnemyState,
  ProjectileKind,
} from './combat-state.ts';

export function createCombatSimulation(emit: (event: CombatEvent) => void): CombatSimulation {
  const { player, enemies, projectiles, particles } = createCombatStatePools();
  const projectilePool = createProjectilePool(projectiles);
  const particlePool = createParticlePool(particles);

  let time = 0;
  let revision = 1;
  let phase: CombatPhase = 'intro';
  let phaseTime = INTRO_DURATION;
  let round = 1;
  let score = 0;
  let combo = 0;
  let shotsFired = 0;
  let dashes = 0;
  let deflections = 0;
  let damageTaken = 0;
  let impact = 0;
  let fireCooldown = 0.12;
  let dashSequence = 0;
  let pendingVictory = false;

  const emitFact = (
    event: Omit<CombatEvent, 'simulationTime' | 'simulationRevision'>,
  ): void => emit(Object.freeze({
    ...event,
    simulationTime: time,
    simulationRevision: revision,
  }));

  const liveView = Object.freeze({
    get time() { return time; },
    get revision() { return revision; },
    get phase() { return phase; },
    get phaseTime() { return phaseTime; },
    get round() { return round; },
    get maxRounds() { return MAX_ROUNDS; },
    get score() { return score; },
    get combo() { return combo; },
    get shotsFired() { return shotsFired; },
    get dashes() { return dashes; },
    get deflections() { return deflections; },
    get damageTaken() { return damageTaken; },
    get impact() { return impact; },
    get fireCooldown() { return fireCooldown; },
    get dashSequence() { return dashSequence; },
    get pendingVictory() { return pendingVictory; },
    get projectileCursor() { return projectilePool.cursor(); },
    get particleCursor() { return particlePool.cursor(); },
    player,
    enemies,
    projectiles,
    particles,
  });

  const recordPhase = (): void => emitFact({
    type: 'combat.phase',
    value: phaseTime,
    round,
    phase,
  });

  const burst = (x: number, z: number, color: number, count: number, force: number): void => {
    particlePool.burst(revision, x, z, color, count, force);
  };

  const startRound = (): void => {
    const encounter = populateRound(enemies, round);
    fireCooldown = 0.08;
    phase = 'combat';
    phaseTime = 0;
    emitFact({
      type: 'combat.round-started',
      value: encounter.enemyCount,
      round,
      phase,
      role: encounter.openingRole,
    });
    recordPhase();
  };

  const reset = (): void => {
    resetCombatants(player, enemies);
    projectilePool.reset();
    particlePool.reset();
    phase = 'intro';
    phaseTime = INTRO_DURATION;
    round = 1;
    score = 0;
    combo = 0;
    fireCooldown = 0.12;
    pendingVictory = false;
    impact = 0;
    emitFact({ type: 'combat.retry', value: 1, round, phase });
    recordPhase();
  };

  const fireCannon = (): void => {
    const target = nearestActiveEnemy(enemies, player.x, player.z);
    if (target === null) return;
    const [directionX, directionZ] = normalized(
      target.enemy.x - player.x + target.enemy.vx * 0.12,
      target.enemy.z - player.z + target.enemy.vz * 0.12,
      player.facingX,
      player.facingZ,
    );
    projectilePool.spawn(
      player.x + directionX * 0.55,
      player.z + directionZ * 0.55,
      directionX * 16.5,
      directionZ * 16.5,
      'cannon',
      -1,
      1.05,
    );
    player.facingX = directionX;
    player.facingZ = directionZ;
    shotsFired += 1;
    emitFact({
      type: 'combat.cannon-fired',
      enemyIndex: target.index,
      value: shotsFired,
      round,
      source: 'cannon',
    });
  };

  const fireHostile = (enemy: CombatEnemy, enemyIndex: number, spread = 0): void => {
    const [baseX, baseZ] = normalized(player.x - enemy.x, player.z - enemy.z);
    const cosine = Math.cos(spread);
    const sine = Math.sin(spread);
    const directionX = baseX * cosine - baseZ * sine;
    const directionZ = baseX * sine + baseZ * cosine;
    const speed = enemy.role === 'warden' ? 7.8 : 6.8;
    projectilePool.spawn(
      enemy.x + directionX * 0.5,
      enemy.z + directionZ * 0.5,
      directionX * speed,
      directionZ * speed,
      'hostile',
      enemyIndex,
      2.6,
    );
  };

  const damagePlayer = (source: 'bolt' | 'charge'): void => {
    if (phase !== 'combat' || player.invulnerable > 0 || player.hull <= 0) return;
    player.hull -= 1;
    player.invulnerable = 1.05;
    player.revision += 1;
    damageTaken += 1;
    combo = 0;
    impact = 1;
    burst(player.x, player.z, 5, 24, 4.6);
    emitFact({ type: 'combat.player-damaged', value: player.hull, round, source });
    if (player.hull > 0) return;
    phase = 'defeat';
    phaseTime = 0;
    player.vx = 0;
    player.vz = 0;
    projectiles.forEach((projectile) => { projectile.life = 0; });
    emitFact({ type: 'combat.defeat', value: round, round, phase });
    recordPhase();
  };

  const enemyBehaviorPort = Object.freeze({ fireHostile, damagePlayer });

  const defeatEnemy = (enemy: CombatEnemy, enemyIndex: number): void => {
    enemy.active = false;
    enemy.state = 'defeated';
    enemy.stateTime = 0;
    enemy.vx = 0;
    enemy.vz = 0;
    enemy.mark = 0;
    enemy.revision += 1;
    score += 100 * round * (enemy.role === 'warden' ? 4 : 1);
    impact = Math.max(impact, enemy.role === 'warden' ? 1 : 0.65);
    burst(enemy.x, enemy.z, enemy.kind + 1, enemy.role === 'warden' ? 42 : 26, 5.2);
    emitFact({
      type: 'combat.enemy-defeated',
      enemyIndex,
      value: score,
      round,
      role: enemy.role,
      source: 'blade',
    });
  };

  const damageEnemy = (
    enemy: CombatEnemy,
    enemyIndex: number,
    source: 'blade' | 'deflection',
  ): void => {
    if (!enemy.active) return;
    if (enemy.shield > 0) {
      enemy.shield -= 1;
      enemy.hit = 1;
      enemy.stagger = Math.max(enemy.stagger, 0.28);
      enemy.revision += 1;
      burst(enemy.x, enemy.z, 4, 18, 3.6);
      return;
    }
    enemy.hull -= 1;
    enemy.hit = 1;
    enemy.stagger = Math.max(enemy.stagger, 0.35);
    enemy.state = 'staggered';
    enemy.stateTime = 0.24;
    enemy.revision += 1;
    impact = Math.max(impact, 0.45);
    burst(enemy.x, enemy.z, enemy.kind + 1, 16, 3.8);
    emitFact({
      type: 'combat.enemy-damaged',
      enemyIndex,
      value: enemy.hull,
      round,
      role: enemy.role,
      source,
    });
    if (enemy.hull <= 0) defeatEnemy(enemy, enemyIndex);
  };

  const beginDash = (input: CombatInput): void => {
    const [dashX, dashZ] = normalized(input.aim.x, input.aim.z, player.facingX, player.facingZ);
    player.drive = Math.max(0, player.drive - DASH_COST);
    player.vx = dashX * 23.5;
    player.vz = dashZ * 23.5;
    player.facingX = dashX;
    player.facingZ = dashZ;
    player.dash = DASH_DURATION;
    player.invulnerable = Math.max(player.invulnerable, DASH_DURATION + 0.06);
    player.dashCooldown = 0.42;
    player.revision += 1;
    dashSequence += 1;
    dashes += 1;
    combo = Math.max(0, combo - 1);
    impact = Math.max(impact, 0.16);
    burst(player.x, player.z, 0, 14, 3.2);
    emitFact({ type: 'combat.dash', value: dashes, round, source: 'blade' });
  };

  const sweepBlade = (previousX: number, previousZ: number): void => {
    if (player.dash <= 0) return;
    enemies.forEach((enemy, enemyIndex) => {
      if (!enemy.active || enemy.lastDash === dashSequence) return;
      const radius = ENEMY_HULL_CONTRACTS[enemy.role].bladeRadius;
      if (segmentDistanceSquared(previousX, previousZ, player.x, player.z, enemy.x, enemy.z) > radius ** 2) return;
      enemy.lastDash = dashSequence;
      const chained = enemy.mark > 0;
      if (chained) {
        enemy.mark = 0;
        combo += 1;
        player.drive = Math.min(player.maxDrive, player.drive + 26 + Math.min(10, combo * 2));
      } else {
        combo = 0;
      }
      damageEnemy(enemy, enemyIndex, 'blade');
      emitFact({
        type: 'combat.dash-hit',
        enemyIndex,
        value: combo,
        round,
        role: enemy.role,
        source: 'blade',
      });
    });
  };

  const markEnemy = (enemy: CombatEnemy, enemyIndex: number): void => {
    enemy.mark = Math.max(enemy.mark, 3.2);
    enemy.stagger = Math.max(enemy.stagger, 0.18);
    enemy.hit = 0.65;
    if (enemy.shield > 0) enemy.shield -= 1;
    if (enemy.state !== 'attack') {
      enemy.state = 'staggered';
      enemy.stateTime = 0.12;
    }
    enemy.revision += 1;
    burst(enemy.x, enemy.z, 0, 8, 2.2);
    emitFact({
      type: 'combat.enemy-marked',
      enemyIndex,
      value: enemy.mark,
      round,
      role: enemy.role,
      source: 'cannon',
    });
  };

  const projectileCollisionPort = Object.freeze({
    onPlayerHit(): void {
      damagePlayer('bolt');
    },
    onEnemyHit(enemy: CombatEnemy, enemyIndex: number, kind: 'cannon' | 'deflected'): void {
      if (kind === 'deflected') damageEnemy(enemy, enemyIndex, 'deflection');
      else markEnemy(enemy, enemyIndex);
    },
    onDeflection(projectile: CombatProjectile): void {
      deflections += 1;
      player.drive = Math.min(player.maxDrive, player.drive + 12);
      impact = Math.max(impact, 0.38);
      burst(projectile.x, projectile.z, 0, 12, 3.5);
      emitFact({
        type: 'combat.projectile-deflected',
        value: deflections,
        round,
        source: 'deflection',
      });
    },
  });

  const checkRoundClear = (): void => {
    if (phase !== 'combat' || enemies.some((enemy) => enemy.active)) return;
    pendingVictory = round >= MAX_ROUNDS;
    phase = 'clear';
    phaseTime = CLEAR_DURATION;
    combo += 1;
    player.drive = Math.min(player.maxDrive, player.drive + 24);
    projectiles.forEach((projectile) => { projectile.life = 0; });
    emitFact({ type: 'combat.round-cleared', value: score, round, phase });
    recordPhase();
  };

  const update = (deltaSeconds: number, input: CombatInput): void => {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    if (dt <= 0) return;
    time += dt;
    revision += 1;
    impact = Math.max(0, impact - dt * 4.2);
    player.dash = Math.max(0, player.dash - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const attackPressed = input.attack && !player.attackHeld;
    player.attackHeld = input.attack;

    if ((phase === 'defeat' || phase === 'victory') && attackPressed) {
      reset();
      particlePool.update(dt);
      return;
    }
    if (phase === 'intro') {
      phaseTime = Math.max(0, phaseTime - dt);
      if (phaseTime <= 0) startRound();
      particlePool.update(dt);
      return;
    }
    if (phase === 'clear') {
      phaseTime = Math.max(0, phaseTime - dt);
      if (phaseTime <= 0) {
        if (pendingVictory) {
          phase = 'victory';
          phaseTime = 0;
          emitFact({ type: 'combat.victory', value: score, round, phase });
          recordPhase();
        } else {
          round += 1;
          startRound();
        }
      }
      particlePool.update(dt);
      return;
    }
    if (phase !== 'combat') {
      particlePool.update(dt);
      return;
    }

    const moveX = input.movement.active && Number.isFinite(input.movement.x) ? input.movement.x : 0;
    const moveZ = input.movement.active && Number.isFinite(input.movement.z) ? input.movement.z : 0;
    if (attackPressed && player.dashCooldown <= 0 && player.drive >= DASH_COST) beginDash(input);

    const previousPlayerX = player.x;
    const previousPlayerZ = player.z;
    if (player.dash <= 0) {
      const moveLength = Math.hypot(moveX, moveZ);
      if (moveLength > 0.001) {
        const moveScale = moveLength > 1 ? 1 / moveLength : 1;
        const response = 1 - Math.exp(-24 * dt);
        player.vx += (moveX * moveScale * 6.4 - player.vx) * response;
        player.vz += (moveZ * moveScale * 6.4 - player.vz) * response;
      } else {
        const damping = Math.exp(-14 * dt);
        player.vx *= damping;
        player.vz *= damping;
      }
      player.drive = Math.min(player.maxDrive, player.drive + 5.5 * dt);
    } else {
      const damping = Math.exp(-1.4 * dt);
      player.vx *= damping;
      player.vz *= damping;
    }
    player.x += player.vx * dt;
    player.z += player.vz * dt;
    clampToArena(player);
    sweepBlade(previousPlayerX, previousPlayerZ);

    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      fireCannon();
      fireCooldown += 0.34;
    }
    enemies.forEach((enemy, enemyIndex) => {
      updateEnemyBehavior(enemy, enemyIndex, dt, player, enemyBehaviorPort);
    });
    updateCombatProjectiles(
      projectiles,
      enemies,
      player,
      dt,
      previousPlayerX,
      previousPlayerZ,
      projectileCollisionPort,
    );
    particlePool.update(dt);
    checkRoundClear();
  };

  const read = (): CombatSnapshot => Object.freeze({
    time,
    revision,
    phase,
    phaseTime,
    round,
    maxRounds: MAX_ROUNDS,
    score,
    combo,
    shotsFired,
    dashes,
    deflections,
    damageTaken,
    impact,
    fireCooldown,
    dashSequence,
    pendingVictory,
    projectileCursor: projectilePool.cursor(),
    particleCursor: particlePool.cursor(),
    player: Object.freeze({ ...player }),
    enemies: Object.freeze(enemies.map((enemy) => Object.freeze({ ...enemy }))),
    projectiles: Object.freeze(projectiles.map((projectile) => Object.freeze({ ...projectile }))),
    particles: Object.freeze(particles.map((particle) => Object.freeze({ ...particle }))),
  });

  return Object.freeze({
    update,
    view: () => liveView,
    read,
    digest: () => combatDigest(liveView),
  });
}
