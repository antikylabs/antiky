import { createHash, randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';

import {
  POINT_LIGHT_EDIT_PERMISSION,
  EngineSessionValidationError,
  PointLightCommandValidationError,
  parseEngineControlResult,
  parseEngineSessionStatus,
  parsePointLightCommandContext,
  parsePointLightCommandResult,
  type CorrectPointLightPowerRequest,
  type PointLightCommandContext,
  type PointLightCommandResult,
  type SetPointLightPowerCommand,
} from '@antiky/framework';

import type {
  DevelopmentReloadResult,
  DevelopmentSessionControlResult,
} from '../development/types.ts';
import {
  parseCaptureFrameRequestV2,
  type CaptureFrameRequestV2,
  type DevelopmentCaptureResultV2,
} from '../development/capture.ts';
import type { ObservationRefV1 } from '../development/observation.ts';
import { AntikyCliError } from '../errors.ts';
import {
  captureFailure,
  decodePng,
  persistLegacyCapture,
  readPngDimensions,
  staleCaptureError,
  validateCaptureObservation,
  type CaptureRuntimeContext,
} from './capture-action.ts';
import type { EvidenceStore } from './evidence-store.ts';
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticCode,
  type CliDiagnosticComponent,
  type CliDiagnosticLevel,
  type CliDiagnosticSink,
} from './diagnostics.ts';

const DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000;
export { MAX_CAPTURE_ENVELOPE_BYTES } from './capture-action.ts';

type BrowserDevelopmentActionBase = Readonly<{
  schemaVersion: 1;
  actionId: string;
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
}>;

export type BrowserDevelopmentAction =
  | (BrowserDevelopmentActionBase & Readonly<{ kind: 'reload' }>)
  | (BrowserDevelopmentActionBase & Readonly<{
    kind: 'capture';
    captureId: string;
    evidenceId?: string;
    target?: CaptureFrameRequestV2['target'];
    warmUpFrames?: number;
  }>)
  | (BrowserDevelopmentActionBase & Readonly<{
    kind: 'set-point-light-power';
    command: SetPointLightPowerCommand;
    context: PointLightCommandContext;
  }>)
  | (BrowserDevelopmentActionBase & Readonly<{
    kind: 'correct-point-light-power';
    request: CorrectPointLightPowerRequest;
    context: PointLightCommandContext;
  }>)
  | (BrowserDevelopmentActionBase & Readonly<{ kind: 'pause-simulation' }>)
  | (BrowserDevelopmentActionBase & Readonly<{ kind: 'resume-simulation' }>)
  | (BrowserDevelopmentActionBase & Readonly<{
    kind: 'step-simulation';
    expectedCompletedStepCount: number;
  }>);

export type CaptureActionInput = Readonly<{
  actionId: string;
  runtimeInstanceId: string;
  publicationSequence?: number;
  mimeType: 'image/png';
  canvasWidth: number;
  canvasHeight: number;
  dataBase64: string;
}>;

export type PointLightActionResultInput = Readonly<{
  actionId: string;
  runtimeInstanceId: string;
  result: unknown;
}>;

export type SessionControlActionResultInput = Readonly<{
  actionId: string;
  runtimeInstanceId: string;
  result: unknown;
  session: unknown;
}>;

type DevelopmentActionBrokerOptions = Readonly<{
  developmentSessionId: string;
  rootDirectory: string;
  readRuntimeContext(): CaptureRuntimeContext;
  evidenceStore?: EvidenceStore;
  timeoutMilliseconds?: number;
  now?: () => string;
  diagnosticSink?: CliDiagnosticSink;
}>;

type LegacyDevelopmentCaptureResult = Readonly<{
  schemaVersion: 1;
  actionId: string;
  captureId: string;
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
  mimeType: 'image/png';
  byteLength: number;
  sha256: string;
  path: string;
}>;

type PendingAction = {
  action: BrowserDevelopmentAction;
  delivered: boolean;
  resolve(
    value:
      | DevelopmentReloadResult
      | LegacyDevelopmentCaptureResult
      | DevelopmentCaptureResultV2
      | PointLightCommandResult
      | DevelopmentSessionControlResult,
  ): void;
  reject(cause: Error): void;
  timer: NodeJS.Timeout;
  captureV2?: Readonly<{
    request: CaptureFrameRequestV2;
    evidenceId: string;
  }>;
};

export interface DevelopmentActionBroker {
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<LegacyDevelopmentCaptureResult>;
  captureFrameV2(request: unknown): Promise<DevelopmentCaptureResultV2>;
  setPointLightPower(command: SetPointLightPowerCommand): Promise<PointLightCommandResult>;
  correctPointLightPower(
    request: CorrectPointLightPowerRequest,
  ): Promise<PointLightCommandResult>;
  pauseSimulation(): Promise<DevelopmentSessionControlResult>;
  resumeSimulation(): Promise<DevelopmentSessionControlResult>;
  stepSimulation(expectedCompletedStepCount: number): Promise<DevelopmentSessionControlResult>;
  nextAction(runtimeInstanceId: string): BrowserDevelopmentAction | null;
  noteRuntimeConnected(runtimeInstanceId: string): void;
  completeCapture(input: CaptureActionInput): Promise<void>;
  completePointLightCommand(input: PointLightActionResultInput): Promise<void>;
  completeSessionControl(input: SessionControlActionResultInput): Promise<void>;
  stop(): void;
}

function actionError(
  code: 'ANTIKY_ACTION_BUSY' | 'ANTIKY_ACTION_TIMEOUT' | 'ANTIKY_RUNTIME_UNAVAILABLE',
  message: string,
): AntikyCliError {
  return new AntikyCliError(code, message);
}

export function createDevelopmentActionBroker(
  options: DevelopmentActionBrokerOptions,
): DevelopmentActionBroker {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_ACTION_TIMEOUT_MILLISECONDS;
  const now = options.now ?? (() => new Date().toISOString());
  const diagnosticSink = options.diagnosticSink ?? NOOP_CLI_DIAGNOSTIC_SINK;
  let pending: PendingAction | null = null;
  let stopped = false;

  const reportAction = (
    active: PendingAction,
    level: CliDiagnosticLevel,
    code: CliDiagnosticCode,
    component: CliDiagnosticComponent = 'action-broker',
  ): void => emitCliDiagnostic(diagnosticSink, {
    level,
    code,
    developmentSessionId: options.developmentSessionId,
    runtimeInstanceId: active.action.runtimeInstanceId,
    actionId: active.action.actionId,
    component,
  });

  const resolvePending = (
    active: PendingAction,
    value:
      | DevelopmentReloadResult
      | LegacyDevelopmentCaptureResult
      | DevelopmentCaptureResultV2
      | PointLightCommandResult
      | DevelopmentSessionControlResult,
  ): boolean => {
    if (pending !== active) return false;
    pending = null;
    clearTimeout(active.timer);
    active.resolve(value);
    reportAction(active, 'info', 'ANTIKY_ACTION_COMPLETED');
    return true;
  };

  const rejectPending = (active: PendingAction, cause: Error): boolean => {
    if (pending !== active) return false;
    pending = null;
    clearTimeout(active.timer);
    active.reject(cause);
    return true;
  };

  const createPending = <T extends
    | DevelopmentReloadResult
      | LegacyDevelopmentCaptureResult
      | DevelopmentCaptureResultV2
    | PointLightCommandResult
    | DevelopmentSessionControlResult>(
    kind: BrowserDevelopmentAction['kind'],
    payload: Readonly<Record<string, unknown>> = {},
    runtimeContextInput?: CaptureRuntimeContext,
    captureV2?: PendingAction['captureV2'],
  ): Promise<T> => {
    if (stopped) {
      throw actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'The development session stopped.');
    }
    if (pending) throw actionError('ANTIKY_ACTION_BUSY', 'Another development action is active.');
    const runtimeContext = runtimeContextInput ?? options.readRuntimeContext();
    if (!runtimeContext.connected || !runtimeContext.runtimeInstanceId) {
      throw actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'A connected runtime is required.');
    }
    const actionId = `action-${randomUUID()}`;
    const trustedContext = kind === 'set-point-light-power' || kind === 'correct-point-light-power'
      ? parsePointLightCommandContext({
        principalId: 'antiky-local-development',
        permissions: [POINT_LIGHT_EDIT_PERMISSION],
        receivedAt: now(),
        runtimeInstanceId: runtimeContext.runtimeInstanceId,
      })
      : undefined;
    const action = Object.freeze({
      schemaVersion: 1 as const,
      actionId,
      kind,
      developmentSessionId: options.developmentSessionId,
      runtimeInstanceId: runtimeContext.runtimeInstanceId,
      buildRevision: runtimeContext.buildRevision,
      ...(kind === 'capture' ? { captureId: `capture-${randomUUID()}` } : {}),
      ...payload,
      ...(trustedContext === undefined ? {} : { context: trustedContext }),
    }) as BrowserDevelopmentAction;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const active = pending;
        if (!active || active.action.actionId !== actionId) return;
        reportAction(active, 'warning', 'ANTIKY_ACTION_TIMED_OUT');
        rejectPending(active, actionError('ANTIKY_ACTION_TIMEOUT', `${kind} action timed out.`));
      }, timeoutMilliseconds);
      timer.unref();
      pending = {
        action,
        delivered: false,
        resolve: resolve as PendingAction['resolve'],
        reject,
        timer,
        ...(captureV2 === undefined ? {} : { captureV2 }),
      };
      reportAction(pending, 'info', 'ANTIKY_ACTION_STARTED');
    });
  };

  return Object.freeze({
    requestReload: () => createPending<DevelopmentReloadResult>('reload'),
    captureFrame: () => createPending<LegacyDevelopmentCaptureResult>('capture'),
    async captureFrameV2(requestInput: unknown): Promise<DevelopmentCaptureResultV2> {
      const request = parseCaptureFrameRequestV2(requestInput);
      const runtimeContext = options.readRuntimeContext();
      validateCaptureObservation(request, runtimeContext);
      const evidenceId = `evidence-${randomUUID()}`;
      return createPending<DevelopmentCaptureResultV2>(
        'capture',
        { evidenceId, target: request.target, warmUpFrames: request.warmUpFrames },
        runtimeContext,
        Object.freeze({ request, evidenceId }),
      );
    },
    setPointLightPower: (command: SetPointLightPowerCommand) => (
      createPending<PointLightCommandResult>('set-point-light-power', { command })
    ),
    correctPointLightPower: (request: CorrectPointLightPowerRequest) => (
      createPending<PointLightCommandResult>('correct-point-light-power', { request })
    ),
    pauseSimulation: () => (
      createPending<DevelopmentSessionControlResult>('pause-simulation')
    ),
    resumeSimulation: () => (
      createPending<DevelopmentSessionControlResult>('resume-simulation')
    ),
    stepSimulation: (expectedCompletedStepCount: number) => {
      if (!Number.isSafeInteger(expectedCompletedStepCount) || expectedCompletedStepCount < 0) {
        throw new AntikyCliError(
          'ANTIKY_ARGUMENT_INVALID',
          'Expected completed-step count must be a non-negative safe integer.',
        );
      }
      return createPending<DevelopmentSessionControlResult>('step-simulation', {
        expectedCompletedStepCount,
      });
    },
    nextAction(runtimeInstanceId: string): BrowserDevelopmentAction | null {
      if (
        !pending
        || pending.delivered
        || pending.action.runtimeInstanceId !== runtimeInstanceId
      ) return null;
      pending.delivered = true;
      reportAction(pending, 'info', 'ANTIKY_ACTION_DELIVERED');
      return pending.action;
    },
    noteRuntimeConnected(runtimeInstanceId: string): void {
      const active = pending;
      if (
        !active
        || active.action.kind !== 'reload'
        || !active.delivered
        || active.action.runtimeInstanceId === runtimeInstanceId
      ) return;
      resolvePending(active, Object.freeze({
        schemaVersion: 1,
        actionId: active.action.actionId,
        developmentSessionId: options.developmentSessionId,
        buildRevision: active.action.buildRevision,
        oldRuntimeInstanceId: active.action.runtimeInstanceId,
        newRuntimeInstanceId: runtimeInstanceId,
        result: 'reloaded',
      }));
    },
    async completeCapture(input: CaptureActionInput): Promise<void> {
      const active = pending;
      if (
        !active
        || active.action.kind !== 'capture'
        || !active.delivered
        || active.action.actionId !== input.actionId
        || active.action.runtimeInstanceId !== input.runtimeInstanceId
        || !active.action.captureId
      ) {
        throw new AntikyCliError('ANTIKY_ACTION_STALE', 'The capture action is stale.');
      }
      if (
        input.mimeType !== 'image/png'
        || !Number.isSafeInteger(input.canvasWidth)
        || input.canvasWidth <= 0
        || !Number.isSafeInteger(input.canvasHeight)
        || input.canvasHeight <= 0
      ) {
        throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture metadata is invalid.');
      }
      let bytes: Buffer;
      try {
        bytes = decodePng(input.dataBase64);
        if (active.captureV2) {
          const dimensions = readPngDimensions(bytes);
          if (
            dimensions.width !== input.canvasWidth
            || dimensions.height !== input.canvasHeight
          ) {
            throw new AntikyCliError(
              'ANTIKY_CAPTURE_INVALID',
              'The PNG dimensions do not match the game canvas.',
            );
          }
        }
      } catch (cause: unknown) {
        if (active.captureV2 && cause instanceof AntikyCliError) rejectPending(active, cause);
        throw cause;
      }
      if (active.captureV2) {
        const { request, evidenceId } = active.captureV2;
        let observation: ObservationRefV1;
        try {
          observation = validateCaptureObservation(request, options.readRuntimeContext());
          if (input.publicationSequence !== observation.publicationSequence) {
            throw captureFailure(
              'CAPTURE_OBSERVATION_STALE',
              'The captured runtime publication is no longer current.',
            );
          }
        } catch (cause: unknown) {
          if (cause instanceof AntikyCliError) rejectPending(active, cause);
          throw cause;
        }
        if (
          input.canvasWidth !== request.target.width
          || input.canvasHeight !== request.target.height
        ) {
          const error = captureFailure(
            'CAPTURE_DIMENSIONS_MISMATCH',
            'The game canvas dimensions changed; read capabilities and retry.',
          );
          rejectPending(active, error);
          throw error;
        }
        if (!options.evidenceStore) {
          const error = captureFailure(
            'CAPTURE_ARTIFACT_FAILED',
            'The private evidence store is unavailable.',
          );
          rejectPending(active, error);
          throw error;
        }
        let artifact;
        try {
          artifact = await options.evidenceStore.put({
            evidenceId,
            kind: 'still',
            role: 'canvas-master',
            mimeType: 'image/png',
            bytes,
            width: input.canvasWidth,
            height: input.canvasHeight,
            observation,
          });
        } catch {
          const error = captureFailure(
            'CAPTURE_ARTIFACT_FAILED',
            'The private capture artifact could not be stored.',
          );
          rejectPending(active, error);
          throw error;
        }
        const result = Object.freeze({
          schemaVersion: 2 as const,
          actionId: active.action.actionId,
          captureId: active.action.captureId,
          source: 'interactive-runtime' as const,
          observation,
          deviceScaleFactor: request.target.deviceScaleFactor,
          artifact,
        });
        if (!resolvePending(active, result)) throw staleCaptureError();
        return;
      }
      let path: string;
      try {
        path = await persistLegacyCapture(options.rootDirectory, active.action.captureId, bytes);
      } catch {
        reportAction(active, 'error', 'ANTIKY_CAPTURE_SAVE_FAILED', 'capture-store');
        if (pending !== active) throw staleCaptureError();
        const error = new AntikyCliError(
          'ANTIKY_CAPTURE_SAVE_FAILED',
          'The frame capture could not be saved.',
        );
        rejectPending(active, error);
        throw error;
      }
      const result = Object.freeze({
        schemaVersion: 1,
        actionId: active.action.actionId,
        captureId: active.action.captureId,
        developmentSessionId: options.developmentSessionId,
        runtimeInstanceId: active.action.runtimeInstanceId,
        buildRevision: active.action.buildRevision,
        mimeType: 'image/png',
        byteLength: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        path,
      });
      if (!resolvePending(active, result)) {
        const [discard] = await Promise.allSettled([rm(path, { force: true })]);
        if (discard?.status === 'rejected') {
          reportAction(active, 'error', 'ANTIKY_CAPTURE_SAVE_FAILED', 'capture-store');
        }
        throw staleCaptureError();
      }
    },
    async completePointLightCommand(input: PointLightActionResultInput): Promise<void> {
      const active = pending;
      if (
        !active
        || (
          active.action.kind !== 'set-point-light-power'
          && active.action.kind !== 'correct-point-light-power'
        )
        || !active.delivered
        || active.action.actionId !== input.actionId
        || active.action.runtimeInstanceId !== input.runtimeInstanceId
      ) {
        throw new AntikyCliError('ANTIKY_ACTION_STALE', 'The point-light action is stale.');
      }
      let result: PointLightCommandResult;
      try {
        result = parsePointLightCommandResult(input.result);
      } catch (cause: unknown) {
        if (cause instanceof PointLightCommandValidationError) {
          throw new AntikyCliError(
            'ANTIKY_ACTION_STALE',
            'The point-light action returned an invalid result.',
          );
        }
        throw cause;
      }
      const expectedCommandId = active.action.kind === 'set-point-light-power'
        ? active.action.command.commandId
        : active.action.request.commandId;
      if (
        result.commandId !== expectedCommandId
        || result.runtimeInstanceId !== active.action.runtimeInstanceId
      ) {
        throw new AntikyCliError(
          'ANTIKY_ACTION_STALE',
          'The point-light action result does not match the active request.',
        );
      }
      if (!resolvePending(active, result)) {
        throw new AntikyCliError('ANTIKY_ACTION_STALE', 'The point-light action is stale.');
      }
    },
    async completeSessionControl(input: SessionControlActionResultInput): Promise<void> {
      const active = pending;
      if (
        !active
        || (
          active.action.kind !== 'pause-simulation'
          && active.action.kind !== 'resume-simulation'
          && active.action.kind !== 'step-simulation'
        )
        || !active.delivered
        || active.action.actionId !== input.actionId
        || active.action.runtimeInstanceId !== input.runtimeInstanceId
      ) {
        throw new AntikyCliError('ANTIKY_ACTION_STALE', 'The session-control action is stale.');
      }
      try {
        const result = parseEngineControlResult(input.result);
        const session = parseEngineSessionStatus(input.session);
        if (
          session.runtimeInstanceId !== active.action.runtimeInstanceId
          || result.mode !== session.mode
          || result.completedStepCount !== session.clock.completedStepCount
          || result.controlRevision !== session.revisions.controlRevision
          || result.pauseReasons.length !== session.pauseReasons.length
          || result.pauseReasons.some((reason, index) => reason !== session.pauseReasons[index])
        ) {
          throw new EngineSessionValidationError(
            'Session-control result does not match session status',
            '$.result',
          );
        }
        if (!resolvePending(active, Object.freeze({
          schemaVersion: 1,
          actionId: active.action.actionId,
          developmentSessionId: options.developmentSessionId,
          result,
          session,
        }))) {
          throw new AntikyCliError('ANTIKY_ACTION_STALE', 'The session-control action is stale.');
        }
      } catch (cause: unknown) {
        if (cause instanceof EngineSessionValidationError) {
          throw new AntikyCliError(
            'ANTIKY_ACTION_STALE',
            'The session-control action returned invalid or stale state.',
          );
        }
        throw cause;
      }
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (!pending) return;
      const active = pending;
      reportAction(active, 'info', 'ANTIKY_ACTION_CANCELLED');
      rejectPending(
        active,
        actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'The development session stopped.'),
      );
    },
  });
}
