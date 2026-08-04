import { loadAntikyConfig } from './config.ts';
import type {
  DevelopmentCaptureResult,
  DevelopmentReloadResult,
  DevelopmentSnapshot,
} from './development-types.ts';
import { AntikyCliError } from './errors.ts';
import { readSessionDescriptor } from './session-descriptor.ts';

export interface DevelopmentClient {
  readDevelopmentSnapshot(): Promise<DevelopmentSnapshot>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
}

export async function connectDevelopmentClient(
  configPath = 'antiky.config.json',
): Promise<DevelopmentClient> {
  const config = await loadAntikyConfig(configPath);
  const descriptor = await readSessionDescriptor(config);

  const requestAction = async <T>(path: '/v1/actions/reload' | '/v1/actions/capture'): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${descriptor.inspectionUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${descriptor.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ schemaVersion: 1 }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service is unavailable.',
      );
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {
        error?: { code?: string; message?: string };
      } | null;
      const code = body?.error?.code;
      if (code === 'ANTIKY_RUNTIME_UNAVAILABLE') {
        throw new AntikyCliError(code, body?.error?.message ?? 'The runtime is unavailable.');
      }
      if (code === 'ANTIKY_ACTION_BUSY' || code === 'ANTIKY_ACTION_TIMEOUT') {
        throw new AntikyCliError(code, body?.error?.message ?? 'The action failed.');
      }
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        `The Antiky inspection service rejected the action with status ${response.status}.`,
      );
    }
    return await response.json() as T;
  };

  return Object.freeze({
    async readDevelopmentSnapshot(): Promise<DevelopmentSnapshot> {
      let response: Response;
      try {
        response = await fetch(`${descriptor.inspectionUrl}/v1/development`, {
          headers: { authorization: `Bearer ${descriptor.credential}` },
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        throw new AntikyCliError(
          'ANTIKY_SESSION_UNAVAILABLE',
          'The Antiky inspection service is unavailable.',
        );
      }
      if (!response.ok) {
        throw new AntikyCliError(
          response.status === 401 ? 'ANTIKY_UNAUTHORIZED' : 'ANTIKY_SESSION_UNAVAILABLE',
          `The Antiky inspection service rejected the request with status ${response.status}.`,
        );
      }
      const snapshot = await response.json() as DevelopmentSnapshot;
      if (
        snapshot.schemaVersion !== 1
        || snapshot.developmentSessionId !== descriptor.developmentSessionId
      ) {
        throw new AntikyCliError(
          'ANTIKY_SESSION_UNAVAILABLE',
          'The Antiky inspection service returned an incompatible snapshot.',
        );
      }
      return snapshot;
    },
    requestReload: () => requestAction<DevelopmentReloadResult>('/v1/actions/reload'),
    captureFrame: () => requestAction<DevelopmentCaptureResult>('/v1/actions/capture'),
  });
}

export async function inspectDevelopmentSession(
  configPath = 'antiky.config.json',
): Promise<DevelopmentSnapshot> {
  const client = await connectDevelopmentClient(configPath);
  return client.readDevelopmentSnapshot();
}
