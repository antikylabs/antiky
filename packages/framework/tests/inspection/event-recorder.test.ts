import assert from 'node:assert/strict';
import test from 'node:test';

import { createBoundedEventRecorder } from '../../src/inspection/event-recorder.ts';

const DESCRIPTOR = {
  owner: 'framework' as const,
  sourceId: 'antiky.test-facts',
  worldId: '0197f27e-1000-7000-8000-000000000001',
  runtimeInstanceId: 'runtime-test-001',
  describe: (recorded: { event: { type: string }; sequence: number; occurredAt: string }) => ({
    eventSchemaVersion: 2,
    type: recorded.event.type,
    sequence: recorded.sequence,
    commandId: `0197f27e-2000-7000-8000-${recorded.sequence.toString(16).padStart(12, '0')}`,
    worldId: '0197f27e-1000-7000-8000-000000000001',
    entityIds: ['0197f27e-1000-7000-8000-000000000011'],
    revision: recorded.sequence,
    occurredAt: recorded.occurredAt,
    data: { factKind: 'deterministic-simulation' },
  }),
};

const at = (index: number) => `2026-08-14T00:00:${String(index).padStart(2, '0')}.000Z`;

test('a full ring keeps the newest events and reports what it dropped', () => {
  const recorder = createBoundedEventRecorder<{ type: string }>(3);
  for (let index = 0; index < 10; index += 1) {
    recorder.record({ type: `event-${index}` }, at(index));
  }

  const history = recorder.history(DESCRIPTOR);
  assert.equal(history.counts.available, 10);
  assert.equal(history.counts.retained, 3);
  assert.equal(history.retention.droppedCount, 7);
  assert.equal(history.incomplete, true);
  assert.deepEqual(
    recorder.retained().map((entry) => entry.event.type),
    ['event-7', 'event-8', 'event-9'],
  );
});

test('sequence numbers are 1-based, monotonic, and never reused after a drop', () => {
  const recorder = createBoundedEventRecorder<{ type: string }>(3);
  recorder.record({ type: 'first' }, at(0));
  assert.equal(recorder.retained()[0]!.sequence, 1, 'sequences start at 1, not 0');

  for (let index = 1; index < 10; index += 1) recorder.record({ type: `e${index}` }, at(index));
  const sequences = recorder.retained().map((entry) => entry.sequence);

  // 8, 9, 10 — not 1, 2, 3. A recycled sequence would make a dropped event and a retained one
  // indistinguishable in a trace.
  assert.deepEqual(sequences, [8, 9, 10]);
  for (let index = 1; index < sequences.length; index += 1) {
    assert.ok(sequences[index]! > sequences[index - 1]!, 'sequences must ascend');
  }
});

test('an unfilled ring is complete and drops nothing', () => {
  const recorder = createBoundedEventRecorder<{ type: string }>(8);
  recorder.record({ type: 'only' }, at(1));

  const history = recorder.history(DESCRIPTOR);
  assert.equal(history.incomplete, false);
  assert.equal(history.retention.droppedCount, 0);
  assert.deepEqual(history.counts, { available: 1, retained: 1 });
});

test('an empty recorder still produces a valid history', () => {
  const history = createBoundedEventRecorder<{ type: string }>(4).history(DESCRIPTOR);
  assert.deepEqual(history.counts, { available: 0, retained: 0 });
  assert.equal(history.incomplete, false);
  assert.equal(history.events.length, 0);
});

test('the timestamp is the caller\'s, not the recorder\'s clock', () => {
  const recorder = createBoundedEventRecorder<{ type: string }>(2);
  recorder.record({ type: 'authored' }, '2026-01-01T00:00:00.000Z');
  assert.equal(recorder.retained()[0]!.occurredAt, '2026-01-01T00:00:00.000Z');
});

test('a capacity that cannot hold anything is rejected at construction', () => {
  assert.throws(() => createBoundedEventRecorder(0), RangeError);
  assert.throws(() => createBoundedEventRecorder(-1), RangeError);
  assert.throws(() => createBoundedEventRecorder(2.5), RangeError);
});
