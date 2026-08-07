# 0017: Stop an engine session after a game-code fault

## Status

Accepted

## Context

A game-code failure can occur after one of these callbacks or operations changes world state:

- An engine-system callback
- An input-capture function
- A state-digest function
- A command operation.

The engine session cannot know which state changes are completed.

If the engine session continues, the same operation can change the world state again.

Inspection and disposal must stay available after this failure.

These architecture decisions are also applicable:

- [Let EngineSession own worlds](0008-engine-session-owns-worlds_H.md)
- [Serialize data only when it crosses a real boundary](0010-serialize-at-boundaries_H.md)
- [Give the simulation all inputs explicitly](0013-explicit-simulation-inputs_H.md).

## Decision

A terminal fault is a session condition that stops all subsequent simulation operations and command
operations.

We will put an engine session in `faulted` mode after a game-code failure.

After a terminal fault, `EngineSession` will reject all simulation operations and command operations.

After the failure, `EngineSession` will not run the operation again.

`EngineSession` will keep inspection and disposal available.

Inspection will identify the fault source. It will not include callback error details, game input, or
command data.

Expected invalid input will not cause a terminal fault.

All other input-capture failures will cause a terminal fault.

After a terminal fault, the game host must start a new engine session to continue simulation.

## Consequences

- The engine session cannot continue when it does not know which state changes are completed.
- A developer can read the fault data and dispose of the engine session.
- The game host must start a new engine session after a terminal fault.
- Game code can reject expected invalid input without a terminal fault.
- The [public `EngineSession` contract](../../user-facing-docs/framework/engine-sessions.md) contains
  the result codes and fault data.
- If this recovery policy changes, Antiky must add a new ADR.

## Revision history

- `28662fe98ad0d547c5a9c43fc133a63e95b6e3aa` — Prior version before this change.
