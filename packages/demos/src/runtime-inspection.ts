import {
  createInspectionSnapshot,
  type InspectionSnapshot,
  type RuntimeLifecycle,
} from '@antiky/framework';

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
}>;

function runtimeLifecycle(phase: DemoRuntimePhase): RuntimeLifecycle {
  if (phase === 'poster' || phase === 'loading') return 'initializing';
  return phase;
}

export function createDemoInspectionSnapshot(input: DemoInspectionInput): InspectionSnapshot {
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
      code: 'ANTIKY_RUNTIME_ERROR',
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
  });
}
