import {
  parseEvidenceArtifactRefV1,
  type EvidenceArtifactRefV1,
} from './evidence.ts';
import {
  parseObservationRefV1,
  type ObservationRefV1,
} from '../observation.ts';
import { AntikyCliError } from '../../errors.ts';

export const CAPTURE_MAX_WIDTH = 2560;
export const CAPTURE_MAX_HEIGHT = 1440;
export const CAPTURE_MAX_DEVICE_SCALE_FACTOR = 2;
export const CAPTURE_MAX_WARM_UP_FRAMES = 300;

export type CaptureRuntimePolicy = 'current-or-managed' | 'managed-only';

export type CaptureExpectedObservationV2 = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  runtimeInstanceId: string;
  sessionId?: string;
  completedStepCount?: number;
  stateDigest?: string | null;
}>;

export type CaptureFrameRequestV2 = Readonly<{
  schemaVersion: 2;
  expected: CaptureExpectedObservationV2;
  runtimePolicy: CaptureRuntimePolicy;
  target: Readonly<{
    width: number;
    height: number;
    deviceScaleFactor: number;
  }>;
  warmUpFrames: number;
  idempotencyKey: string;
}>;

export type DevelopmentCaptureResultV2 = Readonly<{
  schemaVersion: 2;
  actionId: string;
  captureId: string;
  source: 'interactive-runtime' | 'managed-runtime';
  observation: ObservationRefV1;
  deviceScaleFactor: number;
  artifact: EvidenceArtifactRefV1;
}>;

export type CaptureExpectedRuntimeV3 = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  currentRuntimeInstanceId: string | null;
  sessionId?: string;
  completedStepCount?: number;
  stateDigest?: string | null;
}>;

export type CaptureFrameRequestV3 = Readonly<{
  schemaVersion: 3;
  expected: CaptureExpectedRuntimeV3;
  runtimePolicy: CaptureRuntimePolicy;
  target: CaptureFrameRequestV2['target'];
  warmUpFrames: number;
  idempotencyKey: string;
}>;

export type DevelopmentCaptureResultV3 = Readonly<
  Omit<DevelopmentCaptureResultV2, 'schemaVersion'>
  & Readonly<{ schemaVersion: 3 }>
>;

type UnknownRecord = Record<string, unknown>;

function invalid(message: string, path: string): never {
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', message, path);
}

function object(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected a capture request object.', path);
  }
  return value as UnknownRecord;
}

function exactKeys(
  record: UnknownRecord,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) invalid('Unknown capture request field.', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(record, key)) invalid('Missing capture request field.', `${path}.${key}`);
  }
}

function string(value: unknown, path: string, maximum = 128): string {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) invalid('Expected a bounded capture string.', path);
  return value;
}

function count(value: unknown, path: string, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    invalid('Expected a bounded capture count.', path);
  }
  return value as number;
}

export function parseCaptureFrameRequestV2(value: unknown): CaptureFrameRequestV2 {
  const record = object(value, '$');
  exactKeys(record, [
    'schemaVersion', 'expected', 'runtimePolicy', 'target', 'warmUpFrames', 'idempotencyKey',
  ], [], '$');
  if (record.schemaVersion !== 2) invalid('Unsupported capture request version.', '$.schemaVersion');
  if (record.runtimePolicy !== 'current-or-managed' && record.runtimePolicy !== 'managed-only') {
    invalid('Unknown capture runtime policy.', '$.runtimePolicy');
  }
  const expected = object(record.expected, '$.expected');
  exactKeys(expected, [
    'developmentSessionId', 'acceptedBuildRevision', 'runtimeInstanceId',
  ], ['sessionId', 'completedStepCount', 'stateDigest'], '$.expected');
  if (expected.completedStepCount !== undefined && expected.sessionId === undefined) {
    invalid('A completed-step fence requires a session identity.', '$.expected.completedStepCount');
  }
  if (expected.stateDigest !== undefined && expected.completedStepCount === undefined) {
    invalid('A state-digest fence requires a completed step.', '$.expected.stateDigest');
  }
  const target = object(record.target, '$.target');
  exactKeys(target, ['width', 'height', 'deviceScaleFactor'], [], '$.target');
  const deviceScaleFactor = target.deviceScaleFactor;
  if (
    typeof deviceScaleFactor !== 'number'
    || !Number.isFinite(deviceScaleFactor)
    || deviceScaleFactor < 0.5
    || deviceScaleFactor > CAPTURE_MAX_DEVICE_SCALE_FACTOR
  ) invalid('Capture device scale factor exceeds limits.', '$.target.deviceScaleFactor');
  return Object.freeze({
    schemaVersion: 2,
    expected: Object.freeze({
      developmentSessionId: string(expected.developmentSessionId, '$.expected.developmentSessionId'),
      acceptedBuildRevision: count(expected.acceptedBuildRevision, '$.expected.acceptedBuildRevision'),
      runtimeInstanceId: string(expected.runtimeInstanceId, '$.expected.runtimeInstanceId'),
      ...(expected.sessionId === undefined
        ? {}
        : { sessionId: string(expected.sessionId, '$.expected.sessionId') }),
      ...(expected.completedStepCount === undefined
        ? {}
        : { completedStepCount: count(expected.completedStepCount, '$.expected.completedStepCount') }),
      ...(expected.stateDigest === undefined
        ? {}
        : {
          stateDigest: expected.stateDigest === null
            ? null
            : string(expected.stateDigest, '$.expected.stateDigest', 512),
        }),
    }),
    runtimePolicy: record.runtimePolicy,
    target: Object.freeze({
      width: count(target.width, '$.target.width', CAPTURE_MAX_WIDTH) || invalid(
        'Capture width must be positive.',
        '$.target.width',
      ),
      height: count(target.height, '$.target.height', CAPTURE_MAX_HEIGHT) || invalid(
        'Capture height must be positive.',
        '$.target.height',
      ),
      deviceScaleFactor,
    }),
    warmUpFrames: count(record.warmUpFrames, '$.warmUpFrames', CAPTURE_MAX_WARM_UP_FRAMES),
    idempotencyKey: string(record.idempotencyKey, '$.idempotencyKey'),
  });
}

export function parseCaptureFrameRequestV3(value: unknown): CaptureFrameRequestV3 {
  const record = object(value, '$');
  exactKeys(record, [
    'schemaVersion', 'expected', 'runtimePolicy', 'target', 'warmUpFrames', 'idempotencyKey',
  ], [], '$');
  if (record.schemaVersion !== 3) invalid('Unsupported capture request version.', '$.schemaVersion');
  if (record.runtimePolicy !== 'current-or-managed' && record.runtimePolicy !== 'managed-only') {
    invalid('Unknown capture runtime policy.', '$.runtimePolicy');
  }
  const expected = object(record.expected, '$.expected');
  exactKeys(expected, [
    'developmentSessionId', 'acceptedBuildRevision', 'currentRuntimeInstanceId',
  ], ['sessionId', 'completedStepCount', 'stateDigest'], '$.expected');
  const currentRuntimeInstanceId = expected.currentRuntimeInstanceId === null
    ? null
    : string(expected.currentRuntimeInstanceId, '$.expected.currentRuntimeInstanceId');
  if (currentRuntimeInstanceId === null && (
    expected.sessionId !== undefined
    || expected.completedStepCount !== undefined
    || expected.stateDigest !== undefined
  )) invalid('Session fences require a current runtime.', '$.expected.sessionId');
  if (expected.completedStepCount !== undefined && expected.sessionId === undefined) {
    invalid('A completed-step fence requires a session identity.', '$.expected.completedStepCount');
  }
  if (expected.stateDigest !== undefined && expected.completedStepCount === undefined) {
    invalid('A state-digest fence requires a completed step.', '$.expected.stateDigest');
  }
  const target = object(record.target, '$.target');
  exactKeys(target, ['width', 'height', 'deviceScaleFactor'], [], '$.target');
  const deviceScaleFactor = target.deviceScaleFactor;
  if (
    typeof deviceScaleFactor !== 'number'
    || !Number.isFinite(deviceScaleFactor)
    || deviceScaleFactor < 0.5
    || deviceScaleFactor > CAPTURE_MAX_DEVICE_SCALE_FACTOR
  ) invalid('Capture device scale factor exceeds limits.', '$.target.deviceScaleFactor');
  return Object.freeze({
    schemaVersion: 3,
    expected: Object.freeze({
      developmentSessionId: string(expected.developmentSessionId, '$.expected.developmentSessionId'),
      acceptedBuildRevision: count(expected.acceptedBuildRevision, '$.expected.acceptedBuildRevision'),
      currentRuntimeInstanceId,
      ...(expected.sessionId === undefined
        ? {}
        : { sessionId: string(expected.sessionId, '$.expected.sessionId') }),
      ...(expected.completedStepCount === undefined
        ? {}
        : { completedStepCount: count(expected.completedStepCount, '$.expected.completedStepCount') }),
      ...(expected.stateDigest === undefined
        ? {}
        : {
          stateDigest: expected.stateDigest === null
            ? null
            : string(expected.stateDigest, '$.expected.stateDigest', 512),
        }),
    }),
    runtimePolicy: record.runtimePolicy,
    target: Object.freeze({
      width: count(target.width, '$.target.width', CAPTURE_MAX_WIDTH) || invalid(
        'Capture width must be positive.', '$.target.width',
      ),
      height: count(target.height, '$.target.height', CAPTURE_MAX_HEIGHT) || invalid(
        'Capture height must be positive.', '$.target.height',
      ),
      deviceScaleFactor,
    }),
    warmUpFrames: count(record.warmUpFrames, '$.warmUpFrames', CAPTURE_MAX_WARM_UP_FRAMES),
    idempotencyKey: string(record.idempotencyKey, '$.idempotencyKey'),
  });
}

export function parseDevelopmentCaptureResultV2(value: unknown): DevelopmentCaptureResultV2 {
  const record = object(value, '$');
  exactKeys(record, [
    'schemaVersion', 'actionId', 'captureId', 'source', 'observation',
    'deviceScaleFactor', 'artifact',
  ], [], '$');
  if (record.schemaVersion !== 2) invalid('Unsupported capture result version.', '$.schemaVersion');
  if (record.source !== 'interactive-runtime' && record.source !== 'managed-runtime') {
    invalid('Unknown capture source.', '$.source');
  }
  const deviceScaleFactor = record.deviceScaleFactor;
  if (
    typeof deviceScaleFactor !== 'number'
    || !Number.isFinite(deviceScaleFactor)
    || deviceScaleFactor < 0.5
    || deviceScaleFactor > CAPTURE_MAX_DEVICE_SCALE_FACTOR
  ) invalid('Invalid capture device scale factor.', '$.deviceScaleFactor');
  const observation = parseObservationRefV1(record.observation);
  const artifact = parseEvidenceArtifactRefV1(record.artifact);
  if (
    artifact.kind !== 'still'
    || artifact.mimeType !== 'image/png'
    || artifact.observation.developmentSessionId !== observation.developmentSessionId
    || artifact.observation.runtimeInstanceId !== observation.runtimeInstanceId
    || artifact.observation.publicationSequence !== observation.publicationSequence
  ) invalid('Capture artifact does not match its observation.', '$.artifact');
  return Object.freeze({
    schemaVersion: 2,
    actionId: string(record.actionId, '$.actionId'),
    captureId: string(record.captureId, '$.captureId'),
    source: record.source,
    observation,
    deviceScaleFactor,
    artifact,
  });
}

export function parseDevelopmentCaptureResultV3(value: unknown): DevelopmentCaptureResultV3 {
  const record = object(value, '$');
  if (record.schemaVersion !== 3) invalid('Unsupported capture result version.', '$.schemaVersion');
  const parsed = parseDevelopmentCaptureResultV2({ ...record, schemaVersion: 2 });
  return Object.freeze({ ...parsed, schemaVersion: 3 });
}
