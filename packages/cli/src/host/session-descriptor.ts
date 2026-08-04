import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AntikyConfig } from '../config.ts';
import { AntikyCliError } from '../errors.ts';

const SESSION_DIRECTORY = '.antiky';
const SESSION_FILE = 'dev-session.json';
const MAX_DESCRIPTOR_BYTES = 8192;

export type SessionDescriptor = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  configHash: string;
  inspectionUrl: string;
  credential: string;
  ownerPid: number;
}>;

export function getSessionDescriptorPath(configPath: string): string {
  return join(dirname(configPath), SESSION_DIRECTORY, SESSION_FILE);
}

export async function writeSessionDescriptor(
  path: string,
  descriptor: SessionDescriptor,
): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(descriptor, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function removeSessionDescriptor(path: string): Promise<void> {
  await rm(path, { force: true });
  try {
    await rmdir(dirname(path));
  } catch (cause: unknown) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw cause;
  }
}

function isDescriptor(value: unknown): value is SessionDescriptor {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = [
    'configHash',
    'credential',
    'developmentSessionId',
    'inspectionUrl',
    'ownerPid',
    'schemaVersion',
  ];
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === expectedKeys[index])
    && record.schemaVersion === 1
    && typeof record.developmentSessionId === 'string'
    && record.developmentSessionId.length > 0
    && typeof record.configHash === 'string'
    && record.configHash.length > 0
    && typeof record.inspectionUrl === 'string'
    && typeof record.credential === 'string'
    && record.credential.length >= 32
    && Number.isSafeInteger(record.ownerPid)
    && (record.ownerPid as number) > 0;
}

export async function readSessionDescriptor(config: AntikyConfig): Promise<SessionDescriptor> {
  const path = getSessionDescriptorPath(config.path);
  let descriptor: SessionDescriptor;
  try {
    const source = await readFile(path, 'utf8');
    if (Buffer.byteLength(source) > MAX_DESCRIPTOR_BYTES) throw new Error('Oversized descriptor.');
    const parsed: unknown = JSON.parse(source);
    if (!isDescriptor(parsed)) throw new Error('Invalid descriptor.');
    descriptor = Object.freeze({ ...parsed });
  } catch {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      `No active Antiky session was found for ${config.path}.`,
    );
  }

  const expectedUrl = `http://${config.network.host}:${config.network.inspectionPort}`;
  if (descriptor.configHash !== config.hash || descriptor.inspectionUrl !== expectedUrl) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky session descriptor does not match the selected config.',
    );
  }
  return descriptor;
}
