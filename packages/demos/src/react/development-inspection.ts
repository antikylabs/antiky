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

export interface DevelopmentInspectionPublisher {
  publish(input: DemoInspectionInput): Promise<void>;
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
  ) {
    throw new Error('Antiky inspection bootstrap is incompatible.');
  }
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

export async function connectDevelopmentInspectionPublisher(): Promise<
DevelopmentInspectionPublisher | null
> {
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
  let closed = false;
  let publicationTail = Promise.resolve();

  return Object.freeze({
    publish(input: DemoInspectionInput): Promise<void> {
      if (closed) return Promise.resolve();
      const publication = publicationTail.then(async () => {
        if (closed) return;
        const snapshot = createDemoInspectionSnapshot(input);
        const publishResponse = await fetch(`${inspectionOrigin}/v1/runtime/snapshot`, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            authorization: `Bearer ${bootstrap.credential}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            schemaVersion: 1,
            developmentSessionId: bootstrap.developmentSessionId,
            snapshot,
          }),
          signal: controller.signal,
        });
        if (!publishResponse.ok) {
          throw new Error(`Antiky inspection publication failed (${publishResponse.status}).`);
        }
      });
      publicationTail = publication.catch(() => {});
      return publication;
    },
    close(): void {
      closed = true;
      controller.abort();
    },
  });
}
