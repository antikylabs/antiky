import {
  createInspectionSnapshot,
  createPointLightWorldViews,
  type EngineSessionStatus,
  type InspectionSnapshot,
  type PointLightInspection,
  type RuntimeLifecycle,
} from '@antiky/framework';
import type { BroMetalErrorCode } from 'brometal';

import type { DemoStats } from './runtime.ts';

export type DemoRuntimePhase =
  | 'poster'
  | 'loading'
  | 'ready'
  | 'running'
  | 'paused'
  | 'error'
  | 'stopped';

export type DemoInspectionInput = Readonly<{
  runtimeInstanceId: string;
  phase: DemoRuntimePhase;
  frameCount: number;
  framesPerSecond: number;
  canvasWidth: number;
  canvasHeight: number;
  stats: DemoStats;
  error: string | null;
  errorCode?: BroMetalErrorCode;
  session?: EngineSessionStatus;
  pointLights?: PointLightInspection;
}>;

function runtimeLifecycle(phase: DemoRuntimePhase): RuntimeLifecycle {
  if (phase === 'poster' || phase === 'loading') return 'initializing';
  return phase;
}

export function createDemoInspectionSnapshot(input: DemoInspectionInput): InspectionSnapshot {
  const pointLightWorldViews = input.pointLights === undefined
    ? undefined
    : createPointLightWorldViews(input.pointLights);
  const renderMeasurements: {
    owner: 'framework';
    canvasWidth?: number;
    canvasHeight?: number;
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
  } = { owner: 'framework' };
  if (input.canvasWidth > 0) renderMeasurements.canvasWidth = input.canvasWidth;
  if (input.canvasHeight > 0) renderMeasurements.canvasHeight = input.canvasHeight;
  if (input.stats.drawCalls !== undefined) renderMeasurements.drawCalls = input.stats.drawCalls;
  if (input.stats.instances !== undefined) renderMeasurements.instances = input.stats.instances;
  if (input.stats.bytesPerFrame !== undefined) {
    renderMeasurements.uploadBytesPerFrame = input.stats.bytesPerFrame;
  }

  const diagnostics = input.phase === 'error'
    ? [{
      id: `${input.runtimeInstanceId}:error`,
      owner: 'framework' as const,
      source: 'runtime' as const,
      code: input.errorCode === undefined
        ? 'ANTIKY_RUNTIME_ERROR'
        : `ANTIKY_BROMETAL_${input.errorCode.replaceAll('-', '_').toUpperCase()}`,
      severity: 'error' as const,
      message: input.error ?? 'The runtime failed without an error message.',
      relatedIds: [input.runtimeInstanceId],
    }]
    : [];

  return createInspectionSnapshot({
    schemaVersion: 1,
    runtime: {
      instanceId: input.runtimeInstanceId,
      lifecycle: runtimeLifecycle(input.phase),
    },
    diagnostics,
    measurements: {
      runtime: {
        owner: 'framework',
        frameCount: input.frameCount,
        framesPerSecond: input.framesPerSecond,
      },
      render: renderMeasurements,
    },
    ...(input.session === undefined ? {} : { session: input.session }),
    ...(input.pointLights === undefined ? {} : { pointLights: input.pointLights }),
    ...(pointLightWorldViews === undefined ? {} : pointLightWorldViews),
  });
}
