import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
  DevelopmentCaptureResult,
  DevelopmentReloadResult,
  DevelopmentSessionControlResult,
} from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';

const DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000;
// High-DPI canvases can exceed 5 MiB below 4K. Keep the local transport bounded while allowing
// exact PNG captures from common development displays.
export const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
export const MAX_CAPTURE_ENVELOPE_BYTES = Math.ceil(MAX_CAPTURE_BYTES / 3) * 4 + 64 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

type BrowserDevelopmentActionBase = Readonly<{
  schemaVersion: 1;
  actionId: string;
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
}>;

export type BrowserDevelopmentAction =
  | (BrowserDevelopmentActionBase & Readonly<{ kind: 'reload' }>)
  | (BrowserDevelopmentActionBase & Readonly<{ kind: 'capture'; captureId: string }>)
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

type RuntimeContext = Readonly<{
  runtimeInstanceId: string | null;
  buildRevision: number;
  connected: boolean;
}>;

type DevelopmentActionBrokerOptions = Readonly<{
  developmentSessionId: string;
  rootDirectory: string;
  readRuntimeContext(): RuntimeContext;
  timeoutMilliseconds?: number;
  now?: () => string;
}>;

type PendingAction = {
  action: BrowserDevelopmentAction;
  delivered: boolean;
  resolve(
    value:
      | DevelopmentReloadResult
      | DevelopmentCaptureResult
      | PointLightCommandResult
      | DevelopmentSessionControlResult,
  ): void;
  reject(cause: Error): void;
  timer: NodeJS.Timeout;
};

export interface DevelopmentActionBroker {
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
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

function staleCaptureError(): AntikyCliError {
  return new AntikyCliError('ANTIKY_ACTION_STALE', 'The capture action is stale.');
}

function decodePng(value: string): Buffer {
  if (value.length === 0 || value.length > Math.ceil(MAX_CAPTURE_BYTES / 3) * 4 + 4) {
    throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture is empty or too large.');
  }
  const bytes = Buffer.from(value, 'base64');
  if (
    bytes.length === 0
    || bytes.length > MAX_CAPTURE_BYTES
    || bytes.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')
    || bytes.subarray(0, PNG_SIGNATURE.length).compare(PNG_SIGNATURE) !== 0
  ) {
    throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture is not a valid PNG payload.');
  }
  return bytes;
}

async function persistCapture(
  rootDirectory: string,
  captureId: string,
  bytes: Buffer,
): Promise<string> {
  const directory = join(rootDirectory, '.antiky', 'captures');
  const path = join(directory, `${captureId}.png`);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let committed = false;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
    committed = true;
    return path;
  } finally {
    await Promise.allSettled([
      rm(temporaryPath, { force: true }),
      ...(committed ? [] : [rm(path, { force: true })]),
    ]);
  }
}

export function createDevelopmentActionBroker(
  options: DevelopmentActionBrokerOptions,
): DevelopmentActionBroker {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_ACTION_TIMEOUT_MILLISECONDS;
  const now = options.now ?? (() => new Date().toISOString());
  let pending: PendingAction | null = null;
  let stopped = false;

  const resolvePending = (
    active: PendingAction,
    value:
      | DevelopmentReloadResult
      | DevelopmentCaptureResult
      | PointLightCommandResult
      | DevelopmentSessionControlResult,
  ): boolean => {
    if (pending !== active) return false;
    pending = null;
    clearTimeout(active.timer);
    active.resolve(value);
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
    | DevelopmentCaptureResult
    | PointLightCommandResult
    | DevelopmentSessionControlResult>(
    kind: BrowserDevelopmentAction['kind'],
    payload: Readonly<Record<string, unknown>> = {},
  ): Promise<T> => {
    if (stopped) {
      throw actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'The development session stopped.');
    }
    if (pending) throw actionError('ANTIKY_ACTION_BUSY', 'Another development action is active.');
    const runtimeContext = options.readRuntimeContext();
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
        rejectPending(active, actionError('ANTIKY_ACTION_TIMEOUT', `${kind} action timed out.`));
      }, timeoutMilliseconds);
      timer.unref();
      pending = {
        action,
        delivered: false,
        resolve: resolve as PendingAction['resolve'],
        reject,
        timer,
      };
    });
  };

  return Object.freeze({
    requestReload: () => createPending<DevelopmentReloadResult>('reload'),
    captureFrame: () => createPending<DevelopmentCaptureResult>('capture'),
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
      const bytes = decodePng(input.dataBase64);
      let path: string;
      try {
        path = await persistCapture(options.rootDirectory, active.action.captureId, bytes);
      } catch {
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
        await Promise.allSettled([rm(path, { force: true })]);
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
      rejectPending(
        active,
        actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'The development session stopped.'),
      );
    },
  });
}
