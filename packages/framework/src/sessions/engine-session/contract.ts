import type { SessionId, WorldId } from '../../identity/ids.ts';

export const ENGINE_SESSION_SCHEMA_VERSION = 3 as const;
export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_ELAPSED_SECONDS = 0.05;
export const MAX_STEPS_PER_FRAME = 3;
export const MAX_ENGINE_SYSTEMS = 256;

export type EnginePauseReason = 'user' | 'tool' | 'visibility';
export type EngineSessionMode = 'running' | 'paused' | 'faulted' | 'disposed';
export type EngineStepSource = 'frame' | 'single-step';
export type EngineSessionFaultSource =
  | 'input-capture'
  | 'system'
  | 'state-digest'
  | 'completed-step-observer'
  | 'command';

export type EngineSessionFault = Readonly<{
  code: 'ENGINE_CALLBACK_FAILED';
  source: EngineSessionFaultSource;
  systemId: string | null;
}>;

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
  /**
   * Return semantic input as a deeply immutable graph of primitives, frozen plain objects, and
   * frozen arrays. The session validates and copies that graph before systems run. Functions and
   * accessor properties are rejected even when their container is frozen because they can retain
   * mutable closure state.
   */
  captureInput(input: Input): Readonly<Input> | null;
  getStateDigest?: () => string;
  /**
   * Observe each completed step once, after its systems and state digest succeed.
   *
   * The session calls this observer in completed-step order while its writer is busy. The observer
   * receives no session or world authority and must not mutate game state. A thrown error faults
   * the session as `completed-step-observer`, but the step remains completed and later steps in the
   * same frame do not run. The session does not retain observed steps.
   */
  onCompletedStep?: (step: CompletedEngineStep<Input>) => void;
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
  fault: EngineSessionFault | null;
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
  | 'SESSION_FAULTED'
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
  | 'SESSION_FAULTED'
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
  | 'SESSION_FAULTED'
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

  /**
   * Why each service failed to dispose, in the order they were released.
   *
   * This used to carry only a count. A session whose services failed to release reported *how many*
   * had failed and nothing about any of them, so the one piece of information needed to diagnose it
   * was collected and then discarded a line later.
   */
  readonly causes: readonly unknown[];

  constructor(causes: readonly unknown[]) {
    const count = causes.length;
    super(
      `EngineSession disposal failed for ${count} owned service${count === 1 ? '' : 's'}.`,
      { cause: causes[0] },
    );
    this.causes = Object.freeze([...causes]);
    this.name = 'EngineSessionDisposalError';
  }

  get failureCount(): number {
    return this.causes.length;
  }
}
