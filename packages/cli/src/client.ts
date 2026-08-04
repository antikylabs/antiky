import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { loadAntikyConfig } from './config.ts';
import type { DevelopmentSnapshot } from './development-types.ts';
import { AntikyCliError } from './errors.ts';

type SessionDescriptor = {
  schemaVersion: number;
  developmentSessionId: string;
  configHash: string;
  inspectionUrl: string;
  credential: string;
  ownerPid: number;
};

export async function inspectDevelopmentSession(
  configPath = 'antiky.config.json',
): Promise<DevelopmentSnapshot> {
  const config = await loadAntikyConfig(configPath);
  const descriptorPath = join(dirname(config.path), '.antiky', 'dev-session.json');
  let descriptor: SessionDescriptor;
  try {
    const source = await readFile(descriptorPath, 'utf8');
    if (Buffer.byteLength(source) > 8192) throw new Error('Session descriptor is oversized.');
    descriptor = JSON.parse(source) as SessionDescriptor;
  } catch {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      `No active Antiky session was found for ${config.path}.`,
    );
  }
  const expectedUrl = `http://${config.network.host}:${config.network.inspectionPort}`;
  if (
    descriptor.schemaVersion !== 1
    || descriptor.configHash !== config.hash
    || descriptor.inspectionUrl !== expectedUrl
    || typeof descriptor.credential !== 'string'
    || descriptor.credential.length < 32
  ) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky session descriptor does not match the selected config.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${descriptor.inspectionUrl}/v1/development`, {
      headers: { authorization: `Bearer ${descriptor.credential}` },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    throw new AntikyCliError('ANTIKY_SESSION_UNAVAILABLE', 'The Antiky inspection service is unavailable.');
  }
  if (!response.ok) {
    throw new AntikyCliError(
      response.status === 401 ? 'ANTIKY_UNAUTHORIZED' : 'ANTIKY_SESSION_UNAVAILABLE',
      `The Antiky inspection service rejected the request with status ${response.status}.`,
    );
  }
  return await response.json() as DevelopmentSnapshot;
}
