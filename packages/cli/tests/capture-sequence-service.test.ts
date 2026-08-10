import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { ObservationRefV1 } from '../src/development/observation.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseCaptureGameplaySequenceResultV1 } from '../src/development/capture-sequence.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createCaptureSequenceService } from '../src/host/capture-sequence-service.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createEvidenceStore } from '../src/host/evidence-store.ts';
import type {
  ManagedCaptureRuntime,
  ManagedPresentationAction,
} from '../src/host/managed-capture-runtime.ts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function observation(runtimeInstanceId: string): ObservationRefV1 {
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: 'development-sequence-service-001',
    acceptedBuildRevision: 2,
    runtimeInstanceId,
    publicationSequence: 4,
    publishedAt: '2026-08-10T21:00:00.000Z',
    connectionState: 'connected',
    freshness: 'current',
    session: Object.freeze({
      sessionId: 'session-sequence-service-001',
      worldId: 'world-sequence-service-001',
      mode: 'running',
      completedStepCount: 12,
      controlRevision: 0,
      worldRevision: 12,
      stateDigest: 'sequence-state-12',
    }),
    world: Object.freeze({
      worldId: 'world-sequence-service-001',
      revision: 12,
      eventSequence: 3,
    }),
  });
}

test('a managed presentation trace produces private PNG masters, poster, WebM, and manifest', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-sequence-service-'));
  const evidenceStore = createEvidenceStore({
    rootDirectory,
    developmentSessionId: 'development-sequence-service-001',
  });
  let state = {
    developmentSessionId: 'development-sequence-service-001',
    acceptedBuildRevision: 2,
    connectionState: 'waiting' as 'waiting' | 'connected' | 'unavailable',
    observation: null as ObservationRefV1 | null,
    inspection: null,
  };
  const actions: ManagedPresentationAction[] = [];
  let now = 0;
  const managedRuntime: ManagedCaptureRuntime = {
    async ensureRuntime() {
      state = {
        ...state,
        connectionState: 'connected',
        observation: observation('runtime-sequence-service-001'),
      };
      return {
        runtimeInstanceId: 'runtime-sequence-service-001',
        webGpu: { status: 'available', unavailableReason: null },
      };
    },
    owns: (id) => id === 'runtime-sequence-service-001',
    webGpuStatus: () => ({ status: 'available', unavailableReason: null }),
    assertSafe: () => {},
    captureCanvasPng: async () => PNG,
    performPresentationAction: async (_id, action) => { actions.push(action); },
    waitForPresentationFrame: async () => {},
    encodePngSequence: async (_id, frames, framesPerSecond) => {
      assert.equal(frames.length, 2);
      assert.equal(framesPerSecond, 20);
      return {
        bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]),
        encoder: {
          name: 'chromium-media-recorder',
          version: '151.0.7922.34',
          codec: 'vp9',
          mimeType: 'video/webm',
          videoBitsPerSecond: 8_000_000,
          source: 'png-masters',
          audio: 'none',
        },
      };
    },
    releaseRuntime: async () => {},
    stop: async () => {},
  };
  const service = createCaptureSequenceService({
    configuredWidth: 1,
    configuredHeight: 1,
    projectRevision: 'a'.repeat(64),
    readState: () => state,
    managedRuntime,
    evidenceStore,
    nowMilliseconds: () => now,
    sleep: async (milliseconds) => { now += milliseconds; },
  });

  try {
    const result = await service.captureGameplaySequence({
      schemaVersion: 1,
      expected: {
        developmentSessionId: state.developmentSessionId,
        acceptedBuildRevision: 2,
        currentRuntimeInstanceId: null,
      },
      runtimePolicy: 'managed-only',
      target: { width: 1, height: 1, deviceScaleFactor: 1 },
      source: {
        kind: 'presentation-trace',
        framesPerSecond: 20,
        entries: [
          { kind: 'key-press', code: 'KeyD' },
          { kind: 'presentation-frame-wait', frameCount: 2 },
          { kind: 'key-release', code: 'KeyD' },
        ],
      },
      idempotencyKey: 'sequence-service-001',
    });
    assert.equal(result.source, 'managed-runtime');
    assert.equal(result.cadence.actualFrameCount, 2);
    assert.equal(result.cadence.droppedFrameCount, 0);
    assert.deepEqual(actions.map((action) => action.kind), ['key-press', 'key-release']);
    assert.equal(result.artifacts.masterFrameCount, 2);
    assert.equal(result.artifacts.poster.kind, 'poster');
    assert.equal(result.artifacts.video.mimeType, 'video/webm');
    assert.equal(result.artifacts.manifest.kind, 'manifest');
    assert.equal(result.artifacts.presentationTrace?.kind, 'presentation-trace');
    assert.deepEqual(parseCaptureGameplaySequenceResultV1(structuredClone(result)), result);
    assert.doesNotMatch(JSON.stringify(result), /base64|bytes|path|pid|credential|\/private\//i);

    const listed = evidenceStore.list({ evidenceId: result.evidenceId, limit: 256 });
    assert.deepEqual(new Set(listed.artifacts.map(({ artifact }) => artifact.kind)), new Set([
      'sequence-frame', 'poster', 'video', 'manifest', 'presentation-trace',
    ]));
    const manifest = await evidenceStore.read({
      evidenceId: result.evidenceId,
      artifactId: result.artifacts.manifest.artifactId,
    });
    const parsed = JSON.parse(manifest.bytes.toString('utf8'));
    assert.equal(parsed.privacy.gameCanvasOnly, true);
    assert.equal(parsed.privacy.desktopPixelsPossible, false);
    assert.equal(parsed.encoder.source, 'png-masters');
    assert.equal(parsed.artifacts.frames.length, 2);
    assert.equal(parsed.correlation.start.session.status, 'available');
    assert.equal(parsed.correlation.start.events.reason, 'event-history-not-published');
    assert.doesNotMatch(manifest.bytes.toString('utf8'), /\/Users\/|\/private\/|pid|credential/i);
  } finally {
    await service.stop();
    await evidenceStore.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('an encoder failure discards every partial sequence artifact', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-sequence-rollback-'));
  const evidenceStore = createEvidenceStore({
    rootDirectory,
    developmentSessionId: 'development-sequence-service-001',
  });
  const observed = observation('runtime-sequence-service-001');
  const managedRuntime: ManagedCaptureRuntime = {
    async ensureRuntime() {
      return {
        runtimeInstanceId: observed.runtimeInstanceId,
        webGpu: { status: 'available', unavailableReason: null },
      };
    },
    owns: () => true,
    webGpuStatus: () => ({ status: 'available', unavailableReason: null }),
    assertSafe: () => {},
    captureCanvasPng: async () => PNG,
    performPresentationAction: async () => {},
    waitForPresentationFrame: async () => {},
    encodePngSequence: async () => { throw new Error('private encoder detail'); },
    releaseRuntime: async () => {},
    stop: async () => {},
  };
  const service = createCaptureSequenceService({
    configuredWidth: 1,
    configuredHeight: 1,
    projectRevision: 'a'.repeat(64),
    readState: () => ({
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      connectionState: 'connected',
      observation: observed,
      inspection: null,
    }),
    managedRuntime,
    evidenceStore,
    nowMilliseconds: () => 100,
    sleep: async () => {},
  });
  try {
    await assert.rejects(() => service.captureGameplaySequence({
      schemaVersion: 1,
      expected: {
        developmentSessionId: observed.developmentSessionId,
        acceptedBuildRevision: observed.acceptedBuildRevision,
        currentRuntimeInstanceId: observed.runtimeInstanceId,
      },
      runtimePolicy: 'managed-only',
      target: { width: 1, height: 1, deviceScaleFactor: 1 },
      source: { kind: 'window', durationMilliseconds: 100, framesPerSecond: 10 },
      idempotencyKey: 'sequence-rollback-001',
    }));
    assert.equal(evidenceStore.list({ limit: 256 }).availableCount, 0);
  } finally {
    await service.stop();
    await evidenceStore.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('stop releases the managed runtime and settles an active sequence', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-sequence-stop-'));
  const evidenceStore = createEvidenceStore({
    rootDirectory,
    developmentSessionId: 'development-sequence-service-001',
  });
  const observed = observation('runtime-sequence-service-001');
  let stopCount = 0;
  let signalSleepStarted: (() => void) | undefined;
  const sleepStarted = new Promise<void>((resolve) => { signalSleepStarted = resolve; });
  const managedRuntime: ManagedCaptureRuntime = {
    async ensureRuntime() {
      return {
        runtimeInstanceId: observed.runtimeInstanceId,
        webGpu: { status: 'available', unavailableReason: null },
      };
    },
    owns: () => true,
    webGpuStatus: () => ({ status: 'available', unavailableReason: null }),
    assertSafe: () => {},
    captureCanvasPng: async () => PNG,
    performPresentationAction: async () => {},
    waitForPresentationFrame: async () => {},
    encodePngSequence: async () => { throw new Error('must not encode'); },
    releaseRuntime: async () => {},
    stop: async () => { stopCount += 1; },
  };
  const service = createCaptureSequenceService({
    configuredWidth: 1,
    configuredHeight: 1,
    projectRevision: 'a'.repeat(64),
    readState: () => ({
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      connectionState: 'connected',
      observation: observed,
      inspection: null,
    }),
    managedRuntime,
    evidenceStore,
    nowMilliseconds: () => 0,
    sleep: async () => {
      signalSleepStarted?.();
      await new Promise<void>(() => {});
    },
  });

  try {
    const capture = service.captureGameplaySequence({
      schemaVersion: 1,
      expected: {
        developmentSessionId: observed.developmentSessionId,
        acceptedBuildRevision: observed.acceptedBuildRevision,
        currentRuntimeInstanceId: observed.runtimeInstanceId,
      },
      runtimePolicy: 'managed-only',
      target: { width: 1, height: 1, deviceScaleFactor: 1 },
      source: { kind: 'window', durationMilliseconds: 100, framesPerSecond: 10 },
      idempotencyKey: 'sequence-stop-001',
    });
    await sleepStarted;
    await service.stop();
    await assert.rejects(
      () => capture,
      (error: unknown) => (
        error instanceof Error
        && 'code' in error
        && error.code === 'CAPTURE_RUNTIME_UNAVAILABLE'
      ),
    );
    assert.equal(stopCount, 1);
    assert.equal(evidenceStore.list({ limit: 256 }).availableCount, 0);
  } finally {
    await service.stop();
    await evidenceStore.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});

test('a private evidence-store failure returns the stable capture artifact code', async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'antiky-sequence-artifact-failure-'));
  const evidenceStore = createEvidenceStore({
    rootDirectory,
    developmentSessionId: 'development-sequence-service-001',
  });
  await evidenceStore.stop();
  const observed = observation('runtime-sequence-service-001');
  let now = 0;
  const managedRuntime: ManagedCaptureRuntime = {
    async ensureRuntime() {
      return {
        runtimeInstanceId: observed.runtimeInstanceId,
        webGpu: { status: 'available', unavailableReason: null },
      };
    },
    owns: () => true,
    webGpuStatus: () => ({ status: 'available', unavailableReason: null }),
    assertSafe: () => {},
    captureCanvasPng: async () => PNG,
    performPresentationAction: async () => {},
    waitForPresentationFrame: async () => {},
    encodePngSequence: async () => ({
      bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1]),
      encoder: {
        name: 'chromium-media-recorder',
        version: '151.0.7922.34',
        codec: 'vp9',
        mimeType: 'video/webm',
        videoBitsPerSecond: 8_000_000,
        source: 'png-masters',
        audio: 'none',
      },
    }),
    releaseRuntime: async () => {},
    stop: async () => {},
  };
  const service = createCaptureSequenceService({
    configuredWidth: 1,
    configuredHeight: 1,
    projectRevision: 'a'.repeat(64),
    readState: () => ({
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      connectionState: 'connected',
      observation: observed,
      inspection: null,
    }),
    managedRuntime,
    evidenceStore,
    nowMilliseconds: () => now,
    sleep: async (milliseconds) => { now += milliseconds; },
  });

  try {
    await assert.rejects(
      () => service.captureGameplaySequence({
        schemaVersion: 1,
        expected: {
          developmentSessionId: observed.developmentSessionId,
          acceptedBuildRevision: observed.acceptedBuildRevision,
          currentRuntimeInstanceId: observed.runtimeInstanceId,
        },
        runtimePolicy: 'managed-only',
        target: { width: 1, height: 1, deviceScaleFactor: 1 },
        source: { kind: 'window', durationMilliseconds: 100, framesPerSecond: 10 },
        idempotencyKey: 'sequence-artifact-failure-001',
      }),
      (error: unknown) => (
        error instanceof Error
        && 'code' in error
        && error.code === 'CAPTURE_ARTIFACT_FAILED'
      ),
    );
  } finally {
    await service.stop();
    await rm(rootDirectory, { recursive: true, force: true });
  }
});
