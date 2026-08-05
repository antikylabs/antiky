import {
  IdValidationError,
  parseSessionId,
  parseWorldId,
  type SessionId,
  type WorldId,
} from '../identity/ids.ts';

export const ENGINE_SESSION_SCHEMA_VERSION = 1 as const;
export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_ELAPSED_SECONDS = 0.05;
export const MAX_STEPS_PER_FRAME = 3;

export type EnginePauseReason = 'user' | 'tool' | 'visibility';
export type EngineSessionMode = 'running' | 'paused' | 'disposed';
export type EngineStepSource = 'frame' | 'single-step';

export type EngineStepContext<Input> = Readonly<{
  completedStepId: number;
  inputSequence: number;
  fixedDeltaSeconds: typeof FIXED_STEP_SECONDS;
  source: EngineStepSource;
  input: Readonly<Input>;
}>;

export type EngineSystem<Input> = Readonly<{
  id: string;
  run(step: EngineStepContext<Input>): void;
}>;

export type EngineSessionOwnedService = Readonly<{
  dispose(): void;
}>;

export type EngineSessionOptions<Input> = Readonly<{
  sessionId: unknown;
  worldId: unknown;
  runtimeInstanceId: unknown;
  systems: readonly EngineSystem<Input>[];
  captureInput(input: Input): Readonly<Input>;
  getStateDigest?: () => string;
  services?: readonly EngineSessionOwnedService[];
  initialCompletedStepCount?: number;
}>;

export type CompletedEngineStep<Input> = Readonly<{
  completedStepId: number;
  inputSequence: number;
  fixedDeltaSeconds: typeof FIXED_STEP_SECONDS;
  source: EngineStepSource;
  input: Readonly<Input>;
  stateDigest: string | null;
}>;

export type EngineSessionStatus = Readonly<{
  schemaVersion: typeof ENGINE_SESSION_SCHEMA_VERSION;
  sessionId: SessionId;
  worldId: WorldId;
  runtimeInstanceId: string;
  mode: EngineSessionMode;
  pauseReasons: readonly EnginePauseReason[];
  systemOrder: readonly string[];
  clock: Readonly<{
    fixedStepSeconds: typeof FIXED_STEP_SECONDS;
    maximumFrameElapsedSeconds: typeof MAX_FRAME_ELAPSED_SECONDS;
    maximumStepsPerFrame: typeof MAX_STEPS_PER_FRAME;
    accumulatorSeconds: number;
    completedStepCount: number;
    inputSequence: number;
    totalAcceptedElapsedSeconds: number;
    totalDiscardedSeconds: number;
  }>;
  revisions: Readonly<{
    commandSequence: number;
    controlRevision: number;
    worldRevision: number;
  }>;
  lastCompletedStep: Readonly<{
    completedStepId: number;
    inputSequence: number;
    stateDigest: string | null;
  }> | null;
}>;

export type EngineFrameResultCode =
  | 'ADVANCED'
  | 'INVALID_ELAPSED_TIME'
  | 'INVALID_INPUT'
  | 'SESSION_PAUSED'
  | 'SESSION_DISPOSED'
  | 'SESSION_BUSY'
  | 'COUNTER_LIMIT';

export type EngineFrameResult = Readonly<{
  code: EngineFrameResultCode;
  completedSteps: number;
  inputSequence: number;
  acceptedElapsedSeconds: number;
  discardedElapsedSeconds: number;
  accumulatorSeconds: number;
}>;

export type EngineControlResultCode =
  | 'PAUSED'
  | 'RESUMED'
  | 'STEPPED'
  | 'NO_OP'
  | 'INVALID_PAUSE_REASON'
  | 'INVALID_EXPECTED_STEP'
  | 'INVALID_INPUT'
  | 'STALE_COMPLETED_STEP'
  | 'SESSION_RUNNING'
  | 'SESSION_DISPOSED'
  | 'SESSION_BUSY'
  | 'COUNTER_LIMIT';

export type EngineControlResult = Readonly<{
  code: EngineControlResultCode;
  mode: EngineSessionMode;
  completedStepCount: number;
  controlRevision: number;
  pauseReasons: readonly EnginePauseReason[];
  renderRequested: boolean;
}>;

export type EngineCommandContext = Readonly<{
  commandSequence: number;
  currentWorldRevision: number;
}>;

export type EngineCommandOutcome<Result> = Readonly<{
  result: Result;
  authoringChanged: boolean;
}>;

export type EngineCommandExecutionCode =
  | 'EXECUTED'
  | 'SESSION_DISPOSED'
  | 'SESSION_BUSY'
  | 'COUNTER_LIMIT';

export type EngineCommandExecution<Result> =
  | Readonly<{
    code: 'EXECUTED';
    commandSequence: number;
    worldRevision: number;
    result: Result;
  }>
  | Readonly<{
    code: Exclude<EngineCommandExecutionCode, 'EXECUTED'>;
    commandSequence: number;
    worldRevision: number;
  }>;

export interface EngineSession<Input> {
  readonly sessionId: SessionId;
  readonly worldId: WorldId;
  readonly runtimeInstanceId: string;
  advance(elapsedSeconds: number, input: Input): EngineFrameResult;
  pause(reason: EnginePauseReason): EngineControlResult;
  resume(reason: EnginePauseReason): EngineControlResult;
  step(expectedCompletedStepCount: number, input: Input): EngineControlResult;
  executeCommand<Result>(
    operation: (context: EngineCommandContext) => EngineCommandOutcome<Result>,
  ): EngineCommandExecution<Result>;
  readStatus(): EngineSessionStatus;
  readLastCompletedStep(): CompletedEngineStep<Input> | null;
  dispose(): void;
}

export class EngineSessionValidationError extends Error {
  readonly code = 'ANTIKY_ENGINE_SESSION_INVALID';

  constructor(message: string, readonly path: string) {
    super(`${message} at ${path}`);
    this.name = 'EngineSessionValidationError';
  }
}

export class EngineSessionDisposalError extends Error {
  readonly code = 'ANTIKY_ENGINE_SESSION_DISPOSAL_FAILED';

  constructor(readonly failureCount: number) {
    super(`EngineSession disposal failed for ${failureCount} owned service${failureCount === 1 ? '' : 's'}.`);
    this.name = 'EngineSessionDisposalError';
  }
}

const PAUSE_REASONS = ['user', 'tool', 'visibility'] as const;
const SYSTEM_ID_PATTERN = /^[a-z][a-z0-9.-]{0,63}$/;
const RUNTIME_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_RUNTIME_ID_LENGTH = 128;
const MAX_DIGEST_LENGTH = 256;
const MAX_INPUT_DEPTH = 32;
const MAX_INPUT_VALUES = 4_096;

function fail(message: string, path: string): never {
  throw new EngineSessionValidationError(message, path);
}

function readRuntimeInstanceId(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_RUNTIME_ID_LENGTH
    || !RUNTIME_ID_PATTERN.test(value)
  ) {
    fail('Expected a valid runtime-instance ID', '$.runtimeInstanceId');
  }
  return value;
}

function readSafeCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('Expected a non-negative safe integer', path);
  }
  return value as number;
}

function readSystems<Input>(value: unknown): readonly EngineSystem<Input>[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('Expected at least one engine system', '$.systems');
  }
  const ids = new Set<string>();
  return Object.freeze(value.map((candidate, index) => {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      fail('Expected an engine system', `$.systems[${index}]`);
    }
    const record = candidate as Record<string, unknown>;
    if (typeof record.id !== 'string' || !SYSTEM_ID_PATTERN.test(record.id)) {
      fail('Expected a stable system ID', `$.systems[${index}].id`);
    }
    if (ids.has(record.id)) fail('System IDs must be unique', `$.systems[${index}].id`);
    if (typeof record.run !== 'function') fail('Expected a system function', `$.systems[${index}].run`);
    ids.add(record.id);
    return Object.freeze({
      id: record.id,
      run: record.run as EngineSystem<Input>['run'],
    });
  }));
}

function readServices(value: unknown): readonly EngineSessionOwnedService[] {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) fail('Expected an owned-service array', '$.services');
  const seen = new Set<unknown>();
  return Object.freeze(value.map((candidate, index) => {
    if (
      candidate === null
      || typeof candidate !== 'object'
      || typeof (candidate as { dispose?: unknown }).dispose !== 'function'
    ) {
      fail('Expected an owned disposable service', `$.services[${index}]`);
    }
    if (seen.has(candidate)) fail('Owned services must be unique', `$.services[${index}]`);
    seen.add(candidate);
    return candidate as EngineSessionOwnedService;
  }));
}

function isImmutableInput(value: unknown): boolean {
  const seen = new Set<object>();
  let valueCount = 0;
  const visit = (current: unknown, depth: number): boolean => {
    valueCount += 1;
    if (valueCount > MAX_INPUT_VALUES || depth > MAX_INPUT_DEPTH) return false;
    if (current === null || typeof current !== 'object') return true;
    if (seen.has(current)) return false;
    if (!Object.isFrozen(current)) return false;
    seen.add(current);
    if (Array.isArray(current)) return current.every((item) => visit(item, depth + 1));
    if (Object.getPrototypeOf(current) !== Object.prototype) return false;
    return Object.values(current).every((item) => visit(item, depth + 1));
  };
  return visit(value, 0);
}

function sortedPauseReasons(reasons: ReadonlySet<EnginePauseReason>): readonly EnginePauseReason[] {
  return Object.freeze(PAUSE_REASONS.filter((reason) => reasons.has(reason)));
}

function isPauseReason(value: unknown): value is EnginePauseReason {
  return typeof value === 'string' && PAUSE_REASONS.includes(value as EnginePauseReason);
}

export function createEngineSession<Input>(
  options: EngineSessionOptions<Input>,
): EngineSession<Input> {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    fail('Expected EngineSession options', '$');
  }

  let sessionId: SessionId;
  let worldId: WorldId;
  try {
    sessionId = parseSessionId(options.sessionId);
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, '$.sessionId');
    throw error;
  }
  try {
    worldId = parseWorldId(options.worldId);
  } catch (error) {
    if (error instanceof IdValidationError) fail(error.message, '$.worldId');
    throw error;
  }
  const runtimeInstanceId = readRuntimeInstanceId(options.runtimeInstanceId);
  const systems = readSystems<Input>(options.systems);
  if (typeof options.captureInput !== 'function') {
    fail('Expected an input-capture function', '$.captureInput');
  }
  if (options.getStateDigest !== undefined && typeof options.getStateDigest !== 'function') {
    fail('Expected a state-digest function', '$.getStateDigest');
  }
  const captureInput = options.captureInput;
  const getStateDigest = options.getStateDigest;
  const services = readServices(options.services);

  let mode: EngineSessionMode = 'running';
  const pauseReasons = new Set<EnginePauseReason>();
  let accumulatorSeconds = 0;
  let completedStepCount = readSafeCount(
    options.initialCompletedStepCount ?? 0,
    '$.initialCompletedStepCount',
  );
  let inputSequence = 0;
  let totalAcceptedElapsedSeconds = 0;
  let totalDiscardedSeconds = 0;
  let commandSequence = 0;
  let controlRevision = 0;
  let worldRevision = 0;
  let lastCompletedStep: CompletedEngineStep<Input> | null = null;
  let busy = false;

  const frameResult = (
    code: EngineFrameResultCode,
    values: Partial<Omit<EngineFrameResult, 'code'>> = {},
  ): EngineFrameResult => Object.freeze({
    code,
    completedSteps: values.completedSteps ?? 0,
    inputSequence: values.inputSequence ?? inputSequence,
    acceptedElapsedSeconds: values.acceptedElapsedSeconds ?? 0,
    discardedElapsedSeconds: values.discardedElapsedSeconds ?? 0,
    accumulatorSeconds: values.accumulatorSeconds ?? accumulatorSeconds,
  });

  const controlResult = (
    code: EngineControlResultCode,
    renderRequested = false,
  ): EngineControlResult => Object.freeze({
    code,
    mode,
    completedStepCount,
    controlRevision,
    pauseReasons: sortedPauseReasons(pauseReasons),
    renderRequested,
  });

  const capture = (input: Input): Readonly<Input> | null => {
    busy = true;
    try {
      const captured = captureInput(input);
      return isImmutableInput(captured) ? captured : null;
    } catch {
      return null;
    } finally {
      busy = false;
    }
  };

  const digest = (): string | null => {
    if (getStateDigest === undefined) return null;
    const value = getStateDigest();
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_DIGEST_LENGTH) {
      throw new EngineSessionValidationError(
        `State digest must contain 1 through ${MAX_DIGEST_LENGTH} characters`,
        '$.getStateDigest()',
      );
    }
    return value;
  };

  const runStep = (
    completedStepId: number,
    currentInputSequence: number,
    input: Readonly<Input>,
    source: EngineStepSource,
  ): CompletedEngineStep<Input> => {
    const context: EngineStepContext<Input> = Object.freeze({
      completedStepId,
      inputSequence: currentInputSequence,
      fixedDeltaSeconds: FIXED_STEP_SECONDS,
      source,
      input,
    });
    for (const system of systems) system.run(context);
    return Object.freeze({ ...context, stateDigest: digest() });
  };

  const advance = (elapsedSeconds: number, input: Input): EngineFrameResult => {
    if (mode === 'disposed') return frameResult('SESSION_DISPOSED');
    if (mode === 'paused') return frameResult('SESSION_PAUSED');
    if (busy) return frameResult('SESSION_BUSY');
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return frameResult('INVALID_ELAPSED_TIME');
    }
    if (inputSequence >= Number.MAX_SAFE_INTEGER) return frameResult('COUNTER_LIMIT');
    const captured = capture(input);
    if (captured === null) return frameResult('INVALID_INPUT');

    const acceptedElapsedSeconds = Math.min(elapsedSeconds, MAX_FRAME_ELAPSED_SECONDS);
    const initialDiscardedSeconds = elapsedSeconds - acceptedElapsedSeconds;
    const availableSeconds = accumulatorSeconds + acceptedElapsedSeconds;
    const availableSteps = Math.floor((availableSeconds + Number.EPSILON) / FIXED_STEP_SECONDS);
    const completedSteps = Math.min(availableSteps, MAX_STEPS_PER_FRAME);
    if (completedStepCount > Number.MAX_SAFE_INTEGER - completedSteps) {
      return frameResult('COUNTER_LIMIT');
    }
    const excessSteps = Math.max(0, availableSteps - completedSteps);
    const discardedElapsedSeconds = initialDiscardedSeconds + excessSteps * FIXED_STEP_SECONDS;
    const nextAccumulator = Math.max(
      0,
      availableSeconds - (completedSteps + excessSteps) * FIXED_STEP_SECONDS,
    );
    const nextInputSequence = inputSequence + 1;

    busy = true;
    let latestStep = lastCompletedStep;
    try {
      for (let index = 0; index < completedSteps; index += 1) {
        latestStep = runStep(
          completedStepCount + index + 1,
          nextInputSequence,
          captured,
          'frame',
        );
      }
    } finally {
      busy = false;
    }

    inputSequence = nextInputSequence;
    completedStepCount += completedSteps;
    accumulatorSeconds = nextAccumulator < FIXED_STEP_SECONDS ? nextAccumulator : 0;
    totalAcceptedElapsedSeconds += acceptedElapsedSeconds;
    totalDiscardedSeconds += discardedElapsedSeconds;
    lastCompletedStep = latestStep;
    return frameResult('ADVANCED', {
      completedSteps,
      inputSequence,
      acceptedElapsedSeconds,
      discardedElapsedSeconds,
      accumulatorSeconds,
    });
  };

  const pause = (reason: EnginePauseReason): EngineControlResult => {
    if (mode === 'disposed') return controlResult('SESSION_DISPOSED');
    if (busy) return controlResult('SESSION_BUSY');
    if (!isPauseReason(reason)) return controlResult('INVALID_PAUSE_REASON');
    if (pauseReasons.has(reason)) return controlResult('NO_OP');
    if (controlRevision >= Number.MAX_SAFE_INTEGER) return controlResult('COUNTER_LIMIT');
    pauseReasons.add(reason);
    mode = 'paused';
    controlRevision += 1;
    return controlResult('PAUSED');
  };

  const resume = (reason: EnginePauseReason): EngineControlResult => {
    if (mode === 'disposed') return controlResult('SESSION_DISPOSED');
    if (busy) return controlResult('SESSION_BUSY');
    if (!isPauseReason(reason)) return controlResult('INVALID_PAUSE_REASON');
    if (!pauseReasons.has(reason)) return controlResult('NO_OP');
    if (controlRevision >= Number.MAX_SAFE_INTEGER) return controlResult('COUNTER_LIMIT');
    pauseReasons.delete(reason);
    mode = pauseReasons.size === 0 ? 'running' : 'paused';
    controlRevision += 1;
    return controlResult('RESUMED');
  };

  const step = (expected: number, input: Input): EngineControlResult => {
    if (mode === 'disposed') return controlResult('SESSION_DISPOSED');
    if (busy) return controlResult('SESSION_BUSY');
    if (mode === 'running') return controlResult('SESSION_RUNNING');
    if (!Number.isSafeInteger(expected) || expected < 0) {
      return controlResult('INVALID_EXPECTED_STEP');
    }
    if (expected !== completedStepCount) return controlResult('STALE_COMPLETED_STEP');
    if (
      completedStepCount >= Number.MAX_SAFE_INTEGER
      || inputSequence >= Number.MAX_SAFE_INTEGER
      || controlRevision >= Number.MAX_SAFE_INTEGER
    ) {
      return controlResult('COUNTER_LIMIT');
    }
    const captured = capture(input);
    if (captured === null) return controlResult('INVALID_INPUT');

    const nextInputSequence = inputSequence + 1;
    busy = true;
    let completed: CompletedEngineStep<Input>;
    try {
      completed = runStep(
        completedStepCount + 1,
        nextInputSequence,
        captured,
        'single-step',
      );
    } finally {
      busy = false;
    }
    inputSequence = nextInputSequence;
    completedStepCount += 1;
    controlRevision += 1;
    lastCompletedStep = completed;
    return controlResult('STEPPED', true);
  };

  const executeCommand = <Result>(
    operation: (context: EngineCommandContext) => EngineCommandOutcome<Result>,
  ): EngineCommandExecution<Result> => {
    const unavailable = (code: Exclude<EngineCommandExecutionCode, 'EXECUTED'>) => Object.freeze({
      code,
      commandSequence,
      worldRevision,
    });
    if (mode === 'disposed') return unavailable('SESSION_DISPOSED');
    if (busy) return unavailable('SESSION_BUSY');
    if (
      commandSequence >= Number.MAX_SAFE_INTEGER
      || worldRevision >= Number.MAX_SAFE_INTEGER
    ) {
      return unavailable('COUNTER_LIMIT');
    }
    if (typeof operation !== 'function') fail('Expected a command operation', '$.operation');

    const nextCommandSequence = commandSequence + 1;
    const context: EngineCommandContext = Object.freeze({
      commandSequence: nextCommandSequence,
      currentWorldRevision: worldRevision,
    });
    busy = true;
    let outcome: EngineCommandOutcome<Result>;
    try {
      outcome = operation(context);
    } finally {
      busy = false;
    }
    if (
      outcome === null
      || typeof outcome !== 'object'
      || !Object.hasOwn(outcome, 'result')
      || typeof outcome.authoringChanged !== 'boolean'
    ) {
      fail('Expected a command outcome', '$.operation.result');
    }

    commandSequence = nextCommandSequence;
    if (outcome.authoringChanged) worldRevision += 1;
    return Object.freeze({
      code: 'EXECUTED',
      commandSequence,
      worldRevision,
      result: outcome.result,
    });
  };

  const readStatus = (): EngineSessionStatus => {
    const statusStep = lastCompletedStep === null ? null : Object.freeze({
      completedStepId: lastCompletedStep.completedStepId,
      inputSequence: lastCompletedStep.inputSequence,
      stateDigest: lastCompletedStep.stateDigest,
    });
    return Object.freeze({
      schemaVersion: ENGINE_SESSION_SCHEMA_VERSION,
      sessionId,
      worldId,
      runtimeInstanceId,
      mode,
      pauseReasons: sortedPauseReasons(pauseReasons),
      systemOrder: Object.freeze(systems.map((system) => system.id)),
      clock: Object.freeze({
        fixedStepSeconds: FIXED_STEP_SECONDS,
        maximumFrameElapsedSeconds: MAX_FRAME_ELAPSED_SECONDS,
        maximumStepsPerFrame: MAX_STEPS_PER_FRAME,
        accumulatorSeconds,
        completedStepCount,
        inputSequence,
        totalAcceptedElapsedSeconds,
        totalDiscardedSeconds,
      }),
      revisions: Object.freeze({ commandSequence, controlRevision, worldRevision }),
      lastCompletedStep: statusStep,
    });
  };

  const dispose = (): void => {
    if (mode === 'disposed') return;
    if (busy) throw new EngineSessionValidationError('Cannot dispose a busy session', '$.dispose');
    mode = 'disposed';
    pauseReasons.clear();
    if (controlRevision < Number.MAX_SAFE_INTEGER) controlRevision += 1;
    const failures: unknown[] = [];
    for (let index = services.length - 1; index >= 0; index -= 1) {
      try {
        services[index]!.dispose();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw new EngineSessionDisposalError(failures.length);
  };

  return Object.freeze({
    sessionId,
    worldId,
    runtimeInstanceId,
    advance,
    pause,
    resume,
    step,
    executeCommand,
    readStatus,
    readLastCompletedStep: () => lastCompletedStep,
    dispose,
  });
}
