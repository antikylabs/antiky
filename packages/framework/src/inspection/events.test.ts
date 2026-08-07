import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  EVENT_HISTORY_SCHEMA_VERSION,
  EventHistoryValidationError,
  createEventHistory,
  type EventHistoryInput,
} from './events.ts';

const WORLD_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abc';
const ENTITY_ID = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';

function commandId(index: number): string {
  return `018f0f3a-7b2c-7a1d-8e2f-${(0xac0 + index).toString(16).padStart(12, '0')}`;
}

function event(sequence: number) {
  return {
    eventSchemaVersion: 1,
    type: 'antiky.authoring.point-light-power-set',
    sequence,
    commandId: commandId(sequence),
    worldId: WORLD_ID,
    entityIds: [ENTITY_ID],
    revision: sequence + 1,
    occurredAt: `2026-08-05T03:00:0${sequence}.000Z`,
    data: { oldPower: sequence, newPower: sequence + 0.5 },
  };
}

function historyInput(): EventHistoryInput {
  return {
    schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
    owner: 'framework',
    sourceId: 'antiky.point-light-authoring',
    worldId: WORLD_ID,
    runtimeInstanceId: 'runtime-events-001',
    incomplete: false,
    counts: { available: 2, retained: 2 },
    retention: {
      lifetime: 'runtime-instance',
      storage: 'memory',
      overflow: 'reject-new',
      capacity: 256,
      droppedCount: 0,
    },
    events: [event(1), event(2)],
  };
}

test('event history preserves source order, accepted fact identity, and immutable bounded data', () => {
  const input = historyInput();
  const history = createEventHistory(input);

  (input.events[0]!.data as { oldPower: number }).oldPower = 99;
  input.events[0]!.entityIds.push(
    '018f0f3a-7b2c-7a1d-8e2f-123456789abe',
  );

  assert.deepEqual(history.events.map((item) => item.sequence), [1, 2]);
  assert.equal(history.events[0]?.type, 'antiky.authoring.point-light-power-set');
  assert.equal(history.events[0]?.commandId, commandId(1));
  assert.deepEqual(history.events[0]?.entityIds, [ENTITY_ID]);
  assert.equal(history.events[0]?.revision, 2);
  assert.equal(history.events[0]?.occurredAt, '2026-08-05T03:00:01.000Z');
  assert.deepEqual(history.events[0]?.data, { oldPower: 1, newPower: 1.5 });
  assert.deepEqual(history.counts, { available: 2, retained: 2 });
  assert.equal(history.retention.lifetime, 'runtime-instance');
  assert.ok(Object.isFrozen(history));
  assert.ok(Object.isFrozen(history.events));
  assert.ok(Object.isFrozen(history.events[0]?.entityIds));
  assert.ok(Object.isFrozen(history.events[0]?.data));
});

test('event history represents drop-oldest retention and its source lifetime honestly', () => {
  const input = historyInput();
  input.incomplete = true;
  input.counts = { available: 3, retained: 2 };
  input.retention = {
    lifetime: 'session',
    storage: 'memory',
    overflow: 'drop-oldest',
    capacity: 2,
    droppedCount: 1,
  };
  input.events = [event(2), event(3)];
  const history = createEventHistory(input);

  assert.equal(history.incomplete, true);
  assert.equal(history.retention.droppedCount, 1);
  assert.deepEqual(history.events.map((item) => item.sequence), [2, 3]);
});

test('event history rejects sequence gaps, identity mismatches, and false retention claims', () => {
  const gap = historyInput();
  gap.events[1]!.sequence = 3;
  assert.throws(
    () => createEventHistory(gap),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path === '$.events[1].sequence'
    ),
  );

  const wrongWorld = historyInput();
  wrongWorld.events[0]!.worldId = '018f0f3a-7b2c-7a1d-8e2f-123456789bbb';
  assert.throws(
    () => createEventHistory(wrongWorld),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path === '$.events[0].worldId'
    ),
  );

  const falseIncomplete = historyInput();
  falseIncomplete.incomplete = true;
  assert.throws(
    () => createEventHistory(falseIncomplete),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path === '$.incomplete'
    ),
  );

  const falseDrop = historyInput();
  falseDrop.retention.droppedCount = 1;
  assert.throws(
    () => createEventHistory(falseDrop),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path === '$.retention.droppedCount'
    ),
  );
});

test('event history rejects unknown fields and excessive event data', () => {
  assert.throws(
    () => createEventHistory({ ...historyInput(), rejectedCommands: [] }),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path === '$.rejectedCommands'
    ),
  );

  const large = historyInput();
  large.events[0]!.data = { text: 'x'.repeat(9_000) };
  assert.throws(
    () => createEventHistory(large),
    (error: unknown) => (
      error instanceof EventHistoryValidationError
      && error.path.startsWith('$.events[0].data')
    ),
  );
});
