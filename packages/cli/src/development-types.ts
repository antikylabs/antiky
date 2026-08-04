import type { InspectionSnapshot } from '@antiky/framework';

export const DEVELOPMENT_SCHEMA_VERSION = 1 as const;

export type DevelopmentProcessState = 'starting' | 'running' | 'stopped' | 'failed';
export type DevelopmentConnectionState = 'waiting' | 'connected' | 'unavailable';
export type DevelopmentCleanupState = 'active' | 'stopping' | 'stopped';
export type DevelopmentChangeKind = 'initial' | 'source' | 'shader' | 'asset' | 'config';
export type DevelopmentBuildResult = 'pending' | 'ready' | 'failed';

export type DevelopmentBuildSnapshot = Readonly<{
  owner: 'cli';
  revision: number;
  changeKind: DevelopmentChangeKind;
  result: DevelopmentBuildResult;
  changedPath?: string;
  durationMilliseconds?: number;
}>;

export type DevelopmentDiagnostic = Readonly<{
  id: string;
  owner: 'cli';
  source: 'build' | 'connection' | 'action';
  revision: number;
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  relatedIds: readonly string[];
}>;

export type DevelopmentSnapshot = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  acceptedBuildRevision: number;
  startedAt: string;
  config: Readonly<{
    path: string;
    gameUrl: string;
    host: '127.0.0.1';
    gamePort: number;
    inspectionPort: number;
  }>;
  processes: Readonly<{
    game: Readonly<{
      state: DevelopmentProcessState;
      pid?: number;
      exitCode?: number;
    }>;
    shaders: Readonly<{
      state: DevelopmentProcessState;
      pid?: number;
      exitCode?: number;
    }>;
  }>;
  connection: Readonly<{
    state: DevelopmentConnectionState;
  }>;
  cleanup: Readonly<{
    state: DevelopmentCleanupState;
  }>;
  build: DevelopmentBuildSnapshot;
  diagnostics: readonly DevelopmentDiagnostic[];
  measurements: Readonly<{
    owner: 'cli';
    launchMilliseconds: number;
    cleanupMilliseconds?: number;
  }>;
  inspection: InspectionSnapshot | null;
}>;

export type DevelopmentStopReason = 'normal' | 'interrupt' | 'child-failure' | 'start-failure';

export type DevelopmentStopResult = Readonly<{
  reason: DevelopmentStopReason;
  exitCode: number;
  cleanupMilliseconds: number;
}>;

export type DevelopmentReloadResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  actionId: string;
  developmentSessionId: string;
  buildRevision: number;
  oldRuntimeInstanceId: string;
  newRuntimeInstanceId: string;
  result: 'reloaded';
}>;

export type DevelopmentCaptureResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  actionId: string;
  captureId: string;
  developmentSessionId: string;
  runtimeInstanceId: string;
  buildRevision: number;
  mimeType: 'image/png';
  byteLength: number;
  sha256: string;
  path: string;
}>;
