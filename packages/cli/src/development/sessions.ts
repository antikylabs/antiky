import { parseEngineSessionStatus } from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentSessionStatus,
  DevelopmentSessionStatusV2,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
} from './types.ts';

export function projectDevelopmentSessionStatus(
  snapshot: DevelopmentSnapshot | DevelopmentSnapshotV2,
): DevelopmentSessionStatus {
  if (!snapshot.inspection?.session) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime does not publish engine-session inspection.',
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId: snapshot.developmentSessionId,
    session: parseEngineSessionStatus(snapshot.inspection.session),
  });
}

export function projectDevelopmentSessionStatusV2(
  snapshot: DevelopmentSnapshotV2,
): DevelopmentSessionStatusV2 {
  if (!snapshot.observation) {
    throw new AntikyCliError(
      'ANTIKY_RUNTIME_UNAVAILABLE',
      'The runtime has not published an observation.',
    );
  }
  const legacy = projectDevelopmentSessionStatus(snapshot);
  return Object.freeze({
    schemaVersion: 2,
    observation: snapshot.observation,
    session: legacy.session,
  });
}
