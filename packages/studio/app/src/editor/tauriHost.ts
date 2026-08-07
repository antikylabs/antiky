import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type {
  EditorHost,
  NativeProjectError,
  NativeProjectEvent,
  NativeRecentProject,
  NativeProjectSource,
  ProjectActivationRequest,
  ProjectValidationRequest,
  ValidatedProjectBoundary,
} from './types.ts';

export const PROJECT_OPEN_EVENT = 'antiky://project-open';
const MAX_PROJECT_BYTES = 64 * 1024;

type UnknownRecord = Record<string, unknown>;

function incompatible(): never {
  throw new Error('The Studio native host returned an incompatible response.');
}

function readRecord(value: unknown): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) incompatible();
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, expected: readonly string[]): void {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  if (
    actual.length !== sortedExpected.length
    || actual.some((key, index) => key !== sortedExpected[index])
  ) incompatible();
}

function readString(value: unknown, maximum: number): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) incompatible();
  return value;
}

function readSelectionId(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) incompatible();
  return value as number;
}

function readRevision(value: unknown): string {
  const revision = readString(value, 64);
  if (!/^[a-f0-9]{64}$/u.test(revision)) incompatible();
  return revision;
}

function readTimestamp(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) incompatible();
  return value as number;
}

function readNativeError(value: unknown): NativeProjectError {
  const record = readRecord(value);
  exactKeys(record, ['code', 'message']);
  const code = readString(record.code, 64);
  if (!/^[A-Z0-9_]+$/u.test(code)) incompatible();
  return Object.freeze({ code, message: readString(record.message, 512) });
}

export function parseNativeProjectSource(value: unknown): NativeProjectSource {
  const record = readRecord(value);
  exactKeys(record, [
    'schemaVersion',
    'selectionId',
    'manifestPath',
    'projectRoot',
    'revision',
    'source',
  ]);
  if (record.schemaVersion !== 1 || typeof record.source !== 'string') incompatible();
  if (new TextEncoder().encode(record.source).byteLength > MAX_PROJECT_BYTES) incompatible();
  return Object.freeze({
    schemaVersion: 1,
    selectionId: readSelectionId(record.selectionId),
    manifestPath: readString(record.manifestPath, 4_096),
    projectRoot: readString(record.projectRoot, 4_096),
    revision: readRevision(record.revision),
    source: record.source,
  });
}

export function parseNativeProjectEvent(value: unknown): NativeProjectEvent {
  const record = readRecord(value);
  if (record.kind === 'opened') {
    exactKeys(record, ['kind', 'project']);
    return Object.freeze({ kind: 'opened', project: parseNativeProjectSource(record.project) });
  }
  if (record.kind === 'error') {
    exactKeys(record, ['kind', 'error']);
    return Object.freeze({ kind: 'error', error: readNativeError(record.error) });
  }
  incompatible();
}

export function parseNativeProjectEventOrError(value: unknown): NativeProjectEvent {
  try {
    return parseNativeProjectEvent(value);
  } catch {
    return Object.freeze({
      kind: 'error',
      error: Object.freeze({
        code: 'ANTIKY_NATIVE_UNAVAILABLE',
        message: 'The Studio native host returned an incompatible project event.',
      }),
    });
  }
}

export function parseValidatedProjectBoundary(value: unknown): ValidatedProjectBoundary {
  const record = readRecord(value);
  exactKeys(record, [
    'selectionId',
    'manifestPath',
    'projectRoot',
    'revision',
    'developmentWorkingDirectory',
    'buildWorkingDirectory',
  ]);
  return Object.freeze({
    selectionId: readSelectionId(record.selectionId),
    manifestPath: readString(record.manifestPath, 4_096),
    projectRoot: readString(record.projectRoot, 4_096),
    revision: readRevision(record.revision),
    developmentWorkingDirectory: readString(record.developmentWorkingDirectory, 4_096),
    buildWorkingDirectory: readString(record.buildWorkingDirectory, 4_096),
  });
}

export function parseNativeRecentProject(value: unknown): NativeRecentProject {
  const record = readRecord(value);
  exactKeys(record, ['available', 'lastOpenedAt', 'manifestPath', 'projectRoot']);
  if (typeof record.available !== 'boolean') incompatible();
  return Object.freeze({
    available: record.available,
    lastOpenedAt: readTimestamp(record.lastOpenedAt),
    manifestPath: readString(record.manifestPath, 4_096),
    projectRoot: readString(record.projectRoot, 4_096),
  });
}

export function parseNativeRecentProjects(value: unknown): readonly NativeRecentProject[] {
  if (!Array.isArray(value) || value.length > 20) incompatible();
  return Object.freeze(value.map(parseNativeRecentProject));
}

export function createTauriEditorHost(): EditorHost {
  return Object.freeze({
    async readInitialProjectEvent(): Promise<NativeProjectEvent | null> {
      const value = await invoke<unknown>('project_initial_event');
      return value === null ? null : parseNativeProjectEvent(value);
    },
    async selectProject(): Promise<NativeProjectSource | null> {
      const value = await invoke<unknown>('project_select');
      return value === null ? null : parseNativeProjectSource(value);
    },
    async createProject(name: string): Promise<NativeProjectSource | null> {
      const value = await invoke<unknown>('project_create', { name });
      return value === null ? null : parseNativeProjectSource(value);
    },
    async listRecentProjects(): Promise<readonly NativeRecentProject[]> {
      return parseNativeRecentProjects(await invoke<unknown>('project_recents'));
    },
    async openRecentProject(manifestPath: string): Promise<NativeProjectSource | null> {
      const value = await invoke<unknown>('project_open_recent', { request: { manifestPath } });
      return value === null ? null : parseNativeProjectSource(value);
    },
    async listenProjectEvents(listener: (event: NativeProjectEvent) => void): Promise<() => void> {
      return listen<unknown>(PROJECT_OPEN_EVENT, (event) => {
        listener(parseNativeProjectEventOrError(event.payload));
      });
    },
    async validateProject(request: ProjectValidationRequest): Promise<ValidatedProjectBoundary> {
      return parseValidatedProjectBoundary(await invoke<unknown>('project_validate', { request }));
    },
    async activateProject(request: ProjectActivationRequest): Promise<void> {
      await invoke('project_activate', { request });
    },
  });
}
