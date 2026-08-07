import type { InspectionSnapshot } from '@antiky/framework';

import type { DevelopmentConnectionState } from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticCode,
  type CliDiagnosticLevel,
  type CliDiagnosticSink,
} from './diagnostics.ts';

const DEFAULT_RUNTIME_TIMEOUT_MILLISECONDS = 3000;
const MAX_RETIRED_RUNTIME_IDS = 32;

type RuntimeConnectionOptions = Readonly<{
  timeoutMilliseconds?: number;
  developmentSessionId?: string;
  diagnosticSink?: CliDiagnosticSink;
  acceptBuild(snapshot: InspectionSnapshot): number;
}>;

export type RuntimeConnectionSnapshot = Readonly<{
  state: DevelopmentConnectionState;
  runtimeInstanceId: string | null;
  inspection: InspectionSnapshot | null;
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
  const retiredRuntimeIds = new Set<string>();

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
    ...(options.developmentSessionId === undefined
      ? {}
      : { developmentSessionId: options.developmentSessionId }),
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
    read: () => Object.freeze({
      state: state(),
      runtimeInstanceId: activeRuntimeInstanceId,
      inspection,
    }),
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
      if (reportConnected) {
        reportRuntime('info', 'ANTIKY_RUNTIME_CONNECTED', runtimeInstanceId);
      }
      reportedState = 'connected';
      return options.acceptBuild(snapshot);
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
