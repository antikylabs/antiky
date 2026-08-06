# Slice 03: Put Character Simulation Under EngineSession

For a short review, answer the questions in [`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` |
| Owner | Antiky Framework maintainers |
| Outcome | The hero and eight NPCs advance through the shipped fixed `EngineSession` and expose stable actor inspection |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Architecture decisions | Accepted ADRs below, including [ADR 0018](../../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md) |
| Depends on | [`../slice-02/plan.md`](../slice-02/plan.md) complete, including ADRs 0016 and 0017 |
| Alignment revision | `dd5ddae179da2ce2c9eb27a45a34f1c28ecbb6ed` |
| Review date | `2026-08-05` |
| Complete check | `node --experimental-strip-types --experimental-transform-types docs/objectives/antiky-town/slice-03/verification/verify.mjs` |
| Evidence | `docs/objectives/antiky-town/slice-03/outputs/{run-id}/receipt.json` |

The goal runner must read the complete owner-input file. It must stop on a `PENDING` answer. Slice
02 and its hardening work are complete. ADR 0018 is accepted, and BroMetal is current.

Goal command:

```text
/goal implement docs/objectives/antiky-town/slice-03/plan.md until complete
```

## Review summary

- Split the 1,286-line character file by responsibility and move the reusable motor into Framework.
- Remove the motor's accumulator and give it the fixed delta from each session step.
- Give all nine actors stable entity IDs and shared read-only inspection Tools.
- Publish actor inspection and render poses only after all nine actor updates succeed.
- Make the renderer consume the last completed actor snapshot without changing simulation.
- Owner question 2 must select the CPU path or expand this plan for a complete GPU path.
- Do not add a partial GPU port, per-step GPU readback, or duplicate CPU and GPU motors.

## Outcome

Developers can run and inspect repeatable hero and NPC movement while `EngineSession` remains the
only owner of simulation time.

### Observable behavior

- Equal initial state, semantic inputs, and fixed steps produce the same actor state digest.
- The hero keeps the approved input and collision behavior, and all eight NPC paths stay repeatable.
- `list_actors` and `get_actor` report the same stable facts through direct, CLI, and MCP clients.
- Render rate and pause state do not change completed-step actor results.
- Invalid input does not start a step. A game-code or physics-query failure faults the session and
  retains the last completed actor snapshot.

### Non-goals

- General rigid bodies, forces, joints, broadphase services, Rapier, or a partial GPU physics path.
- Network prediction, rollback, durable movement frames, abilities, animation graphs, or navmesh work.
- A general actor model, public scheduler, ECS query API, or RenderDriver.
- Moving static Town content through assets. Slice 04 owns that work.

## Recommended shape pending owner question 2

```text
browser semantic input or deterministic NPC intent
  -> EngineSession step context: completed-step ID, 1/60 delta, and input
  -> private Town actor system in stable entity-ID order
  -> Framework KinematicCharacterMotor -> private Town physics adapter
  -> atomically published CPU actor snapshot and digest
  -> inspection and prepared render state
  -> current Town renderer -> BroMetal -> WebGPU
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `@antiky/framework` | One-step motor, value contracts, validation, and immutable movement results | A clock, Town geometry, actor policy, DOM, BroMetal, or a general physics world |
| Antiky Town | Stable actor definitions, NPC intent, system entry, collision adapter, completed snapshots, and render preparation | Session time or reusable motor math |
| Demo host | Semantic keyboard input and render pulses | Actor updates or fixed-step assignment |
| CLI and MCP | Read-only actor presentation over the shared development client | A second actor service or MCP Resources |
| BroMetal | Actor drawing, shader work, and GPU failure reporting | Collision, path progress, state digest, or authoritative position |

The session calls the actor system once per fixed step. The motor receives the session's fixed delta
and performs exactly one step per call. Town publishes previous and current actor poses only after
the complete actor system succeeds. Rendering can interpolate but cannot write actor state.

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [Objective agent guidance](../AGENTS.md); [`CLAUDE.md`](../CLAUDE.md) routes to it.
- [`../SLICE_WORKFLOW_A.md`](../SLICE_WORKFLOW_A.md)
- [`../IMPLEMENTATION_PLAN_A.md`](../IMPLEMENTATION_PLAN_A.md)
- [`../SLICE_FEEDBACK_H.txt`](../SLICE_FEEDBACK_H.txt)
- [General development-harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [General inspection direction](../../general-stuff/INSPECTION_TOOLING_A.md)
- [General release and versioning direction](../../general-stuff/RELEASE_VERSIONING_A.md)
- [ADR 0002: Keep movement temporary](../../../adr/framework/0002-event-sourcing_H.md)
- [ADR 0003: Share services with humans and agents](../../../adr/framework/0003-agent-native_H.md)
- [ADR 0006: Keep BroMetal inside the render driver](../../../adr/framework/0006-brometal-render-driver_H.md)
- [ADR 0007: Use commands for external mutations](../../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [ADR 0008: Let EngineSession own worlds](../../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [ADR 0009: Keep state projections separate](../../../adr/framework/0009-separate-state-projections_H.md)
- [ADR 0010: Serialize only at real boundaries](../../../adr/framework/0010-serialize-at-boundaries_H.md)
- [ADR 0011: Use stable IDs](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [ADR 0012: Let the server decide online game state](../../../adr/framework/0012-server-authoritative-simulation_H.md)
- [ADR 0013: Give simulation all inputs explicitly](../../../adr/framework/0013-explicit-simulation-inputs_H.md)
- [ADR 0015: Support WebGPU only](../../../adr/framework/0015-webgpu-support-only_H.md)
- [ADR 0016: Give platform work to the game host](../../../adr/framework/0016-give-platform-work-to-game-host_H.md)
- [ADR 0017: Stop a session after a game-code fault](../../../adr/framework/0017-stop-engine-session-after-game-code-fault_H.md)
- [ADR 0018: Select physics authority and execution independently](../../../adr/framework/0018-select-physics-authority-and-execution-independently_H.md)
- [ADR 0001: Use MCP Tools for local development](../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [`world-and-session-model_A.md`](../../../architecture/framework/world-and-session-model_A.md)
- [`authoritative-online-runtime_A.md`](../../../architecture/framework/authoritative-online-runtime_A.md)
- [`rendering-and-assets_A.md`](../../../architecture/framework/rendering-and-assets_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-05`.

| Source | Relevant approach | Antiky result |
| --- | --- | --- |
| [Phaser Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade) | Its world can use a render-independent fixed rate, manual updates, and one-step control. The world also owns bodies and its spatial index. | Keep one session clock and a private query adapter. Do not copy Phaser's Scene ownership. |
| [Godot stable `CharacterBody3D`](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html) | Script-driven kinematic motion exposes slide, slope, floor snap, bounded slide iterations, and moving-platform state. Its call mutates the body and velocity. | Preserve the useful deep behavior, but hide mutable state and return frozen step snapshots. Do not adopt a node hierarchy. |
| [Bevy 0.19 fixed time](https://docs.rs/bevy/latest/bevy/time/struct.Fixed.html) and [`FixedUpdate`](https://docs.rs/bevy/latest/bevy/prelude/struct.FixedUpdate.html) | The fixed schedule can run zero or more times per render update. Physics, AI, and rules share its fixed clock. Bevy currently defaults to 64 Hz. | Keep Antiky's already-approved 60 Hz session clock. Do not give the motor another accumulator or add Bevy's schedules and ECS. |
| [Unity 6.0 `CharacterController.Move`](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/CharacterController.Move.html) | The caller supplies an absolute motion delta. Collision constrains it and returns direction flags. The controller does not apply gravity. | Give the motor explicit input and step time. Return immutable state and contacts; keep game intent outside it. |
| [Unreal Engine 5.8 Mover](https://dev.epicgames.com/documentation/unreal-engine/mover-features-and-concepts-in-unreal-engine) | Experimental Mover separates composable inputs, simulation snapshots, movement modes, and interchangeable backends. | Use the input-to-snapshot separation now. Defer modes, layered moves, rollback, prediction, and backend selection. |
| [Rapier JavaScript 0.17 character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | One controller can compute corrected translation without owning a body. It handles slopes, steps, snap, platforms, and ordered collisions, but its guide says character control remains game-specific. | Keep the narrow motor/query seam and Town policy. Use Rapier as boundary evidence, not a dependency. |

BroMetal is pinned and installed at `0.15.0`; `npm ls brometal --all`, the npm registry, and the
current source package all report `0.15.0`. Its README describes an ahead-of-time TypeScript shader
compiler with a thin WebGPU runtime and no scene graph. Version 0.15.0 supports compute stages,
storage buffers, GPU-resident render targets, and typed asynchronous GPU errors. No upgrade is
needed.

ADR 0018 selects physics authority independently from its execution device. Same-step physics and
gameplay can stay entirely on the GPU. CPU code needs an asynchronous snapshot only when it reads
GPU state.

The current Slice 03 design has these CPU consumers:

- NPC intent reads the current actor position.
- `EngineSession` reads a state digest after each synchronous system step.
- Camera, sprite, standee-side, and depth-of-field preparation read actor state.
- The proposed actor Tools read bounded actor snapshots.

A complete GPU design can move collision queries, NPC intent, actor state, the state digest, and
render preparation into ordered GPU work. It must also add asynchronous snapshot, step-completion,
inspection, digest, and fault contracts. The current `EngineSession` does not have these contracts.

The recommended Slice 03 path keeps this nine-actor workload on the CPU. It has no measured CPU
limit, and its reported actor upload is only 1,152 bytes for each frame. This is a workload choice,
not a general Framework rule. Keep sprite shading, visual animation, and useful interpolation on
the GPU. Publish one bounded nine-actor snapshot for each presentation, keep GPU resources stable,
and perform no readback.

If owner question 2 selects GPU execution, update this plan before implementation. Do not add a
partial compute pipeline to the current CPU plan.

The complete [`UNDER_REVIEW_A.md`](../../../adr/UNDER_REVIEW_A.md) was reviewed. Candidate 1 became
ADR 0018 and owner question 1 is approved. Owner question 2 now selects the Slice 03 execution
device. The game-host decision that was candidate 13 is accepted as ADR 0016. Candidates 2, 3, 8,
and 15 do not block this slice because it adds no general runtime schema, ECS storage, event store,
or extension API.

## Current state and reference

- Slice 02 is complete. Framework `EngineSession` schema version 2 owns the 1/60 clock, immutable
  system order, pause controls, explicit step input, inspection, disposal, and terminal faults.
- Antiky Town already calls `TownRuntime.update()` once for each session step and renders at most
  once for each presentation callback. The nested motor still owns a second accumulator.
- `brometal-town/physics/character-motor.ts` is 1,286 lines. It combines physics queries and world
  adapters with motor policy and mutable runtime state. This exceeds the 800-line decomposition
  threshold in `GOOD_ENGINEERING_H.md`.
- Its 13 focused tests pass. The API exposes mutable `state` and `debug`, while
  `advance(delta, input)` owns frame limits, catch-up steps, and interpolation.
- The reference creates one hero and eight NPCs without stable IDs. The renderer reads motor state
  directly for actors, camera focus, and post-processing.
- Framework has no character module or actor inspection. The existing direct client, HTTP action
  bridge, MCP Tools, and `antiky tool` already share runtime inspection and session controls.
- BroMetal `0.15.0` is current, and `npm run check` passes at the alignment revision.

| Capability | Decision | Source or required result |
| --- | --- | --- |
| Generic motor and regression tests | `MOVE + DECOMPOSE` | Move the reusable motor into `framework/src/character/kinematic-character-motor/`; do not move one 1,286-line file or leave a duplicate. |
| Motor-owned accumulator and mutable public state | `REMOVE` | Remove `advance()`, frame limits, catch-up policy, and writable public values. Accept the session step delta and return frozen state and debug results. |
| Town physics queries and actor policy | `EXTEND` | Keep Town collider queries, walk-surface sampling, NPC paths, and actor policy private to the Town implementation. |
| Stable actor IDs and inspection | `CREATE` | No current actor records or Tools exist. |
| Actor publication and render preparation | `CREATE` | Publish one complete snapshot after all actors succeed. Renderer consumes immutable previous/current poses and presentation alpha. |
| EngineSession fault behavior | `REUSE` | ADR 0017 and schema version 2 already stop later work and retain inspection; add no second recovery policy. |
| General physics, ECS, movement history | `DEFER` | No second consumer or requirement proves these contracts. |

## Deliverables

### Framework

- Add `character/kinematic-character-motor/` with separate contract, configuration, and runtime
  files. Export the approved motor and narrow `CharacterPhysicsWorld`, not Town adapters.
- Accept the fixed delta as explicit step input. Return frozen config, state, contact, debug, and
  result values. Validate finite input before changing motor state.
- Preserve current collision behavior and move the motor-focused tests beside the module. Keep
  Town physics-query tests with the private Town adapter. Do not leave a second motor implementation.
- Keep Framework free of Town, DOM, React, Node.js, and BroMetal imports.

### Integration and tools

- Add fixed UUIDv7 entity IDs and deterministic authoring records for the hero and eight NPCs.
- Add one Town actor system. It derives NPC intent, steps each motor in stable entity-ID order, and
  publishes an immutable actor snapshot and digest only after the whole step succeeds.
- Keep the Town collider and walk-surface adapter private. Keep camera smoothing and visual
  interpolation in render preparation. Make the renderer read prepared actor poses only.
- Add a bounded actor read model to the existing Framework inspection snapshot. This is an
  inspection contract, not a general actor behavior or storage API.
- Add `list_actors` and `get_actor` to the existing development client, HTTP read path, MCP Tools,
  and `antiky tool`. Return structured facts, not motor objects or runtime indexes.
- Use the installed BroMetal baseline. Do not add an actor mutation Tool or MCP Resource.

### User-facing documentation

- Add `docs/user-facing-docs/framework/character-movement.md` as general concept and how-to
  guidance for the supported motor API.
- Update general inspection, CLI development, and MCP Tool references with actor queries.
- Do not write user documentation about Slice 03. Use Antiky Town only as a short example.
- Record Studio documentation as `N/A` unless its existing development connection changes.

## Data and authority path

```text
validated semantic input plus deterministic NPC intent
  -> EngineSession assigns one completed-step ID and fixed delta
  -> Town actor system steps stable actor IDs through the Framework motor
  -> complete step publishes authoritative CPU actor state and digest
  -> failure retains the prior published snapshot and faults the session
  -> shared inspection and prepared render poses
  -> current Town renderer -> BroMetal
```

Stable `EntityId` values identify actors across reloads. Session and runtime IDs change on rebuild.
Runtime indexes and collision handles stay private and temporary. Actor order is stable by entity ID.
Input is consumed by a fixed step and is not a command, event, or durable record. The completed CPU
actor state is authoritative; interpolation and GPU data are derived.

## Safe behavior

| Event | Required result |
| --- | --- |
| Non-finite, malformed, or oversized movement input | Stable rejection before the step and unchanged completed state |
| Duplicate actor ID or invalid motor configuration | Session construction fails with a stable diagnostic |
| Unknown actor in `get_actor` | Stable not-found result and no state change |
| Physics query or actor-system failure | Enter the existing terminal session fault, stop later work, and keep the last completed inspection/render snapshot |
| BroMetal failure | Stop drawing safely and preserve inspectable CPU actor state |
| Reload, reconnect, disposal, or later request | Reload keeps actor IDs but creates new session/runtime IDs; reconnect reads live state; dispose once; reject later work |

Actor Tools remain local, read-only, production-excluded development operations behind the current
credential, origin, and payload limits. No input Tool is exposed, so this slice adds no remote
movement authority.

## CPU-to-GPU path

- Authoritative CPU state: nine fixed-step actor states and the last completed snapshot.
- Changed Antiky range: one completed snapshot with previous/current poses for all nine actors.
- Actual BroMetal update unit: one whole bounded actor attribute batch for each presented frame.
- Normal GPU readback: zero.
- Stable resources: actor atlas, program, buffers, bind groups, and pass resources stay alive.
- Failure and disposal: preserve CPU facts; stop or release each GPU resource exactly once.
- Measurements: record actor steps, physics queries, contacts, CPU step time, upload writes, bytes,
  draw count, and resource creation/disposal against the reference.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Confirm dependencies and capture actor trajectories, captures, collision counts, and upload baseline | Reference tests and saved baseline facts | `Record Slice 03 baseline` |
| `CP-01` | Decompose and move the motor into Framework with no private clock | Moved regression tests, immutable-result tests, and import-boundary tests | `Move character motor to Framework` |
| `CP-02` | Add stable actors, fixed Town system, snapshots, digest, and prepared render poses | Headless repeatability, parity, and render-read-only tests | `Run Town actors in EngineSession` |
| `CP-03` | Add actor inspection clients and general user documentation | Direct, HTTP, CLI, and MCP contract tests; manual docs review | `Add actor inspection tools` |
| `CP-04` | Run the temporary complete verifier and save the receipt and summary | One clean complete run | `Verify Slice 03 characters` |

Each checkpoint includes its tests and leaves the repository in a working state.

## Test plan

- Preserve every existing motor regression. Test validation, immutable returns, one-step execution,
  stable contact order, finite values, and the explicit session fixed delta.
- Test equal hero input, NPC paths, actor order, and step counts for equal states and digests.
- Test one update per session step, zero or many steps per render pulse, pause, single-step, and
  different render rates. Confirm rendering cannot mutate actor state.
- Test missing ground, walls, slopes, steps, ledges, penetration, moving support, adapter failure,
  duplicate IDs, unknown actors, terminal fault snapshot retention, disposal, and reconstruction.
- Test direct, development-client, HTTP, MCP, and human `antiky tool` inspection parity. Confirm
  MCP discovery exposes Tools only and actor operations are read-only.
- Compare approved paths, collision outcomes, captures, actor work, uploads, draws, and zero readback
  with `town-study`.
- Check changed user-facing links, commands, and examples manually. Do not add tests that only test prose.
- Run affected package tests, `npm run check`, and the temporary complete check from one clean start.

For a reported error, add a failing regression test before the fix. Keep all temporary complete
verification under this slice's `verification/` folder. Do not add it to a package manifest or
shared script folder. Delete it after the final outputs pass.

## Completion checks

- [ ] Owner input is `ANSWERED`.
- [x] Slice 02 is complete, and ADR 0018 is accepted.
- [ ] Framework owns a motor that advances exactly one supplied step, and the original regressions still pass.
- [ ] The session is the only clock and all nine actors produce repeatable completed-step state.
- [ ] Stable actor IDs and direct, CLI, MCP, and Studio-compatible inspection agree.
- [ ] Renderer code reads prepared actor poses and does not update simulation.
- [ ] Invalid input, failures, reload, reconnect, security, and disposal preserve safe state.
- [ ] CPU, collision-query, upload, draw, visual-parity, and zero-readback checks pass.
- [ ] General user-facing documentation matches the shipped behavior.
- [ ] Package tests, `npm run check`, and the complete check pass.
- [ ] The evidence receipt validates and links all required proof.

## Run and evidence rule

Use the shared workflow for isolation, permissions, retries, rollback, and receipt content.

- Isolation: Use one worktree, browser runtime, output folder, and strict port set for the run.
- Retry: Retry one classified transient browser or GPU start. Do not retry deterministic failures.
- Rollback: Return to the latest passing checkpoint if a regression cannot be fixed forward.
- Special authority: Use the existing local development credential. Add no production authority.
- After completion: Framework and demo maintainers own motor and actor checks; feedback returns to
  `SLICE_FEEDBACK_H.txt`.

The temporary verifier writes and validates `receipt.json`, `confirmation-checks.md`, `facts.json`,
and `measurements.json` in one new `outputs/{run-id}/` folder. Record actual revisions, ports, IDs,
steps, inputs, digests, diagnostics, commands, measurements, captures, and changed user-facing pages.

Update `../slice-list.md` from the run facts. Write `slice-summary.md` with the simple owner handoff:
what changed in Framework, CLI, Studio, the demo, and BroMetal; how to test it; and any ADR made.
