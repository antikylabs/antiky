import { createRenderer } from 'brometal';
import {
  FIXED_STEP_SECONDS,
  createEngineSession,
  createInspectionSnapshot,
  createSessionId,
  inspectPointLightService,
  createSessionFrameDriver,
} from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';

import { createRelayInspectionModel } from './inspection.ts';
import { createRelayInteractionBuffer } from './input-buffer.ts';
import { EXPO_LIGHT_IDS, EXPO_WORLD_ID, createExpoLightService } from './lights.ts';
import { createPresentedView } from './presented-view.ts';
import { RELAY_PRESENTATION } from './presentation.ts';
import { createRelayRenderer } from './renderer.ts';
import {
  createBlackoutRelaySimulation,
  type RelayInput,
} from './simulation.ts';

function capturedMovement(context: Parameters<GameModuleEntry>[0]): RelayInput['movement'] {
  const x = context.movement.active && Number.isFinite(context.movement.x)
    ? Math.max(-1, Math.min(1, context.movement.x))
    : 0;
  const z = context.movement.active && Number.isFinite(context.movement.z)
    ? Math.max(-1, Math.min(1, context.movement.z))
    : 0;
  return Object.freeze({ x, z, active: Math.hypot(x, z) > 0.01 });
}

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

const game: GameModuleEntry = async (context) => {
  const renderer = await createRenderer(context.canvas, {
    clearColor: RELAY_PRESENTATION.clearColor,
    cull: 'back',
  });
  const lightService = createExpoLightService(context.runtimeInstanceId);
  let relayRenderer: Awaited<ReturnType<typeof createRelayRenderer>> | undefined;
  try {
    const lightRecords = EXPO_LIGHT_IDS.map((entityId) => {
      const record = lightService.getPointLight(entityId);
      if (record === undefined) throw new Error(`Blackout Relay is missing authored light ${entityId}.`);
      return record;
    });
    // TEMPORARY DIAGNOSTIC — remove once the driver migration renders.
    // A construction failure here rejects the module entry, the host publishes nothing, and the
    // capture harness reports only CAPTURE_RUNTIME_TIMEOUT. That hides the actual error completely.
    // Reporting it through `report` puts it in the metrics sidecar, which is readable.
    try {
      relayRenderer = await createRelayRenderer(renderer, lightRecords);
    } catch (cause: unknown) {
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      context.report({ note: `RENDERER CONSTRUCTION FAILED — ${detail}` });
      // Publish a blank frame rather than rejecting, so the capture succeeds and the note above
      // reaches the sidecar. If the capture still times out, construction was NOT the failure.
      return Object.freeze({
        frame(): void { renderer.present(() => {}); },
        dispose(): void { renderer.destroy(); },
      });
    }
    const powers: [number, number, number] = [0, 0, 0];
    const inspectionModel = createRelayInspectionModel(context.runtimeInstanceId);
    const simulation = createBlackoutRelaySimulation((event) => inspectionModel.record(event));
    const presentedView = createPresentedView(simulation.view());
    const interaction = createRelayInteractionBuffer();

    const refreshPowers = (): void => {
      EXPO_LIGHT_IDS.forEach((entityId, index) => {
        powers[index] = lightService.getPointLight(entityId)?.pointLight.power ?? 0;
      });
      const changes = lightService.readPointLightRenderChanges();
      if (changes.pointLights.length > 0) {
        lightService.acknowledgePointLightRenderChanges(changes.eventSequence);
      }
    };
    refreshPowers();

    const semanticInput = (): RelayInput => Object.freeze({
      movement: capturedMovement(context),
      interact: interaction.read(),
      lightPowers: Object.freeze([...powers]) as readonly [number, number, number],
    });

    const session = createEngineSession<RelayInput>({
      sessionId: createSessionId(),
      worldId: EXPO_WORLD_ID,
      runtimeInstanceId: context.runtimeInstanceId,
      systems: [Object.freeze({
        id: 'blackout-relay-simulation',
        run(step) {
          simulation.update(step.fixedDeltaSeconds, step.input);
        },
      })],
      captureInput(input) {
        if (
          !Number.isFinite(input.movement.x)
          || !Number.isFinite(input.movement.z)
          || input.lightPowers.some((power) => !Number.isFinite(power))
        ) return null;
        return Object.freeze({
          movement: Object.freeze({ ...input.movement }),
          interact: input.interact === true,
          lightPowers: Object.freeze([...input.lightPowers]) as readonly [number, number, number],
        });
      },
      getStateDigest: () => simulation.digest(),
    });

    context.report(relayRenderer.measurements);
    let disposed = false;
    // One place derives elapsed time, routes a failed advance somewhere visible, and presents
    // either way.
    const driver = createSessionFrameDriver<RelayInput>({
      advance(elapsedSeconds, input) {
        // Captured before the steps run, so the blend has a genuine previous state.
        presentedView.capture();
        return session.advance(elapsedSeconds, input);
      },
      input: semanticInput,
      present: (alpha) => { relayRenderer?.render(presentedView.present(alpha), powers, context.pointer); },
      presentationAlpha: (result) => presentationAlpha(result.completedSteps, session.readStatus()),
      onFault: ({ code }) => {
        // Previously dropped, in every demo, including SESSION_FAULTED — a faulted session showed
        // as a frozen picture with no diagnostic anywhere.
        context.report({ note: `relay session frame: ${code}` });
      },
    });

    const inspection: GameInspectionPort = Object.freeze({
      snapshot(state) {
        const base = createGameInspectionSnapshot(state, {
          session: session.readStatus(),
          pointLights: inspectPointLightService(lightService),
        });
        return createInspectionSnapshot({
          ...base,
          world: inspectionModel.world(simulation.read()),
          events: inspectionModel.events(),
        });
      },
      setPointLightPower(command, commandContext) {
        return lightService.submitPointLightPower(command, commandContext);
      },
      correctPointLightPower(request, commandContext) {
        return lightService.correctPointLightPower(request, commandContext);
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
        refreshPowers();
        interaction.capture(context.pointer.clicked === true);
        const result = session.step(expectedCompletedStepCount, semanticInput());
        interaction.consume(result.code === 'STEPPED' ? 1 : 0);
        relayRenderer?.render(presentedView.present(1), powers, context.pointer);
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        refreshPowers();
        interaction.consume(driver.frame(platformTimeSeconds).completedSteps);
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        try {
          session.dispose();
          lightService.dispose();
          relayRenderer?.dispose();
        } finally {
          renderer.destroy();
        }
      },
    });
  } catch (cause: unknown) {
    relayRenderer?.dispose();
    lightService.dispose();
    renderer.destroy();
    throw cause;
  }
};

export default game;
