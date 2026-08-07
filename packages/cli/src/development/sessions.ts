import { parseEngineSessionStatus } from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import type {
  DevelopmentSessionStatus,
  DevelopmentSnapshot,
} from './types.ts';

export function projectDevelopmentSessionStatus(
  snapshot: DevelopmentSnapshot,
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
