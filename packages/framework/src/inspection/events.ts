import {
  IdValidationError,
  parseCommandId,
  parseEntityId,
  parseWorldId,
  type CommandId,
  type EntityId,
  type WorldId,
} from '../identity/ids.ts';
import {
  InspectionJsonValueError,
  cloneInspectionJson,
  type InspectionJsonValue,
} from './json-value.ts';
import type { InspectionCount, InspectionCountInput } from './world.ts';

export const EVENT_HISTORY_SCHEMA_VERSION = 1 as const;
export const MAX_EVENT_HISTORY_EVENTS = 512;
export const MAX_EVENT_ENTITY_IDS = 16;

export type EventHistoryEntryInput = {
  eventSchemaVersion: number;
  type: string;
  sequence: number;
  commandId: unknown;
  worldId: unknown;
  entityIds: unknown[];
  revision: number;
  occurredAt: string;
  data: unknown;
};
export type EventHistoryInput = {
  schemaVersion: typeof EVENT_HISTORY_SCHEMA_VERSION;
  owner: 'framework';
  sourceId: string;
  worldId: unknown;
  runtimeInstanceId: string;
  incomplete: boolean;
  counts: InspectionCountInput;
  retention: {
    lifetime: 'runtime-instance' | 'session' | 'durable';
    storage: 'memory' | 'persistent';
    overflow: 'reject-new' | 'drop-oldest';
    capacity: number;
    droppedCount: number;
  };
  events: EventHistoryEntryInput[];
};

export type EventHistoryEntry = Readonly<{
  eventSchemaVersion: number;
  type: string;
  sequence: number;
  commandId: CommandId;
  worldId: WorldId;
  entityIds: readonly EntityId[];
  revision: number;
  occurredAt: string;
  data: InspectionJsonValue;
}>;
export type EventHistory = Readonly<{
  schemaVersion: typeof EVENT_HISTORY_SCHEMA_VERSION;
  owner: 'framework';
  sourceId: string;
  worldId: WorldId;
  runtimeInstanceId: string;
  incomplete: boolean;
  counts: InspectionCount;
  retention: Readonly<{
    lifetime: 'runtime-instance' | 'session' | 'durable';
    storage: 'memory' | 'persistent';
    overflow: 'reject-new' | 'drop-oldest';
    capacity: number;
    droppedCount: number;
  }>;
  events: readonly EventHistoryEntry[];
}>;

export class EventHistoryValidationError extends Error {
  readonly code = 'ANTIKY_EVENT_HISTORY_INVALID';

  constructor(message: string, readonly path: string) {
    super(`${message} at ${path}`);
    this.name = 'EventHistoryValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

function fail(message: string, path: string): never {
  throw new EventHistoryValidationError(message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(record: UnknownRecord, required: readonly string[], path: string): void {
  const allowed = new Set(required);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) fail('Missing field', `${path}.${key}`);
  }
}

function readCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value as number;
}

function readPositive(value: unknown, path: string): number {
  const result = readCount(value, path);
  if (result === 0) fail('Expected a positive safe integer', path);
  return result;
}

function readString(value: unknown, path: string, maximum: number, pattern: RegExp): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || !pattern.test(value)
  ) fail(`Expected a valid string no longer than ${maximum} characters`, path);
  return value;
}

function readId<T>(operation: () => T, path: string): T {
  try {
    return operation();
  } catch (cause: unknown) {
    if (cause instanceof IdValidationError) fail('Expected a canonical UUIDv7', path);
    throw cause;
  }
}

function readTime(value: unknown, path: string): string {
  if (
    typeof value !== 'string'
    || value.length > 64
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) fail('Expected an ISO 8601 UTC time', path);
  return value;
}

function readJson(value: unknown, path: string): InspectionJsonValue {
  try {
    return cloneInspectionJson(value, path);
  } catch (cause: unknown) {
    if (cause instanceof InspectionJsonValueError) fail(cause.reason, cause.path);
    throw cause;
  }
}

export function createEventHistory(input: unknown, path = '$'): EventHistory {
  const record = readObject(input, path);
  checkKeys(record, [
    'schemaVersion',
    'owner',
    'sourceId',
    'worldId',
    'runtimeInstanceId',
    'incomplete',
    'counts',
    'retention',
    'events',
  ], path);
  if (record.schemaVersion !== EVENT_HISTORY_SCHEMA_VERSION) {
    fail(`Expected schema version ${EVENT_HISTORY_SCHEMA_VERSION}`, `${path}.schemaVersion`);
  }
  if (record.owner !== 'framework') fail('Expected framework ownership', `${path}.owner`);
  if (typeof record.incomplete !== 'boolean') fail('Expected a boolean', `${path}.incomplete`);
  const worldId = readId(() => parseWorldId(record.worldId), `${path}.worldId`);

  if (!Array.isArray(record.events)) fail('Expected an array', `${path}.events`);
  if (record.events.length > MAX_EVENT_HISTORY_EVENTS) {
    fail(`Expected at most ${MAX_EVENT_HISTORY_EVENTS} events`, `${path}.events`);
  }

  const retentionRecord = readObject(record.retention, `${path}.retention`);
  checkKeys(retentionRecord, [
    'lifetime',
    'storage',
    'overflow',
    'capacity',
    'droppedCount',
  ], `${path}.retention`);
  const lifetime = readString(
    retentionRecord.lifetime,
    `${path}.retention.lifetime`,
    32,
    /^(runtime-instance|session|durable)$/,
  ) as 'runtime-instance' | 'session' | 'durable';
  const storage = readString(
    retentionRecord.storage,
    `${path}.retention.storage`,
    16,
    /^(memory|persistent)$/,
  ) as 'memory' | 'persistent';
  const overflow = readString(
    retentionRecord.overflow,
    `${path}.retention.overflow`,
    16,
    /^(reject-new|drop-oldest)$/,
  ) as 'reject-new' | 'drop-oldest';
  const capacity = readPositive(retentionRecord.capacity, `${path}.retention.capacity`);
  const droppedCount = readCount(
    retentionRecord.droppedCount,
    `${path}.retention.droppedCount`,
  );
  if (record.events.length > capacity) fail('Retained events exceed source capacity', `${path}.events`);
  if (overflow === 'reject-new' && droppedCount !== 0) {
    fail('Reject-new retention cannot drop accepted events', `${path}.retention.droppedCount`);
  }

  const countRecord = readObject(record.counts, `${path}.counts`);
  checkKeys(countRecord, ['available', 'retained'], `${path}.counts`);
  const available = readCount(countRecord.available, `${path}.counts.available`);
  const retained = readCount(countRecord.retained, `${path}.counts.retained`);
  if (retained !== record.events.length) {
    fail('Retained count does not match the event view', `${path}.counts.retained`);
  }
  if (available !== retained + droppedCount) {
    fail('Available count must equal retained plus dropped events', `${path}.counts.available`);
  }
  const expectedIncomplete = droppedCount > 0;
  if (record.incomplete !== expectedIncomplete) {
    fail('Event-history incomplete status does not match retention', `${path}.incomplete`);
  }

  const firstSequence = droppedCount + 1;
  const events = record.events.map((value, index) => {
    const eventPath = `${path}.events[${index}]`;
    const event = readObject(value, eventPath);
    checkKeys(event, [
      'eventSchemaVersion',
      'type',
      'sequence',
      'commandId',
      'worldId',
      'entityIds',
      'revision',
      'occurredAt',
      'data',
    ], eventPath);
    const eventWorldId = readId(() => parseWorldId(event.worldId), `${eventPath}.worldId`);
    if (eventWorldId !== worldId) fail('Event belongs to another world', `${eventPath}.worldId`);
    const sequence = readPositive(event.sequence, `${eventPath}.sequence`);
    if (sequence !== firstSequence + index) {
      fail('Event sequence is not contiguous with retained history', `${eventPath}.sequence`);
    }
    if (!Array.isArray(event.entityIds)) fail('Expected an array', `${eventPath}.entityIds`);
    if (event.entityIds.length > MAX_EVENT_ENTITY_IDS) {
      fail(`Expected at most ${MAX_EVENT_ENTITY_IDS} entity IDs`, `${eventPath}.entityIds`);
    }
    const seenEntityIds = new Set<EntityId>();
    const entityIds = Object.freeze(event.entityIds.map((entityId, entityIndex) => {
      const entityPath = `${eventPath}.entityIds[${entityIndex}]`;
      const parsed = readId(() => parseEntityId(entityId), entityPath);
      if (seenEntityIds.has(parsed)) fail('Event entity identity is duplicated', entityPath);
      seenEntityIds.add(parsed);
      return parsed;
    }));
    return Object.freeze({
      eventSchemaVersion: readPositive(
        event.eventSchemaVersion,
        `${eventPath}.eventSchemaVersion`,
      ),
      type: readString(
        event.type,
        `${eventPath}.type`,
        128,
        /^[A-Za-z][A-Za-z0-9._:-]*$/,
      ),
      sequence,
      commandId: readId(() => parseCommandId(event.commandId), `${eventPath}.commandId`),
      worldId: eventWorldId,
      entityIds,
      revision: readCount(event.revision, `${eventPath}.revision`),
      occurredAt: readTime(event.occurredAt, `${eventPath}.occurredAt`),
      data: readJson(event.data, `${eventPath}.data`),
    });
  });
  if (available > 0 && events.at(-1)?.sequence !== available) {
    fail('Latest retained sequence does not match available count', `${path}.events`);
  }

  return Object.freeze({
    schemaVersion: EVENT_HISTORY_SCHEMA_VERSION,
    owner: 'framework',
    sourceId: readString(
      record.sourceId,
      `${path}.sourceId`,
      128,
      /^[A-Za-z][A-Za-z0-9._:-]*$/,
    ),
    worldId,
    runtimeInstanceId: readString(
      record.runtimeInstanceId,
      `${path}.runtimeInstanceId`,
      128,
      /^[A-Za-z0-9._:@+-]+$/,
    ),
    incomplete: record.incomplete,
    counts: Object.freeze({ available, retained }),
    retention: Object.freeze({ lifetime, storage, overflow, capacity, droppedCount }),
    events: Object.freeze(events),
  });
}
