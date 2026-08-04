import type { InspectionSnapshot } from '@antiky/framework';

import type { DevelopmentConnectionState } from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';

const DEFAULT_RUNTIME_TIMEOUT_MILLISECONDS = 3000;
const MAX_RETIRED_RUNTIME_IDS = 32;

type RuntimeConnectionOptions = Readonly<{
  timeoutMilliseconds?: number;
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
  let inspection: InspectionSnapshot | null = null;
  let activeRuntimeInstanceId: string | null = null;
  let activePublicationSequence = 0;
  let lastContactMilliseconds = 0;
  let explicitlyDisconnected = false;
  const retiredRuntimeIds = new Set<string>();

  const state = (): DevelopmentConnectionState => {
    if (inspection === null) return 'waiting';
    if (
      explicitlyDisconnected
      || Date.now() - lastContactMilliseconds > timeoutMilliseconds
    ) return 'unavailable';
    return 'connected';
  };

  return Object.freeze({
    read: () => Object.freeze({
      state: state(),
      runtimeInstanceId: activeRuntimeInstanceId,
      inspection,
    }),
    accept(snapshot: InspectionSnapshot, publicationSequence: number): number {
      const runtimeInstanceId = snapshot.runtime.instanceId;
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
    },
    touch(runtimeInstanceId: string): void {
      if (runtimeInstanceId !== activeRuntimeInstanceId || explicitlyDisconnected) {
        stale('ANTIKY_RUNTIME_STALE', 'Runtime instance is stale.');
      }
      lastContactMilliseconds = Date.now();
    },
  });
}
