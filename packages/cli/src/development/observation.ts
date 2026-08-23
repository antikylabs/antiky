import type { InspectionSnapshot } from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';

const MAX_ID_LENGTH = 128;
const MAX_DIGEST_LENGTH = 512;

export type ObservationFreshness = 'current' | 'retained-unavailable';

export type ObservationSessionRefV1 = Readonly<{
  sessionId: string;
  worldId: string;
  mode: 'running' | 'paused' | 'faulted' | 'disposed';
  completedStepCount: number;
  controlRevision: number;
  worldRevision: number;
  stateDigest: string | null;
}>;

export type ObservationWorldRefV1 = Readonly<{
  worldId: string;
  revision: number | null;
  eventSequence: number | null;
}>;

export type ObservationRefV1 = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  acceptedBuildRevision: number;
  runtimeInstanceId: string;
  publicationSequence: number;
  publishedAt: string;
  connectionState: 'connected' | 'unavailable';
  freshness: ObservationFreshness;
  session: ObservationSessionRefV1 | null;
  world: ObservationWorldRefV1 | null;
}>;

export type CreateObservationRefV1Input = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  publicationSequence: number;
  publishedAt: string;
  connectionState: 'connected' | 'unavailable';
  inspection: InspectionSnapshot;
}>;

type UnknownRecord = Record<string, unknown>;

function invalid(message: string, path = '$'): never {
  throw new AntikyCliError('ANTIKY_OBSERVATION_INVALID', message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected an observation object.', path);
  }
  return value as UnknownRecord;
}

function exactKeys(
  value: UnknownRecord,
  required: readonly string[],
  path: string,
): void {
  const expected = new Set(required);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) invalid('Unknown observation field.', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) invalid('Missing observation field.', `${path}.${key}`);
  }
}

function readString(value: unknown, path: string, maximum = MAX_ID_LENGTH): string {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) invalid('Expected a bounded observation string.', path);
  return value;
}

function readCount(value: unknown, path: string, positive = false): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < (positive ? 1 : 0)
  ) invalid('Expected a bounded observation counter.', path);
  return value as number;
}

function readTimestamp(value: unknown, path: string): string {
  const timestamp = readString(value, path, 32);
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== timestamp) {
    invalid('Expected a canonical UTC observation timestamp.', path);
  }
  return timestamp;
}

function readSession(value: unknown): ObservationSessionRefV1 | null {
  if (value === null) return null;
  const record = readObject(value, '$.session');
  exactKeys(record, [
    'sessionId',
    'worldId',
    'mode',
    'completedStepCount',
    'controlRevision',
    'worldRevision',
    'stateDigest',
  ], '$.session');
  if (!['running', 'paused', 'faulted', 'disposed'].includes(String(record.mode))) {
    invalid('Expected a known engine-session mode.', '$.session.mode');
  }
  const stateDigest = record.stateDigest === null
    ? null
    : readString(record.stateDigest, '$.session.stateDigest', MAX_DIGEST_LENGTH);
  return Object.freeze({
    sessionId: readString(record.sessionId, '$.session.sessionId'),
    worldId: readString(record.worldId, '$.session.worldId'),
    mode: record.mode as ObservationSessionRefV1['mode'],
    completedStepCount: readCount(record.completedStepCount, '$.session.completedStepCount'),
    controlRevision: readCount(record.controlRevision, '$.session.controlRevision'),
    worldRevision: readCount(record.worldRevision, '$.session.worldRevision'),
    stateDigest,
  });
}

function readWorld(value: unknown): ObservationWorldRefV1 | null {
  if (value === null) return null;
  const record = readObject(value, '$.world');
  exactKeys(record, ['worldId', 'revision', 'eventSequence'], '$.world');
  return Object.freeze({
    worldId: readString(record.worldId, '$.world.worldId'),
    revision: record.revision === null
      ? null
      : readCount(record.revision, '$.world.revision'),
    eventSequence: record.eventSequence === null
      ? null
      : readCount(record.eventSequence, '$.world.eventSequence'),
  });
}

export function parseObservationRefV1(value: unknown): ObservationRefV1 {
  const record = readObject(value, '$');
  exactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'acceptedBuildRevision',
    'runtimeInstanceId',
    'publicationSequence',
    'publishedAt',
    'connectionState',
    'freshness',
    'session',
    'world',
  ], '$');
  if (record.schemaVersion !== 1) invalid('Unsupported observation version.', '$.schemaVersion');
  if (record.connectionState !== 'connected' && record.connectionState !== 'unavailable') {
    invalid('Expected a known observation connection state.', '$.connectionState');
  }
  const expectedFreshness = record.connectionState === 'connected'
    ? 'current'
    : 'retained-unavailable';
  if (record.freshness !== expectedFreshness) {
    invalid('Observation freshness does not match its connection state.', '$.freshness');
  }
  const session = readSession(record.session);
  const world = readWorld(record.world);
  if (session && world && session.worldId !== world.worldId) {
    invalid('Observation session and world identities disagree.', '$.world.worldId');
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: readString(
      record.developmentSessionId,
      '$.developmentSessionId',
    ),
    acceptedBuildRevision: readCount(
      record.acceptedBuildRevision,
      '$.acceptedBuildRevision',
    ),
    runtimeInstanceId: readString(record.runtimeInstanceId, '$.runtimeInstanceId'),
    publicationSequence: readCount(
      record.publicationSequence,
      '$.publicationSequence',
      true,
    ),
    publishedAt: readTimestamp(record.publishedAt, '$.publishedAt'),
    connectionState: record.connectionState,
    freshness: expectedFreshness,
    session,
    world,
  });
}

function inspectionWorld(inspection: InspectionSnapshot): ObservationWorldRefV1 | null {
  const worldId = inspection.session?.worldId
    ?? inspection.world?.worldId
    ?? inspection.events?.worldId
    ?? inspection.pointLights?.worldId;
  if (worldId === undefined) return null;
  const events = inspection.events?.events ?? [];
  const lastEvent = events.at(-1);
  return Object.freeze({
    worldId,
    revision: inspection.world?.revision ?? null,
    eventSequence: inspection.pointLights?.eventSequence ?? lastEvent?.sequence ?? 0,
  });
}

export function createObservationRefV1(
  input: CreateObservationRefV1Input,
): ObservationRefV1 {
  const session = input.inspection.session;
  return parseObservationRefV1({
    schemaVersion: 1,
    developmentSessionId: input.developmentSessionId,
    acceptedBuildRevision: input.acceptedBuildRevision,
    runtimeInstanceId: input.inspection.runtime.instanceId,
    publicationSequence: input.publicationSequence,
    publishedAt: input.publishedAt,
    connectionState: input.connectionState,
    freshness: input.connectionState === 'connected' ? 'current' : 'retained-unavailable',
    session: session === undefined
      ? null
      : {
        sessionId: session.sessionId,
        worldId: session.worldId,
        mode: session.mode,
        completedStepCount: session.clock.completedStepCount,
        controlRevision: session.revisions.controlRevision,
        worldRevision: session.revisions.worldRevision,
        stateDigest: session.lastCompletedStep?.stateDigest ?? null,
      },
    world: inspectionWorld(input.inspection),
  });
}
