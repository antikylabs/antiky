import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatInspectionModel } from '../src/inspection.ts';
import { createCombatSimulation } from '../src/simulation.ts';

test('combat inspection exposes hierarchy, runtime stores, and bounded events', () => {
  const inspection = createCombatInspectionModel('combat-inspection-test');
  const simulation = createCombatSimulation((event) => inspection.record(event));
  const idle = Object.freeze({
    movement: Object.freeze({ x: 0, z: 0, active: false }),
    aim: Object.freeze({ x: 0, z: -1 }),
    attack: false,
  });
  for (let frame = 0; frame < 360; frame += 1) simulation.update(1 / 60, idle);

  const world = inspection.world(simulation.read());
  const events = inspection.events();
  assert.equal(world.entities.length, 14);
  assert.equal(world.relationships.length, 13);
  assert.deepEqual(world.stores.map((store) => store.kind), ['render', 'runtime']);
  assert.ok(events.events.some((event) => event.type === 'combat.enemy-hit'));
  assert.ok(events.events.length <= events.retention.capacity);
  assert.equal(events.counts.available, events.counts.retained + events.retention.droppedCount);
});
