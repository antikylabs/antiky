import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  DevelopmentCaptureResult,
  DevelopmentReloadResult,
} from './development-types.ts';
import { AntikyCliError } from './errors.ts';

const DEFAULT_ACTION_TIMEOUT_MILLISECONDS = 10_000;
const MAX_CAPTURE_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type BrowserDevelopmentAction = Readonly<{
  schemaVersion: 1;
  actionId: string;
  kind: 'reload' | 'capture';
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
  captureId?: string;
}>;

export type CaptureActionInput = Readonly<{
  actionId: string;
  runtimeInstanceId: string;
  mimeType: 'image/png';
  canvasWidth: number;
  canvasHeight: number;
  dataBase64: string;
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
}>;

type PendingAction = {
  action: BrowserDevelopmentAction;
  delivered: boolean;
  resolve(value: DevelopmentReloadResult | DevelopmentCaptureResult): void;
  reject(cause: Error): void;
  timer: NodeJS.Timeout;
};

export interface DevelopmentActionBroker {
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
  nextAction(runtimeInstanceId: string): BrowserDevelopmentAction | null;
  noteRuntimeConnected(runtimeInstanceId: string): void;
  completeCapture(input: CaptureActionInput): Promise<void>;
  stop(): void;
}

function actionError(
  code: 'ANTIKY_ACTION_BUSY' | 'ANTIKY_ACTION_TIMEOUT' | 'ANTIKY_RUNTIME_UNAVAILABLE',
  message: string,
): AntikyCliError {
  return new AntikyCliError(code, message);
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

export function createDevelopmentActionBroker(
  options: DevelopmentActionBrokerOptions,
): DevelopmentActionBroker {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_ACTION_TIMEOUT_MILLISECONDS;
  let pending: PendingAction | null = null;

  const createPending = <T extends DevelopmentReloadResult | DevelopmentCaptureResult>(
    kind: 'reload' | 'capture',
  ): Promise<T> => {
    if (pending) throw actionError('ANTIKY_ACTION_BUSY', 'Another development action is active.');
    const context = options.readRuntimeContext();
    if (!context.connected || !context.runtimeInstanceId) {
      throw actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'A connected runtime is required.');
    }
    const actionId = `action-${randomUUID()}`;
    const action = Object.freeze({
      schemaVersion: 1 as const,
      actionId,
      kind,
      developmentSessionId: options.developmentSessionId,
      runtimeInstanceId: context.runtimeInstanceId,
      buildRevision: context.buildRevision,
      ...(kind === 'capture' ? { captureId: `capture-${randomUUID()}` } : {}),
    });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending?.action.actionId !== actionId) return;
        pending = null;
        reject(actionError('ANTIKY_ACTION_TIMEOUT', `${kind} action timed out.`));
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

  const complete = (value: DevelopmentReloadResult | DevelopmentCaptureResult) => {
    const active = pending;
    if (!active) return;
    clearTimeout(active.timer);
    pending = null;
    active.resolve(value);
  };

  return Object.freeze({
    requestReload: () => createPending<DevelopmentReloadResult>('reload'),
    captureFrame: () => createPending<DevelopmentCaptureResult>('capture'),
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
      if (
        !pending
        || pending.action.kind !== 'reload'
        || !pending.delivered
        || pending.action.runtimeInstanceId === runtimeInstanceId
      ) return;
      complete(Object.freeze({
        schemaVersion: 1,
        actionId: pending.action.actionId,
        developmentSessionId: options.developmentSessionId,
        buildRevision: pending.action.buildRevision,
        oldRuntimeInstanceId: pending.action.runtimeInstanceId,
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
      const directory = join(options.rootDirectory, '.antiky', 'captures');
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await chmod(directory, 0o700);
      const path = join(directory, `${active.action.captureId}.png`);
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
        await rename(temporaryPath, path);
        await chmod(path, 0o600);
      } finally {
        await rm(temporaryPath, { force: true });
      }
      complete(Object.freeze({
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
      }));
    },
    stop(): void {
      if (!pending) return;
      const active = pending;
      pending = null;
      clearTimeout(active.timer);
      active.reject(actionError('ANTIKY_RUNTIME_UNAVAILABLE', 'The development session stopped.'));
    },
  });
}
