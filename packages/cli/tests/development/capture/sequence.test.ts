import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseCaptureGameplaySequenceRequestV1 } from '../../../src/development/capture/sequence.ts';

const expected = Object.freeze({
  developmentSessionId: 'development-sequence-001',
  acceptedBuildRevision: 4,
  currentRuntimeInstanceId: null,
});

const target = Object.freeze({ width: 1280, height: 720, deviceScaleFactor: 1 });

test('window and presentation-trace sequence requests are strict, bounded, and immutable', () => {
  const windowRequest = parseCaptureGameplaySequenceRequestV1({
    schemaVersion: 1,
    expected,
    runtimePolicy: 'managed-only',
    target,
    source: { kind: 'window', durationMilliseconds: 3000, framesPerSecond: 30 },
    idempotencyKey: 'sequence-window-001',
  });
  assert.equal(windowRequest.source.kind, 'window');
  assert.ok(Object.isFrozen(windowRequest));
  assert.ok(Object.isFrozen(windowRequest.source));

  const traceRequest = parseCaptureGameplaySequenceRequestV1({
    schemaVersion: 1,
    expected,
    runtimePolicy: 'managed-only',
    target,
    source: {
      kind: 'presentation-trace',
      framesPerSecond: 20,
      entries: [
        { kind: 'key-press', code: 'KeyD' },
        { kind: 'presentation-frame-wait', frameCount: 20 },
        { kind: 'pointer-move', x: 0.75, y: 0.25 },
        { kind: 'pointer-press', button: 'primary' },
        { kind: 'pointer-release', button: 'primary' },
        { kind: 'key-release', code: 'KeyD' },
      ],
    },
    idempotencyKey: 'sequence-trace-001',
  });
  assert.equal(traceRequest.source.kind, 'presentation-trace');
  assert.ok(Object.isFrozen(traceRequest.source.entries));
  assert.ok(traceRequest.source.entries.every(Object.isFrozen));
});

test('presentation traces reject unsafe edges, coordinates, keys, and capture budgets', () => {
  const request = (entries: readonly unknown[], framesPerSecond = 30) => ({
    schemaVersion: 1,
    expected,
    runtimePolicy: 'managed-only',
    target,
    source: { kind: 'presentation-trace', framesPerSecond, entries },
    idempotencyKey: 'sequence-invalid-001',
  });
  for (const entries of [
    [{ kind: 'key-press', code: 'KeyD' }, { kind: 'key-press', code: 'KeyD' }],
    [{ kind: 'key-release', code: 'KeyD' }],
    [{ kind: 'pointer-release', button: 'primary' }],
    [{ kind: 'pointer-move', x: -0.1, y: 0.5 }],
    [{ kind: 'key-press', code: 'MetaLeft' }],
    [{ kind: 'presentation-frame-wait', frameCount: 181 }],
    [{ kind: 'presentation-frame-wait', frameCount: 1, script: 'document.cookie' }],
  ]) assert.throws(() => parseCaptureGameplaySequenceRequestV1(request(entries)));
  assert.throws(() => parseCaptureGameplaySequenceRequestV1(request([
    { kind: 'key-press', code: 'KeyD' },
    { kind: 'presentation-frame-wait', frameCount: 1 },
  ])));
  assert.throws(() => parseCaptureGameplaySequenceRequestV1(request([
    { kind: 'presentation-frame-wait', frameCount: 180 },
  ], 29)));
});

test('window sequences reject excessive duration, rate, frames, and non-managed policy', () => {
  const base = {
    schemaVersion: 1,
    expected,
    runtimePolicy: 'managed-only',
    target,
    source: { kind: 'window', durationMilliseconds: 6000, framesPerSecond: 30 },
    idempotencyKey: 'sequence-window-limits-001',
  } as const;
  assert.throws(() => parseCaptureGameplaySequenceRequestV1({
    ...base,
    source: { ...base.source, durationMilliseconds: 6001 },
  }));
  assert.throws(() => parseCaptureGameplaySequenceRequestV1({
    ...base,
    source: { ...base.source, framesPerSecond: 31 },
  }));
  assert.throws(() => parseCaptureGameplaySequenceRequestV1({
    ...base,
    runtimePolicy: 'current-or-managed',
  }));
  assert.throws(() => parseCaptureGameplaySequenceRequestV1({ ...base, pageUrl: 'file:///tmp' }));
});
