import {
  EngineSessionValidationError,
  parseEngineControlResult,
  parseEngineSessionStatus,
  parseCorrectPointLightPowerRequest,
  parsePointLightCommandContext,
  parsePointLightCommandResult,
  parseSetPointLightPowerCommand,
  type CorrectPointLightPowerRequest,
  type EngineControlResult,
  type EngineSessionStatus,
  type PointLightCommandContext,
  type PointLightCommandResult,
  type SetPointLightPowerCommand,
} from '@antiky/framework';

import {
  createDemoInspectionSnapshot,
  type DemoInspectionInput,
} from '../runtime-inspection.ts';

type BrowserBootstrap = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  gameUrl: string;
  credential: string;
}>;

type BrowserActionBase = Readonly<{
  schemaVersion: 1;
  actionId: string;
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
}>;

type BrowserAction =
  | (BrowserActionBase & Readonly<{ kind: 'reload' }>)
  | (BrowserActionBase & Readonly<{ kind: 'capture'; captureId: string }>)
  | (BrowserActionBase & Readonly<{
    kind: 'set-point-light-power';
    command: SetPointLightPowerCommand;
    context: PointLightCommandContext;
  }>)
  | (BrowserActionBase & Readonly<{
    kind: 'correct-point-light-power';
    request: CorrectPointLightPowerRequest;
    context: PointLightCommandContext;
  }>)
  | (BrowserActionBase & Readonly<{ kind: 'pause-simulation' }>)
  | (BrowserActionBase & Readonly<{ kind: 'resume-simulation' }>)
  | (BrowserActionBase & Readonly<{
    kind: 'step-simulation';
    expectedCompletedStepCount: number;
  }>);

export type BrowserFrameCapture = Readonly<{
  mimeType: 'image/png';
  canvasWidth: number;
  canvasHeight: number;
  dataBase64: string;
}>;

export type BrowserSessionControlResult = Readonly<{
  result: EngineControlResult;
  session: EngineSessionStatus;
}>;

export type DevelopmentInspectionHandlers = Readonly<{
  reload(): void;
  captureFrame(): Promise<BrowserFrameCapture>;
  setPointLightPower?(
    command: SetPointLightPowerCommand,
    context: PointLightCommandContext,
  ): PointLightCommandResult | Promise<PointLightCommandResult>;
  correctPointLightPower?(
    request: CorrectPointLightPowerRequest,
    context: PointLightCommandContext,
  ): PointLightCommandResult | Promise<PointLightCommandResult>;
  pauseSimulation?(): BrowserSessionControlResult | Promise<BrowserSessionControlResult>;
  resumeSimulation?(): BrowserSessionControlResult | Promise<BrowserSessionControlResult>;
  stepSimulation?(
    expectedCompletedStepCount: number,
  ): BrowserSessionControlResult | Promise<BrowserSessionControlResult>;
}>;

export interface DevelopmentInspectionPublisher {
  publish(input: DemoInspectionInput): Promise<void>;
  disconnect(input: DemoInspectionInput): Promise<void>;
  close(): void;
}

function readBootstrap(value: unknown, inspectionOrigin: string): BrowserBootstrap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Antiky inspection bootstrap is invalid.');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 4
    || keys[0] !== 'credential'
    || keys[1] !== 'developmentSessionId'
    || keys[2] !== 'gameUrl'
    || keys[3] !== 'schemaVersion'
    || record.schemaVersion !== 1
    || typeof record.developmentSessionId !== 'string'
    || typeof record.gameUrl !== 'string'
    || new URL(record.gameUrl).origin !== window.location.origin
    || typeof record.credential !== 'string'
    || record.credential.length < 32
  ) throw new Error('Antiky inspection bootstrap is incompatible.');
  if (new URL(inspectionOrigin).origin !== inspectionOrigin) {
    throw new Error('Antiky inspection origin is invalid.');
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: record.developmentSessionId,
    gameUrl: record.gameUrl,
    credential: record.credential,
  });
}

function readAction(value: unknown, bootstrap: BrowserBootstrap): BrowserAction {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Antiky development action is invalid.');
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const expectedKeys = kind === 'capture'
    ? ['actionId', 'buildRevision', 'captureId', 'developmentSessionId', 'kind', 'runtimeInstanceId', 'schemaVersion']
    : kind === 'set-point-light-power'
      ? ['actionId', 'buildRevision', 'command', 'context', 'developmentSessionId', 'kind', 'runtimeInstanceId', 'schemaVersion']
      : kind === 'correct-point-light-power'
        ? ['actionId', 'buildRevision', 'context', 'developmentSessionId', 'kind', 'request', 'runtimeInstanceId', 'schemaVersion']
        : kind === 'step-simulation'
          ? ['actionId', 'buildRevision', 'developmentSessionId', 'expectedCompletedStepCount', 'kind', 'runtimeInstanceId', 'schemaVersion']
        : ['actionId', 'buildRevision', 'developmentSessionId', 'kind', 'runtimeInstanceId', 'schemaVersion'];
  const keys = Object.keys(record).sort();
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
    || record.schemaVersion !== 1
    || (
      kind !== 'reload'
      && kind !== 'capture'
      && kind !== 'set-point-light-power'
      && kind !== 'correct-point-light-power'
      && kind !== 'pause-simulation'
      && kind !== 'resume-simulation'
      && kind !== 'step-simulation'
    )
    || record.developmentSessionId !== bootstrap.developmentSessionId
    || typeof record.actionId !== 'string'
    || typeof record.runtimeInstanceId !== 'string'
    || !Number.isSafeInteger(record.buildRevision)
    || (kind === 'capture' && typeof record.captureId !== 'string')
    || (
      kind === 'step-simulation'
      && (!Number.isSafeInteger(record.expectedCompletedStepCount)
        || (record.expectedCompletedStepCount as number) < 0)
    )
  ) throw new Error('Antiky development action is incompatible.');
  const base = {
    schemaVersion: 1,
    actionId: record.actionId,
    developmentSessionId: bootstrap.developmentSessionId,
    runtimeInstanceId: record.runtimeInstanceId,
    buildRevision: record.buildRevision as number,
  } as const;
  if (kind === 'capture') {
    return Object.freeze({ ...base, kind, captureId: record.captureId as string });
  }
  if (kind === 'set-point-light-power') {
    const context = parsePointLightCommandContext(record.context);
    if (context.runtimeInstanceId !== base.runtimeInstanceId) {
      throw new Error('Antiky point-light action context targets another runtime.');
    }
    return Object.freeze({
      ...base,
      kind,
      command: parseSetPointLightPowerCommand(record.command),
      context,
    });
  }
  if (kind === 'correct-point-light-power') {
    const context = parsePointLightCommandContext(record.context);
    if (context.runtimeInstanceId !== base.runtimeInstanceId) {
      throw new Error('Antiky point-light action context targets another runtime.');
    }
    return Object.freeze({
      ...base,
      kind,
      request: parseCorrectPointLightPowerRequest(record.request),
      context,
    });
  }
  if (kind === 'pause-simulation' || kind === 'resume-simulation') {
    return Object.freeze({ ...base, kind });
  }
  if (kind === 'step-simulation') {
    return Object.freeze({
      ...base,
      kind,
      expectedCompletedStepCount: record.expectedCompletedStepCount as number,
    });
  }
  return Object.freeze({ ...base, kind: 'reload' });
}

function readSessionControlResult(
  value: unknown,
  runtimeInstanceId: string,
): BrowserSessionControlResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Session-control handler returned an invalid result.');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== 2 || keys[0] !== 'result' || keys[1] !== 'session') {
    throw new Error('Session-control handler returned incompatible fields.');
  }
  try {
    const result = parseEngineControlResult(record.result);
    const session = parseEngineSessionStatus(record.session);
    if (
      session.runtimeInstanceId !== runtimeInstanceId
      || result.mode !== session.mode
      || result.completedStepCount !== session.clock.completedStepCount
      || result.controlRevision !== session.revisions.controlRevision
      || result.pauseReasons.length !== session.pauseReasons.length
      || result.pauseReasons.some((reason, index) => reason !== session.pauseReasons[index])
    ) throw new Error('Session-control handler returned stale state.');
    return Object.freeze({ result, session });
  } catch (cause: unknown) {
    if (cause instanceof EngineSessionValidationError) {
      throw new Error('Session-control handler returned invalid state.');
    }
    throw cause;
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

export async function connectDevelopmentInspectionPublisher(
  inspectionOrigin?: string,
  handlers?: DevelopmentInspectionHandlers,
): Promise<DevelopmentInspectionPublisher | null> {
  if (!inspectionOrigin) return null;
  const parsedOrigin = new URL(inspectionOrigin);
  if (parsedOrigin.protocol !== 'http:' || parsedOrigin.hostname !== '127.0.0.1') {
    throw new Error('Antiky inspection must use an IPv4 loopback origin.');
  }

  const controller = new AbortController();
  const response = await fetch(`${inspectionOrigin}/v1/browser/bootstrap`, {
    cache: 'no-store',
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`Antiky inspection bootstrap failed (${response.status}).`);
  const bootstrap = readBootstrap(await response.json(), inspectionOrigin);
  const authorization = `Bearer ${bootstrap.credential}`;
  let closed = false;
  let publicationSequence = 0;
  let sequenceRuntimeInstanceId: string | null = null;
  let publicationTail = Promise.resolve();
  let activeRuntimeInstanceId: string | null = null;

  const pollActions = async () => {
    while (!closed) {
      if (!activeRuntimeInstanceId) {
        await delay(25, controller.signal);
        continue;
      }
      try {
        const actionResponse = await fetch(
          `${inspectionOrigin}/v1/runtime/action?runtimeInstanceId=${encodeURIComponent(activeRuntimeInstanceId)}`,
          { cache: 'no-store', headers: { authorization }, signal: controller.signal },
        );
        if (actionResponse.status === 204) {
          await delay(250, controller.signal);
          continue;
        }
        if (!actionResponse.ok) throw new Error(`Action poll failed (${actionResponse.status}).`);
        const action = readAction(await actionResponse.json(), bootstrap);
        if (action.runtimeInstanceId !== activeRuntimeInstanceId) {
          throw new Error('Antiky development action targets a stale runtime.');
        }
        if (action.kind === 'reload') {
          handlers?.reload();
          return;
        }
        if (!handlers) throw new Error('Development action handler is unavailable.');
        let result: unknown;
        if (action.kind === 'capture') {
          result = { kind: 'capture', ...await handlers.captureFrame() };
        } else if (
          action.kind === 'pause-simulation'
          || action.kind === 'resume-simulation'
          || action.kind === 'step-simulation'
        ) {
          const control = readSessionControlResult(
            action.kind === 'pause-simulation'
              ? await handlers.pauseSimulation?.()
              : action.kind === 'resume-simulation'
                ? await handlers.resumeSimulation?.()
                : await handlers.stepSimulation?.(action.expectedCompletedStepCount),
            action.runtimeInstanceId,
          );
          result = {
            kind: 'session-control',
            controlResult: control.result,
            session: control.session,
          };
        } else {
          const commandResult = parsePointLightCommandResult(
            action.kind === 'set-point-light-power'
              ? await handlers.setPointLightPower?.(action.command, action.context)
              : await handlers.correctPointLightPower?.(action.request, action.context),
          );
          const expectedCommandId = action.kind === 'set-point-light-power'
            ? action.command.commandId
            : action.request.commandId;
          if (
            commandResult.commandId !== expectedCommandId
            || commandResult.runtimeInstanceId !== action.runtimeInstanceId
          ) throw new Error('Point-light action returned a stale result.');
          result = { kind: 'point-light-command', commandResult };
        }
        const resultResponse = await fetch(`${inspectionOrigin}/v1/runtime/action-result`, {
          method: 'POST',
          cache: 'no-store',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 1,
            developmentSessionId: bootstrap.developmentSessionId,
            runtimeInstanceId: action.runtimeInstanceId,
            actionId: action.actionId,
            result,
          }),
          signal: controller.signal,
        });
        if (!resultResponse.ok) {
          throw new Error(`Capture publication failed (${resultResponse.status}).`);
        }
      } catch (cause: unknown) {
        if (closed || controller.signal.aborted) return;
        await delay(250, controller.signal);
      }
    }
  };

  const publisher: DevelopmentInspectionPublisher = Object.freeze({
    publish(input: DemoInspectionInput): Promise<void> {
      if (closed) return Promise.resolve();
      const publication = publicationTail.then(async () => {
        if (closed) return;
        const nextSequence = sequenceRuntimeInstanceId === input.runtimeInstanceId
          ? publicationSequence + 1
          : 1;
        const snapshot = createDemoInspectionSnapshot(input);
        const publishResponse = await fetch(`${inspectionOrigin}/v1/runtime/snapshot`, {
          method: 'POST',
          cache: 'no-store',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 1,
            developmentSessionId: bootstrap.developmentSessionId,
            publicationSequence: nextSequence,
            snapshot,
          }),
          signal: controller.signal,
        });
        if (!publishResponse.ok) {
          throw new Error(`Antiky inspection publication failed (${publishResponse.status}).`);
        }
        publicationSequence = nextSequence;
        sequenceRuntimeInstanceId = input.runtimeInstanceId;
        activeRuntimeInstanceId = input.runtimeInstanceId;
      });
      publicationTail = publication.catch(() => {});
      return publication;
    },
    disconnect(input: DemoInspectionInput): Promise<void> {
      const disconnection = publicationTail.then(async () => {
        if (closed || activeRuntimeInstanceId !== input.runtimeInstanceId) return;
        publicationSequence += 1;
        const disconnectResponse = await fetch(`${inspectionOrigin}/v1/runtime/disconnect`, {
          method: 'POST',
          cache: 'no-store',
          keepalive: true,
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 1,
            developmentSessionId: bootstrap.developmentSessionId,
            runtimeInstanceId: input.runtimeInstanceId,
            publicationSequence,
          }),
          signal: controller.signal,
        });
        if (!disconnectResponse.ok) {
          throw new Error(`Antiky runtime disconnect failed (${disconnectResponse.status}).`);
        }
      });
      publicationTail = disconnection.catch(() => {});
      return disconnection;
    },
    close(): void {
      closed = true;
      controller.abort();
    },
  });

  if (handlers) void pollActions().catch(() => {});
  return publisher;
}
