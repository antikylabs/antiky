import {
  parseCaptureFrameRequestV3,
  type CaptureExpectedRuntimeV3,
  type CaptureFrameRequestV2,
} from './capture.ts';
import {
  parseEvidenceArtifactRefV1,
  type EvidenceArtifactRefV1,
} from './evidence.ts';
import {
  parseObservationRefV1,
  type ObservationRefV1,
} from './observation.ts';
import { AntikyCliError } from '../errors.ts';

export const CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS = 6_000;
export const CAPTURE_SEQUENCE_MAX_FRAMES_PER_SECOND = 30;
export const CAPTURE_SEQUENCE_MAX_FRAMES = 180;
export const CAPTURE_SEQUENCE_MAX_TRACE_ENTRIES = 512;

export const PRESENTATION_KEY_CODES = Object.freeze([
  'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp',
  'Enter', 'Escape', 'KeyA', 'KeyD', 'KeyS', 'KeyW', 'Space',
] as const);

export type PresentationKeyCode = typeof PRESENTATION_KEY_CODES[number];

export type PresentationTraceEntryV1 =
  | Readonly<{ kind: 'key-press' | 'key-release'; code: PresentationKeyCode }>
  | Readonly<{ kind: 'pointer-move'; x: number; y: number }>
  | Readonly<{ kind: 'pointer-press' | 'pointer-release'; button: 'primary' }>
  | Readonly<{ kind: 'presentation-frame-wait'; frameCount: number }>
  | Readonly<{
    kind: 'completed-step-wait';
    completedStepCount: number;
    timeoutMilliseconds: number;
  }>;

export type CaptureSequenceSourceV1 =
  | Readonly<{
    kind: 'window';
    durationMilliseconds: number;
    framesPerSecond: number;
  }>
  | Readonly<{
    kind: 'presentation-trace';
    framesPerSecond: number;
    entries: readonly PresentationTraceEntryV1[];
  }>;

export type CaptureGameplaySequenceRequestV1 = Readonly<{
  schemaVersion: 1;
  expected: CaptureExpectedRuntimeV3;
  runtimePolicy: 'managed-only';
  target: CaptureFrameRequestV2['target'];
  source: CaptureSequenceSourceV1;
  idempotencyKey: string;
}>;

export type CaptureGameplaySequenceResultV1 = Readonly<{
  schemaVersion: 1;
  sequenceId: string;
  source: 'managed-runtime';
  evidenceId: string;
  observations: Readonly<{ start: ObservationRefV1; end: ObservationRefV1 }>;
  target: CaptureFrameRequestV2['target'];
  cadence: Readonly<{
    framesPerSecond: number;
    requestedFrameCount: number;
    actualFrameCount: number;
    lateFrameCount: 0;
    droppedFrameCount: 0;
    captureOffsetsMilliseconds: readonly number[];
    /**
     * What the simulation was doing when each frame was taken, parallel to
     * `captureOffsetsMilliseconds`.
     *
     * A capture without this can only say how a frame looked, never which simulation instant it
     * looked that way at — so an event and a frame cannot be correlated and any motion claim made
     * from pixels is unfalsifiable.
     */
    frames: readonly Readonly<{
      offsetMilliseconds: number;
      completedStepCount: number | null;
      stateDigest: string | null;
      eventSequence: number | null;
    }>[];
  }>;
  completedSteps: Readonly<{
    start: number | null;
    end: number | null;
    startStateDigest: string | null;
    endStateDigest: string | null;
  }>;
  artifacts: Readonly<{
    masterFrameCount: number;
    poster: EvidenceArtifactRefV1;
    manifest: EvidenceArtifactRefV1;
    video: EvidenceArtifactRefV1;
    presentationTrace: EvidenceArtifactRefV1 | null;
  }>;
}>;

type UnknownRecord = Record<string, unknown>;

function invalid(message: string, path: string): never {
  throw new AntikyCliError('CAPTURE_TRACE_INVALID', message, path);
}

function object(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected an object.', path);
  }
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, keys: readonly string[], path: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) invalid('Unknown field.', `${path}.${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) invalid('Missing field.', `${path}.${key}`);
  }
}

function count(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    invalid('Expected a bounded integer.', path);
  }
  return value as number;
}

function coordinate(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    invalid('Expected a normalized canvas coordinate.', path);
  }
  return value;
}

function parseEntry(value: unknown, index: number): PresentationTraceEntryV1 {
  const path = `$.source.entries[${index}]`;
  const entry = object(value, path);
  if (entry.kind === 'key-press' || entry.kind === 'key-release') {
    exactKeys(entry, ['kind', 'code'], path);
    if (!PRESENTATION_KEY_CODES.includes(entry.code as PresentationKeyCode)) {
      invalid('Unsupported presentation key code.', `${path}.code`);
    }
    return Object.freeze({ kind: entry.kind, code: entry.code as PresentationKeyCode });
  }
  if (entry.kind === 'pointer-move') {
    exactKeys(entry, ['kind', 'x', 'y'], path);
    return Object.freeze({
      kind: 'pointer-move',
      x: coordinate(entry.x, `${path}.x`),
      y: coordinate(entry.y, `${path}.y`),
    });
  }
  if (entry.kind === 'pointer-press' || entry.kind === 'pointer-release') {
    exactKeys(entry, ['kind', 'button'], path);
    if (entry.button !== 'primary') invalid('Unsupported pointer button.', `${path}.button`);
    return Object.freeze({ kind: entry.kind, button: 'primary' });
  }
  if (entry.kind === 'presentation-frame-wait') {
    exactKeys(entry, ['kind', 'frameCount'], path);
    return Object.freeze({
      kind: 'presentation-frame-wait',
      frameCount: count(entry.frameCount, `${path}.frameCount`, 1, CAPTURE_SEQUENCE_MAX_FRAMES),
    });
  }
  if (entry.kind === 'completed-step-wait') {
    exactKeys(entry, ['kind', 'completedStepCount', 'timeoutMilliseconds'], path);
    return Object.freeze({
      kind: 'completed-step-wait',
      completedStepCount: count(entry.completedStepCount, `${path}.completedStepCount`, 0, Number.MAX_SAFE_INTEGER),
      timeoutMilliseconds: count(
        entry.timeoutMilliseconds,
        `${path}.timeoutMilliseconds`,
        1,
        CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS,
      ),
    });
  }
  invalid('Unsupported presentation trace entry.', `${path}.kind`);
}

function validateEdges(entries: readonly PresentationTraceEntryV1[]): number {
  const pressedKeys = new Set<PresentationKeyCode>();
  let pointerPressed = false;
  let frameCount = 0;
  entries.forEach((entry, index) => {
    if (entry.kind === 'key-press') {
      if (pressedKeys.has(entry.code)) invalid('Repeated key press without release.', `$.source.entries[${index}]`);
      pressedKeys.add(entry.code);
    } else if (entry.kind === 'key-release') {
      if (!pressedKeys.delete(entry.code)) invalid('Key release has no matching press.', `$.source.entries[${index}]`);
    } else if (entry.kind === 'pointer-press') {
      if (pointerPressed) invalid('Repeated pointer press without release.', `$.source.entries[${index}]`);
      pointerPressed = true;
    } else if (entry.kind === 'pointer-release') {
      if (!pointerPressed) invalid('Pointer release has no matching press.', `$.source.entries[${index}]`);
      pointerPressed = false;
    } else if (entry.kind === 'presentation-frame-wait') {
      frameCount += entry.frameCount;
    }
  });
  if (pressedKeys.size > 0 || pointerPressed) invalid('Presentation input must end released.', '$.source.entries');
  if (frameCount < 1 || frameCount > CAPTURE_SEQUENCE_MAX_FRAMES) {
    invalid('Presentation trace frame count exceeds limits.', '$.source.entries');
  }
  return frameCount;
}

export function captureSequenceFrameCount(source: CaptureSequenceSourceV1): number {
  if (source.kind === 'window') {
    return Math.floor(source.durationMilliseconds * source.framesPerSecond / 1000);
  }
  return source.entries.reduce(
    (total, entry) => total + (entry.kind === 'presentation-frame-wait' ? entry.frameCount : 0),
    0,
  );
}

export function parseCaptureGameplaySequenceRequestV1(
  value: unknown,
): CaptureGameplaySequenceRequestV1 {
  const record = object(value, '$');
  exactKeys(record, [
    'schemaVersion', 'expected', 'runtimePolicy', 'target', 'source', 'idempotencyKey',
  ], '$');
  if (record.schemaVersion !== 1) invalid('Unsupported sequence request version.', '$.schemaVersion');
  if (record.runtimePolicy !== 'managed-only') {
    invalid('Gameplay sequences require the managed runtime.', '$.runtimePolicy');
  }
  const common = parseCaptureFrameRequestV3({
    schemaVersion: 3,
    expected: record.expected,
    runtimePolicy: record.runtimePolicy,
    target: record.target,
    warmUpFrames: 0,
    idempotencyKey: record.idempotencyKey,
  });
  const source = object(record.source, '$.source');
  let parsedSource: CaptureSequenceSourceV1;
  if (source.kind === 'window') {
    exactKeys(source, ['kind', 'durationMilliseconds', 'framesPerSecond'], '$.source');
    parsedSource = Object.freeze({
      kind: 'window',
      durationMilliseconds: count(
        source.durationMilliseconds,
        '$.source.durationMilliseconds',
        100,
        CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS,
      ),
      framesPerSecond: count(
        source.framesPerSecond,
        '$.source.framesPerSecond',
        1,
        CAPTURE_SEQUENCE_MAX_FRAMES_PER_SECOND,
      ),
    });
  } else if (source.kind === 'presentation-trace') {
    exactKeys(source, ['kind', 'framesPerSecond', 'entries'], '$.source');
    if (!Array.isArray(source.entries) || source.entries.length < 1
      || source.entries.length > CAPTURE_SEQUENCE_MAX_TRACE_ENTRIES) {
      invalid('Presentation trace entries exceed limits.', '$.source.entries');
    }
    const entries = Object.freeze(source.entries.map(parseEntry));
    const framesPerSecond = count(
      source.framesPerSecond,
      '$.source.framesPerSecond',
      1,
      CAPTURE_SEQUENCE_MAX_FRAMES_PER_SECOND,
    );
    const frameCount = validateEdges(entries);
    if (frameCount / framesPerSecond * 1000 > CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS) {
      invalid('Presentation trace duration exceeds limits.', '$.source.entries');
    }
    parsedSource = Object.freeze({ kind: 'presentation-trace', framesPerSecond, entries });
  } else {
    invalid('Unsupported sequence source.', '$.source.kind');
  }
  const frameCount = captureSequenceFrameCount(parsedSource);
  if (frameCount < 1 || frameCount > CAPTURE_SEQUENCE_MAX_FRAMES) {
    invalid('Sequence frame count exceeds limits.', '$.source');
  }
  return Object.freeze({
    schemaVersion: 1,
    expected: common.expected,
    runtimePolicy: 'managed-only',
    target: common.target,
    source: parsedSource,
    idempotencyKey: common.idempotencyKey,
  });
}

function boundedString(value: unknown, path: string, maximum = 128): string {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) invalid('Expected a bounded string.', path);
  return value;
}

function nullableCount(value: unknown, path: string): number | null {
  return value === null ? null : count(value, path, 0, Number.MAX_SAFE_INTEGER);
}

function nullableDigest(value: unknown, path: string): string | null {
  return value === null ? null : boundedString(value, path, 512);
}

export function parseCaptureGameplaySequenceResultV1(
  value: unknown,
): CaptureGameplaySequenceResultV1 {
  const record = object(value, '$');
  exactKeys(record, [
    'schemaVersion', 'sequenceId', 'source', 'evidenceId', 'observations', 'target',
    'cadence', 'completedSteps', 'artifacts',
  ], '$');
  if (record.schemaVersion !== 1 || record.source !== 'managed-runtime') {
    invalid('Unsupported sequence result.', '$.schemaVersion');
  }
  const observations = object(record.observations, '$.observations');
  exactKeys(observations, ['start', 'end'], '$.observations');
  const start = parseObservationRefV1(observations.start);
  const end = parseObservationRefV1(observations.end);
  const target = object(record.target, '$.target');
  exactKeys(target, ['width', 'height', 'deviceScaleFactor'], '$.target');
  const parsedTarget = Object.freeze({
    width: count(target.width, '$.target.width', 1, 2560),
    height: count(target.height, '$.target.height', 1, 1440),
    deviceScaleFactor: (() => {
      const scale = target.deviceScaleFactor;
      if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < 0.5 || scale > 2) {
        invalid('Sequence DPR is invalid.', '$.target.deviceScaleFactor');
      }
      return scale;
    })(),
  });
  const cadence = object(record.cadence, '$.cadence');
  exactKeys(cadence, [
    'framesPerSecond', 'requestedFrameCount', 'actualFrameCount', 'lateFrameCount',
    'droppedFrameCount', 'captureOffsetsMilliseconds', 'frames',
  ], '$.cadence');
  if (!Array.isArray(cadence.captureOffsetsMilliseconds)) {
    invalid('Sequence offsets are invalid.', '$.cadence.captureOffsetsMilliseconds');
  }
  const offsets = Object.freeze(cadence.captureOffsetsMilliseconds.map((offset, index) => {
    if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) {
      invalid('Sequence offset is invalid.', `$.cadence.captureOffsetsMilliseconds[${index}]`);
    }
    return offset;
  }));
  const actualFrameCount = count(
    cadence.actualFrameCount,
    '$.cadence.actualFrameCount',
    1,
    CAPTURE_SEQUENCE_MAX_FRAMES,
  );
  if (offsets.length !== actualFrameCount) {
    invalid('Sequence offsets do not match frame count.', '$.cadence.captureOffsetsMilliseconds');
  }
  if (!Array.isArray(cadence.frames) || cadence.frames.length !== actualFrameCount) {
    invalid('Sequence frame observations do not match frame count.', '$.cadence.frames');
  }
  const frameObservations = Object.freeze(cadence.frames.map((entry, index) => {
    const frame = object(entry, `$.cadence.frames[${index}]`);
    exactKeys(
      frame,
      ['offsetMilliseconds', 'completedStepCount', 'stateDigest', 'eventSequence'],
      `$.cadence.frames[${index}]`,
    );
    if (frame.offsetMilliseconds !== offsets[index]) {
      invalid('Frame observation offset does not match its capture offset.', `$.cadence.frames[${index}]`);
    }
    for (const key of ['completedStepCount', 'eventSequence'] as const) {
      const value = frame[key];
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
        invalid('Frame observation counter is invalid.', `$.cadence.frames[${index}].${key}`);
      }
    }
    if (frame.stateDigest !== null && typeof frame.stateDigest !== 'string') {
      invalid('Frame observation digest is invalid.', `$.cadence.frames[${index}].stateDigest`);
    }
    return Object.freeze({
      offsetMilliseconds: frame.offsetMilliseconds as number,
      completedStepCount: frame.completedStepCount as number | null,
      stateDigest: frame.stateDigest as string | null,
      eventSequence: frame.eventSequence as number | null,
    });
  }));
  if (cadence.lateFrameCount !== 0 || cadence.droppedFrameCount !== 0) {
    invalid('A successful exact sequence cannot report dropped frames.', '$.cadence');
  }
  const parsedCadence = Object.freeze({
    framesPerSecond: count(
      cadence.framesPerSecond,
      '$.cadence.framesPerSecond',
      1,
      CAPTURE_SEQUENCE_MAX_FRAMES_PER_SECOND,
    ),
    requestedFrameCount: count(
      cadence.requestedFrameCount,
      '$.cadence.requestedFrameCount',
      1,
      CAPTURE_SEQUENCE_MAX_FRAMES,
    ),
    actualFrameCount,
    lateFrameCount: 0 as const,
    droppedFrameCount: 0 as const,
    captureOffsetsMilliseconds: offsets,
    frames: frameObservations,
  });
  const steps = object(record.completedSteps, '$.completedSteps');
  exactKeys(steps, ['start', 'end', 'startStateDigest', 'endStateDigest'], '$.completedSteps');
  const completedSteps = Object.freeze({
    start: nullableCount(steps.start, '$.completedSteps.start'),
    end: nullableCount(steps.end, '$.completedSteps.end'),
    startStateDigest: nullableDigest(steps.startStateDigest, '$.completedSteps.startStateDigest'),
    endStateDigest: nullableDigest(steps.endStateDigest, '$.completedSteps.endStateDigest'),
  });
  const artifacts = object(record.artifacts, '$.artifacts');
  exactKeys(artifacts, [
    'masterFrameCount', 'poster', 'manifest', 'video', 'presentationTrace',
  ], '$.artifacts');
  const poster = parseEvidenceArtifactRefV1(artifacts.poster);
  const manifest = parseEvidenceArtifactRefV1(artifacts.manifest);
  const video = parseEvidenceArtifactRefV1(artifacts.video);
  const presentationTrace = artifacts.presentationTrace === null
    ? null
    : parseEvidenceArtifactRefV1(artifacts.presentationTrace);
  const evidenceId = boundedString(record.evidenceId, '$.evidenceId');
  if (
    poster.kind !== 'poster'
    || manifest.kind !== 'manifest'
    || video.kind !== 'video'
    || (presentationTrace !== null && presentationTrace.kind !== 'presentation-trace')
    || [poster, manifest, video, ...(presentationTrace ? [presentationTrace] : [])]
      .some((artifact) => artifact.evidenceId !== evidenceId)
  ) invalid('Sequence artifacts are incompatible.', '$.artifacts');
  return Object.freeze({
    schemaVersion: 1,
    sequenceId: boundedString(record.sequenceId, '$.sequenceId'),
    source: 'managed-runtime',
    evidenceId,
    observations: Object.freeze({ start, end }),
    target: parsedTarget,
    cadence: parsedCadence,
    completedSteps,
    artifacts: Object.freeze({
      masterFrameCount: count(
        artifacts.masterFrameCount,
        '$.artifacts.masterFrameCount',
        1,
        CAPTURE_SEQUENCE_MAX_FRAMES,
      ),
      poster,
      manifest,
      video,
      presentationTrace,
    }),
  });
}
