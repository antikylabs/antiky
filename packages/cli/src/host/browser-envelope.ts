import {
  EngineSessionValidationError,
  PointLightInspectionValidationError,
  createInspectionSnapshot,
  InspectionValidationError,
  type InspectionSnapshot,
} from '@antiky/framework';

import type {
  CaptureActionInput,
  PointLightActionResultInput,
  SessionControlActionResultInput,
} from './actions.ts';

type UnknownRecord = Record<string, unknown>;

export class BrowserEnvelopeError extends Error {
  constructor(
    readonly status: 400 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BrowserEnvelopeError';
  }
}

export type BrowserSnapshotEnvelope = Readonly<{
  snapshot: InspectionSnapshot;
  publicationSequence: number;
}>;

export type BrowserDisconnectEnvelope = Readonly<{
  runtimeInstanceId: string;
  publicationSequence: number;
}>;

export type BrowserActionResultEnvelope =
  | Readonly<{
    kind: 'capture';
    input: CaptureActionInput;
    snapshot: InspectionSnapshot | null;
    publicationSequence: number | null;
  }>
  | Readonly<{ kind: 'point-light-command'; input: PointLightActionResultInput }>
  | Readonly<{ kind: 'session-control'; input: SessionControlActionResultInput }>;

function fail(status: 400 | 409, code: string, message: string): never {
  throw new BrowserEnvelopeError(status, code, message);
}

function readObject(value: unknown): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(400, 'ANTIKY_MESSAGE_INVALID', 'Expected a message object.');
  }
  return value as UnknownRecord;
}

function hasExactKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function requireSession(record: UnknownRecord, developmentSessionId: string): void {
  if (record.schemaVersion !== 1) {
    fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid browser message version.');
  }
  if (record.developmentSessionId !== developmentSessionId) {
    fail(409, 'ANTIKY_SESSION_STALE', 'Development session is stale.');
  }
}

function readSequence(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    fail(400, 'ANTIKY_MESSAGE_INVALID', 'Publication sequence must be a positive integer.');
  }
  return value as number;
}

function readActionResultRecord(
  value: unknown,
  developmentSessionId: string,
): { result: UnknownRecord; actionId: string; runtimeInstanceId: string } {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion', 'developmentSessionId', 'runtimeInstanceId', 'actionId', 'result',
  ])) fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action result fields.');
  requireSession(record, developmentSessionId);
  if (typeof record.actionId !== 'string' || typeof record.runtimeInstanceId !== 'string') {
    fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action result values.');
  }
  return {
    result: readObject(record.result),
    actionId: record.actionId,
    runtimeInstanceId: record.runtimeInstanceId,
  };
}

export function readBrowserSnapshotEnvelope(
  value: unknown,
  developmentSessionId: string,
): BrowserSnapshotEnvelope {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'publicationSequence',
    'snapshot',
  ])) fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid browser message fields.');
  requireSession(record, developmentSessionId);
  try {
    return Object.freeze({
      snapshot: createInspectionSnapshot(record.snapshot),
      publicationSequence: readSequence(record.publicationSequence),
    });
  } catch (cause: unknown) {
    if (
      cause instanceof InspectionValidationError
      || cause instanceof PointLightInspectionValidationError
      || cause instanceof EngineSessionValidationError
    ) {
      fail(400, cause.code, cause.message);
    }
    throw cause;
  }
}

export function readBrowserDisconnectEnvelope(
  value: unknown,
  developmentSessionId: string,
): BrowserDisconnectEnvelope {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'runtimeInstanceId',
    'publicationSequence',
  ])) fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid disconnect message fields.');
  requireSession(record, developmentSessionId);
  if (typeof record.runtimeInstanceId !== 'string' || record.runtimeInstanceId.length > 128) {
    fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid runtime instance ID.');
  }
  return Object.freeze({
    runtimeInstanceId: record.runtimeInstanceId,
    publicationSequence: readSequence(record.publicationSequence),
  });
}

export function readBrowserActionResultEnvelope(
  value: unknown,
  developmentSessionId: string,
): BrowserActionResultEnvelope {
  const { result, actionId, runtimeInstanceId } = readActionResultRecord(
    value,
    developmentSessionId,
  );
  if (result.kind === 'capture') {
    const legacyKeys = [
      'kind', 'mimeType', 'canvasWidth', 'canvasHeight', 'dataBase64',
    ];
    const observedKeys = [...legacyKeys, 'publicationSequence', 'snapshot'];
    const hasObservation = hasExactKeys(result, observedKeys);
    if (
      (!hasExactKeys(result, legacyKeys) && !hasObservation)
      || result.mimeType !== 'image/png'
      || typeof result.dataBase64 !== 'string'
    ) {
      fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid capture result fields.');
    }
    let snapshot: InspectionSnapshot | null = null;
    let publicationSequence: number | null = null;
    if (hasObservation) {
      publicationSequence = readSequence(result.publicationSequence);
      try {
        snapshot = createInspectionSnapshot(result.snapshot);
      } catch (cause: unknown) {
        if (
          cause instanceof InspectionValidationError
          || cause instanceof PointLightInspectionValidationError
          || cause instanceof EngineSessionValidationError
        ) fail(400, cause.code, cause.message);
        throw cause;
      }
      if (snapshot.runtime.instanceId !== runtimeInstanceId) {
        fail(409, 'ANTIKY_RUNTIME_STALE', 'Capture observation runtime is stale.');
      }
    }
    return Object.freeze({
      kind: 'capture',
      input: Object.freeze({
        actionId,
        runtimeInstanceId,
        ...(publicationSequence === null ? {} : { publicationSequence }),
        mimeType: 'image/png',
        canvasWidth: result.canvasWidth as number,
        canvasHeight: result.canvasHeight as number,
        dataBase64: result.dataBase64,
      }),
      snapshot,
      publicationSequence,
    });
  }
  if (result.kind === 'point-light-command') {
    if (!hasExactKeys(result, ['kind', 'commandResult'])) {
      fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid point-light action result fields.');
    }
    return Object.freeze({
      kind: 'point-light-command',
      input: Object.freeze({ actionId, runtimeInstanceId, result: result.commandResult }),
    });
  }
  if (result.kind === 'session-control') {
    if (!hasExactKeys(result, ['kind', 'controlResult', 'session'])) {
      fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid session-control result fields.');
    }
    return Object.freeze({
      kind: 'session-control',
      input: Object.freeze({
        actionId,
        runtimeInstanceId,
        result: result.controlResult,
        session: result.session,
      }),
    });
  }
  fail(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action result kind.');
}
