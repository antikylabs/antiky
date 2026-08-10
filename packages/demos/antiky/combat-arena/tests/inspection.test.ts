import assert from 'node:assert/strict';
import test from 'node:test';

import { createCombatInspectionModel } from '../src/inspection.ts';
import { createCombatSimulation } from '../src/simulation.ts';

function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}

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
  assert.equal(world.entities.length, 11);
  assert.equal(world.relationships.length, 10);
  assert.deepEqual(world.stores.map((store) => store.kind), ['render', 'runtime']);
  const player = world.entities.find((entity) => entity.label === 'Starbreaker');
  const squad = world.entities.find((entity) => entity.label === 'Circuit Hostiles');
  assert.ok(player?.components.some((component) => record(component.data).hull === simulation.read().player.hull));
  assert.ok(player?.components.some((component) => typeof record(component.data).drive === 'number'));
  assert.ok(squad?.components.some((component) => Array.isArray(record(component.data).roles)));
  assert.ok(events.events.some((event) => event.type === 'combat.enemy-marked'));
  assert.ok(events.events.some((event) => record(event.data).round === 1));
  assert.ok(events.events.length <= events.retention.capacity);
  assert.equal(events.counts.available, events.counts.retained + events.retention.droppedCount);
});

test('combat event history labels deterministic simulation facts without claiming wall-clock or command provenance', () => {
  const firstInspection = createCombatInspectionModel('combat-fact-test-a');
  const secondInspection = createCombatInspectionModel('combat-fact-test-b');
  const firstSimulation = createCombatSimulation((event) => firstInspection.record(event));
  const secondSimulation = createCombatSimulation((event) => secondInspection.record(event));
  const idle = Object.freeze({
    movement: Object.freeze({ x: 0, z: 0, active: false }),
    aim: Object.freeze({ x: 0, z: -1 }),
    attack: false,
  });
  for (let frame = 0; frame < 180; frame += 1) {
    firstSimulation.update(1 / 60, idle);
    secondSimulation.update(1 / 60, idle);
  }

  const first = firstInspection.events();
  const second = secondInspection.events();
  assert.equal(first.sourceId, 'antiky.combat-simulation-facts');
  assert.equal(first.events.length, second.events.length);
  assert.deepEqual(first.events, second.events);
  const fact = first.events[0];
  assert.ok(fact);
  const data = record(fact.data);
  assert.equal(data.factKind, 'deterministic-simulation');
  assert.equal(data.commandIdMapping, 'schema-required deterministic fact identity; no command occurred');
  assert.equal(data.occurredAtMapping, 'simulation seconds encoded from Unix epoch; not wall-clock time');
  assert.equal(fact.revision, data.simulationRevision);
  assert.equal(
    fact.occurredAt,
    new Date(Math.round(Number(data.simulationTimeSeconds) * 1_000)).toISOString(),
  );
});
