import type {
  CorrectPointLightPowerRequest,
  EngineControlResult,
  EngineSessionStatus,
  EventHistory,
  InspectionSnapshot,
  PointLightAuthoringRecord,
  PointLightCommandResult,
  PointLightPowerSetFact,
  RenderPointLight,
  RuntimePointLight,
  SetPointLightPowerCommand,
  WorldId,
  WorldInspection,
} from '@antiky/framework';
import type { ObservationRefV1 } from './observation.ts';

export const DEVELOPMENT_SCHEMA_VERSION = 1 as const;

export type DevelopmentProcessState = 'starting' | 'running' | 'stopped' | 'failed';
export type DevelopmentConnectionState = 'waiting' | 'connected' | 'unavailable';
export type DevelopmentCleanupState = 'active' | 'stopping' | 'stopped' | 'failed';
export type DevelopmentChangeKind = 'initial' | 'source' | 'shader' | 'asset' | 'project';
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
  project: Readonly<{
    name: string;
    manifestPath: string;
    projectRoot: string;
    revision: string;
    gameUrl: string;
    host: '127.0.0.1';
    gamePort: number;
    inspectionPort: number;
    viewport: Readonly<{
      width: number;
      height: number;
    }>;
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

export type DevelopmentSnapshotV2 = Readonly<
  Omit<DevelopmentSnapshot, 'schemaVersion'>
  & Readonly<{
    schemaVersion: 2;
    observation: ObservationRefV1 | null;
  }>
>;

export type DevelopmentStopReason = 'normal' | 'interrupt' | 'child-failure' | 'start-failure';

export type DevelopmentStopResult = Readonly<{
  reason: DevelopmentStopReason;
  exitCode: number;
  cleanupMilliseconds: number;
  cleanupFailureCount: number;
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

export type DevelopmentPointLightList = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  runtimeInstanceId: string;
  worldId: WorldId;
  eventSequence: number;
  pointLights: readonly PointLightAuthoringRecord[];
}>;

export type DevelopmentPointLightDetails = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  runtimeInstanceId: string;
  worldId: WorldId;
  eventSequence: number;
  pointLight: Readonly<{
    authoring: PointLightAuthoringRecord;
    runtime: RuntimePointLight;
    render: RenderPointLight | null;
    facts: readonly PointLightPowerSetFact[];
  }> | null;
}>;

export type DevelopmentPointLightListV2 = Readonly<{
  schemaVersion: 2;
  observation: ObservationRefV1;
  worldId: WorldId;
  eventSequence: number;
  pointLights: readonly PointLightAuthoringRecord[];
}>;

export type DevelopmentPointLightDetailsV2 = Readonly<{
  schemaVersion: 2;
  observation: ObservationRefV1;
  worldId: WorldId;
  eventSequence: number;
  pointLight: DevelopmentPointLightDetails['pointLight'];
}>;

export type DevelopmentWorldInspection = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  world: WorldInspection;
}>;

export type DevelopmentEventHistory = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  events: EventHistory;
}>;

export type DevelopmentWorldInspectionV2 = Readonly<{
  schemaVersion: 2;
  observation: ObservationRefV1;
  world: WorldInspection;
}>;

export type DevelopmentEventHistoryV2 = Readonly<{
  schemaVersion: 2;
  observation: ObservationRefV1;
  events: EventHistory;
}>;

export type DevelopmentSetPointLightPowerInput = SetPointLightPowerCommand;
export type DevelopmentCorrectPointLightPowerInput = CorrectPointLightPowerRequest;
export type DevelopmentPointLightCommandResult = PointLightCommandResult;

export type DevelopmentSessionStatus = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  session: EngineSessionStatus;
}>;

export type DevelopmentSessionStatusV2 = Readonly<{
  schemaVersion: 2;
  observation: ObservationRefV1;
  session: EngineSessionStatus;
}>;

export type DevelopmentSessionControlResult = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  actionId: string;
  developmentSessionId: string;
  result: EngineControlResult;
  session: EngineSessionStatus;
}>;

export type DevelopmentMcpLogValue =
  | null
  | boolean
  | number
  | string
  | readonly DevelopmentMcpLogValue[]
  | Readonly<{ [key: string]: DevelopmentMcpLogValue }>;

export type DevelopmentMcpCallOutcome = 'success' | 'tool-error' | 'protocol-error';

export type DevelopmentMcpCall = Readonly<{
  sequence: number;
  callId: string;
  jsonRpcId: string | number | null;
  receivedAt: string;
  durationMilliseconds: number;
  toolName: string;
  arguments: DevelopmentMcpLogValue;
  outcome: DevelopmentMcpCallOutcome;
  result?: DevelopmentMcpLogValue;
  error?: DevelopmentMcpLogValue;
  correlationIds: Readonly<Partial<{
    actionId: string;
    captureId: string;
    commandId: string;
    correctedCommandId: string;
    developmentSessionId: string;
    entityId: string;
    runtimeInstanceId: string;
    sessionId: string;
    worldId: string;
  }>>;
  redaction: Readonly<{
    applied: boolean;
    paths: readonly string[];
  }>;
  truncation: Readonly<{
    applied: boolean;
    paths: readonly string[];
  }>;
}>;

export type DevelopmentMcpCallLog = Readonly<{
  schemaVersion: typeof DEVELOPMENT_SCHEMA_VERSION;
  developmentSessionId: string;
  owner: 'cli';
  retention: Readonly<{
    scope: 'development-session';
    capacity: number;
    retainedCount: number;
    droppedCount: number;
    firstSequence: number | null;
    lastSequence: number | null;
  }>;
  calls: readonly DevelopmentMcpCall[];
}>;
