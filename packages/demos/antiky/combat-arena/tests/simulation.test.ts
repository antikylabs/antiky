import assert from 'node:assert/strict';
import test from 'node:test';

import { combatDigest } from '../src/combat/digest.ts';
import { updateEnemyBehavior } from '../src/combat/ai.ts';
import { updateCombatProjectiles } from '../src/combat/projectiles.ts';
import { BLADE_EDGE_ALLOWANCE, PLAYER_HURT_RADIUS } from '../src/combat/hulls.ts';
import { createCombatStatePools } from '../src/combat/state.ts';
import { SHIP_FOOTPRINTS } from '../src/ship-footprints.gen.ts';
import {
  createCombatSimulation,
  type CombatEnemy,
  type CombatInput,
  type CombatEvent,
  type CombatPlayer,
} from '../src/simulation.ts';

const idle: CombatInput = Object.freeze({
  movement: Object.freeze({ x: 0, z: 0, active: false }),
  aim: Object.freeze({ x: 0, z: -1 }),
  attack: false,
});

function toward(x: number, z: number): Readonly<{ x: number; z: number }> {
  const length = Math.max(0.001, Math.hypot(x, z));
  return Object.freeze({ x: x / length, z: z / length });
}

function runFrames(
  simulation: ReturnType<typeof createCombatSimulation>,
  count: number,
  inputForFrame: (frame: number) => CombatInput = () => idle,
): void {
  for (let frame = 0; frame < count; frame += 1) {
    simulation.update(1 / 60, inputForFrame(frame));
  }
}

test('an idle pilot loses all three hull instead of passively winning', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));

  runFrames(simulation, 60 * 40);

  const snapshot = simulation.read();
  assert.equal(snapshot.phase, 'defeat');
  assert.equal(snapshot.player.hull, 0);
  assert.equal(snapshot.round, 1);
  assert.equal(snapshot.score, 0);
  assert.ok(events.filter((event) => event.type === 'combat.player-damaged').length >= 3);
  assert.ok(events.some((event) => event.type === 'combat.defeat'));
  assert.ok(!events.some((event) => event.type === 'combat.victory'));
});

test('auto-cannon marks and staggers but cannot defeat an enemy without a dash', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));

  runFrames(simulation, 60 * 4);

  const snapshot = simulation.read();
  assert.ok(snapshot.shotsFired >= 4);
  assert.ok(snapshot.enemies.some((enemy) => enemy.mark > 0));
  assert.ok(snapshot.enemies.some((enemy) => enemy.stagger > 0));
  assert.ok(snapshot.enemies.filter((enemy) => enemy.active).every((enemy) => enemy.hull > 0));
  assert.ok(events.some((event) => event.type === 'combat.enemy-marked'));
  assert.ok(!events.some((event) => event.type === 'combat.enemy-defeated'));
});

test('dash is a swept blade hit that chains a marked target and restores drive', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));
  let driveBeforeHit = 0;

  runFrames(simulation, 60 * 8, () => {
    const state = simulation.view();
    const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
      ?? state.enemies.find((enemy) => enemy.active);
    if (target === undefined) return idle;
    const aim = toward(target.x - state.player.x, target.z - state.player.z);
    const canDash = target.mark > 0
      && state.player.dashCooldown <= 0
      && state.player.drive >= 32;
    if (canDash) driveBeforeHit = state.player.drive;
    return Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: canDash,
    });
  });

  const snapshot = simulation.read();
  const dashHit = events.find((event) => event.type === 'combat.dash-hit');
  assert.ok(dashHit);
  assert.ok(snapshot.dashes >= 1);
  assert.ok(snapshot.combo >= 1);
  assert.ok(snapshot.player.drive > driveBeforeHit - 32);
  assert.ok(events.some((event) => event.type === 'combat.enemy-damaged'));
});

test('a skilled deterministic trace clears round one while preserving hull', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));

  runFrames(simulation, 60 * 14, () => {
    const state = simulation.view();
    const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
      ?? state.enemies.find((enemy) => enemy.active);
    if (target === undefined) return idle;
    const aim = toward(target.x - state.player.x, target.z - state.player.z);
    return Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: target.mark > 0 && state.player.dashCooldown <= 0 && state.player.drive >= 32,
    });
  });

  const snapshot = simulation.read();
  assert.ok(snapshot.round >= 2 || snapshot.phase === 'victory');
  assert.ok(snapshot.player.hull >= 1);
  assert.ok(events.some((event) => event.type === 'combat.round-cleared' && event.round === 1));
});

test('a blade dash deflects a hostile bolt during its invulnerability window', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));

  runFrames(simulation, 60 * 35, () => {
    const state = simulation.view();
    if (state.round === 1) {
      const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
        ?? state.enemies.find((enemy) => enemy.active);
      if (target === undefined) return idle;
      const aim = toward(target.x - state.player.x, target.z - state.player.z);
      return Object.freeze({
        movement: Object.freeze({ ...aim, active: true }),
        aim,
        attack: target.mark > 0 && state.player.dashCooldown <= 0 && state.player.drive >= 32,
      });
    }
    const hostile = state.projectiles.find((projectile) => projectile.life > 0 && projectile.enemy);
    if (state.round !== 2 || hostile === undefined) return idle;
    const aim = toward(hostile.x - state.player.x, hostile.z - state.player.z);
    return Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: state.player.dashCooldown <= 0 && state.player.drive >= 32,
    });
  });

  assert.ok(events.some((event) => event.type === 'combat.projectile-deflected'));
  assert.ok(simulation.read().deflections >= 1);
});

function bladeHitsWardenAtOffset(offset: number): boolean {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));
  runFrames(simulation, 60);
  const live = simulation.view() as unknown as { player: CombatPlayer; enemies: CombatEnemy[] };
  live.player.x = -3;
  live.player.z = 0;
  live.player.vx = 0;
  live.player.vz = 0;
  live.player.drive = 100;
  live.player.dashCooldown = 0;
  live.player.attackHeld = false;
  live.enemies.forEach((enemy) => { enemy.active = false; });
  Object.assign(live.enemies[0]!, {
    active: true,
    role: 'warden',
    x: 0,
    z: offset,
    vx: 0,
    vz: 0,
    hull: 4,
    maxHull: 4,
    shield: 0,
    mark: 3,
    state: 'staggered',
    stateTime: 10,
    lastDash: -1,
  });
  for (let frame = 0; frame < 14; frame += 1) {
    simulation.update(1 / 60, Object.freeze({
      movement: Object.freeze({ x: 1, z: 0, active: true }),
      aim: Object.freeze({ x: 1, z: 0 }),
      attack: frame === 0,
    }));
  }
  return events.some((event) => event.type === 'combat.dash-hit' && event.role === 'warden');
}

test('blade sweep hits the true Warden radial edge and misses beyond its blade allowance', () => {
  const radialEdge = SHIP_FOOTPRINTS.ships.warden.radialRadius;
  assert.equal(bladeHitsWardenAtOffset(radialEdge), true);
  assert.equal(bladeHitsWardenAtOffset(radialEdge + BLADE_EDGE_ALLOWANCE), true);
  assert.equal(bladeHitsWardenAtOffset(radialEdge + BLADE_EDGE_ALLOWANCE + 0.02), false);
});

function cannonHitsWardenAtOffset(offset: number): boolean {
  const { player, enemies, projectiles } = createCombatStatePools();
  const enemy = enemies[0]!;
  Object.assign(enemy, { active: true, role: 'warden', x: 0, z: 0, hull: 4, maxHull: 4 });
  projectiles[0] = {
    x: -3,
    z: offset,
    previousX: -3,
    previousZ: offset,
    vx: 360,
    vz: 0,
    life: 1,
    enemy: false,
    kind: 'cannon',
    ownerIndex: -1,
  };
  let hits = 0;
  updateCombatProjectiles(projectiles, enemies, player, 1 / 60, player.x, player.z, {
    onPlayerHit() {},
    onEnemyHit() { hits += 1; },
    onDeflection() {},
  });
  return hits === 1;
}

test('cannon path hits the true Warden radial edge and misses just outside', () => {
  const radialEdge = SHIP_FOOTPRINTS.ships.warden.radialRadius;
  assert.equal(cannonHitsWardenAtOffset(radialEdge), true);
  assert.equal(cannonHitsWardenAtOffset(radialEdge + 0.02), false);
});

function wardenChargeHitsAtOffset(offset: number): boolean {
  const { player, enemies } = createCombatStatePools();
  Object.assign(player, { x: 0, z: 0, invulnerable: 0 });
  const enemy = enemies[0]!;
  Object.assign(enemy, {
    active: true,
    role: 'warden',
    state: 'attack',
    stateTime: 1,
    pattern: 2,
    x: -3,
    z: offset,
    vx: 360,
    vz: 0,
  });
  let contacts = 0;
  updateEnemyBehavior(enemy, 0, 1 / 60, player, {
    fireHostile() {},
    damagePlayer() { contacts += 1; },
  });
  return contacts === 1;
}

test('Warden charge hits its true radial edge and misses beyond the player damage core', () => {
  const radialEdge = SHIP_FOOTPRINTS.ships.warden.radialRadius;
  assert.equal(wardenChargeHitsAtOffset(radialEdge), true);
  assert.equal(wardenChargeHitsAtOffset(radialEdge + PLAYER_HURT_RADIUS), true);
  assert.equal(wardenChargeHitsAtOffset(radialEdge + PLAYER_HURT_RADIUS + 0.02), false);
});

test('defeat and victory both accept click-to-retry into a fresh intro', () => {
  const defeatEvents: CombatEvent[] = [];
  const defeated = createCombatSimulation((event) => defeatEvents.push(event));
  runFrames(defeated, 60 * 40);
  defeated.update(1 / 60, Object.freeze({ ...idle, attack: true }));
  assert.equal(defeated.read().phase, 'intro');
  assert.equal(defeated.read().player.hull, 3);
  assert.ok(defeatEvents.some((event) => event.type === 'combat.retry'));

  const victoryEvents: CombatEvent[] = [];
  const victorious = createCombatSimulation((event) => victoryEvents.push(event));
  runFrames(victorious, 60 * 40, () => {
    const state = victorious.view();
    const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
      ?? state.enemies.find((enemy) => enemy.active);
    if (target === undefined) return idle;
    const aim = toward(target.x - state.player.x, target.z - state.player.z);
    return Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: target.mark > 0 && state.player.dashCooldown <= 0 && state.player.drive >= 32,
    });
  });
  assert.equal(victorious.read().phase, 'victory');
  assert.ok(victoryEvents.some((event) => event.type === 'combat.victory'));
  victorious.update(1 / 60, Object.freeze({ ...idle, attack: true }));
  assert.equal(victorious.read().phase, 'intro');
  assert.equal(victorious.read().round, 1);
});

test('identical fixed-step traces produce identical state digests', () => {
  const first = createCombatSimulation(() => {});
  const second = createCombatSimulation(() => {});
  for (let frame = 0; frame < 720; frame += 1) {
    const attack = frame % 53 === 0;
    const angle = frame * 0.017;
    const input: CombatInput = Object.freeze({
      movement: Object.freeze({ x: Math.cos(angle), z: Math.sin(angle), active: true }),
      aim: Object.freeze({ x: Math.cos(angle * 1.7), z: Math.sin(angle * 1.7) }),
      attack,
    });
    first.update(1 / 60, input);
    second.update(1 / 60, input);
  }
  assert.equal(first.digest(), second.digest());
});

test('digest hashes live state without JSON serialization', () => {
  const simulation = createCombatSimulation(() => {});
  const originalStringify = JSON.stringify;
  JSON.stringify = () => {
    throw new Error('digest must not allocate a serialized object graph');
  };
  try {
    const first = simulation.digest();
    simulation.update(1 / 60, idle);
    const second = simulation.digest();
    assert.notEqual(first, second);
  } finally {
    JSON.stringify = originalStringify;
  }
});

test('digest changes for every future-driving cooldown, motion, attack, and projectile field', () => {
  const state = createCombatSimulation(() => {}).read();
  const firstEnemy = state.enemies[0]!;
  const firstProjectile = state.projectiles[0]!;
  const enemyChange = (change: Partial<typeof firstEnemy>) => ({
    ...state,
    enemies: [{ ...firstEnemy, ...change }, ...state.enemies.slice(1)],
  });
  const projectileChange = (change: Partial<typeof firstProjectile>) => ({
    ...state,
    projectiles: [{ ...firstProjectile, ...change }, ...state.projectiles.slice(1)],
  });
  const variants = [
    ['phaseTime', { ...state, phaseTime: state.phaseTime + 0.001 }],
    ['shotsFired', { ...state, shotsFired: state.shotsFired + 1 }],
    ['fireCooldown', { ...state, fireCooldown: state.fireCooldown + 0.001 }],
    ['dashSequence', { ...state, dashSequence: state.dashSequence + 1 }],
    ['pendingVictory', { ...state, pendingVictory: !state.pendingVictory }],
    ['projectileCursor', { ...state, projectileCursor: state.projectileCursor + 1 }],
    ['particleCursor', { ...state, particleCursor: state.particleCursor + 1 }],
    ['player velocity', { ...state, player: { ...state.player, vx: state.player.vx + 0.001 } }],
    ['player facing', { ...state, player: { ...state.player, facingX: state.player.facingX + 0.001 } }],
    ['player dash', { ...state, player: { ...state.player, dash: state.player.dash + 0.001 } }],
    ['player cooldown', { ...state, player: { ...state.player, dashCooldown: state.player.dashCooldown + 0.001 } }],
    ['player invulnerability', { ...state, player: { ...state.player, invulnerable: state.player.invulnerable + 0.001 } }],
    ['player attack edge', { ...state, player: { ...state.player, attackHeld: !state.player.attackHeld } }],
    ['enemy velocity', enemyChange({ vx: firstEnemy.vx + 0.001 })],
    ['enemy state timer', enemyChange({ stateTime: firstEnemy.stateTime + 0.001 })],
    ['enemy cooldown', enemyChange({ cooldown: firstEnemy.cooldown + 0.001 })],
    ['enemy pattern', enemyChange({ pattern: firstEnemy.pattern + 1 })],
    ['enemy last dash', enemyChange({ lastDash: firstEnemy.lastDash + 1 })],
    ['projectile previous position', projectileChange({ previousX: firstProjectile.previousX + 0.001 })],
    ['projectile velocity', projectileChange({ vx: firstProjectile.vx + 0.001 })],
    ['projectile life', projectileChange({ life: firstProjectile.life + 0.001 })],
    ['projectile owner', projectileChange({ ownerIndex: firstProjectile.ownerIndex + 1 })],
  ] as const;
  const baseline = combatDigest(state);

  variants.forEach(([label, variant]) => {
    assert.notEqual(combatDigest(variant), baseline, label);
  });
});

test('digest fits the engine session transport limit', () => {
  const digest = createCombatSimulation(() => {}).digest();
  assert.ok(digest.length > 0);
  assert.ok(digest.length <= 256, `digest was ${digest.length} characters`);
});

test('terminal retry consumes one press and requires release before a new combat action', () => {
  const simulation = createCombatSimulation(() => {});
  runFrames(simulation, 60 * 40);
  assert.equal(simulation.read().phase, 'defeat');

  const heldAttack = Object.freeze({ ...idle, attack: true });
  simulation.update(1 / 60, heldAttack);
  assert.equal(simulation.read().phase, 'intro');
  runFrames(simulation, 60, () => heldAttack);
  assert.equal(simulation.read().phase, 'combat');
  assert.equal(simulation.read().dashes, 0);

  simulation.update(1 / 60, idle);
  simulation.update(1 / 60, heldAttack);
  assert.equal(simulation.read().dashes, 1);
});

test('normal thrust and release meet the combat response budget while dash appears in one fixed step', () => {
  const cruising = createCombatSimulation(() => {});
  const response = createCombatSimulation(() => {});
  runFrames(cruising, 60, () => idle);
  runFrames(response, 60, () => idle);
  const thrust: CombatInput = Object.freeze({
    movement: Object.freeze({ x: 1, z: 0, active: true }),
    aim: Object.freeze({ x: 1, z: 0 }),
    attack: false,
  });
  runFrames(cruising, 60, () => thrust);
  runFrames(response, 7, () => thrust);
  const cruiseSpeed = Math.hypot(cruising.read().player.vx, cruising.read().player.vz);
  const responseSpeed = Math.hypot(response.read().player.vx, response.read().player.vz);
  assert.ok(responseSpeed >= cruiseSpeed * 0.9);

  runFrames(response, 9, () => idle);
  const releasedSpeed = Math.hypot(response.read().player.vx, response.read().player.vz);
  assert.ok(releasedSpeed <= cruiseSpeed * 0.2);

  const beforeDash = response.read();
  response.update(1 / 60, Object.freeze({ ...thrust, attack: true }));
  const afterDash = response.read();
  assert.equal(afterDash.dashes, beforeDash.dashes + 1);
  assert.ok(afterDash.player.dash > 0);
  assert.notEqual(afterDash.player.x, beforeDash.player.x);
});

test('the skilled opening trace establishes the first-thirty-second escalation beats', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));
  let firstTelegraph = Number.POSITIVE_INFINITY;
  runFrames(simulation, 60 * 21, () => {
    const state = simulation.view();
    if (state.enemies.some((enemy) => enemy.active && enemy.state === 'telegraph')) {
      firstTelegraph = Math.min(firstTelegraph, state.time);
    }
    const target = state.enemies.find((enemy) => enemy.active && enemy.mark > 0)
      ?? state.enemies.find((enemy) => enemy.active);
    if (target === undefined) return idle;
    const aim = toward(target.x - state.player.x, target.z - state.player.z);
    return Object.freeze({
      movement: Object.freeze({ ...aim, active: true }),
      aim,
      attack: target.mark > 0 && state.player.dashCooldown <= 0 && state.player.drive >= 32,
    });
  });

  const firstMark = events.find((event) => event.type === 'combat.enemy-marked');
  const firstDash = events.find((event) => event.type === 'combat.dash');
  const firstClear = events.find((event) => event.type === 'combat.round-cleared' && event.round === 1);
  const secondRound = events.find((event) => event.type === 'combat.round-started' && event.round === 2);
  assert.ok(firstMark && firstMark.simulationTime <= 4);
  assert.ok(firstDash && firstDash.simulationTime <= 8);
  assert.ok(firstTelegraph <= 13);
  assert.ok(firstClear && firstClear.simulationTime <= 18);
  assert.ok(secondRound && secondRound.simulationTime <= 21);
});
