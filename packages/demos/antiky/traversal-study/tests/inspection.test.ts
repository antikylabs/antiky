import assert from 'node:assert/strict';
import test from 'node:test';

import { createTraversalInspectionModel } from '../src/inspection.ts';
import { createTraversalSimulation } from '../src/simulation.ts';

test('traversal inspection exposes the authored course and live event history', () => {
  const inspection = createTraversalInspectionModel('traversal-inspection-test');
  const simulation = createTraversalSimulation((event) => inspection.record(event));
  const input = Object.freeze({ horizontal: 0, active: false, jump: false });
  for (let frame = 0; frame < 420; frame += 1) simulation.update(1 / 60, input);

  const world = inspection.world(simulation.read());
  const events = inspection.events();
  assert.equal(world.entities.length, 13);
  assert.equal(world.relationships.length, 12);
  assert.equal(world.stores.length, 2);
  assert.ok(events.events.some((event) => event.type === 'traversal.jump'));
  assert.ok(events.events.some((event) => event.type === 'traversal.land'));
  assert.ok(events.events.length <= events.retention.capacity);
});
