import {
  EngineSessionValidationError,
  createEngineSession,
  createSessionId,
  inspectPointLightService,
  type EngineSession,
  type PointLightAuthoringService,
  type PointLightCommandResult,
  type SessionId,
} from '@antiky/framework';
import {
  createGameInspectionSnapshot,
  type GameInstance,
  type GameInspectionPort,
} from '@antiky/framework/game';

import type {
  TownGameSetup,
  TownRuntime,
  TownRuntimeBuilder,
} from './town/town-runtime.ts';
import { createAntikyTownPointLightService } from './content/point-lights.ts';
import {
  createAntikyTownGameHost,
  registerAntikyTownGameHost,
  type TownSemanticInput,
} from './gameplay/game-host.ts';
import { createTownPointLightAdapter } from './render/point-light-adapter.ts';

export type AntikyTownCompositionOptions = Readonly<{
  createSessionId?: () => SessionId;
}>;

export type AntikyTownGameInstance = GameInstance & Readonly<{
  pointLightService: PointLightAuthoringService;
}>;

export type AntikyTownGameFactory = (
  setup: TownGameSetup,
) => AntikyTownGameInstance | Promise<AntikyTownGameInstance>;

function createSessionPointLightService(
  service: PointLightAuthoringService,
  session: EngineSession<TownSemanticInput>,
): PointLightAuthoringService {
  const executePointLightCommand = (
    operation: () => PointLightCommandResult,
  ): PointLightCommandResult => {
    const execution = session.executeCommand(() => {
      const result = operation();
      return Object.freeze({ result, authoringChanged: result.code === 'ACCEPTED' });
    });
    if (execution.code === 'EXECUTED' && execution.result !== undefined) return execution.result;
    if (execution.code === 'SESSION_DISPOSED') return operation();
    throw new EngineSessionValidationError(
      `Point-light command could not run (${execution.code})`,
      '$.pointLightCommand',
    );
  };

  const facade: PointLightAuthoringService = {
    worldId: service.worldId,
    listPointLights: () => service.listPointLights(),
    getPointLight: (entityId) => service.getPointLight(entityId),
    submitPointLightPower: (command, context) => executePointLightCommand(
      () => service.submitPointLightPower(command, context),
    ),
    correctPointLightPower: (request, context) => executePointLightCommand(
      () => service.correctPointLightPower(request, context),
    ),
    listPointLightPowerFacts: () => service.listPointLightPowerFacts(),
    listPointLightCommandResults: () => service.listPointLightCommandResults(),
    readPointLightState: () => service.readPointLightState(),
    readPointLightRenderChanges: () => service.readPointLightRenderChanges(),
    acknowledgePointLightRenderChanges: (eventSequence) => (
      service.acknowledgePointLightRenderChanges(eventSequence)
    ),
    replayPointLightPowerFacts: (facts) => service.replayPointLightPowerFacts(facts),
    rebuildPointLightState: () => service.rebuildPointLightState(),
    dispose: () => session.dispose(),
  };
  return Object.freeze(facade);
}

export function createAntikyTownDemoFactory(
  buildTown: TownRuntimeBuilder,
  options: AntikyTownCompositionOptions = {},
): AntikyTownGameFactory {
  return async (setup) => {
    const service = createAntikyTownPointLightService(setup.runtimeInstanceId);
    let town: TownRuntime | null = null;
    let session: EngineSession<TownSemanticInput> | null = null;
    try {
      const pointLightAdapter = createTownPointLightAdapter(service);
      town = await buildTown({ slotZeroPower: pointLightAdapter })(setup);
      const ownedTown = town;
      session = createEngineSession<TownSemanticInput>({
        sessionId: (options.createSessionId ?? createSessionId)(),
        worldId: service.worldId,
        runtimeInstanceId: setup.runtimeInstanceId,
        systems: [Object.freeze({
          id: 'town-update',
          run(step) {
            ownedTown.update(step.fixedDeltaSeconds, step.input.movement);
          },
        })],
        captureInput(input) {
          return input;
        },
        getStateDigest: () => ownedTown.readStateDigest(),
        services: [service, ownedTown],
      });
      const ownedSession = session;
      const host = createAntikyTownGameHost(
        ownedSession,
        ownedTown,
        setup.movement,
        (render) => setup.renderer.present(render),
      );
      const pointLightService = createSessionPointLightService(service, ownedSession);
      const inspection: GameInspectionPort = Object.freeze({
        snapshot: (state) => createGameInspectionSnapshot(state, {
          session: host.readStatus(),
          pointLights: inspectPointLightService(pointLightService),
        }),
        setPointLightPower: (command, context) => (
          pointLightService.submitPointLightPower(command, context)
        ),
        correctPointLightPower: (request, context) => (
          pointLightService.correctPointLightPower(request, context)
        ),
        pauseSimulation() {
          const result = host.pause('tool');
          return Object.freeze({ result, session: host.readStatus() });
        },
        resumeSimulation() {
          const result = host.resume('tool');
          return Object.freeze({ result, session: host.readStatus() });
        },
        stepSimulation(expectedCompletedStepCount) {
          const result = host.step(expectedCompletedStepCount);
          return Object.freeze({ result, session: host.readStatus() });
        },
      });
      let disposed = false;
      const instance = Object.freeze({
        pointLightService,
        inspection,
        frame(platformTimeSeconds: number): void {
          if (!disposed) host.present(platformTimeSeconds);
        },
        dispose(): void {
          if (disposed) return;
          disposed = true;
          ownedSession.dispose();
        },
      });
      registerAntikyTownGameHost(instance, host);
      return instance;
    } catch (cause: unknown) {
      if (session !== null) {
        session.dispose();
      } else {
        try {
          town?.dispose();
        } finally {
          service.dispose();
        }
      }
      throw cause;
    }
  };
}
