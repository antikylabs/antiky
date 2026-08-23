import { createHash, randomUUID } from 'node:crypto';

import {
  CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS,
  CAPTURE_SEQUENCE_MAX_FRAMES,
  captureSequenceFrameCount,
  parseCaptureGameplaySequenceRequestV1,
  type CaptureGameplaySequenceRequestV1,
  type CaptureGameplaySequenceResultV1,
  type PresentationTraceEntryV1,
} from '../../development/capture/sequence.ts';
import {
  CAPTURE_BROWSER_REVISION,
  CAPTURE_BROWSER_VERSION,
  CAPTURE_PLAYWRIGHT_VERSION,
} from '../../development/capture/capabilities.ts';
import type { ObservationRefV1 } from '../../development/observation.ts';
import { AntikyCliError } from '../../errors.ts';
import { readPngDimensions } from './action.ts';
import {
  createCaptureOperationLock,
  type CaptureOperationLock,
} from './operation-lock.ts';
import type { EvidenceStore } from './evidence-store.ts';
import type {
  ManagedCaptureRuntime,
  ManagedPresentationAction,
  ManagedWebMEncoding,
} from './runtime.ts';

const MAX_SEQUENCE_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_IDEMPOTENCY_RECORDS = 128;

type SequenceState = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  connectionState: 'waiting' | 'connected' | 'unavailable';
  observation: ObservationRefV1 | null;
  inspection: Readonly<{
    diagnostics?: readonly unknown[];
    measurements?: Readonly<{ render?: unknown }>;
    events?: Readonly<{ counts?: Readonly<{ available?: number }> }>;
  }> | null;
}>;

type CaptureSequenceServiceOptions = Readonly<{
  configuredWidth: number;
  configuredHeight: number;
  projectRevision: string;
  readState(): SequenceState;
  managedRuntime: ManagedCaptureRuntime;
  evidenceStore: EvidenceStore;
  operationLock?: CaptureOperationLock;
  nowMilliseconds?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export interface CaptureSequenceService {
  captureGameplaySequence(
    request: CaptureGameplaySequenceRequestV1,
  ): Promise<CaptureGameplaySequenceResultV1>;
  stop(): Promise<void>;
}

function failure(
  code:
    | 'CAPTURE_RUNTIME_UNAVAILABLE'
    | 'CAPTURE_RUNTIME_BUSY'
    | 'CAPTURE_BUILD_STALE'
    | 'CAPTURE_OBSERVATION_STALE'
    | 'CAPTURE_DIMENSIONS_MISMATCH'
    | 'CAPTURE_STEP_UNAVAILABLE'
    | 'CAPTURE_TRACE_INVALID'
    | 'CAPTURE_LIMIT_EXCEEDED'
    | 'CAPTURE_DROPPED_FRAMES'
    | 'CAPTURE_ENCODER_UNAVAILABLE'
    | 'CAPTURE_ARTIFACT_FAILED',
  message: string,
): AntikyCliError {
  return new AntikyCliError(code, message);
}

function requestDigest(request: CaptureGameplaySequenceRequestV1): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}

function validateTarget(
  request: CaptureGameplaySequenceRequestV1,
  options: CaptureSequenceServiceOptions,
): void {
  if (
    request.target.width !== options.configuredWidth
    || request.target.height !== options.configuredHeight
  ) {
    throw failure(
      'CAPTURE_DIMENSIONS_MISMATCH',
      'Gameplay sequence capture requires the configured final canvas dimensions.',
    );
  }
}

function currentRuntimeId(state: SequenceState): string | null {
  return state.connectionState === 'connected'
    ? state.observation?.runtimeInstanceId ?? null
    : null;
}

function validateInitial(
  request: CaptureGameplaySequenceRequestV1,
  state: SequenceState,
): void {
  if (request.expected.developmentSessionId !== state.developmentSessionId) {
    throw failure('CAPTURE_OBSERVATION_STALE', 'The development session changed.');
  }
  if (request.expected.acceptedBuildRevision !== state.acceptedBuildRevision) {
    throw failure('CAPTURE_BUILD_STALE', 'The accepted build changed; read status and retry.');
  }
  if (request.expected.currentRuntimeInstanceId !== currentRuntimeId(state)) {
    throw failure('CAPTURE_OBSERVATION_STALE', 'The current runtime slot changed.');
  }
}

function validateManagedObservation(
  request: CaptureGameplaySequenceRequestV1,
  state: SequenceState,
  runtimeInstanceId: string,
): ObservationRefV1 {
  const firstAcceptance = request.expected.acceptedBuildRevision === 0
    && state.acceptedBuildRevision === 1;
  if (
    state.developmentSessionId !== request.expected.developmentSessionId
    || (state.acceptedBuildRevision !== request.expected.acceptedBuildRevision && !firstAcceptance)
  ) throw failure('CAPTURE_BUILD_STALE', 'The accepted build changed during capture startup.');
  const observation = state.observation;
  if (
    state.connectionState !== 'connected'
    || !observation
    || observation.freshness !== 'current'
    || observation.runtimeInstanceId !== runtimeInstanceId
    || observation.acceptedBuildRevision !== state.acceptedBuildRevision
  ) throw failure('CAPTURE_OBSERVATION_STALE', 'The managed runtime observation changed.');
  if (
    request.expected.sessionId !== undefined
    && observation.session?.sessionId !== request.expected.sessionId
  ) throw failure('CAPTURE_OBSERVATION_STALE', 'The engine session changed.');
  if (
    request.expected.completedStepCount !== undefined
    && observation.session?.completedStepCount !== request.expected.completedStepCount
  ) throw failure('CAPTURE_OBSERVATION_STALE', 'The completed simulation step changed.');
  if (
    request.expected.stateDigest !== undefined
    && observation.session?.stateDigest !== request.expected.stateDigest
  ) throw failure('CAPTURE_OBSERVATION_STALE', 'The simulation state digest changed.');
  return observation;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPosterPng(frame: Buffer): Buffer {
  const iendOffset = frame.length - 12;
  if (iendOffset < 8 || frame.toString('ascii', iendOffset + 4, iendOffset + 8) !== 'IEND') {
    throw failure('CAPTURE_ARTIFACT_FAILED', 'The sequence poster source is invalid.');
  }
  const type = Buffer.from('tEXt');
  const data = Buffer.from('AntikyRole\0poster');
  const chunk = Buffer.allocUnsafe(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 8 + data.length);
  return Buffer.concat([frame.subarray(0, iendOffset), chunk, frame.subarray(iendOffset)]);
}

function correlation(state: SequenceState): Readonly<Record<string, unknown>> {
  return Object.freeze({
    session: state.observation?.session
      ? Object.freeze({ status: 'available', observation: 'sequence-observation' })
      : Object.freeze({ status: 'unavailable', reason: 'engine-session-not-published' }),
    world: state.observation?.world
      ? Object.freeze({ status: 'available', observation: 'sequence-observation' })
      : Object.freeze({ status: 'unavailable', reason: 'world-view-not-published' }),
    events: state.inspection?.events
      ? Object.freeze({
        status: 'available',
        availableCount: state.inspection.events.counts?.available ?? null,
      })
      : Object.freeze({ status: 'unavailable', reason: 'event-history-not-published' }),
    diagnostics: state.inspection
      ? Object.freeze({ status: 'available', count: state.inspection.diagnostics?.length ?? 0 })
      : Object.freeze({ status: 'unavailable', reason: 'runtime-inspection-not-published' }),
    render: state.inspection?.measurements?.render
      ? Object.freeze({ status: 'available', observation: 'sequence-observation' })
      : Object.freeze({ status: 'unavailable', reason: 'render-measurements-not-published' }),
  });
}

function isPresentationAction(
  entry: PresentationTraceEntryV1,
): entry is ManagedPresentationAction {
  return entry.kind !== 'presentation-frame-wait' && entry.kind !== 'completed-step-wait';
}

export function createCaptureSequenceService(
  options: CaptureSequenceServiceOptions,
): CaptureSequenceService {
  const nowMilliseconds = options.nowMilliseconds ?? (() => performance.now());
  const sleep = options.sleep ?? ((milliseconds: number) => (
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
  ));
  const idempotency = new Map<string, Readonly<{
    digest: string;
    promise: Promise<CaptureGameplaySequenceResultV1>;
  }>>();
  const operationLock = options.operationLock ?? createCaptureOperationLock();
  const activeOperations = new Set<Promise<CaptureGameplaySequenceResultV1>>();
  let signalStopped: (() => void) | undefined;
  const stoppedSignal = new Promise<void>((resolve) => { signalStopped = resolve; });
  let stopped = false;
  let stopping: Promise<void> | null = null;

  const assertActive = (): void => {
    if (stopped) throw failure('CAPTURE_RUNTIME_UNAVAILABLE', 'Capture service stopped.');
  };

  const sleepWhileActive = async (milliseconds: number): Promise<void> => {
    assertActive();
    await Promise.race([
      sleep(milliseconds),
      stoppedSignal.then(() => {
        throw failure('CAPTURE_RUNTIME_UNAVAILABLE', 'Capture service stopped.');
      }),
    ]);
  };

  const perform = async (
    request: CaptureGameplaySequenceRequestV1,
  ): Promise<CaptureGameplaySequenceResultV1> => {
    assertActive();
    let evidenceId: string | null = null;
    try {
      validateTarget(request, options);
      validateInitial(request, options.readState());
      const managed = await options.managedRuntime.ensureRuntime({
        deviceScaleFactor: request.target.deviceScaleFactor,
      });
      const startState = options.readState();
      const startObservation = validateManagedObservation(
        request,
        startState,
        managed.runtimeInstanceId,
      );
      options.managedRuntime.assertSafe();

      const frames: Buffer[] = [];
      const captureOffsetsMilliseconds: number[] = [];
      // What the simulation was doing when each frame was taken. Without this, no pixel
      // measurement can be tied to a simulation instant, so no claim correlating an event with a
      // frame is falsifiable.
      const frameObservations: {
        offsetMilliseconds: number;
        completedStepCount: number | null;
        stateDigest: string | null;
        eventSequence: number | null;
      }[] = [];
      const frameIntervalMilliseconds = 1000 / request.source.framesPerSecond;
      const startedAtMilliseconds = nowMilliseconds();
      let nextFrameOffsetMilliseconds = frameIntervalMilliseconds;
      let totalBytes = 0;
      let lateFrameCount = 0;

      const captureNextFrame = async (): Promise<void> => {
        const remaining = nextFrameOffsetMilliseconds - (nowMilliseconds() - startedAtMilliseconds);
        if (remaining > 0) await sleepWhileActive(remaining);
        assertActive();
        await options.managedRuntime.waitForPresentationFrame(managed.runtimeInstanceId);
        const actualOffset = nowMilliseconds() - startedAtMilliseconds;
        const previousOffset = captureOffsetsMilliseconds.at(-1);
        if (
          (previousOffset !== undefined && actualOffset <= previousOffset)
          || actualOffset - nextFrameOffsetMilliseconds > frameIntervalMilliseconds
        ) {
          lateFrameCount += 1;
        }
        const frame = await options.managedRuntime.captureCanvasPng(managed.runtimeInstanceId);
        const dimensions = readPngDimensions(frame);
        if (dimensions.width !== request.target.width || dimensions.height !== request.target.height) {
          throw failure('CAPTURE_DIMENSIONS_MISMATCH', 'The managed canvas dimensions changed.');
        }
        totalBytes += frame.byteLength;
        if (totalBytes > MAX_SEQUENCE_ARTIFACT_BYTES) {
          throw failure('CAPTURE_LIMIT_EXCEEDED', 'Sequence master bytes exceed limits.');
        }
        frames.push(frame);
        const offsetMilliseconds = Math.round(actualOffset * 1000) / 1000;
        captureOffsetsMilliseconds.push(offsetMilliseconds);
        const frameState = options.readState();
        frameObservations.push({
          offsetMilliseconds,
          completedStepCount: frameState.observation?.session?.completedStepCount ?? null,
          stateDigest: frameState.observation?.session?.stateDigest ?? null,
          eventSequence: frameState.observation?.publicationSequence ?? null,
        });
        nextFrameOffsetMilliseconds += frameIntervalMilliseconds;
      };

      if (request.source.kind === 'window') {
        for (let index = 0; index < captureSequenceFrameCount(request.source); index += 1) {
          await captureNextFrame();
        }
      } else {
        for (const entry of request.source.entries) {
          assertActive();
          if (isPresentationAction(entry)) {
            await options.managedRuntime.performPresentationAction(managed.runtimeInstanceId, entry);
          } else if (entry.kind === 'presentation-frame-wait') {
            for (let index = 0; index < entry.frameCount; index += 1) await captureNextFrame();
          } else {
            const deadline = nowMilliseconds() + entry.timeoutMilliseconds;
            while (true) {
              const state = options.readState();
              const observed = state.observation;
              if (
                state.connectionState !== 'connected'
                || observed?.runtimeInstanceId !== managed.runtimeInstanceId
                || observed.freshness !== 'current'
              ) throw failure('CAPTURE_OBSERVATION_STALE', 'The managed runtime changed during a step wait.');
              if (!observed.session) {
                throw failure('CAPTURE_STEP_UNAVAILABLE', 'The game does not publish EngineSession steps.');
              }
              if (observed.session.completedStepCount >= entry.completedStepCount) break;
              if (nowMilliseconds() >= deadline) {
                throw failure('CAPTURE_STEP_UNAVAILABLE', 'The completed-step wait timed out.');
              }
              await sleepWhileActive(Math.min(10, deadline - nowMilliseconds()));
            }
          }
        }
      }

      if (frames.length > CAPTURE_SEQUENCE_MAX_FRAMES) {
        throw failure('CAPTURE_LIMIT_EXCEEDED', 'Sequence frame count exceeds limits.');
      }
      if (lateFrameCount > 0) {
        throw failure(
          'CAPTURE_DROPPED_FRAMES',
          'Exact capture cadence was missed; reduce FPS or dimensions and retry.',
        );
      }
      if (nowMilliseconds() - startedAtMilliseconds > CAPTURE_SEQUENCE_MAX_DURATION_MILLISECONDS
        + frameIntervalMilliseconds) {
        throw failure('CAPTURE_LIMIT_EXCEEDED', 'Sequence capture duration exceeds limits.');
      }

      const endState = options.readState();
      const endObservation = validateManagedObservation(request, endState, managed.runtimeInstanceId);
      const encoded: ManagedWebMEncoding = await options.managedRuntime.encodePngSequence(
        managed.runtimeInstanceId,
        frames,
        request.source.framesPerSecond,
      );
      totalBytes += encoded.bytes.byteLength;
      if (totalBytes > MAX_SEQUENCE_ARTIFACT_BYTES) {
        throw failure('CAPTURE_LIMIT_EXCEEDED', 'Sequence artifact bytes exceed limits.');
      }

      const sequenceId = `sequence-${randomUUID()}`;
      evidenceId = `evidence-${randomUUID()}`;
      const traceHash = request.source.kind === 'presentation-trace'
        ? createHash('sha256').update(JSON.stringify(request.source.entries)).digest('hex')
        : null;
      const traceArtifact = request.source.kind === 'presentation-trace'
        ? await options.evidenceStore.put({
          evidenceId,
          kind: 'presentation-trace',
          role: 'presentation-trace',
          mimeType: 'application/json',
          bytes: Buffer.from(JSON.stringify({
            schemaVersion: 1,
            deterministic: false,
            sha256: traceHash,
            entries: request.source.entries,
          })),
          width: null,
          height: null,
          observation: startObservation,
        })
        : null;
      const frameArtifacts = [];
      for (let index = 0; index < frames.length; index += 1) {
        frameArtifacts.push(await options.evidenceStore.put({
          evidenceId,
          kind: 'sequence-frame',
          role: `sequence-frame-${String(index + 1).padStart(4, '0')}`,
          mimeType: 'image/png',
          bytes: frames[index]!,
          width: request.target.width,
          height: request.target.height,
          observation: endObservation,
        }));
      }
      const posterBytes = createPosterPng(frames[Math.floor(frames.length / 2)]!);
      const poster = await options.evidenceStore.put({
        evidenceId,
        kind: 'poster',
        role: 'sequence-poster',
        mimeType: 'image/png',
        bytes: posterBytes,
        width: request.target.width,
        height: request.target.height,
        observation: endObservation,
      });
      const video = await options.evidenceStore.put({
        evidenceId,
        kind: 'video',
        role: 'review-derivative',
        mimeType: 'video/webm',
        bytes: encoded.bytes,
        width: request.target.width,
        height: request.target.height,
        observation: endObservation,
      });
      const cadence = Object.freeze({
        framesPerSecond: request.source.framesPerSecond,
        requestedFrameCount: captureSequenceFrameCount(request.source),
        actualFrameCount: frames.length,
        lateFrameCount: 0 as const,
        droppedFrameCount: 0 as const,
        captureOffsetsMilliseconds: Object.freeze(captureOffsetsMilliseconds),
        frames: Object.freeze(frameObservations.map((entry) => Object.freeze(entry))),
      });
      const completedSteps = Object.freeze({
        start: startObservation.session?.completedStepCount ?? null,
        end: endObservation.session?.completedStepCount ?? null,
        startStateDigest: startObservation.session?.stateDigest ?? null,
        endStateDigest: endObservation.session?.stateDigest ?? null,
      });
      const manifestBytes = Buffer.from(JSON.stringify({
        schemaVersion: 1,
        sequenceId,
        evidenceId,
        projectRevision: options.projectRevision,
        capabilityRevision: 'capture-v1',
        runtime: {
          source: 'managed-runtime',
          playwrightVersion: CAPTURE_PLAYWRIGHT_VERSION,
          browserRevision: CAPTURE_BROWSER_REVISION,
          browserVersion: CAPTURE_BROWSER_VERSION,
          webGpu: managed.webGpu,
        },
        target: {
          kind: 'final-canvas',
          ...request.target,
          colorSpace: 'unknown',
          transfer: 'unknown',
        },
        source: request.source.kind,
        cadence,
        observations: { start: startObservation, end: endObservation },
        completedSteps,
        presentationTrace: traceArtifact
          ? { sha256: traceHash, artifact: traceArtifact }
          : { sha256: null, artifact: null },
        correlation: {
          start: correlation(startState),
          end: correlation(endState),
        },
        encoder: encoded.encoder,
        artifacts: {
          frames: frameArtifacts,
          poster,
          video,
          presentationTrace: traceArtifact,
        },
        receipt: { createdAt: new Date().toISOString(), timeAuthority: 'wall-clock-receipt-only' },
        reviewState: 'private-unreviewed',
        retention: { scope: 'development-session', state: 'retained' },
        privacy: {
          gameCanvasOnly: true,
          desktopPixelsPossible: false,
          audio: 'none',
          contentScan: 'not-performed',
        },
      }));
      const manifest = await options.evidenceStore.put({
        evidenceId,
        kind: 'manifest',
        role: 'sequence-manifest',
        mimeType: 'application/json',
        bytes: manifestBytes,
        width: null,
        height: null,
        observation: endObservation,
      });
      return Object.freeze({
        schemaVersion: 1,
        sequenceId,
        source: 'managed-runtime',
        evidenceId,
        observations: Object.freeze({ start: startObservation, end: endObservation }),
        target: request.target,
        cadence,
        completedSteps,
        artifacts: Object.freeze({
          masterFrameCount: frames.length,
          poster,
          manifest,
          video,
          presentationTrace: traceArtifact,
        }),
      });
    } catch (cause: unknown) {
      if (evidenceId) await options.evidenceStore.discard(evidenceId).catch(() => {});
      await options.managedRuntime.releaseRuntime().catch(() => {});
      if (
        cause instanceof AntikyCliError
        && cause.code.startsWith('ANTIKY_EVIDENCE_')
      ) {
        throw failure(
          'CAPTURE_ARTIFACT_FAILED',
          'Private sequence evidence could not be retained; reduce capture size and retry.',
        );
      }
      if (cause instanceof AntikyCliError) throw cause;
      throw failure('CAPTURE_ENCODER_UNAVAILABLE', 'Managed sequence encoding failed.');
    }
  };

  const execute = (request: CaptureGameplaySequenceRequestV1) => (
    operationLock.run(() => perform(request))
  );

  return Object.freeze({
    captureGameplaySequence(input: CaptureGameplaySequenceRequestV1) {
      const request = parseCaptureGameplaySequenceRequestV1(input);
      const digest = requestDigest(request);
      const existing = idempotency.get(request.idempotencyKey);
      if (existing) {
        if (existing.digest !== digest) {
          throw failure('CAPTURE_TRACE_INVALID', 'The idempotency key is bound to another sequence.');
        }
        return existing.promise;
      }
      const promise = execute(request).catch((cause: unknown) => {
        idempotency.delete(request.idempotencyKey);
        throw cause;
      });
      activeOperations.add(promise);
      void promise.finally(() => activeOperations.delete(promise)).catch(() => {});
      idempotency.set(request.idempotencyKey, Object.freeze({ digest, promise }));
      if (idempotency.size > MAX_IDEMPOTENCY_RECORDS) {
        const oldest = idempotency.keys().next().value;
        if (oldest) idempotency.delete(oldest);
      }
      return promise;
    },
    async stop(): Promise<void> {
      if (stopping) return stopping;
      stopped = true;
      signalStopped?.();
      stopping = (async () => {
        await options.managedRuntime.stop().catch(() => {});
        await Promise.allSettled([...activeOperations]);
        idempotency.clear();
      })();
      return stopping;
    },
  });
}
