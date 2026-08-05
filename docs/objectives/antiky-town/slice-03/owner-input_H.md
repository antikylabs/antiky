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

- Slice 02 must be complete, including its accepted host-lifecycle ADR.
- `EngineSession` owns fixed time, step assignment, and system order.
- Semantic movement input and movement results are temporary. They do not enter durable history.
- Keep `town-study` runnable as the reference.
- Humans and agents use the same development service through `antiky tool` and MCP Tools.

## Question 1: Should we accept a narrow authoritative-physics ADR now?

### Context

[`UNDER_REVIEW_A.md` candidate 1](../../../adr/UNDER_REVIEW_A.md#1-authoritative-physics) is needed
before Framework owns character collision behavior. Antiky also needs headless and future server
simulation. GPU readback cannot be part of that authority path.

### Recommendation

Accept a narrow ADR before implementation. Keep character movement and collision authoritative on
the CPU. Let the motor query a small `CharacterPhysicsWorld` interface. Keep Town's collider and
walk-surface adapter private. Keep contacts and runtime handles temporary.

Do not add a public general physics service or a Rapier dependency. Reconsider Rapier after a
second physics consumer or measurements prove that the current motor is not enough.

### Owner answer

`PENDING`

## Question 2: Should the tested character motor become a Framework API?

### Context

The current 1,286-line motor has mature collision behavior and 13 focused regression tests. It is
inside `brometal-town`, owns a second fixed-step accumulator, and exposes mutable state. Slice 02
makes the session the only clock owner.

### Recommendation

Move the generic motor, its value types, and its tests to `@antiky/framework`. Export a small
`KinematicCharacterMotor` API with immutable snapshots and one fixed-step operation. Remove the
motor's accumulator, frame-delta input, and catch-up policy. Keep Town paths, actor rules, ground
sampling, collider construction, and render preparation out of Framework.

This accepts the reusable deep module without publishing a general body, world, or ECS API.

### Owner answer

`PENDING`

## Question 3: Which actor identities and inspection Tools should developers use?

### Context

The reference creates one hero and eight NPCs as array entries. They have no stable IDs. The roadmap
requires actor inspection without treating runtime indexes as persistent identity.

### Recommendation

Give the hero and each NPC a fixed UUIDv7 `EntityId` in Town-authored content. Add `list_actors` and
`get_actor` to the shared development client, MCP, and `antiky tool`. Return the stable entity ID,
role, movement state, completed simulation step, state digest, and bounded diagnostics. Sort lists
by stable ID. Do not expose runtime indexes and do not add movement mutation Tools.

### Owner answer

`PENDING`

## Question 4: What behavior may change during the move?

### Context

The reference advances path progress, stride, camera follow, and motor time from browser-frame
delta. Fixed simulation can change sub-frame interpolation even when completed-step state matches.

### Recommendation

Preserve the hero spawn, controls, movement limits, collision rules, NPC count, NPC paths, and
visible appearance. Move path progress and motor state to fixed steps. Keep camera smoothing and
visual interpolation in render preparation. Allow only sub-frame smoothing differences that do not
change completed-step positions, collision outcomes, or the approved reference captures.

### Owner answer

`PENDING`

## Work that does not need owner input

The implementation agent selects fixtures, allocates run resources, measures actor work and GPU
uploads, preserves stable IDs, and writes the general user documentation. It must add a new owner
question only if a finding changes visible behavior, public API, scope, or an accepted decision.
