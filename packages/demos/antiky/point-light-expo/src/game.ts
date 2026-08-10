import { createRenderer } from 'brometal';
import {
  createEngineSession,
  createInspectionSnapshot,
  createSessionId,
  inspectPointLightService,
} from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInspectionPort,
  type GameModuleEntry,
} from '@antiky/framework/game';

import { createRelayInspectionModel } from './inspection.ts';
import { createRelayInteractionBuffer } from './input-buffer.ts';
import { EXPO_LIGHT_IDS, EXPO_WORLD_ID, createExpoLightService } from './lights.ts';
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
    relayRenderer = await createRelayRenderer(renderer, lightRecords);
    const powers: [number, number, number] = [0, 0, 0];
    const inspectionModel = createRelayInspectionModel(context.runtimeInstanceId);
    const simulation = createBlackoutRelaySimulation((event) => inspectionModel.record(event));
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
    let previousPlatformTime: number | null = null;
    let disposed = false;
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
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      resumeSimulation() {
        const result = session.resume('tool');
        previousPlatformTime = null;
        return Object.freeze({ result, session: session.readStatus() });
      },
      stepSimulation(expectedCompletedStepCount) {
        refreshPowers();
        interaction.capture(context.pointer.clicked === true);
        const result = session.step(expectedCompletedStepCount, semanticInput());
        interaction.consume(result.code === 'STEPPED' ? 1 : 0);
        relayRenderer?.render(simulation.view(), powers, context.pointer);
        return Object.freeze({ result, session: session.readStatus() });
      },
    });

    return Object.freeze({
      inspection,
      frame(platformTimeSeconds: number): void {
        if (disposed) return;
        refreshPowers();
        const elapsed = previousPlatformTime === null || platformTimeSeconds <= previousPlatformTime
          ? 0
          : platformTimeSeconds - previousPlatformTime;
        previousPlatformTime = platformTimeSeconds;
        interaction.capture(context.pointer.clicked === true);
        const result = session.advance(elapsed, semanticInput());
        interaction.consume(result.completedSteps);
        relayRenderer?.render(simulation.view(), powers, context.pointer);
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
