import {
  FIXED_STEP_SECONDS,
  createEngineSession,
  createInspectionSnapshot,
  createSessionId,
} from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';

import { COMBAT_WORLD_ID, createCombatInspectionModel } from './inspection.ts';
import { createCombatActionBuffer } from './input-buffer.ts';
import { createPresentedView } from './presented-view.ts';
import { createCombatRenderer } from './renderer.ts';
import {
  createCombatSimulation,
  type CombatInput,
  type CombatSnapshot,
} from './simulation.ts';

/**
 * How far to blend from the previous simulation state towards the current one.
 *
 * `session.advance` runs the whole batch of fixed steps internally with no per-step hook, so the
 * state captured before it is one step old only when the frame ran exactly one step. That is the
 * normal case on any display at or above 60 Hz. When a frame runs several steps — a slow frame, a
 * background tab catching up — the captured state is several steps stale, and blending towards it
 * would drag everything backwards. Snapping is correct there, and it is also invisible, because a
 * frame that ran three steps was already late.
 *
 * Zero steps needs no special case: nothing moved, so previous and current are equal.
 */
function presentationAlpha(
  completedSteps: number,
  status: Readonly<{ clock: Readonly<{ accumulatorSeconds: number }> }>,
): number {
  if (completedSteps > 1) return 1;
  return status.clock.accumulatorSeconds / FIXED_STEP_SECONDS;
}

function capturedInput(
  context: Parameters<GameModuleEntry>[0],
  state: CombatSnapshot,
  attack: boolean,
): CombatInput {
  const movementX = context.movement.active && Number.isFinite(context.movement.x)
    ? context.movement.x
    : 0;
  const movementZ = context.movement.active && Number.isFinite(context.movement.z)
    ? context.movement.z
    : 0;
  let aimX = context.pointer.active && Number.isFinite(context.pointer.x)
    ? (context.pointer.x - 0.5) * 2
    : state.player.facingX;
  let aimZ = context.pointer.active && Number.isFinite(context.pointer.y)
    ? -(context.pointer.y - 0.5) * 2
    : state.player.facingZ;
  const aimLength = Math.hypot(aimX, aimZ);
  if (aimLength > 0.01) {
    aimX /= aimLength;
    aimZ /= aimLength;
  } else {
    aimX = state.player.facingX;
    aimZ = state.player.facingZ;
  }
  return Object.freeze({
    movement: Object.freeze({
      x: Math.max(-1, Math.min(1, movementX)),
      z: Math.max(-1, Math.min(1, movementZ)),
      active: Math.hypot(movementX, movementZ) > 0.01,
    }),
    aim: Object.freeze({ x: aimX, z: aimZ }),
    attack,
  });
}

const game: GameModuleEntry = async (context) => {
  const combatRenderer = await createCombatRenderer(context.canvas);
  try {
    const inspectionModel = createCombatInspectionModel(context.runtimeInstanceId);
    const simulation = createCombatSimulation((event) => inspectionModel.record(event));
    const action = createCombatActionBuffer();
    const session = createEngineSession<CombatInput>({
      sessionId: createSessionId(),
      worldId: COMBAT_WORLD_ID,
      runtimeInstanceId: context.runtimeInstanceId,
      systems: [Object.freeze({
        id: 'starbreaker-combat',
        run(step) {
          simulation.update(step.fixedDeltaSeconds, step.input);
        },
      })],
      captureInput(input) {
        if (
          !Number.isFinite(input.movement.x)
          || !Number.isFinite(input.movement.z)
          || !Number.isFinite(input.aim.x)
          || !Number.isFinite(input.aim.z)
        ) return null;
        return Object.freeze({
          movement: Object.freeze({ ...input.movement }),
          aim: Object.freeze({ ...input.aim }),
          attack: input.attack === true,
        });
      },
      getStateDigest: () => simulation.digest(),
    });

    context.report({
      ...combatRenderer.measurements,
      note: 'Antiky-owned fixed-step Starbreaker combat projected through the BroMetal presentation boundary',
    });

    let previousPlatformTime: number | null = null;
    let disposed = false;
    const semanticInput = (): CombatInput => capturedInput(context, simulation.view(), action.read());
    const presentedView = createPresentedView(simulation.view());
    // 1 means "show the newest state exactly", which is what a manual step or a tool-driven frame
    // wants. Only the real-time loop below presents a partial step.
    const render = (alpha = 1): void => {
      combatRenderer.render(presentedView.present(alpha), context.pointer);
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
        action.capture(context.pointer.clicked === true);
        const result = session.step(expectedCompletedStepCount, semanticInput());
        action.consume(result.code === 'STEPPED' ? 1 : 0);
        render();
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        const elapsed = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
          ? 0
          : platformTimeSeconds - previousPlatformTime;
        previousPlatformTime = platformTimeSeconds;
        action.capture(context.pointer.clicked === true);
        // Captured before the steps run, so the blend has a genuine previous state.
        presentedView.capture();
        const result = session.advance(elapsed, semanticInput());
        action.consume(result.completedSteps);
        render(presentationAlpha(result.completedSteps, session.readStatus()));
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          session.dispose();
        } finally {
          combatRenderer.dispose();
        }
      },
    });
  } catch (cause: unknown) {
    combatRenderer.dispose();
    throw cause;
  }
};

export default game;
