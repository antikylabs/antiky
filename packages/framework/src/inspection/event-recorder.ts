import { EVENT_HISTORY_SCHEMA_VERSION, createEventHistory, type EventHistory } from './events.ts';

/**
 * A bounded ring of simulation events, and the history envelope built from it.
 *
 * The framework already owned the *format* — `createEventHistory` validates it — but every caller
 * had to hand-assemble the counts, the retention block and the drop arithmetic around it. Three
 * demos did, identically, down to a private helper that appeared character for character in all
 * three:
 *
 * ```ts
 * function count(value: number) { return { available: value, retained: value }; }
 * ```
 *
 * That is a shallow module: the interface was wider than what it hid, so the parts it did not hide
 * were copied. This keeps the ring, the sequence numbering and the drop accounting, and leaves the
 * caller only the part that is genuinely theirs — what an event of theirs looks like.
 *
 * The timestamp is an argument, not a `new Date()` inside `record()`. Two of the three demos read
 * the clock in there, which makes the inspection payload untestable and quietly makes a simulation
 * facility depend on wall time.
 */

/**
 * The counts block for a set where everything available is also retained.
 *
 * Appeared character for character as a private helper in three demos' inspection models. It is one
 * line, and one line copied three times is still three places to change when the envelope does.
 */
export function completeCounts(value: number): { available: number; retained: number } {
  return { available: value, retained: value };
}

export type RecordedEvent<TEvent> = Readonly<{
  event: TEvent;
  /** 1-based, monotonic, and never reused — including across a drop. */
  sequence: number;
  occurredAt: string;
}>;

export type EventHistoryDescriptor<TEvent> = Readonly<{
  owner: string;
  sourceId: string;
  worldId: string;
  runtimeInstanceId: string;
  /** What one of this demo's events looks like in the history envelope. */
  describe(recorded: RecordedEvent<TEvent>): Record<string, unknown>;
}>;

export type BoundedEventRecorder<TEvent> = Readonly<{
  /** Retain one event, dropping the oldest once capacity is reached. */
  record(event: TEvent, occurredAt: string): void;
  /** Everything still retained, oldest first. */
  retained(): readonly RecordedEvent<TEvent>[];
  /** How many have ever been recorded, including those since dropped. */
  available(): number;
  /** The validated history envelope, with counts, retention and drop count derived. */
  history(descriptor: EventHistoryDescriptor<TEvent>): EventHistory;
}>;

export function createBoundedEventRecorder<TEvent>(capacity: number): BoundedEventRecorder<TEvent> {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError(`An event recorder needs a positive integer capacity, received ${capacity}.`);
  }
  const ring: RecordedEvent<TEvent>[] = [];
  let recorded = 0;

  return Object.freeze({
    record(event: TEvent, occurredAt: string): void {
      recorded += 1;
      // Sequence counts every event ever recorded, so a dropped one leaves a gap rather than
      // letting a later event reuse its number. A reused sequence would make two different events
      // indistinguishable in a trace.
      ring.push(Object.freeze({ event, sequence: recorded, occurredAt }));
      if (ring.length > capacity) ring.shift();
    },
    retained(): readonly RecordedEvent<TEvent>[] {
      return ring;
    },
    available(): number {
      return recorded;
    },
    history(descriptor: EventHistoryDescriptor<TEvent>): EventHistory {
      return createEventHistory({
        schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
        owner: descriptor.owner,
        sourceId: descriptor.sourceId,
        worldId: descriptor.worldId,
        runtimeInstanceId: descriptor.runtimeInstanceId,
        incomplete: recorded > ring.length,
        counts: { available: recorded, retained: ring.length },
        retention: {
          lifetime: 'runtime-instance',
          storage: 'memory',
          overflow: 'drop-oldest',
          capacity,
          droppedCount: recorded - ring.length,
        },
        events: ring.map((entry) => descriptor.describe(entry)),
      } as Parameters<typeof createEventHistory>[0]);
    },
  });
}
