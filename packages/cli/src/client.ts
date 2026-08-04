import { loadAntikyConfig } from './config.ts';
import type { DevelopmentSnapshot } from './development-types.ts';
import { AntikyCliError } from './errors.ts';
import { readSessionDescriptor } from './session-descriptor.ts';

export interface DevelopmentClient {
  readDevelopmentSnapshot(): Promise<DevelopmentSnapshot>;
}

export async function connectDevelopmentClient(
  configPath = 'antiky.config.json',
): Promise<DevelopmentClient> {
  const config = await loadAntikyConfig(configPath);
  const descriptor = await readSessionDescriptor(config);

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
  });
}

export async function inspectDevelopmentSession(
  configPath = 'antiky.config.json',
): Promise<DevelopmentSnapshot> {
  const client = await connectDevelopmentClient(configPath);
  return client.readDevelopmentSnapshot();
}
