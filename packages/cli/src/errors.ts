export type AntikyCliErrorCode =
  | 'ANTIKY_ARGUMENT_INVALID'
  | 'ANTIKY_CONFIG_INVALID'
  | 'ANTIKY_CONFIG_NOT_FOUND'
  | 'ANTIKY_PORT_BUSY'
  | 'ANTIKY_CHILD_START_FAILED'
  | 'ANTIKY_CHILD_STOP_FAILED'
  | 'ANTIKY_INTERNAL_ERROR'
  | 'ANTIKY_SESSION_UNAVAILABLE'
  | 'ANTIKY_UNAUTHORIZED'
  | 'ANTIKY_RUNTIME_UNAVAILABLE'
  | 'ANTIKY_ACTION_BUSY'
  | 'ANTIKY_ACTION_TIMEOUT'
  | 'ANTIKY_ACTION_STALE'
  | 'ANTIKY_CAPTURE_INVALID'
  | 'ANTIKY_CAPTURE_SAVE_FAILED'
  | 'ANTIKY_RUNTIME_STALE'
  | 'ANTIKY_PUBLICATION_STALE';

export class AntikyCliError extends Error {
  constructor(
    readonly code: AntikyCliErrorCode,
    message: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = 'AntikyCliError';
  }
}
