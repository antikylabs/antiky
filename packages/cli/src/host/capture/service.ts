import { createHash } from 'node:crypto';

import {
  parseCaptureFrameRequestV2,
  parseCaptureFrameRequestV3,
  type CaptureFrameRequestV2,
  type CaptureFrameRequestV3,
  type DevelopmentCaptureResultV2,
  type DevelopmentCaptureResultV3,
} from '../../development/capture/index.ts';
import type { ObservationRefV1 } from '../../development/observation.ts';
import { AntikyCliError } from '../../errors.ts';
import type { ManagedCaptureRuntime } from './runtime.ts';
import {
  createCaptureOperationLock,
  type CaptureOperationLock,
} from './operation-lock.ts';

const MAX_IDEMPOTENCY_RECORDS = 128;

type CaptureServiceState = Readonly<{
  developmentSessionId: string;
  acceptedBuildRevision: number;
  connectionState: 'waiting' | 'connected' | 'unavailable';
  observation: ObservationRefV1 | null;
}>;

type CaptureServiceOptions = Readonly<{
  configuredWidth: number;
  configuredHeight: number;
  readState(): CaptureServiceState;
  managedRuntime: ManagedCaptureRuntime;
  operationLock?: CaptureOperationLock;
  submitCapture(
    request: CaptureFrameRequestV2,
    source: DevelopmentCaptureResultV2['source'],
  ): Promise<DevelopmentCaptureResultV2>;
}>;

export interface CaptureService {
  captureFrame(
    request: CaptureFrameRequestV2 | CaptureFrameRequestV3,
  ): Promise<DevelopmentCaptureResultV2 | DevelopmentCaptureResultV3>;
  stop(): Promise<void>;
}

function failure(
  code:
    | 'CAPTURE_BUILD_STALE'
    | 'CAPTURE_OBSERVATION_STALE'
    | 'CAPTURE_DIMENSIONS_MISMATCH'
    | 'CAPTURE_RUNTIME_BUSY'
    | 'CAPTURE_TRACE_INVALID',
  message: string,
): AntikyCliError {
  return new AntikyCliError(code, message);
}

function requestDigest(request: CaptureFrameRequestV2 | CaptureFrameRequestV3): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex');
}

function validateTarget(
  request: CaptureFrameRequestV2 | CaptureFrameRequestV3,
  options: CaptureServiceOptions,
): void {
  if (
    request.target.width !== options.configuredWidth
    || request.target.height !== options.configuredHeight
  ) {
    throw failure(
      'CAPTURE_DIMENSIONS_MISMATCH',
      'Capture must use the configured final-canvas drawing-buffer dimensions.',
    );
  }
}

function validateHead(
  expected: Readonly<{ developmentSessionId: string; acceptedBuildRevision: number }>,
  state: CaptureServiceState,
): void {
  if (expected.developmentSessionId !== state.developmentSessionId) {
    throw failure('CAPTURE_OBSERVATION_STALE', 'The development session changed.');
  }
  if (expected.acceptedBuildRevision !== state.acceptedBuildRevision) {
    throw failure('CAPTURE_BUILD_STALE', 'The accepted build changed; read status and retry.');
  }
}

function validateManagedHeadAfterLaunch(
  expected: Readonly<{ developmentSessionId: string; acceptedBuildRevision: number }>,
  state: CaptureServiceState,
): void {
  if (expected.developmentSessionId !== state.developmentSessionId) {
    throw failure('CAPTURE_OBSERVATION_STALE', 'The development session changed.');
  }
  const isFirstRuntimeAcceptance = expected.acceptedBuildRevision === 0
    && state.acceptedBuildRevision === 1;
  if (
    expected.acceptedBuildRevision !== state.acceptedBuildRevision
    && !isFirstRuntimeAcceptance
  ) {
    throw failure('CAPTURE_BUILD_STALE', 'The accepted build changed; read status and retry.');
  }
}

function toRuntimeRequest(
  request: CaptureFrameRequestV3,
  observation: ObservationRefV1,
): CaptureFrameRequestV2 {
  return parseCaptureFrameRequestV2({
    schemaVersion: 2,
    expected: {
      developmentSessionId: request.expected.developmentSessionId,
      acceptedBuildRevision: observation.acceptedBuildRevision,
      runtimeInstanceId: observation.runtimeInstanceId,
      ...(request.expected.sessionId === undefined
        ? {}
        : { sessionId: request.expected.sessionId }),
      ...(request.expected.completedStepCount === undefined
        ? {}
        : { completedStepCount: request.expected.completedStepCount }),
      ...(request.expected.stateDigest === undefined
        ? {}
        : { stateDigest: request.expected.stateDigest }),
    },
    runtimePolicy: request.runtimePolicy,
    target: request.target,
    warmUpFrames: request.warmUpFrames,
    idempotencyKey: request.idempotencyKey,
    ...(request.fixture === undefined ? {} : { fixture: request.fixture }),
  });
}

export function createCaptureService(options: CaptureServiceOptions): CaptureService {
  const operationLock = options.operationLock ?? createCaptureOperationLock();
  const idempotency = new Map<string, Readonly<{
    digest: string;
    promise: Promise<DevelopmentCaptureResultV2 | DevelopmentCaptureResultV3>;
  }>>();
  let stopped = false;

  const captureV3 = async (request: CaptureFrameRequestV3): Promise<DevelopmentCaptureResultV3> => {
    const initial = options.readState();
    validateHead(request.expected, initial);
    const currentRuntimeInstanceId = initial.connectionState === 'connected'
      ? initial.observation?.runtimeInstanceId ?? null
      : null;
    if (currentRuntimeInstanceId !== request.expected.currentRuntimeInstanceId) {
      throw failure('CAPTURE_OBSERVATION_STALE', 'The current runtime slot changed.');
    }

    let source: DevelopmentCaptureResultV2['source'];
    let observation: ObservationRefV1;
    if (currentRuntimeInstanceId !== null) {
      if (!initial.observation || initial.observation.freshness !== 'current') {
        throw failure('CAPTURE_OBSERVATION_STALE', 'The current runtime observation is unavailable.');
      }
      const managed = options.managedRuntime.owns(currentRuntimeInstanceId);
      if (request.runtimePolicy === 'managed-only' && !managed) {
        throw failure(
          'CAPTURE_RUNTIME_BUSY',
          'An interactive runtime owns the current slot; disconnect it and retry managed capture.',
        );
      }
      if (managed) options.managedRuntime.assertSafe();
      source = managed ? 'managed-runtime' : 'interactive-runtime';
      observation = initial.observation;
    } else {
      const managed = await options.managedRuntime.ensureRuntime({
        deviceScaleFactor: request.target.deviceScaleFactor,
      });
      const launched = options.readState();
      validateManagedHeadAfterLaunch(request.expected, launched);
      if (
        launched.connectionState !== 'connected'
        || !launched.observation
        || launched.observation.runtimeInstanceId !== managed.runtimeInstanceId
        || launched.observation.acceptedBuildRevision !== launched.acceptedBuildRevision
        || launched.observation.freshness !== 'current'
      ) throw failure('CAPTURE_OBSERVATION_STALE', 'The managed runtime observation changed.');
      options.managedRuntime.assertSafe();
      source = 'managed-runtime';
      observation = launched.observation;
    }

    const result = await options.submitCapture(toRuntimeRequest(request, observation), source);
    return Object.freeze({ ...result, schemaVersion: 3 });
  };

  const perform = async (
    request: CaptureFrameRequestV2 | CaptureFrameRequestV3,
  ): Promise<DevelopmentCaptureResultV2 | DevelopmentCaptureResultV3> => {
    if (stopped) throw new AntikyCliError('CAPTURE_RUNTIME_UNAVAILABLE', 'Capture service stopped.');
    if (request.schemaVersion === 2) {
      return options.submitCapture(parseCaptureFrameRequestV2(request), 'interactive-runtime');
    }
    validateTarget(request, options);
    return captureV3(parseCaptureFrameRequestV3(request));
  };

  const execute = (
    request: CaptureFrameRequestV2 | CaptureFrameRequestV3,
  ): Promise<DevelopmentCaptureResultV2 | DevelopmentCaptureResultV3> => (
    operationLock.run(() => perform(request))
  );

  return Object.freeze({
    captureFrame(requestInput: CaptureFrameRequestV2 | CaptureFrameRequestV3) {
      const request = requestInput.schemaVersion === 2
        ? parseCaptureFrameRequestV2(requestInput)
        : parseCaptureFrameRequestV3(requestInput);
      const digest = requestDigest(request);
      const existing = idempotency.get(request.idempotencyKey);
      if (existing) {
        if (existing.digest !== digest) {
          throw failure(
            'CAPTURE_TRACE_INVALID',
            'The idempotency key is already bound to another capture request.',
          );
        }
        return existing.promise;
      }
      const promise = execute(request).catch((cause: unknown) => {
        idempotency.delete(request.idempotencyKey);
        throw cause;
      });
      idempotency.set(request.idempotencyKey, Object.freeze({ digest, promise }));
      if (idempotency.size > MAX_IDEMPOTENCY_RECORDS) {
        const oldest = idempotency.keys().next().value;
        if (oldest) idempotency.delete(oldest);
      }
      return promise;
    },
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      idempotency.clear();
      await options.managedRuntime.stop();
    },
  });
}
