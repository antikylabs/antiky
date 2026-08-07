import { invoke } from '@tauri-apps/api/core';

import type { DevelopmentConnection } from '@antiky/cli/development';

export type StudioContext = Readonly<{
  projectDirectory: string;
  projectName: string;
}>;

type UnknownRecord = Record<string, unknown>;

function invalidNativeResponse(): never {
  throw new Error('The Studio native host returned an incompatible response.');
}

function readObject(value: unknown): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalidNativeResponse();
  }
  return value as UnknownRecord;
}

function checkExactKeys(record: UnknownRecord, expected: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])
  ) invalidNativeResponse();
}

function readString(value: unknown, minimum: number, maximum: number): string {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) invalidNativeResponse();
  return value;
}

export function parseStudioContext(value: unknown): StudioContext {
  const record = readObject(value);
  checkExactKeys(record, ['projectDirectory', 'projectName']);
  return Object.freeze({
    projectDirectory: readString(record.projectDirectory, 1, 4_096),
    projectName: readString(record.projectName, 1, 128),
  });
}

export function parseNativeDevelopmentConnection(value: unknown): DevelopmentConnection {
  const record = readObject(value);
  checkExactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'projectRevision',
    'inspectionUrl',
    'credential',
    'ownerPid',
  ]);
  if (
    record.schemaVersion !== 1
    || !Number.isSafeInteger(record.ownerPid)
    || (record.ownerPid as number) < 1
  ) invalidNativeResponse();
  const inspectionUrl = readString(record.inspectionUrl, 1, 128);
  let url: URL;
  try {
    url = new URL(inspectionUrl);
  } catch {
    invalidNativeResponse();
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port.length === 0
    || url.origin !== inspectionUrl
    || url.pathname !== '/'
    || url.search.length > 0
    || url.hash.length > 0
    || url.username.length > 0
    || url.password.length > 0
  ) invalidNativeResponse();
  readString(record.projectRevision, 1, 256);
  return Object.freeze({
    developmentSessionId: readString(record.developmentSessionId, 1, 128),
    inspectionUrl,
    credential: readString(record.credential, 32, 512),
  });
}

export async function readNativeStudioContext(): Promise<StudioContext> {
  return parseStudioContext(await invoke<unknown>('studio_context'));
}

export async function discoverNativeDevelopmentConnection(): Promise<DevelopmentConnection> {
  return parseNativeDevelopmentConnection(await invoke<unknown>('discover_development_connection'));
}
