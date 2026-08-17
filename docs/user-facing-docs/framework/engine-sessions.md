# Run a fixed-step game session

An `EngineSession` advances game rules at a steady rate even when display frames arrive early,
late, or not at all. Use one when movement, collisions, timers, and other game decisions need a
predictable clock that you can pause and step during development.

## Create a session

Give the session stable IDs, an ordered system list, and a function that copies input into an
immutable value:

```ts
import {
  createEngineSession,
  createSessionId,
  createWorldId,
} from '@antiky/framework';

const player = { x: 0, z: 0 };

const session = createEngineSession({
  sessionId: createSessionId(),
  worldId: createWorldId(),
  runtimeInstanceId: crypto.randomUUID(),
  systems: [
    {
      id: 'move-player',
      run(step) {
        player.x += step.input.movement.x * 4 * step.fixedDeltaSeconds;
        player.z += step.input.movement.z * 4 * step.fixedDeltaSeconds;
      },
    },
  ],
  captureInput(input: { movement: { x: number; z: number } }) {
    return Object.freeze({
      movement: Object.freeze({
        x: input.movement.x,
        z: input.movement.z,
      }),
    });
  },
  getStateDigest: () => `player:${player.x}:${player.z}`,
});
```

The system order is fixed when you create the session. Every fixed step runs each system once in
that order. The optional state digest gives tests and inspection tools a compact way to compare
the latest completed state; it is not a save file or event log.

## Drive it from your game host

Your browser, native window, server process, or test harness supplies elapsed time and semantic
game input. A browser host can translate `requestAnimationFrame` timestamps like this:

```ts
let previousTimeSeconds: number | null = null;

function present(platformTimeMilliseconds: number) {
  const currentTimeSeconds = platformTimeMilliseconds / 1000;
  const elapsedSeconds = previousTimeSeconds === null
    ? 0
    : Math.max(0, currentTimeSeconds - previousTimeSeconds);
  previousTimeSeconds = currentTimeSeconds;

  const result = session.advance(elapsedSeconds, {
    movement: readMovementControls(),
  });

  if (result.code === 'ADVANCED') renderGame(player);
  requestAnimationFrame(present);
}

requestAnimationFrame(present);
```

Call `renderGame` once after the session handles the display frame. One display frame can contain
zero, one, or several fixed updates, but it should still prepare and draw only once. Rendering and
GPU state do not decide the session's clock or game results.

The first frame accepts no elapsed time. Reset `previousTimeSeconds` to `null` whenever your host
stops and restarts its frame loop, so time spent paused does not become catch-up work.

## Understand the fixed clock

The current session clock has these fixed limits:

| Property | Value | Effect |
| --- | --- | --- |
| Fixed step | `1 / 60` second | Every system receives the same delta |
| Maximum accepted frame time | `0.05` second | A long platform frame cannot add unlimited work |
| Maximum steps per frame | `3` | One display frame cannot monopolize the CPU |

`advance` keeps a fractional remainder for the next frame. It reports accepted and discarded time
in its result, and `readStatus()` reports lifetime totals. Invalid elapsed time or input returns a
stable result code and leaves the clock and game state unchanged.

The session captures one semantic input value for each call to `advance`. If a display frame needs
several catch-up steps, those steps use the same captured input with different completed-step IDs.
Do not let a system read keys, pointers, sockets, or wall-clock time directly.

## Observe completed steps live

Use `onCompletedStep` when a test, capture adapter, or diagnostic needs the identity of every state
that the session completes:

```ts
const completedSteps = [];

const session = createEngineSession({
  // IDs, systems, and input capture omitted here.
  getStateDigest: () => readWorldDigest(),
  onCompletedStep(step) {
    completedSteps.push({
      completedStepId: step.completedStepId,
      inputSequence: step.inputSequence,
      source: step.source,
      stateDigest: step.stateDigest,
    });
  },
});
```

The session calls the observer once after the systems and state digest succeed for a step. Calls
follow completed-step order, including each step in a catch-up frame. A frame that completes no
steps does not call it. An explicit single-step call reports `source: 'single-step'`.

The completed-step record and its captured input are deeply immutable. The observer runs while the
session writer is busy, so it can copy the record or request read-only inspection but cannot
reenter simulation or command work. If the observer throws, that step remains completed, later
steps in the same frame do not run, and the session enters `faulted` mode with source
`completed-step-observer`.

This callback is live observation only. `EngineSession` does not retain an observed-step list,
publish a subscription, save checkpoints, create a replay, or promise durable delivery. A consumer
that needs history or durability must copy the records into storage that it owns. The callback does
not request rendering; the host still presents at most once for each display frame.

## Reject input or stop after a fault

Return `null` from `captureInput` when the caller supplies invalid input that the game can reject
normally:

```ts
captureInput(input: { movementX: number }) {
  if (!Number.isFinite(input.movementX)) return null;
  return Object.freeze({ movementX: input.movementX });
}
```

The frame or single-step operation then returns `INVALID_INPUT`. The session stays usable and does
not change its clock or game state.

Throwing from `captureInput` means that input capture itself failed. Returning a mutable or otherwise
unsafe snapshot is also a capture failure. These failures are different from rejecting expected
invalid input.

The session enters `faulted` mode when input capture, an engine system, the state digest, the
completed-step observer, or a command operation fails unexpectedly. The operation returns
`SESSION_FAULTED`, and all later frames, single-step controls, and commands return the same code
without running more game code. This fail-closed behavior prevents a partially changed world from
being changed again.

`readStatus()` remains available in faulted mode. Its `fault` field contains only a stable code, the
failure source, and the system ID when a system failed. It does not copy the thrown message, stack,
input, or command data across the inspection boundary. Engine-session status uses `schemaVersion: 3`
for this contract.

After you record the diagnostics you need, call `dispose()` and create a new session. A faulted
session cannot resume because the framework cannot know how much game state changed before the
failure.

## Pause, resume, and step

Pause reasons are independent. This prevents a visibility resume from overriding a pause that a
person or development tool still wants:

```ts
session.pause('user');
session.pause('visibility');

session.resume('visibility');
console.log(session.readStatus().mode); // "paused" because "user" remains
```

The supported reasons are `user`, `tool`, and `visibility`. Repeating the same pause or resume is
safe and returns `NO_OP`.

To advance exactly one tick, keep the session paused and pass the completed-step count you just
read:

```ts
const before = session.readStatus();
const result = session.step(before.clock.completedStepCount, {
  movement: readMovementControls(),
});

if (result.renderRequested) renderGame(player);
```

An accepted step returns `STEPPED`. If another caller already advanced the session, the same
request returns `STALE_COMPLETED_STEP` and changes nothing. A step while running returns
`SESSION_RUNNING`.

When `antiky dev` is connected, the CLI and MCP session tools expose the same operations. See the
[MCP tool reference](../mcp/tools.md#engine-session-tools).

## Inspect session state

`readStatus()` returns an immutable snapshot with:

- The session, world, and current game-process identities.
- Running, paused, faulted, or disposed mode and all active pause reasons.
- Bounded fault data when game code caused a terminal fault.
- Fixed-clock limits, completed steps, input sequence, accepted time, and discarded time.
- Immutable system order and command, control, and world revisions.
- The latest completed-step ID and optional state digest.

Include this status as `session` in your [runtime inspection](inspection.md) snapshot. The session
runtime ID must match the enclosing inspection runtime ID.

## Order authoring changes

Use `executeCommand` when an editor, tool, or other caller changes authoritative world state. The
session assigns command order and increments `worldRevision` only when the operation reports
`authoringChanged: true`. Rejected and same-value operations leave the world revision unchanged.

This command boundary does not require every game update to become a durable event. A game can
persist selected authoring facts, while a competitive server can attach its own richer journal,
checkpoints, or replay data to the same authoritative session.

## Dispose owned services

Pass session-owned services through `services` when their lifetime must exactly match the session:

```ts
const session = createEngineSession({
  // IDs, systems, and input capture omitted here.
  services: [audioService, authoringService],
});

session.dispose();
```

Each service needs a `dispose()` method. The session disposes services once in reverse order.
Later frames, controls, and commands return a disposed result. Call `dispose()` again only as a
safe no-op; do not reuse the old session after rebuilding a game runtime.

See [Runtime inspection](inspection.md) to publish session state to development tools and
[Run Antiky locally](../cli/development.md) to control it from the CLI.
