import { unwatchFile, watchFile } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';

import type { InspectionSnapshot } from '@antiky/framework';

import type {
  DevelopmentBuildSnapshot,
  DevelopmentChangeKind,
  DevelopmentDiagnostic,
} from '../development/types.ts';

const DEFAULT_FAILURE_TIMEOUT_MILLISECONDS = 10_000;
const ignoredSegments = new Set(['.antiky', '.git', '.next', 'build', 'node_modules', 'out']);
const assetExtensions = new Set([
  '.avif', '.gif', '.glb', '.gltf', '.jpeg', '.jpg', '.json', '.mp3', '.ogg', '.png', '.svg', '.webp',
]);

type BuildTrackerOptions = Readonly<{
  developmentSessionId: string;
  rootDirectory: string;
  failureTimeoutMilliseconds?: number;
}>;

type PendingBuild = {
  token: number;
  kind: Exclude<DevelopmentChangeKind, 'initial'>;
  changedPath: string;
  startedAtMilliseconds: number;
  priorRuntimeInstanceId: string | null;
  compilerReady: boolean;
  expectedGeneratedPath?: string;
};

export interface BuildTracker {
  snapshot(): DevelopmentBuildSnapshot;
  diagnostics(): readonly DevelopmentDiagnostic[];
  noteFileChange(path: string): void;
  acceptRuntime(snapshot: InspectionSnapshot): number;
  watch(paths: readonly string[]): Promise<void>;
  stop(): Promise<void>;
}

function extension(path: string): string {
  const match = path.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] ?? '';
}

function hasIgnoredSegment(path: string): boolean {
  return path.split(/[\\/]/).some((segment) => ignoredSegments.has(segment));
}

function classify(path: string): Exclude<DevelopmentChangeKind, 'initial'> | null {
  const lower = path.toLowerCase();
  if (lower.endsWith('.shader.ts')) return 'shader';
  if (/\.(?:ts|tsx|js|jsx|css)$/.test(lower) && !/\.test\.[^.]+$/.test(lower)) return 'source';
  if (basename(lower) === 'antiky.config.json') return 'config';
  return assetExtensions.has(extension(lower)) ? 'asset' : null;
}

function isReadyRuntime(snapshot: InspectionSnapshot): boolean {
  return snapshot.runtime.lifecycle === 'ready'
    || snapshot.runtime.lifecycle === 'running'
    || snapshot.runtime.lifecycle === 'paused';
}

function isTrackedFile(path: string): boolean {
  return path.toLowerCase().endsWith('.shader.gen.ts') || classify(path) !== null;
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink() || ignoredSegments.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile() && isTrackedFile(path)) files.push(path);
  }
  return files;
}

export function createBuildTracker(options: BuildTrackerOptions): BuildTracker {
  const rootDirectory = resolve(options.rootDirectory);
  const failureTimeoutMilliseconds = options.failureTimeoutMilliseconds
    ?? DEFAULT_FAILURE_TIMEOUT_MILLISECONDS;
  let revision = 0;
  let latest: DevelopmentBuildSnapshot = Object.freeze({
    owner: 'cli',
    revision,
    changeKind: 'initial',
    result: 'pending',
  });
  let activeDiagnostics: readonly DevelopmentDiagnostic[] = Object.freeze([]);
  let currentRuntimeInstanceId: string | null = null;
  let pending: PendingBuild | null = null;
  let nextToken = 0;
  let failureTimer: NodeJS.Timeout | undefined;
  const watchedFiles = new Set<string>();

  const clearFailureTimer = () => {
    if (failureTimer) clearTimeout(failureTimer);
    failureTimer = undefined;
  };

  const failPending = (candidate: PendingBuild) => {
    if (pending?.token !== candidate.token) return;
    const durationMilliseconds = Date.now() - candidate.startedAtMilliseconds;
    const code = candidate.kind === 'shader'
      ? 'ANTIKY_SHADER_BUILD_FAILED'
      : `ANTIKY_${candidate.kind.toUpperCase()}_BUILD_FAILED`;
    latest = Object.freeze({
      owner: 'cli',
      revision,
      changeKind: candidate.kind,
      result: 'failed',
      changedPath: candidate.changedPath,
      durationMilliseconds,
    });
    activeDiagnostics = Object.freeze([Object.freeze({
      id: `${options.developmentSessionId}:build:${candidate.token}:failed`,
      owner: 'cli' as const,
      source: 'build' as const,
      revision,
      code,
      severity: 'error' as const,
      message: `${candidate.kind} update did not produce a ready runtime.`,
      relatedIds: Object.freeze([
        options.developmentSessionId,
        `build-revision:${revision}`,
      ]),
    })]);
    pending = null;
    failureTimer = undefined;
  };

  const armFailureTimer = (candidate: PendingBuild) => {
    clearFailureTimer();
    failureTimer = setTimeout(() => failPending(candidate), failureTimeoutMilliseconds);
    failureTimer.unref();
  };

  const noteFileChange = (path: string) => {
    const absolutePath = resolve(path);
    const changedPath = relative(rootDirectory, absolutePath).split(sep).join('/');
    if (changedPath.startsWith('../') || changedPath === '..' || hasIgnoredSegment(changedPath)) return;
    const lower = changedPath.toLowerCase();
    if (lower.endsWith('.shader.gen.ts')) {
      if (pending?.kind === 'shader' && pending.expectedGeneratedPath === changedPath) {
        pending.compilerReady = true;
        armFailureTimer(pending);
      }
      return;
    }
    const kind = classify(changedPath);
    if (!kind) return;
    if (pending?.kind === kind && pending.changedPath === changedPath) {
      pending.startedAtMilliseconds = Date.now();
      armFailureTimer(pending);
      return;
    }

    const candidate: PendingBuild = {
      token: ++nextToken,
      kind,
      changedPath,
      startedAtMilliseconds: Date.now(),
      priorRuntimeInstanceId: currentRuntimeInstanceId,
      compilerReady: kind !== 'shader',
      ...(kind === 'shader'
        ? { expectedGeneratedPath: changedPath.replace(/\.shader\.ts$/i, '.shader.gen.ts') }
        : {}),
    };
    pending = candidate;
    activeDiagnostics = Object.freeze([]);
    latest = Object.freeze({
      owner: 'cli',
      revision,
      changeKind: kind,
      result: 'pending',
      changedPath,
    });
    armFailureTimer(candidate);
  };

  const acceptRuntime = (snapshot: InspectionSnapshot): number => {
    if (!isReadyRuntime(snapshot)) return revision;
    const runtimeInstanceId = snapshot.runtime.instanceId;
    if (revision === 0) {
      revision = 1;
      currentRuntimeInstanceId = runtimeInstanceId;
      pending = null;
      clearFailureTimer();
      latest = Object.freeze({
        owner: 'cli',
        revision,
        changeKind: 'initial',
        result: 'ready',
      });
      return revision;
    }

    if (
      pending
      && pending.compilerReady
      && runtimeInstanceId !== pending.priorRuntimeInstanceId
    ) {
      const accepted = pending;
      revision += 1;
      currentRuntimeInstanceId = runtimeInstanceId;
      pending = null;
      clearFailureTimer();
      activeDiagnostics = Object.freeze([]);
      latest = Object.freeze({
        owner: 'cli',
        revision,
        changeKind: accepted.kind,
        result: 'ready',
        changedPath: accepted.changedPath,
        durationMilliseconds: Date.now() - accepted.startedAtMilliseconds,
      });
      return revision;
    }

    if (runtimeInstanceId !== currentRuntimeInstanceId && !pending) {
      currentRuntimeInstanceId = runtimeInstanceId;
    }
    return revision;
  };

  return Object.freeze({
    snapshot: () => latest,
    diagnostics: () => activeDiagnostics,
    noteFileChange,
    acceptRuntime,
    async watch(paths: readonly string[]): Promise<void> {
      for (const path of paths) {
        let isDirectory = false;
        try {
          isDirectory = (await stat(path)).isDirectory();
        } catch {
          continue;
        }
        const targets = isDirectory ? await collectFiles(path) : [path];
        for (const target of targets) {
          if (watchedFiles.has(target) || !isTrackedFile(target)) continue;
          watchFile(target, { interval: 100 }, (current, previous) => {
            if (
              current.mtimeMs !== previous.mtimeMs
              || current.ctimeMs !== previous.ctimeMs
              || current.size !== previous.size
            ) noteFileChange(target);
          });
          watchedFiles.add(target);
        }
      }
    },
    async stop(): Promise<void> {
      clearFailureTimer();
      for (const path of watchedFiles) unwatchFile(path);
      watchedFiles.clear();
    },
  });
}
