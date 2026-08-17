import {
  IdValidationError,
  parseSessionId,
  parseWorldId,
  type SessionId,
  type WorldId,
} from '../../identity/ids.ts';
import {
  ENGINE_SESSION_SCHEMA_VERSION,
  FIXED_STEP_SECONDS,
  MAX_ENGINE_SYSTEMS,
  MAX_FRAME_ELAPSED_SECONDS,
  MAX_STEPS_PER_FRAME,
  EngineSessionDisposalError,
  EngineSessionValidationError,
  type CompletedEngineStep,
  type EngineCommandContext,
  type EngineCommandExecution,
  type EngineCommandExecutionCode,
  type EngineCommandOutcome,
  type EngineControlResult,
  type EngineControlResultCode,
  type EngineFrameResult,
  type EngineFrameResultCode,
  type EnginePauseReason,
  type EngineSession,
  type EngineSessionFault,
  type EngineSessionFaultSource,
  type EngineSessionMode,
  type EngineSessionOptions,
  type EngineSessionOwnedService,
  type EngineStepContext,
  type EngineStepSource,
  type EngineSystem,
} from './contract.ts';
import {
  MAX_DIGEST_LENGTH,
  SYSTEM_ID_PATTERN,
  fail,
  isPauseReason,
  readRuntimeInstanceId,
  readSafeCount,
  sortedPauseReasons,
} from './validation.ts';

const MAX_INPUT_DEPTH = 32;
const MAX_INPUT_VALUES = 4_096;

function readSystems<Input>(value: unknown): readonly EngineSystem<Input>[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('Expected at least one engine system', '$.systems');
  }
  if (value.length > MAX_ENGINE_SYSTEMS) {
    fail(`Expected at most ${MAX_ENGINE_SYSTEMS} engine systems`, '$.systems');
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
    if (typeof record.run !== 'function') {
      fail('Expected a system function', `$.systems[${index}].run`);
    }
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
    if (typeof current === 'function') return false;
    if (current === null || typeof current !== 'object') return true;
    if (seen.has(current)) return false;
    if (!Object.isFrozen(current)) return false;
    seen.add(current);
    const expectedPrototype = Array.isArray(current) ? Array.prototype : Object.prototype;
    if (Object.getPrototypeOf(current) !== expectedPrototype) return false;
    for (const key of Reflect.ownKeys(current)) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor === undefined || !Object.hasOwn(descriptor, 'value')) return false;
      if (!visit(descriptor.value, depth + 1)) return false;
    }
    return true;
  };
  return visit(value, 0);
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
  if (options.onCompletedStep !== undefined && typeof options.onCompletedStep !== 'function') {
    fail('Expected a completed-step observer', '$.onCompletedStep');
  }
  const captureInput = options.captureInput;
  const getStateDigest = options.getStateDigest;
  const onCompletedStep = options.onCompletedStep;
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
  let fault: EngineSessionFault | null = null;
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

  const enterFault = (
    source: EngineSessionFaultSource,
    systemId: string | null = null,
  ): void => {
    if (fault !== null) return;
    fault = Object.freeze({ code: 'ENGINE_CALLBACK_FAILED', source, systemId });
    mode = 'faulted';
    pauseReasons.clear();
    if (controlRevision < Number.MAX_SAFE_INTEGER) controlRevision += 1;
  };

  type CaptureResult =
    | Readonly<{ kind: 'captured'; input: Readonly<Input> }>
    | Readonly<{ kind: 'rejected' }>
    | Readonly<{ kind: 'failed' }>;

  const capture = (input: Input): CaptureResult => {
    busy = true;
    try {
      const captured = captureInput(input);
      if (captured === null) return Object.freeze({ kind: 'rejected' });
      if (!isImmutableInput(captured)) return Object.freeze({ kind: 'failed' });
      return Object.freeze({ kind: 'captured', input: captured });
    } catch {
      return Object.freeze({ kind: 'failed' });
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

  type StepResult =
    | Readonly<{ kind: 'completed'; step: CompletedEngineStep<Input> }>
    | Readonly<{
      kind: 'failed';
      source: Extract<EngineSessionFaultSource, 'system' | 'state-digest'>;
      systemId: string | null;
    }>;

  type StepFailure = Extract<StepResult, { kind: 'failed' }> | Readonly<{
    kind: 'failed';
    source: 'completed-step-observer';
    systemId: null;
  }>;

  const runStep = (
    completedStepId: number,
    currentInputSequence: number,
    input: Readonly<Input>,
    source: EngineStepSource,
  ): StepResult => {
    const context: EngineStepContext<Input> = Object.freeze({
      completedStepId,
      inputSequence: currentInputSequence,
      fixedDeltaSeconds: FIXED_STEP_SECONDS,
      source,
      input,
    });
    for (const system of systems) {
      try {
        system.run(context);
      } catch {
        return Object.freeze({ kind: 'failed', source: 'system', systemId: system.id });
      }
    }
    let stateDigest: string | null;
    try {
      stateDigest = digest();
    } catch {
      return Object.freeze({ kind: 'failed', source: 'state-digest', systemId: null });
    }
    return Object.freeze({
      kind: 'completed',
      step: Object.freeze({ ...context, stateDigest }),
    });
  };

  const advance = (elapsedSeconds: number, input: Input): EngineFrameResult => {
    if (mode === 'disposed') return frameResult('SESSION_DISPOSED');
    if (mode === 'faulted') return frameResult('SESSION_FAULTED');
    if (mode === 'paused') return frameResult('SESSION_PAUSED');
    if (busy) return frameResult('SESSION_BUSY');
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      return frameResult('INVALID_ELAPSED_TIME');
    }
    if (inputSequence >= Number.MAX_SAFE_INTEGER) return frameResult('COUNTER_LIMIT');
    const captureResult = capture(input);
    if (captureResult.kind === 'rejected') return frameResult('INVALID_INPUT');
    if (captureResult.kind === 'failed') {
      enterFault('input-capture');
      return frameResult('SESSION_FAULTED');
    }

    const acceptedElapsedSeconds = Math.min(elapsedSeconds, MAX_FRAME_ELAPSED_SECONDS);
    const initialDiscardedSeconds = elapsedSeconds - acceptedElapsedSeconds;
    const availableSeconds = accumulatorSeconds + acceptedElapsedSeconds;
    const availableSteps = Math.floor((availableSeconds + Number.EPSILON) / FIXED_STEP_SECONDS);
    const plannedSteps = Math.min(availableSteps, MAX_STEPS_PER_FRAME);
    if (completedStepCount > Number.MAX_SAFE_INTEGER - plannedSteps) {
      return frameResult('COUNTER_LIMIT');
    }
    const excessSteps = Math.max(0, availableSteps - plannedSteps);
    const discardedElapsedSeconds = initialDiscardedSeconds + excessSteps * FIXED_STEP_SECONDS;
    const nextAccumulator = Math.max(
      0,
      availableSeconds - (plannedSteps + excessSteps) * FIXED_STEP_SECONDS,
    );
    const nextInputSequence = inputSequence + 1;
    const initialCompletedStepCount = completedStepCount;

    busy = true;
    let latestStep = lastCompletedStep;
    let successfulSteps = 0;
    let stepFailure: StepFailure | null = null;
    try {
      for (let index = 0; index < plannedSteps; index += 1) {
        const stepResult = runStep(
          initialCompletedStepCount + index + 1,
          nextInputSequence,
          captureResult.input,
          'frame',
        );
        if (stepResult.kind === 'failed') {
          stepFailure = stepResult;
          break;
        }
        latestStep = stepResult.step;
        successfulSteps += 1;
        if (onCompletedStep !== undefined) {
          inputSequence = nextInputSequence;
          completedStepCount = initialCompletedStepCount + successfulSteps;
          lastCompletedStep = latestStep;
          try {
            onCompletedStep(stepResult.step);
          } catch {
            stepFailure = Object.freeze({
              kind: 'failed',
              source: 'completed-step-observer',
              systemId: null,
            });
            break;
          }
        }
      }
    } finally {
      busy = false;
    }

    inputSequence = nextInputSequence;
    if (onCompletedStep === undefined) {
      completedStepCount += successfulSteps;
      lastCompletedStep = latestStep;
    }
    accumulatorSeconds = nextAccumulator < FIXED_STEP_SECONDS ? nextAccumulator : 0;
    totalAcceptedElapsedSeconds += acceptedElapsedSeconds;
    totalDiscardedSeconds += discardedElapsedSeconds;
    if (stepFailure !== null) {
      enterFault(stepFailure.source, stepFailure.systemId);
      return frameResult('SESSION_FAULTED', {
        completedSteps: successfulSteps,
        inputSequence,
        acceptedElapsedSeconds,
        discardedElapsedSeconds,
        accumulatorSeconds,
      });
    }
    return frameResult('ADVANCED', {
      completedSteps: successfulSteps,
      inputSequence,
      acceptedElapsedSeconds,
      discardedElapsedSeconds,
      accumulatorSeconds,
    });
  };

  const pause = (reason: EnginePauseReason): EngineControlResult => {
    if (mode === 'disposed') return controlResult('SESSION_DISPOSED');
    if (mode === 'faulted') return controlResult('SESSION_FAULTED');
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
    if (mode === 'faulted') return controlResult('SESSION_FAULTED');
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
    if (mode === 'faulted') return controlResult('SESSION_FAULTED');
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
    const captureResult = capture(input);
    if (captureResult.kind === 'rejected') return controlResult('INVALID_INPUT');
    if (captureResult.kind === 'failed') {
      enterFault('input-capture');
      return controlResult('SESSION_FAULTED');
    }

    const nextInputSequence = inputSequence + 1;
    busy = true;
    let stepResult: StepResult;
    let observerFailed = false;
    try {
      stepResult = runStep(
        completedStepCount + 1,
        nextInputSequence,
        captureResult.input,
        'single-step',
      );
      if (stepResult.kind === 'completed') {
        inputSequence = nextInputSequence;
        completedStepCount += 1;
        controlRevision += 1;
        lastCompletedStep = stepResult.step;
        try {
          onCompletedStep?.(stepResult.step);
        } catch {
          observerFailed = true;
        }
      }
    } finally {
      busy = false;
    }
    inputSequence = nextInputSequence;
    if (stepResult.kind === 'failed') {
      enterFault(stepResult.source, stepResult.systemId);
      return controlResult('SESSION_FAULTED');
    }
    if (observerFailed) {
      enterFault('completed-step-observer');
      return controlResult('SESSION_FAULTED');
    }
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
    if (mode === 'faulted') return unavailable('SESSION_FAULTED');
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
    let outcome: EngineCommandOutcome<Result> | null = null;
    let failed = false;
    try {
      outcome = operation(context);
      if (
        outcome === null
        || typeof outcome !== 'object'
        || !Object.hasOwn(outcome, 'result')
        || typeof outcome.authoringChanged !== 'boolean'
      ) {
        failed = true;
      }
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
    if (failed || outcome === null) {
      enterFault('command');
      return unavailable('SESSION_FAULTED');
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

  const readStatus = (): ReturnType<EngineSession<Input>['readStatus']> => {
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
      fault,
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
    if (failures.length > 0) throw new EngineSessionDisposalError(failures);
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
