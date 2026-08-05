# Slice 03 Owner Input

## Status

`WAITING FOR OWNER`

## Purpose

Slice 03 moves the hero and NPC simulation under `EngineSession`. It also decides whether the
existing character motor becomes a supported Framework API and how developers inspect actors.

The Slice 03 goal reads this file before it changes code. A `PENDING` answer stops the goal.

## How to answer

Replace each `PENDING` value with `APPROVE` or your preferred direction. Add a short note when you
change the recommendation. Change the status to `ANSWERED` after all answers are complete.

## Inherited direction

- Slice 02 is complete. ADR 0016 owns the game-host boundary.
- `EngineSession` owns fixed time, step assignment, and system order.
- ADR 0017 makes an unexpected game-code or physics-query failure a terminal session fault. The
  last completed actor snapshot remains available for inspection and disposal.
- Semantic movement input and movement results are temporary. They do not enter durable history.
- Keep `town-study` runnable as the reference.
- Humans and agents use the same development service through `antiky tool` and MCP Tools.
- Keep authoritative collision on the CPU so the same code can run in a browser, headless test, or
  future server. Keep suitable shading, visual animation, and interpolation on the GPU with no
  readback.

## Question 1: Should we accept a narrow authoritative-physics ADR now?

### Context

[`UNDER_REVIEW_A.md` candidate 1](../../../adr/UNDER_REVIEW_A.md#1-authoritative-physics) is needed
before Framework owns character collision behavior. Antiky also needs headless and future server
simulation. GPU readback cannot be part of that authority path.

### Recommendation

Accept a narrow ADR before implementation. Keep character movement and collision authoritative on
the CPU. Let the motor query a small `CharacterPhysicsWorld` interface. Keep Town's collider and
walk-surface adapter private. Keep contacts and runtime handles temporary.

This does not add a CPU-to-GPU round trip. The renderer receives a derived actor snapshot, and the
GPU does not return it to the CPU. BroMetal can continue to do shading, visual animation, and useful
interpolation on the GPU. A GPU-authoritative motor would require readback for browser inspection
and a different implementation for headless or server use, so it is not suitable for this slice.

Do not add a public general physics service or a Rapier dependency. Reconsider Rapier after a
second physics consumer or measurements prove that the current motor is not enough.

### Owner answer

`PENDING`

## Question 2: Should the tested character motor become a Framework API?

### Context

The current 1,286-line file has mature collision behavior and 13 focused regression tests. It also
combines two responsibilities: world-query adapters and the movement motor. It owns a second
fixed-step accumulator and exposes mutable `state` and `debug`. Slice 02 already makes the session
the only clock owner. The file is also above the 800-line decomposition threshold in
`GOOD_ENGINEERING_H.md`.

### Recommendation

Move the generic motor, its value types, and its tests to
`packages/framework/src/character/kinematic-character-motor/`. Split contracts, configuration,
and runtime code by responsibility. Export a small `KinematicCharacterMotor` API from
`@antiky/framework`. Its one step operation receives the session's fixed delta and returns an
immutable state and debug result.

Remove the motor accumulator, frame-delta input, catch-up limits, interpolation result, and mutable
public fields. Keep Town paths, actor rules, ground sampling, collider construction, and render
preparation outside Framework.

This accepts the reusable deep module without publishing a general body, world, or ECS API.

### Owner answer

`PENDING`

## Question 3: Which actor identities and inspection Tools should developers use?

### Context

The reference creates one hero and eight NPCs as array entries. They have no stable IDs. The roadmap
requires actor inspection without treating runtime indexes as persistent identity.

### Recommendation

Give the hero and each NPC a fixed UUIDv7 `EntityId` in Town-authored content. Add a bounded actor
read model to the shared inspection snapshot, then add `list_actors` and `get_actor` to the direct
client, HTTP read path, MCP, and `antiky tool`.

Return the stable entity ID, role, movement state, completed simulation step, state digest, and
bounded contacts or diagnostics. Sort lists by stable ID. This read model is not a general actor
behavior or storage API. Do not expose runtime indexes and do not add movement mutation Tools.

### Owner answer

`PENDING`

## Question 4: What behavior may change during the move?

### Context

Antiky Town already receives fixed session updates, but the nested motor still accumulates its own
time. The renderer also reads mutable motor state directly for actor sprites, camera follow, and
post-processing. `town-study` remains the variable-frame reference.

### Recommendation

Preserve the hero spawn, controls, movement limits, collision rules, NPC count, NPC paths, and
visible appearance. Move path progress, stride state, and motor state to the one session step. Make
the renderer consume only the last completed actor snapshot. Keep camera smoothing and visual
interpolation in presentation code or its BroMetal shader when that keeps the result simpler.

Allow only sub-frame smoothing differences that do not change completed-step positions, collision
outcomes, or the approved reference captures. Do not add a BroMetal compute or storage-buffer actor
pipeline in this slice; the current reported actor upload is only 1,152 bytes per frame, and Slice
05 owns the measured render-driver boundary.

### Owner answer

`PENDING`

## Work that does not need owner input

The implementation agent selects fixtures, allocates run resources, measures actor work and GPU
uploads, preserves stable IDs, and writes the general user documentation. It must add a new owner
question only if a finding changes visible behavior, public API, scope, or an accepted decision.
