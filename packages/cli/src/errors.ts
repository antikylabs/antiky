export type AntikyCliErrorCode =
  | 'ANTIKY_ARGUMENT_INVALID'
  | 'ANTIKY_CONFIG_INVALID'
  | 'ANTIKY_CONFIG_NOT_FOUND'
  | 'ANTIKY_PORT_BUSY'
  | 'ANTIKY_CHILD_START_FAILED'
  | 'ANTIKY_SESSION_UNAVAILABLE'
  | 'ANTIKY_UNAUTHORIZED';

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
