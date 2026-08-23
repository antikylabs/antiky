import {
  createEventHistory,
  createWorldInspection,
} from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentEventHistory,
  DevelopmentEventHistoryV2,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
  DevelopmentWorldInspection,
  DevelopmentWorldInspectionV2,
} from './types.ts';

function requireObservation(snapshot: DevelopmentSnapshotV2) {
  if (!snapshot.observation) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime has not published an observation.',
    );
  }
  return snapshot.observation;
}

function readWorld(snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2) {
  if (!snapshot.inspection?.world) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish world inspection.',
    );
  }
  return createWorldInspection(snapshot.inspection.world);
}

function readEvents(snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2) {
  if (!snapshot.inspection?.events) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish event history.',
    );
  }
  return createEventHistory(snapshot.inspection.events);
}

export function projectDevelopmentWorldInspection(
  snapshot: DevelopmentSnapshot,
): DevelopmentWorldInspection {
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    world: readWorld(snapshot),
  });
}

export function projectDevelopmentEventHistory(
  snapshot: DevelopmentSnapshot,
): DevelopmentEventHistory {
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    events: readEvents(snapshot),
  });
}

export function projectDevelopmentWorldInspectionV2(
  snapshot: DevelopmentSnapshotV2,
): DevelopmentWorldInspectionV2 {
  return Object.freeze({
    schemaVersion: 2,
    observation: requireObservation(snapshot),
    world: readWorld(snapshot),
  });
}

export function projectDevelopmentEventHistoryV2(
  snapshot: DevelopmentSnapshotV2,
): DevelopmentEventHistoryV2 {
  return Object.freeze({
    schemaVersion: 2,
    observation: requireObservation(snapshot),
    events: readEvents(snapshot),
  });
}
