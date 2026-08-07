import { watch as watchDirectory, type Dirent, type FSWatcher } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';

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
  if (lower.endsWith('.antiky')) return 'project';
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

type WatchSnapshot = Readonly<{
  directories: ReadonlySet<string>;
  files: ReadonlyMap<string, string>;
}>;

function fileSignature(file: Awaited<ReturnType<typeof stat>>): string {
  return `${file.mtimeMs}:${file.ctimeMs}:${file.size}:${file.ino}`;
}

async function collectDirectory(
  root: string,
  directories: Set<string>,
  files: Map<string, string>,
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  directories.add(root);
  for (const entry of entries) {
    if (entry.isSymbolicLink() || ignoredSegments.has(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      await collectDirectory(path, directories, files);
    } else if (entry.isFile() && isTrackedFile(path)) {
      try {
        files.set(path, fileSignature(await stat(path)));
      } catch {
        // A concurrent rename or deletion will be present in the next directory snapshot.
      }
    }
  }
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
  const directoryRoots = new Set<string>();
  const explicitFiles = new Set<string>();
  const directoryWatchers = new Map<string, FSWatcher>();
  const pollingDirectories = new Set<string>();
  let knownFiles: ReadonlyMap<string, string> = new Map();
  let scanTimer: NodeJS.Timeout | undefined;
  let pollingTimer: NodeJS.Timeout | undefined;
  let scanQueue = Promise.resolve();
  let initializedWatch = false;
  let stopped = false;

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

  const collectWatchSnapshot = async (): Promise<WatchSnapshot> => {
    const directories = new Set<string>();
    const files = new Map<string, string>();
    for (const root of directoryRoots) {
      directories.add(root);
      await collectDirectory(root, new Set(), files);
    }
    for (const path of explicitFiles) {
      const parent = dirname(path);
      try {
        if ((await stat(parent)).isDirectory()) directories.add(parent);
        const file = await stat(path);
        if (file.isFile() && isTrackedFile(path)) files.set(path, fileSignature(file));
      } catch {
        // A missing explicit file stays registered so its later creation can be observed.
      }
    }
    return Object.freeze({ directories, files });
  };

  const scheduleScan = (): void => {
    if (stopped || scanTimer !== undefined) return;
    scanTimer = setTimeout(() => {
      scanTimer = undefined;
      void queueWatchScan(true).catch(() => undefined);
    }, 10);
    scanTimer.unref();
  };

  const synchronizeDirectoryWatchers = (directories: ReadonlySet<string>): boolean => {
    let addedWatcher = false;
    for (const [path, watcher] of directoryWatchers) {
      if (directories.has(path)) continue;
      watcher.close();
      directoryWatchers.delete(path);
      pollingDirectories.delete(path);
    }
    for (const path of directories) {
      if (directoryWatchers.has(path) || pollingDirectories.has(path)) continue;
      try {
        const watcher = watchDirectory(path, {
          persistent: false,
          recursive: directoryRoots.has(path),
        }, scheduleScan);
        watcher.on('error', () => {
          if (directoryWatchers.get(path) !== watcher) return;
          watcher.close();
          directoryWatchers.delete(path);
          pollingDirectories.add(path);
          startPolling();
        });
        directoryWatchers.set(path, watcher);
        pollingDirectories.delete(path);
        addedWatcher = true;
      } catch {
        pollingDirectories.add(path);
        startPolling();
      }
    }
    return addedWatcher;
  };

  const reconcileWatchState = async (emitChanges: boolean): Promise<void> => {
    if (stopped) return;
    const current = await collectWatchSnapshot();
    if (stopped) return;
    const addedWatcher = synchronizeDirectoryWatchers(current.directories);
    if (emitChanges) {
      const removed = [...knownFiles.keys()]
        .filter((path) => !current.files.has(path))
        .sort();
      for (const path of removed) {
        if (!path.toLowerCase().endsWith('.shader.gen.ts')) noteFileChange(path);
      }
      const changed = [...current.files]
        .filter(([path, signature]) => knownFiles.get(path) !== signature)
        .map(([path]) => path)
        .sort((left, right) => {
          const leftGenerated = left.toLowerCase().endsWith('.shader.gen.ts');
          const rightGenerated = right.toLowerCase().endsWith('.shader.gen.ts');
          if (leftGenerated !== rightGenerated) return leftGenerated ? 1 : -1;
          return left.localeCompare(right);
        });
      for (const path of changed) noteFileChange(path);
    }
    knownFiles = current.files;
    if (addedWatcher) scheduleScan();
  };

  const queueWatchScan = (emitChanges: boolean): Promise<void> => {
    const queued = scanQueue.then(() => reconcileWatchState(emitChanges));
    scanQueue = queued.catch(() => undefined);
    return queued;
  };

  const startPolling = (): void => {
    if (stopped || pollingTimer !== undefined) return;
    pollingTimer = setInterval(() => {
      if (pollingDirectories.size === 0) {
        clearInterval(pollingTimer);
        pollingTimer = undefined;
        return;
      }
      void queueWatchScan(true).catch(() => undefined);
    }, 100);
    pollingTimer.unref();
  };

  return Object.freeze({
    snapshot: () => latest,
    diagnostics: () => activeDiagnostics,
    noteFileChange,
    acceptRuntime,
    async watch(paths: readonly string[]): Promise<void> {
      for (const path of paths) {
        const absolutePath = resolve(path);
        const relativePath = relative(rootDirectory, absolutePath).split(sep).join('/');
        if (
          relativePath === '..'
          || relativePath.startsWith('../')
          || hasIgnoredSegment(relativePath)
        ) {
          continue;
        }
        try {
          const file = await stat(absolutePath);
          if (file.isDirectory()) directoryRoots.add(absolutePath);
          else if (file.isFile() && isTrackedFile(absolutePath)) explicitFiles.add(absolutePath);
        } catch {
          if (isTrackedFile(absolutePath)) explicitFiles.add(absolutePath);
        }
      }
      if (!initializedWatch) {
        await queueWatchScan(false);
        initializedWatch = true;
      }
      await queueWatchScan(true);
    },
    async stop(): Promise<void> {
      stopped = true;
      clearFailureTimer();
      if (scanTimer !== undefined) clearTimeout(scanTimer);
      scanTimer = undefined;
      if (pollingTimer !== undefined) clearInterval(pollingTimer);
      pollingTimer = undefined;
      for (const watcher of directoryWatchers.values()) watcher.close();
      directoryWatchers.clear();
      await scanQueue;
      directoryRoots.clear();
      explicitFiles.clear();
      pollingDirectories.clear();
      knownFiles = new Map();
    },
  });
}
