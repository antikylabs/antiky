# 0017: Stop an engine session after a game-code fault

## Status

Accepted

## Context

An engine system, input-capture function, state-digest function, or command operation can fail after it changes world state.

An engine session cannot know how much state changed. If the engine session continues, the same operation can change the state again.

Inspection and disposal must stay available after this failure.

The decisions that follow apply:

- [Let EngineSession own worlds](0008-engine-session-owns-worlds_H.md)
- [Serialize data only when it crosses a real boundary](0010-serialize-at-boundaries_H.md)
- [Give the simulation all inputs explicitly](0013-explicit-simulation-inputs_H.md).

## Decision

We will put an engine session in `faulted` mode after a game-code failure.

A terminal fault is a failure that stops all subsequent simulation operations and command operations.

The engine session will not run a system, step, or command operation after a terminal fault.

The engine session will keep inspection and disposal available.

Inspection status will contain a safe fault code, a fault source, and an applicable system ID.

Inspection status will not contain an error message, stack, input, or command data.

An input-capture function must return `null` when it rejects expected invalid input.

For this result, the engine session will return `INVALID_INPUT` and will continue to operate.

All other input-capture failures will cause a terminal fault.

Engine-session status version 2 will include the fault data.

## Consequences

- An engine session cannot continue from partial state after a game-code failure.
- A developer can read the fault data and then dispose the engine session.
- The game host must create a new engine session to continue operation after a terminal fault.
- Each `captureInput` implementation must use `null` only for expected input rejection.
- Transport readers must read engine-session status version 2.
- An internal diagnostic record can contain more information than the safe fault data.
