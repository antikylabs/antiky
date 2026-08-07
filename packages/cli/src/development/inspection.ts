import {
  createEventHistory,
  createWorldInspection,
} from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentEventHistory,
  DevelopmentSnapshot,
  DevelopmentWorldInspection,
} from './types.ts';

export function projectDevelopmentWorldInspection(
  snapshot: DevelopmentSnapshot,
): DevelopmentWorldInspection {
  if (!snapshot.inspection?.world) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish world inspection.',
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    world: createWorldInspection(snapshot.inspection.world),
  });
}

export function projectDevelopmentEventHistory(
  snapshot: DevelopmentSnapshot,
): DevelopmentEventHistory {
  if (!snapshot.inspection?.events) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish event history.',
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    events: createEventHistory(snapshot.inspection.events),
  });
}
