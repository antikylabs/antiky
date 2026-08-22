# 0008: Let EngineSession own worlds

## Status

Accepted

## Context

A world needs services that control:

- Start and stop operations
- Clocks
- Command order
- Assets
- State copies
- Diagnostics
- Optional rendering.

Development also needs primary, preview, test, and agent sandbox worlds at the same time. These
worlds must not duplicate shared services or share data that they can change.

## Decision

An `EngineSession` will control the runtime lifecycle and authority for its worlds. A session can own
one or more independent worlds.

The session will also own shared resources for its worlds:

- The command queue
- The clock
- Services
- State copies
- Diagnostics
- Assets
- An optional render driver.

Each world will own its simulation state. A world can divide its space into zones or regions for
loading and organization.

A large online game can use a `WorldHost` to coordinate many sessions. These sessions can represent
zones, shards, instances, or matches. One process or session does not need to contain the complete
game universe.

## Consequences

- Local, headless, preview, test, and sandbox runtimes use the same lifecycle rules.
- Each command and query must name its target session and world.
- Shared services need clear ownership and disposal rules.
- Each authoritative world changes state in one defined order. This rule also applies when requests
  arrive at the same time.
- Movement between sessions requires a defined handoff. Sessions will not change shared memory.

## Revision history

- `4c35b270f3da017454b12dd75e104b0c50355818`: Prior version before the plain-language rewrite.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
