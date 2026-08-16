import type { InspectionSnapshot } from '@antiky/framework';

import {
  createObservationRefV1,
  type ObservationRefV1,
} from '../../development/observation.ts';
import type { DevelopmentConnectionState } from '../../development/types.ts';
import { AntikyCliError } from '../../errors.ts';
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticCode,
  type CliDiagnosticLevel,
  type CliDiagnosticSink,
} from '../inspection/diagnostics.ts';

const DEFAULT_RUNTIME_TIMEOUT_MILLISECONDS = 3000;
const MAX_RETIRED_RUNTIME_IDS = 32;

type RuntimeConnectionOptions = Readonly<{
  timeoutMilliseconds?: number;
  developmentSessionId: string;
  now?: () => string;
  diagnosticSink?: CliDiagnosticSink;
  acceptBuild(snapshot: InspectionSnapshot): number;
}>;

export type RuntimeConnectionSnapshot = Readonly<{
  state: DevelopmentConnectionState;
  runtimeInstanceId: string | null;
  inspection: InspectionSnapshot | null;
  observation: ObservationRefV1 | null;
}>;

export interface RuntimeConnection {
  read(): RuntimeConnectionSnapshot;
  accept(snapshot: InspectionSnapshot, publicationSequence: number): number;
  disconnect(runtimeInstanceId: string, publicationSequence: number): void;
  touch(runtimeInstanceId: string): void;
}

function stale(
  code: 'ANTIKY_RUNTIME_STALE' | 'ANTIKY_PUBLICATION_STALE',
  message: string,
): never {
  throw new AntikyCliError(code, message);
}

export function createRuntimeConnection(options: RuntimeConnectionOptions): RuntimeConnection {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DEFAULT_RUNTIME_TIMEOUT_MILLISECONDS;
  const diagnosticSink = options.diagnosticSink ?? NOOP_CLI_DIAGNOSTIC_SINK;
  let inspection: InspectionSnapshot | null = null;
  let activeRuntimeInstanceId: string | null = null;
  let activePublicationSequence = 0;
  let lastContactMilliseconds = 0;
  let explicitlyDisconnected = false;
  let reportedState: DevelopmentConnectionState = 'waiting';
  let observation: ObservationRefV1 | null = null;
  const retiredRuntimeIds = new Set<string>();
  const now = options.now ?? (() => new Date().toISOString());

  const currentState = (): DevelopmentConnectionState => {
    if (inspection === null) return 'waiting';
    if (
      explicitlyDisconnected
      || Date.now() - lastContactMilliseconds > timeoutMilliseconds
    ) return 'unavailable';
    return 'connected';
  };

  const reportRuntime = (
    level: CliDiagnosticLevel,
    code: CliDiagnosticCode,
    runtimeInstanceId: string,
  ): void => emitCliDiagnostic(diagnosticSink, {
    level,
    code,
    developmentSessionId: options.developmentSessionId,
    runtimeInstanceId,
    component: 'runtime-connection',
  });

  const state = (): DevelopmentConnectionState => {
    const nextState = currentState();
    if (
      nextState === 'unavailable'
      && reportedState === 'connected'
      && !explicitlyDisconnected
      && activeRuntimeInstanceId !== null
    ) {
      reportRuntime('warning', 'ANTIKY_RUNTIME_TIMED_OUT', activeRuntimeInstanceId);
    }
    reportedState = nextState;
    return nextState;
  };

  return Object.freeze({
    read: () => {
      const connectionState = state();
      const observationConnectionState = connectionState === 'connected'
        ? 'connected'
        : 'unavailable';
      const currentObservation = observation === null
        ? null
        : observationConnectionState === observation.connectionState
          ? observation
          : Object.freeze({
            ...observation,
            connectionState: observationConnectionState,
            freshness: 'retained-unavailable' as const,
          });
      return Object.freeze({
      state: connectionState,
      runtimeInstanceId: activeRuntimeInstanceId,
      inspection,
      observation: currentObservation,
      });
    },
    accept(snapshot: InspectionSnapshot, publicationSequence: number): number {
      state();
      const runtimeInstanceId = snapshot.runtime.instanceId;
      const previousRuntimeInstanceId = activeRuntimeInstanceId;
      const reportConnected = reportedState !== 'connected'
        || previousRuntimeInstanceId !== runtimeInstanceId;
      if (retiredRuntimeIds.has(runtimeInstanceId)) {
        stale('ANTIKY_RUNTIME_STALE', 'Runtime instance is stale.');
      }
      if (activeRuntimeInstanceId === null) {
        if (publicationSequence !== 1) {
          stale('ANTIKY_PUBLICATION_STALE', 'A runtime must begin with publication sequence 1.');
        }
        activeRuntimeInstanceId = runtimeInstanceId;
      } else if (activeRuntimeInstanceId === runtimeInstanceId) {
        if (explicitlyDisconnected || publicationSequence <= activePublicationSequence) {
          stale('ANTIKY_PUBLICATION_STALE', 'Publication is stale.');
        }
      } else {
        if (publicationSequence !== 1) {
          stale(
            'ANTIKY_PUBLICATION_STALE',
            'A replacement runtime must begin with publication sequence 1.',
          );
        }
        retiredRuntimeIds.add(activeRuntimeInstanceId);
        if (retiredRuntimeIds.size > MAX_RETIRED_RUNTIME_IDS) {
          const oldest = retiredRuntimeIds.values().next().value;
          if (oldest) retiredRuntimeIds.delete(oldest);
        }
        activeRuntimeInstanceId = runtimeInstanceId;
        activePublicationSequence = 0;
      }

      activePublicationSequence = publicationSequence;
      lastContactMilliseconds = Date.now();
      explicitlyDisconnected = false;
      inspection = snapshot;
      const acceptedBuildRevision = options.acceptBuild(snapshot);
      observation = createObservationRefV1({
        developmentSessionId: options.developmentSessionId,
        acceptedBuildRevision,
        publicationSequence,
        publishedAt: now(),
        connectionState: 'connected',
        inspection: snapshot,
      });
      if (reportConnected) {
        reportRuntime('info', 'ANTIKY_RUNTIME_CONNECTED', runtimeInstanceId);
      }
      reportedState = 'connected';
      return acceptedBuildRevision;
    },
    disconnect(runtimeInstanceId: string, publicationSequence: number): void {
      if (
        runtimeInstanceId !== activeRuntimeInstanceId
        || explicitlyDisconnected
        || publicationSequence <= activePublicationSequence
      ) stale('ANTIKY_PUBLICATION_STALE', 'Disconnect is stale.');
      activePublicationSequence = publicationSequence;
      lastContactMilliseconds = Date.now();
      explicitlyDisconnected = true;
      reportedState = 'unavailable';
      reportRuntime('info', 'ANTIKY_RUNTIME_DISCONNECTED', runtimeInstanceId);
    },
    touch(runtimeInstanceId: string): void {
      if (runtimeInstanceId !== activeRuntimeInstanceId || explicitlyDisconnected) {
        stale('ANTIKY_RUNTIME_STALE', 'Runtime instance is stale.');
      }
      const wasUnavailable = state() === 'unavailable';
      lastContactMilliseconds = Date.now();
      if (wasUnavailable) {
        reportedState = 'connected';
        reportRuntime('info', 'ANTIKY_RUNTIME_CONNECTED', runtimeInstanceId);
      }
    },
  });
}
