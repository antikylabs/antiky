import { createEngineSession, createInspectionSnapshot, createSessionId } from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';

import { TRAVERSAL_WORLD_ID, createTraversalInspectionModel } from './inspection.ts';
import {
  createTraversalInputBuffer,
  createTraversalSessionInputCapture,
} from './input-buffer.ts';
import { createTraversalRenderer } from './renderer.ts';
import { createTraversalSimulation, type TraversalInput } from './simulation.ts';

type MutableTraversalInput = {
  -readonly [Key in keyof Required<TraversalInput>]: Required<TraversalInput>[Key];
};

function captureInput(context: Parameters<GameModuleEntry>[0], target: MutableTraversalInput): void {
  const horizontal = context.movement.active && Number.isFinite(context.movement.x)
    ? Math.max(-1, Math.min(1, context.movement.x))
    : 0;
  const vertical = context.movement.active && Number.isFinite(context.movement.z)
    ? Math.max(-1, Math.min(1, context.movement.z))
    : 0;
  const jump = context.pointer.clicked || vertical < -0.4;
  const active = Math.abs(horizontal) > 0.01 || Math.abs(vertical) > 0.01 || context.pointer.clicked;
  target.horizontal = horizontal;
  target.active = active;
  target.jump = jump;
  target.brake = vertical > 0.4;
  target.retry = active;
}

const game: GameModuleEntry = async (context) => {
  const presentation = await createTraversalRenderer(context.canvas);
  try {
    const inspectionModel = createTraversalInspectionModel(context.runtimeInstanceId);
    const simulation = createTraversalSimulation((event) => inspectionModel.record(event));
    const session = createEngineSession<TraversalInput>({
      sessionId: createSessionId(),
      worldId: TRAVERSAL_WORLD_ID,
      runtimeInstanceId: context.runtimeInstanceId,
      systems: [Object.freeze({
        id: 'gale-post-traversal',
        run(step) { simulation.update(step.fixedDeltaSeconds, step.input); },
      })],
      captureInput: createTraversalSessionInputCapture(),
      getStateDigest: () => simulation.digest(),
    });

    context.report(presentation.measurements);
    const inputBuffer = createTraversalInputBuffer();
    const hostInput: MutableTraversalInput = { horizontal: 0, active: false, jump: false, brake: false, retry: false };
    let previousPlatformTime: number | null = null;
    let disposed = false;
    const semanticInput = (): TraversalInput => {
      captureInput(context, hostInput);
      inputBuffer.capture(hostInput);
      return inputBuffer.read();
    };
    const render = (deltaSeconds: number): void => {
      presentation.render(simulation.view(), context.pointer, deltaSeconds);
    };

    const inspection: GameInspectionPort = Object.freeze({
      snapshot(state) {
        const base = createGameInspectionSnapshot(state, { session: session.readStatus() });
        const snapshot = simulation.read();
        return createInspectionSnapshot({
          ...base,
          world: inspectionModel.world(snapshot),
          events: inspectionModel.events(),
        });
      },
      pauseSimulation() {
        const result = session.pause('tool');
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      resumeSimulation() {
        const result = session.resume('tool');
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      stepSimulation(expectedCompletedStepCount) {
        const result = session.step(expectedCompletedStepCount, semanticInput());
        inputBuffer.consume(result.code === 'STEPPED' ? 1 : 0);
        if (result.renderRequested) render(1 / 60);
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        const elapsed = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
          ? 0
          : Math.min(0.1, platformTimeSeconds - previousPlatformTime);
        previousPlatformTime = platformTimeSeconds;
        const result = session.advance(elapsed, semanticInput());
        inputBuffer.consume(result.completedSteps);
        render(elapsed);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          session.dispose();
        } finally {
          presentation.dispose();
        }
      },
    });
  } catch (cause: unknown) {
    presentation.dispose();
    throw cause;
  }
};

export default game;
