import {
  createInspectionSnapshot,
  type InspectionSnapshot,
  type RuntimeLifecycle,
} from '../inspection/snapshot.ts';
import type {
  CorrectPointLightPowerRequest,
  PointLightCommandContext,
  PointLightCommandResult,
  SetPointLightPowerCommand,
} from '../point-light/commands.ts';
import {
  createPointLightWorldViews,
} from '../point-light/world-inspection.ts';
import type { PointLightInspection } from '../point-light/inspection.ts';
import type {
  EngineControlResult,
  EngineSessionStatus,
} from '../sessions/engine-session/contract.ts';

/** Semantic pointer state that a game reads from an Antiky host. */
export type GamePointerInput = Readonly<{
  x: number;
  y: number;
  down: boolean;
  active: boolean;
  dragX: number;
  dragY: number;
  clicked: boolean;
}>;

/** Semantic two-axis movement that a game reads from an Antiky host. */
export type GameMovementInput = Readonly<{
  x: number;
  z: number;
  active: boolean;
}>;

export type GameHostMode = 'ambient' | 'interactive' | 'thumbnail';

export type GameMeasurements = Readonly<{
  instances?: number;
  drawCalls?: number;
  uploadBytesPerFrame?: number;
  note?: string;
}>;

export type GameHostInspectionState = Readonly<{
  runtimeInstanceId: string;
  lifecycle: RuntimeLifecycle;
  frameCount: number;
  framesPerSecond: number;
  canvasWidth: number;
  canvasHeight: number;
  measurements: GameMeasurements;
  error?: Readonly<{
    code: string;
    message: string;
  }>;
}>;

export type GameInspectionDetails = Readonly<{
  session?: EngineSessionStatus;
  pointLights?: PointLightInspection;
}>;

export type GameSessionControlResult = Readonly<{
  result: EngineControlResult;
  session: EngineSessionStatus;
}>;

/** Optional semantic inspection supplied by a game to a development host. */
export type GameInspectionPort = Readonly<{
  snapshot(state: GameHostInspectionState): InspectionSnapshot;
  setPointLightPower?(
    command: SetPointLightPowerCommand,
    context: PointLightCommandContext,
  ): PointLightCommandResult | Promise<PointLightCommandResult>;
  correctPointLightPower?(
    request: CorrectPointLightPowerRequest,
    context: PointLightCommandContext,
  ): PointLightCommandResult | Promise<PointLightCommandResult>;
  pauseSimulation?(): GameSessionControlResult | Promise<GameSessionControlResult>;
  resumeSimulation?(): GameSessionControlResult | Promise<GameSessionControlResult>;
  stepSimulation?(
    expectedCompletedStepCount: number,
  ): GameSessionControlResult | Promise<GameSessionControlResult>;
}>;

function sessionLifecycle(
  lifecycle: RuntimeLifecycle,
  session: EngineSessionStatus | undefined,
): RuntimeLifecycle {
  if (session?.mode === 'paused') return 'paused';
  if (session?.mode === 'faulted') return 'error';
  if (session?.mode === 'disposed') return 'stopped';
  return lifecycle;
}

/** Build the validated snapshot shared by generic and game-specific inspection. */
export function createGameInspectionSnapshot(
  state: GameHostInspectionState,
  details: GameInspectionDetails = {},
): InspectionSnapshot {
  const render: {
    owner: 'framework';
    canvasWidth?: number;
    canvasHeight?: number;
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
  } = { owner: 'framework' };
  if (state.canvasWidth > 0) render.canvasWidth = state.canvasWidth;
  if (state.canvasHeight > 0) render.canvasHeight = state.canvasHeight;
  if (state.measurements.drawCalls !== undefined) {
    render.drawCalls = state.measurements.drawCalls;
  }
  if (state.measurements.instances !== undefined) {
    render.instances = state.measurements.instances;
  }
  if (state.measurements.uploadBytesPerFrame !== undefined) {
    render.uploadBytesPerFrame = state.measurements.uploadBytesPerFrame;
  }
  const pointLightWorldViews = details.pointLights === undefined
    ? undefined
    : createPointLightWorldViews(details.pointLights);

  return createInspectionSnapshot({
    schemaVersion: 1,
    runtime: {
      instanceId: state.runtimeInstanceId,
      lifecycle: sessionLifecycle(state.lifecycle, details.session),
    },
    diagnostics: state.error === undefined ? [] : [{
      id: `${state.runtimeInstanceId}:game-host`,
      owner: 'framework',
      source: 'runtime',
      code: state.error.code,
      severity: 'error',
      message: state.error.message,
      relatedIds: [state.runtimeInstanceId],
    }],
    measurements: {
      runtime: {
        owner: 'framework',
        frameCount: state.frameCount,
        framesPerSecond: state.framesPerSecond,
      },
      render,
    },
    ...(details.session === undefined ? {} : { session: details.session }),
    ...(details.pointLights === undefined ? {} : { pointLights: details.pointLights }),
    ...(pointLightWorldViews === undefined ? {} : pointLightWorldViews),
  });
}

/** Platform data and services supplied when a host mounts one game module. */
export type GameHostContext = Readonly<{
  canvas: HTMLCanvasElement;
  runtimeInstanceId: string;
  pointer: GamePointerInput;
  movement: GameMovementInput;
  mode: GameHostMode;
  report(measurements: GameMeasurements): void;
}>;

/** One mounted game. The host owns presentation timing and disposal. */
export type GameInstance = Readonly<{
  frame(platformTimeSeconds: number): void;
  dispose(): void;
  inspection?: GameInspectionPort;
}>;

/** The default export of a compiled Antiky game module. */
export type GameModuleEntry = (
  context: GameHostContext,
) => GameInstance | Promise<GameInstance>;
