---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:8832ca5e375d42b2
---

# Engine session API

Run deterministic fixed-step systems and expose safe pause, resume, single-step, command, and disposal controls.

Use one session as the authority for a running world when simulation timing must stay independent from display timing.

For the task-first workflow, read [Run a fixed-step game session](../framework/engine-sessions.md). Import every API on this page from `@antiky/framework`.

## Example

`sessionId` and `worldId` are stable IDs. `move` is game logic; the host supplies elapsed time and current input each frame.

```ts
import { createEngineSession } from '@antiky/framework';

const session = createEngineSession({
  sessionId,
  worldId,
  runtimeInstanceId: 'game-runtime-1',
  systems: [{ id: 'movement', run: ({ input }) => move(input) }],
  captureInput: (input) => Object.freeze({ ...input }),
});

session.advance(elapsedSeconds, currentInput);
```

## Session frame driver

Derive elapsed time from the host clock once, route a non-advanced frame to a fault channel instead of dropping it, and keep presenting either way.

### `SessionFrameFault`

A frame whose advance returned something other than ADVANCED.

```ts
type SessionFrameFault = Readonly<{
    code: EngineFrameResultCode;
    result: EngineFrameResult;
}>;
```

### `SessionFrameDriverOptions`

The host services a frame driver needs: advance, input, present, and where a fault goes.

```ts
type SessionFrameDriverOptions<TInput> = Readonly<{
    advance(elapsedSeconds: number, input: TInput): EngineFrameResult;
    input(): TInput;
    present(alpha: number): void;
    presentationAlpha?(result: EngineFrameResult): number;
    onFault?(fault: SessionFrameFault): void;
}>;
```

### `SessionFrameDriver`

Derives elapsed time from the host clock, advances the session, and presents the result.

```ts
type SessionFrameDriver = Readonly<{
    frame(platformTimeSeconds: number): EngineFrameResult;
    resetClock(): void;
    presentStep(result: EngineControlResult): EngineControlResult;
}>;
```

### `createSessionFrameDriver`

Create the per-frame loop that turns a presentation clock into session advances.

```ts
function createSessionFrameDriver<TInput>(options: SessionFrameDriverOptions<TInput>): SessionFrameDriver;
```

## Create a session

Create the stateful session once, then drive it through the returned `EngineSession` interface.

### `createEngineSession`

Creates the authoritative fixed-step session and validates its IDs, systems, input capture, and owned services.

```ts
function createEngineSession<Input>(options: EngineSessionOptions<Input>): EngineSession<Input>;
```

## Session contract

Use these records and result codes to integrate game systems, controls, commands, status, and owned services.

### `ENGINE_SESSION_SCHEMA_VERSION`

The schema version emitted in engine-session status records.

```ts
const ENGINE_SESSION_SCHEMA_VERSION = 2 as const;
```

### `FIXED_STEP_SECONDS`

The simulation duration accepted by every completed fixed step.

```ts
const FIXED_STEP_SECONDS = 1 / 60;
```

### `MAX_FRAME_ELAPSED_SECONDS`

The most wall-clock time one frame can add to the fixed-step accumulator.

```ts
const MAX_FRAME_ELAPSED_SECONDS = 0.05;
```

### `MAX_STEPS_PER_FRAME`

The maximum fixed steps a single `advance` call can complete.

```ts
const MAX_STEPS_PER_FRAME = 3;
```

### `MAX_ENGINE_SYSTEMS`

The maximum ordered systems in one engine session.

```ts
const MAX_ENGINE_SYSTEMS = 256;
```

### `EnginePauseReason`

The independent callers that can keep a session paused.

```ts
type EnginePauseReason = 'user' | 'tool' | 'visibility';
```

### `EngineSessionMode`

The current lifecycle mode of an engine session.

```ts
type EngineSessionMode = 'running' | 'paused' | 'faulted' | 'disposed';
```

### `EngineStepSource`

Whether a completed step came from a frame or an explicit single-step control.

```ts
type EngineStepSource = 'frame' | 'single-step';
```

### `EngineSessionFaultSource`

The callback boundary that caused a terminal session fault.

```ts
type EngineSessionFaultSource = 'input-capture' | 'system' | 'state-digest' | 'command';
```

### `EngineSessionFault`

A stable, non-sensitive summary of a failed engine callback.

```ts
type EngineSessionFault = Readonly<{
    code: 'ENGINE_CALLBACK_FAILED';
    source: EngineSessionFaultSource;
    systemId: string | null;
}>;
```

### `EngineStepContext`

The immutable input and clock data passed to each ordered system for one step.

```ts
type EngineStepContext<Input> = Readonly<{
    completedStepId: number;
    inputSequence: number;
    fixedDeltaSeconds: typeof FIXED_STEP_SECONDS;
    source: EngineStepSource;
    input: Readonly<Input>;
}>;
```

### `EngineSystem`

A stable system ID and its fixed-step callback.

```ts
type EngineSystem<Input> = Readonly<{
    id: string;
    run(step: EngineStepContext<Input>): void;
}>;
```

### `EngineSessionOwnedService`

A disposable service whose lifetime is owned by the session.

```ts
type EngineSessionOwnedService = Readonly<{
    dispose(): void;
}>;
```

### `EngineSessionOptions`

Construction options for IDs, ordered systems, immutable input capture, digesting, and owned services.

```ts
type EngineSessionOptions<Input> = Readonly<{
    sessionId: unknown;
    worldId: unknown;
    runtimeInstanceId: unknown;
    systems: readonly EngineSystem<Input>[];
    captureInput(input: Input): Readonly<Input> | null;
    getStateDigest?: () => string;
    services?: readonly EngineSessionOwnedService[];
    initialCompletedStepCount?: number;
}>;
```

### `CompletedEngineStep`

The last completed step, including captured input and an optional state digest.

```ts
type CompletedEngineStep<Input> = Readonly<{
    completedStepId: number;
    inputSequence: number;
    fixedDeltaSeconds: typeof FIXED_STEP_SECONDS;
    source: EngineStepSource;
    input: Readonly<Input>;
    stateDigest: string | null;
}>;
```

### `EngineSessionStatus`

Serializable inspection state for identity, mode, clocks, pause reasons, order, and revisions.

```ts
type EngineSessionStatus = Readonly<{
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
```

### `EngineFrameResultCode`

Stable outcomes from `EngineSession.advance`.

```ts
type EngineFrameResultCode = 'ADVANCED' | 'INVALID_ELAPSED_TIME' | 'INVALID_INPUT' | 'SESSION_PAUSED' | 'SESSION_FAULTED' | 'SESSION_DISPOSED' | 'SESSION_BUSY' | 'COUNTER_LIMIT';
```

### `EngineFrameResult`

Counts accepted, discarded, accumulated, and completed frame work.

```ts
type EngineFrameResult = Readonly<{
    code: EngineFrameResultCode;
    completedSteps: number;
    inputSequence: number;
    acceptedElapsedSeconds: number;
    discardedElapsedSeconds: number;
    accumulatorSeconds: number;
}>;
```

### `EngineControlResultCode`

Stable outcomes from pause, resume, and single-step controls.

```ts
type EngineControlResultCode = 'PAUSED' | 'RESUMED' | 'STEPPED' | 'NO_OP' | 'INVALID_PAUSE_REASON' | 'INVALID_EXPECTED_STEP' | 'INVALID_INPUT' | 'STALE_COMPLETED_STEP' | 'SESSION_RUNNING' | 'SESSION_FAULTED' | 'SESSION_DISPOSED' | 'SESSION_BUSY' | 'COUNTER_LIMIT';
```

### `EngineControlResult`

The session mode and control revision after a control request.

```ts
type EngineControlResult = Readonly<{
    code: EngineControlResultCode;
    mode: EngineSessionMode;
    completedStepCount: number;
    controlRevision: number;
    pauseReasons: readonly EnginePauseReason[];
    renderRequested: boolean;
}>;
```

### `EngineCommandContext`

The authoritative command sequence and world revision supplied to an operation.

```ts
type EngineCommandContext = Readonly<{
    commandSequence: number;
    currentWorldRevision: number;
}>;
```

### `EngineCommandOutcome`

An operation result plus whether authoritative world state changed.

```ts
type EngineCommandOutcome<Result> = Readonly<{
    result: Result;
    authoringChanged: boolean;
}>;
```

### `EngineCommandExecutionCode`

Stable outcomes from the session command boundary.

```ts
type EngineCommandExecutionCode = 'EXECUTED' | 'SESSION_FAULTED' | 'SESSION_DISPOSED' | 'SESSION_BUSY' | 'COUNTER_LIMIT';
```

### `EngineCommandExecution`

The ordered result and world revision returned by `executeCommand`.

```ts
type EngineCommandExecution<Result> = Readonly<{
    code: 'EXECUTED';
    commandSequence: number;
    worldRevision: number;
    result: Result;
}> | Readonly<{
    code: Exclude<EngineCommandExecutionCode, 'EXECUTED'>;
    commandSequence: number;
    worldRevision: number;
}>;
```

### `EngineSession`

The main session interface for frames, controls, commands, status, and cleanup.

```ts
interface EngineSession<Input> {
    readonly sessionId: SessionId;
    readonly worldId: WorldId;
    readonly runtimeInstanceId: string;
    advance(elapsedSeconds: number, input: Input): EngineFrameResult;
    pause(reason: EnginePauseReason): EngineControlResult;
    resume(reason: EnginePauseReason): EngineControlResult;
    step(expectedCompletedStepCount: number, input: Input): EngineControlResult;
    executeCommand<Result>(operation: (context: EngineCommandContext) => EngineCommandOutcome<Result>): EngineCommandExecution<Result>;
    readStatus(): EngineSessionStatus;
    readLastCompletedStep(): CompletedEngineStep<Input> | null;
    dispose(): void;
}
```

### `EngineSessionValidationError`

Thrown for invalid session construction data; `code` and `path` support stable recovery.

```ts
class EngineSessionValidationError extends Error {
    readonly code = 'ANTIKY_ENGINE_SESSION_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `EngineSessionDisposalError`

Thrown after cleanup when one or more owned services fail to dispose.

```ts
class EngineSessionDisposalError extends Error {
    readonly code = 'ANTIKY_ENGINE_SESSION_DISPOSAL_FAILED';
    readonly causes: readonly unknown[];
    constructor(causes: readonly unknown[]);
    get failureCount(): number;
}
```

## Protocol validation

Parse session values received from another process before trusting them as framework records.

### `parseEngineControlResult`

Validates an unknown cross-process control result.

```ts
function parseEngineControlResult(value: unknown, path = '$'): EngineControlResult;
```

### `parseEngineSessionStatus`

Validates an unknown cross-process session status.

```ts
function parseEngineSessionStatus(value: unknown, path = '$'): EngineSessionStatus;
```
