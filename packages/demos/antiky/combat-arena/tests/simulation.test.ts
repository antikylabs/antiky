import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCombatSimulation,
  type CombatInput,
  type CombatEvent,
} from '../src/simulation.ts';

const idle: CombatInput = Object.freeze({
  movement: Object.freeze({ x: 0, z: 0, active: false }),
  aim: Object.freeze({ x: 0, z: -1 }),
  attack: false,
});

test('combat opens with visible fire and produces bounded hit events', () => {
  const events: CombatEvent[] = [];
  const simulation = createCombatSimulation((event) => events.push(event));

  for (let frame = 0; frame < 6; frame += 1) simulation.update(1 / 60, idle);
  assert.ok(simulation.read().projectiles.some((projectile) => projectile.life > 0));
  for (let frame = 6; frame < 180; frame += 1) simulation.update(1 / 60, idle);

  const snapshot = simulation.read();
  assert.ok(snapshot.shotsFired >= 4);
  assert.ok(events.some((event) => event.type === 'combat.projectile-fired'));
  assert.ok(events.some((event) => event.type === 'combat.enemy-hit'));
  assert.ok(events.filter((event) => event.type === 'combat.enemy-hit').length >= 2);
});

test('attack input performs a directional dash without leaving the arena', () => {
  const simulation = createCombatSimulation(() => {});
  const dash: CombatInput = Object.freeze({
    movement: Object.freeze({ x: 1, z: 0, active: true }),
    aim: Object.freeze({ x: 1, z: 0 }),
    attack: true,
  });

  simulation.update(1 / 60, dash);
  for (let frame = 0; frame < 90; frame += 1) simulation.update(1 / 60, idle);

  const snapshot = simulation.read();
  assert.ok(snapshot.dashes >= 1);
  assert.ok(snapshot.player.x > 0.5);
  assert.ok(Math.hypot(snapshot.player.x, snapshot.player.z) <= 7.81);
});
