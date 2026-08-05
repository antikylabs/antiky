import {
  EngineSessionValidationError,
  type EnginePauseReason,
  type EngineSessionMode,
} from './engine-session-contract.ts';

export const PAUSE_REASONS = ['user', 'tool', 'visibility'] as const;
export const SESSION_MODES = ['running', 'paused', 'faulted', 'disposed'] as const;
export const FAULT_SOURCES = ['input-capture', 'system', 'state-digest', 'command'] as const;
export const SYSTEM_ID_PATTERN = /^[a-z][a-z0-9.-]{0,63}$/;
export const MAX_RUNTIME_ID_LENGTH = 128;
export const MAX_DIGEST_LENGTH = 256;

const RUNTIME_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function fail(message: string, path: string): never {
  throw new EngineSessionValidationError(message, path);
}

export function readRuntimeInstanceId(
  value: unknown,
  path = '$.runtimeInstanceId',
): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_RUNTIME_ID_LENGTH
    || !RUNTIME_ID_PATTERN.test(value)
  ) {
    fail('Expected a valid runtime-instance ID', path);
  }
  return value;
}

export function readSafeCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value as number;
}

export function sortedPauseReasons(
  reasons: ReadonlySet<EnginePauseReason>,
): readonly EnginePauseReason[] {
  return Object.freeze(PAUSE_REASONS.filter((reason) => reasons.has(reason)));
}

export function isPauseReason(value: unknown): value is EnginePauseReason {
  return typeof value === 'string' && PAUSE_REASONS.includes(value as EnginePauseReason);
}

export function readPauseReasons(
  value: unknown,
  mode: EngineSessionMode,
  path: string,
): readonly EnginePauseReason[] {
  if (!Array.isArray(value)) fail('Expected an array', path);
  const pauseReasonSet = new Set<EnginePauseReason>();
  for (const [index, reason] of value.entries()) {
    if (!isPauseReason(reason)) {
      fail(`Expected one of: ${PAUSE_REASONS.join(', ')}`, `${path}[${index}]`);
    }
    if (pauseReasonSet.has(reason)) fail('Pause reasons must be unique', `${path}[${index}]`);
    pauseReasonSet.add(reason);
  }
  if (mode === 'paused' && pauseReasonSet.size === 0) {
    fail('A paused session needs a pause reason', path);
  }
  if (mode !== 'paused' && pauseReasonSet.size > 0) {
    fail('Only a paused session can have pause reasons', path);
  }
  return sortedPauseReasons(pauseReasonSet);
}
