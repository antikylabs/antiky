import {
  FIXED_STEP_SECONDS,
  createEngineSession,
  createInspectionSnapshot,
  createSessionId,
  createSessionFrameDriver,
} from '@antiky/framework';
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
import { createPresentedView } from './presented-view.ts';
import { createTraversalSimulation, type TraversalInput } from './simulation.ts';

/**
 * How far to blend from the previous simulation state towards the current one.
 *
 * `session.advance` runs its whole batch of fixed steps with no per-step hook, so the state
 * captured before it is one step old only when the frame ran exactly one step — the normal case at
 * 60 Hz or above. A frame that ran several steps was already late, so snapping there is both
 * correct and invisible. Zero steps needs no special case: nothing moved.
 */
function presentationAlpha(
  completedSteps: number,
  status: Readonly<{ clock: Readonly<{ accumulatorSeconds: number }> }>,
): number {
  if (completedSteps > 1) return 1;
  return status.clock.accumulatorSeconds / FIXED_STEP_SECONDS;
}

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
    let disposed = false;
    const semanticInput = (): TraversalInput => {
      captureInput(context, hostInput);
      inputBuffer.capture(hostInput);
      return inputBuffer.read();
    };
    const presentedView = createPresentedView(simulation.view());
    // `alpha` defaults to 1, meaning "show the newest state exactly", which is what a tool-driven
    // step wants. Only the real-time loop below presents a partial step.
    const render = (deltaSeconds: number, alpha = 1): void => {
      presentation.render(presentedView.present(alpha), context.pointer, deltaSeconds);
    };

    // One place derives elapsed time, routes a failed advance somewhere visible, and presents
    // either way. The `Math.min(0.1, ...)` clamp that used to sit in `frame` is gone: the session's
    // own MAX_FRAME_ELAPSED_SECONDS is 0.05, so 0.1 clamped nothing and only read as though it did.
    let frameElapsedSeconds = 0;
    const driver = createSessionFrameDriver<TraversalInput>({
      advance(elapsedSeconds, input) {
        frameElapsedSeconds = elapsedSeconds;
        // Captured before the steps run, so the blend has a genuine previous state.
        presentedView.capture();
        return session.advance(elapsedSeconds, input);
      },
      input: semanticInput,
      present: (alpha) => { render(frameElapsedSeconds, alpha); },
      presentationAlpha: (result) => presentationAlpha(result.completedSteps, session.readStatus()),
      onFault: ({ code }) => {
        // Previously dropped, in every demo, including SESSION_FAULTED — a faulted session showed
        // as a frozen picture with no diagnostic anywhere. `report` is what the host and the MCP
        // already read.
        context.report({ ...presentation.measurements, note: `traversal session frame: ${code}` });
      },
    });

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
        driver.resetClock();
        return Object.freeze({ result, session: session.readStatus() });
      },
      resumeSimulation() {
        const result = session.resume('tool');
        driver.resetClock();
        return Object.freeze({ result, session: session.readStatus() });
      },
      stepSimulation(expectedCompletedStepCount) {
        const result = session.step(expectedCompletedStepCount, semanticInput());
        inputBuffer.consume(result.code === 'STEPPED' ? 1 : 0);
        if (result.renderRequested) driver.presentStep(result);
        else driver.resetClock();
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        inputBuffer.consume(driver.frame(platformTimeSeconds).completedSteps);
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
