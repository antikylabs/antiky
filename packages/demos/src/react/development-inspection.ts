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

type BrowserAction = Readonly<{
  schemaVersion: 1;
  actionId: string;
  kind: 'reload' | 'capture';
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
  captureId?: string;
}>;

export type BrowserFrameCapture = Readonly<{
  mimeType: 'image/png';
  canvasWidth: number;
  canvasHeight: number;
  dataBase64: string;
}>;

export type DevelopmentInspectionHandlers = Readonly<{
  reload(): void;
  captureFrame(): Promise<BrowserFrameCapture>;
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
    : ['actionId', 'buildRevision', 'developmentSessionId', 'kind', 'runtimeInstanceId', 'schemaVersion'];
  const keys = Object.keys(record).sort();
  if (
    keys.length !== expectedKeys.length
    || keys.some((key, index) => key !== expectedKeys[index])
    || record.schemaVersion !== 1
    || (kind !== 'reload' && kind !== 'capture')
    || record.developmentSessionId !== bootstrap.developmentSessionId
    || typeof record.actionId !== 'string'
    || typeof record.runtimeInstanceId !== 'string'
    || !Number.isSafeInteger(record.buildRevision)
    || (kind === 'capture' && typeof record.captureId !== 'string')
  ) throw new Error('Antiky development action is incompatible.');
  return Object.freeze({
    schemaVersion: 1,
    actionId: record.actionId,
    kind,
    developmentSessionId: bootstrap.developmentSessionId,
    runtimeInstanceId: record.runtimeInstanceId,
    buildRevision: record.buildRevision as number,
    ...(kind === 'capture' ? { captureId: record.captureId as string } : {}),
  });
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
  handlers?: DevelopmentInspectionHandlers,
): Promise<DevelopmentInspectionPublisher | null> {
  const inspectionOrigin = process.env.NEXT_PUBLIC_ANTIKY_INSPECTION_ORIGIN;
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
        if (!handlers || !action.captureId) throw new Error('Capture handler is unavailable.');
        const capture = await handlers.captureFrame();
        const resultResponse = await fetch(`${inspectionOrigin}/v1/runtime/action-result`, {
          method: 'POST',
          cache: 'no-store',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify({
            schemaVersion: 1,
            developmentSessionId: bootstrap.developmentSessionId,
            runtimeInstanceId: action.runtimeInstanceId,
            actionId: action.actionId,
            result: { kind: 'capture', ...capture },
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
