import assert from 'node:assert/strict';
import test from 'node:test';

import type { DevelopmentCaptureResultV2 } from '../../../src/development/capture/index.ts';
import type { ObservationRefV1 } from '../../../src/development/observation.ts';
import { AntikyCliError } from '../../../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createCaptureService } from '../../../src/host/capture/service.ts';
import type { ManagedCaptureRuntime } from '../../../src/host/capture/runtime.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createCaptureOperationLock } from '../../../src/host/capture/operation-lock.ts';

function observation(runtimeInstanceId: string, acceptedBuildRevision = 3): ObservationRefV1 {
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: 'development-capture-service-001',
    acceptedBuildRevision,
    runtimeInstanceId,
    publicationSequence: 1,
    publishedAt: '2026-08-10T20:00:00.000Z',
    connectionState: 'connected',
    freshness: 'current',
    session: null,
    world: null,
  });
}

function result(
  source: DevelopmentCaptureResultV2['source'],
  observed: ObservationRefV1,
): DevelopmentCaptureResultV2 {
  return {
    schemaVersion: 2,
    actionId: 'action-capture-service-001',
    captureId: 'capture-service-001',
    source,
    observation: observed,
    deviceScaleFactor: 1,
    artifact: {
      schemaVersion: 1,
      evidenceId: 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
      artifactId: `artifact-${'a'.repeat(64)}`,
      uri: `antiky-evidence://evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0/artifact-${'a'.repeat(64)}`,
      kind: 'still',
      role: 'canvas-master',
      mimeType: 'image/png',
      width: 1280,
      height: 720,
      byteLength: 1,
      sha256: 'a'.repeat(64),
      createdAt: '2026-08-10T20:00:01.000Z',
      observation: observed,
      reviewState: 'private-unreviewed',
      retention: { scope: 'development-session', state: 'retained' },
      privacy: {
        gameCanvasOnly: true,
        desktopPixelsPossible: false,
        audio: 'none',
        contentScan: 'not-performed',
      },
    },
  };
}

function managedRuntime(onEnsure: () => void): ManagedCaptureRuntime {
  return {
    async ensureRuntime() {
      onEnsure();
      return {
        runtimeInstanceId: 'runtime-managed-service-001',
        webGpu: { status: 'available', unavailableReason: null },
      };
    },
    owns: (runtimeInstanceId) => runtimeInstanceId === 'runtime-managed-service-001',
    webGpuStatus: () => ({ status: 'available', unavailableReason: null }),
    assertSafe: () => {},
    captureCanvasPng: async () => Buffer.alloc(1),
    performPresentationAction: async () => {},
    waitForPresentationFrame: async () => {},
    encodePngSequence: async () => ({
      bytes: Buffer.from('webm'),
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
}

test('a cold capture launches a managed runtime once and deduplicates identical retries', async () => {
  let state: {
    developmentSessionId: string;
    acceptedBuildRevision: number;
    connectionState: 'waiting' | 'connected' | 'unavailable';
    observation: ObservationRefV1 | null;
  } = {
    developmentSessionId: 'development-capture-service-001',
    acceptedBuildRevision: 3,
    connectionState: 'waiting',
    observation: null,
  };
  let launches = 0;
  let submissions = 0;
  const managed = managedRuntime(() => {
    launches += 1;
    state = {
      ...state,
      connectionState: 'connected',
      observation: observation('runtime-managed-service-001'),
    };
  });
  const service = createCaptureService({
    configuredWidth: 1280,
    configuredHeight: 720,
    readState: () => state,
    managedRuntime: managed,
    async submitCapture(request, source) {
      submissions += 1;
      assert.equal(source, 'managed-runtime');
      assert.equal(request.expected.runtimeInstanceId, 'runtime-managed-service-001');
      assert.equal(request.runtimePolicy, 'managed-only');
      return result(source, state.observation!);
    },
  });
  const request = {
    schemaVersion: 3 as const,
    expected: {
      developmentSessionId: state.developmentSessionId,
      acceptedBuildRevision: 3,
      currentRuntimeInstanceId: null,
    },
    runtimePolicy: 'managed-only' as const,
    target: { width: 1280, height: 720, deviceScaleFactor: 1 },
    warmUpFrames: 2,
    idempotencyKey: 'managed-frame-001',
  };

  const [first, retry] = await Promise.all([
    service.captureFrame(request),
    service.captureFrame(structuredClone(request)),
  ]);
  assert.equal(first.schemaVersion, 3);
  assert.equal(first.source, 'managed-runtime');
  assert.equal(retry, first);
  assert.equal(launches, 1);
  assert.equal(submissions, 1);
  assert.throws(
    () => service.captureFrame({
      ...request,
      warmUpFrames: 3,
    }),
    (cause: unknown) => cause instanceof AntikyCliError && cause.code === 'CAPTURE_TRACE_INVALID',
  );
  await service.stop();
});

test('a first cold capture may establish accepted build revision one', async () => {
  let state: {
    developmentSessionId: string;
    acceptedBuildRevision: number;
    connectionState: 'waiting' | 'connected' | 'unavailable';
    observation: ObservationRefV1 | null;
  } = {
    developmentSessionId: 'development-capture-service-001',
    acceptedBuildRevision: 0,
    connectionState: 'waiting',
    observation: null,
  };
  const managed = managedRuntime(() => {
    state = {
      ...state,
      acceptedBuildRevision: 1,
      connectionState: 'connected',
      observation: observation('runtime-managed-service-001', 1),
    };
  });
  const service = createCaptureService({
    configuredWidth: 1280,
    configuredHeight: 720,
    readState: () => state,
    managedRuntime: managed,
    async submitCapture(request, source) {
      assert.equal(request.expected.acceptedBuildRevision, 1);
      return result(source, state.observation!);
    },
  });

  const captured = await service.captureFrame({
    schemaVersion: 3,
    expected: {
      developmentSessionId: state.developmentSessionId,
      acceptedBuildRevision: 0,
      currentRuntimeInstanceId: null,
    },
    runtimePolicy: 'managed-only',
    target: { width: 1280, height: 720, deviceScaleFactor: 1 },
    warmUpFrames: 0,
    idempotencyKey: 'managed-first-build-001',
  });

  assert.equal(captured.observation.acceptedBuildRevision, 1);
  await service.stop();
});

test('a fenced interactive capture never launches or drives a managed runtime', async () => {
  const observed = observation('runtime-interactive-service-001');
  let launches = 0;
  let source: string | null = null;
  const service = createCaptureService({
    configuredWidth: 1280,
    configuredHeight: 720,
    readState: () => ({
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      connectionState: 'connected',
      observation: observed,
    }),
    managedRuntime: managedRuntime(() => { launches += 1; }),
    async submitCapture(_request, selectedSource) {
      source = selectedSource;
      return result(selectedSource, observed);
    },
  });
  const captured = await service.captureFrame({
    schemaVersion: 3,
    expected: {
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      currentRuntimeInstanceId: observed.runtimeInstanceId,
    },
    runtimePolicy: 'current-or-managed',
    target: { width: 1280, height: 720, deviceScaleFactor: 1 },
    warmUpFrames: 0,
    idempotencyKey: 'interactive-frame-001',
  });
  assert.equal(captured.source, 'interactive-runtime');
  assert.equal(source, 'interactive-runtime');
  assert.equal(launches, 0);
  await assert.rejects(
    () => service.captureFrame({
      schemaVersion: 3,
      expected: {
        developmentSessionId: observed.developmentSessionId,
        acceptedBuildRevision: observed.acceptedBuildRevision,
        currentRuntimeInstanceId: observed.runtimeInstanceId,
      },
      runtimePolicy: 'managed-only',
      target: { width: 1280, height: 720, deviceScaleFactor: 1 },
      warmUpFrames: 0,
      idempotencyKey: 'interactive-managed-only-001',
    }),
    (cause: unknown) => cause instanceof AntikyCliError && cause.code === 'CAPTURE_RUNTIME_BUSY',
  );
  await assert.rejects(
    () => service.captureFrame({
      schemaVersion: 3,
      expected: {
        developmentSessionId: observed.developmentSessionId,
        acceptedBuildRevision: observed.acceptedBuildRevision,
        currentRuntimeInstanceId: null,
      },
      runtimePolicy: 'current-or-managed',
      target: { width: 1280, height: 720, deviceScaleFactor: 1 },
      warmUpFrames: 0,
      idempotencyKey: 'stale-slot-001',
    }),
    (cause: unknown) => cause instanceof AntikyCliError
      && cause.code === 'CAPTURE_OBSERVATION_STALE',
  );
  await service.stop();
});

test('a connected runtime owned by the capture service remains attested as managed', async () => {
  const observed = observation('runtime-managed-service-001');
  let launches = 0;
  const service = createCaptureService({
    configuredWidth: 1280,
    configuredHeight: 720,
    readState: () => ({
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      connectionState: 'connected',
      observation: observed,
    }),
    managedRuntime: managedRuntime(() => { launches += 1; }),
    async submitCapture(_request, source) {
      assert.equal(source, 'managed-runtime');
      return result(source, observed);
    },
  });

  const captured = await service.captureFrame({
    schemaVersion: 3,
    expected: {
      developmentSessionId: observed.developmentSessionId,
      acceptedBuildRevision: observed.acceptedBuildRevision,
      currentRuntimeInstanceId: observed.runtimeInstanceId,
    },
    runtimePolicy: 'managed-only',
    target: { width: 1280, height: 720, deviceScaleFactor: 1 },
    warmUpFrames: 0,
    idempotencyKey: 'retained-managed-frame-001',
  });

  assert.equal(captured.source, 'managed-runtime');
  assert.equal(launches, 0);
  await service.stop();
});

test('one capture operation lock rejects a concurrent writer and releases after settlement', async () => {
  const lock = createCaptureOperationLock();
  let release!: () => void;
  const first = lock.run(() => new Promise<string>((resolve) => { release = () => resolve('done'); }));
  await assert.rejects(
    () => lock.run(async () => 'overlap'),
    (cause: unknown) => cause instanceof AntikyCliError && cause.code === 'CAPTURE_RUNTIME_BUSY',
  );
  release();
  assert.equal(await first, 'done');
  assert.equal(await lock.run(async () => 'next'), 'next');
});
