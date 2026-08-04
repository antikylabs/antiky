import type { InspectionSnapshot } from '@antiky/framework';

export const DEVELOPMENT_SCHEMA_VERSION = 1 as const;

export type DevelopmentProcessState = 'starting' | 'running' | 'stopped' | 'failed';
export type DevelopmentConnectionState = 'waiting' | 'connected' | 'unavailable';
export type DevelopmentCleanupState = 'active' | 'stopping' | 'stopped';

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
  diagnostics: readonly Readonly<{
    id: string;
    owner: 'cli';
    code: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    relatedIds: readonly string[];
  }>[];
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
