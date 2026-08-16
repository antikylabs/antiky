import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { AntikyCliError } from '../../errors.ts';
import type { AntikyProject } from '../../project/index.ts';

const SESSION_DIRECTORY = '.antiky';
const SESSION_FILE = 'dev-session.json';
const SESSION_IGNORE_FILE = '.gitignore';
const SESSION_IGNORE_SOURCE = '*\n!.gitignore\n';
const MAX_DESCRIPTOR_BYTES = 8192;

export type SessionDescriptor = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  projectRevision: string;
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
  const ignorePath = join(directory, SESSION_IGNORE_FILE);
  await writeFile(ignorePath, SESSION_IGNORE_SOURCE, { encoding: 'utf8', mode: 0o644 });
  await chmod(ignorePath, 0o644);
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
    'credential',
    'developmentSessionId',
    'inspectionUrl',
    'ownerPid',
    'projectRevision',
    'schemaVersion',
  ];
  return keys.length === expectedKeys.length
    && keys.every((key, index) => key === expectedKeys[index])
    && record.schemaVersion === 1
    && typeof record.developmentSessionId === 'string'
    && record.developmentSessionId.length > 0
    && typeof record.projectRevision === 'string'
    && record.projectRevision.length > 0
    && typeof record.inspectionUrl === 'string'
    && typeof record.credential === 'string'
    && record.credential.length >= 32
    && Number.isSafeInteger(record.ownerPid)
    && (record.ownerPid as number) > 0;
}

export async function readSessionDescriptor(project: AntikyProject): Promise<SessionDescriptor> {
  const path = getSessionDescriptorPath(project.manifestPath);
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
      `No active Antiky session was found for ${project.manifestPath}.`,
    );
  }

  const expectedUrl = `http://${project.network.host}:${project.network.inspectionPort}`;
  if (
    descriptor.projectRevision !== project.revision
    || descriptor.inspectionUrl !== expectedUrl
  ) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky session descriptor does not match the selected project.',
    );
  }
  return descriptor;
}
