import { loadAntikyConfig } from '../config.ts';
import { readSessionDescriptor } from '../host/session-descriptor.ts';
import {
  createDevelopmentClient,
  type DevelopmentClient,
} from './browser-client.ts';
import type { DevelopmentSnapshot } from './types.ts';

export type { DevelopmentClient } from './browser-client.ts';

export async function connectDevelopmentClient(
  configPath = 'antiky.config.json',
): Promise<DevelopmentClient> {
  const config = await loadAntikyConfig(configPath);
  const descriptor = await readSessionDescriptor(config);
  return createDevelopmentClient({
    inspectionUrl: descriptor.inspectionUrl,
    developmentSessionId: descriptor.developmentSessionId,
    credential: descriptor.credential,
  });
}

export async function inspectDevelopmentSession(
  configPath = 'antiky.config.json',
): Promise<DevelopmentSnapshot> {
  const client = await connectDevelopmentClient(configPath);
  return client.readDevelopmentSnapshot();
}
