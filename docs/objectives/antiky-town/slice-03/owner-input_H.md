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
- ADR 0018 selects physics authority independently from CPU or GPU execution. The server owns
  online authority and starts with CPU physics. An online client GPU is nonauthoritative. If the
  local game client owns all necessary game authority, its local `EngineSession` can make GPU physics
  authoritative.

## Question 1: Should we accept a narrow authoritative-physics ADR now?

### Context

[ADR 0018](../../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
now defines physics authority and execution. It keeps online authority on the server, permits
temporary client GPU physics, and makes CPU the first server implementation.

### Recommendation

Keep ADR 0018 as the architecture decision. Do not select one execution device for all client
physics. Do not add a public general physics service or select a physics library in this decision.

### Owner answer

`APPROVE — Use ADR 0018 without creating a Framework-wide CPU physics rule.`

## Question 2: Should Slice 03 keep character simulation on the CPU?

### Context

The same simulation step can stay entirely on the GPU. GPU physics can feed subsequent GPU
gameplay and rendering work without readback.

The Antiky Town client owns all necessary game authority. Its local `EngineSession` can own
authoritative GPU physics state.

The current Town implementation has CPU consumers that use actor physics state:

- NPC intent reads the current motor position before each step.
- `EngineSession` reads a synchronous state digest after each completed step.
- Camera, sprite, standee-side, and depth-of-field preparation read actor state.
- The planned `list_actors` and `get_actor` Tools need bounded actor snapshots.

A complete GPU design can move collision queries, NPC intent, actor state, the state digest, and
render preparation into ordered GPU work. CPU inspection can then use an asynchronous bounded
snapshot. The current `EngineSession` has synchronous system and digest callbacks. It has no GPU
completion, GPU snapshot, or GPU fault contract.

Slice 03 has only nine actors and reports 1,152 bytes of actor uploads for each frame. No
measurement shows a CPU physics limit.

### Recommendation

Keep the Slice 03 character workload on the CPU. This is the smallest complete path through the
current `EngineSession`, headless tests, server-first physics, state digests, and inspection.

Treat `KinematicCharacterMotor` as an explicit CPU gameplay motor, not the universal Antiky physics
API. Do not create a partial GPU port or duplicate CPU and GPU character implementations.

Plan a GPU-resident physics slice when a real workload has many interacting objects or when a game
needs GPU-authoritative local simulation. That slice must move all same-step consumers to the GPU
and define asynchronous snapshots, step completion, inspection, digest, and fault behavior.

If Slice 03 must prove that GPU path now, expand and research the slice before implementation. Do
not keep the current CPU plan and add GPU math inside it.

### Owner answer

`REJECT` - We should use GPU path now... Thats our main goal and alignment with BroMetal. Lets explore and research 3 options for integraiton of nexus with our framework and with brometal.

## Question 3: Should the tested character motor become a Framework API?

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

## Question 4: Which actor identities and inspection Tools should developers use?

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

## Question 5: What behavior may change during the move?

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
