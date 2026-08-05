# Slice 03: Put Character Simulation Under EngineSession

For a short review, answer the questions in [`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `NOT READY` |
| Owner | Antiky Framework maintainers |
| Outcome | The hero and eight NPCs advance through one fixed `EngineSession` and expose stable actor inspection |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Architecture decisions | Accepted ADRs below; [authoritative-physics candidate](../../../adr/UNDER_REVIEW_A.md#1-authoritative-physics) must become an accepted ADR |
| Depends on | [`../slice-02/plan.md`](../slice-02/plan.md) completed, including its host-lifecycle ADR |
| Alignment revision | `c82c2994efe77bbaff35639c58784fb2c8aec54d` |
| Review date | `2026-08-05` |
| Complete check | `node --experimental-strip-types --experimental-transform-types docs/objectives/antiky-town/slice-03/verification/verify.mjs` |
| Evidence | `docs/objectives/antiky-town/slice-03/outputs/{run-id}/receipt.json` |

The goal runner must read the complete owner-input file. It must stop on a `PENDING` answer. It
must also stop until Slice 02 is complete, the required physics ADR is accepted, and BroMetal is
current.

Goal command:

```text
/goal implement docs/objectives/antiky-town/slice-03/plan.md until complete
```

## Review summary

- Move the tested generic character motor and its tests into Framework.
- Remove the motor's second clock and run hero and NPC logic once for each session step.
- Give all nine actors stable entity IDs and shared read-only inspection Tools.
- Make the renderer consume prepared actor state without changing simulation.
- Do not add a general physics service, physics dependency, ECS, movement command log, or GPU authority.

## Outcome

Developers can run and inspect repeatable hero and NPC movement while `EngineSession` remains the
only owner of simulation time.

### Observable behavior

- Equal initial state, semantic inputs, and fixed steps produce the same actor state digest.
- The hero keeps the approved input and collision behavior, and all eight NPC paths stay repeatable.
- `list_actors` and `get_actor` report the same stable facts through direct, CLI, and MCP clients.
- Render rate and pause state do not change completed-step actor results.
- Invalid input or a failed physics query does not publish a partial completed-step snapshot.

### Non-goals

- General rigid bodies, forces, joints, broadphase services, Rapier, or GPU physics.
- Network prediction, rollback, durable movement frames, abilities, animation graphs, or navmesh work.
- A general actor model, public scheduler, ECS query API, or RenderDriver.
- Moving static Town content through assets. Slice 04 owns that work.

## Chosen shape

```text
browser semantic input or deterministic NPC intent
  -> EngineSession fixed step -> Town actor system
  -> Framework KinematicCharacterMotor -> private Town physics adapter
  -> completed CPU actor snapshot -> inspection and prepared render state
  -> current Town renderer -> BroMetal -> WebGPU
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `@antiky/framework` | Fixed-step motor, value contracts, validation, immutable movement results | Town geometry, actor policy, DOM, BroMetal, or a general physics world |
| Antiky Town | Stable actor definitions, NPC intent, system order entry, collision adapter, and render preparation | Session time or reusable motor math |
| Demo host | Semantic keyboard input and render pulses | Actor updates or fixed-step assignment |
| CLI and MCP | Read-only actor presentation over the shared development client | A second actor service or MCP Resources |
| BroMetal | Actor drawing, shader work, and GPU failure reporting | Collision, path progress, state digest, or authoritative position |

The session calls the actor system once per fixed step. The motor performs exactly one step per
call. Town prepares previous and current actor poses for interpolation after the last completed
step. Rendering can interpolate but cannot write actor state.

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [`../AGENTS.md`](../AGENTS.md)
- [`../SLICE_WORKFLOW_A.md`](../SLICE_WORKFLOW_A.md)
- [`../IMPLEMENTATION_PLAN_A.md`](../IMPLEMENTATION_PLAN_A.md)
- [`../SLICE_FEEDBACK_H.txt`](../SLICE_FEEDBACK_H.txt)
- [General development-harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [General inspection direction](../../general-stuff/INSPECTION_TOOLING_A.md)
- [General release and versioning direction](../../general-stuff/RELEASE_VERSIONING_A.md)
- [ADR 0002: Keep movement temporary](../../../adr/framework/0002-event-sourcing_H.md)
- [ADR 0003: Share services with humans and agents](../../../adr/framework/0003-agent-native_H.md)
- [ADR 0007: Use commands for external mutations](../../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [ADR 0008: Let EngineSession own worlds](../../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [ADR 0009: Keep state projections separate](../../../adr/framework/0009-separate-state-projections_H.md)
- [ADR 0011: Use stable IDs](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [ADR 0013: Give simulation all inputs explicitly](../../../adr/framework/0013-explicit-simulation-inputs_H.md)
- [ADR 0015: Support WebGPU only](../../../adr/framework/0015-webgpu-support-only_H.md)
- [ADR 0001: Use MCP Tools for local development](../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [`world-and-session-model_A.md`](../../../architecture/framework/world-and-session-model_A.md)
- [`authoritative-online-runtime_A.md`](../../../architecture/framework/authoritative-online-runtime_A.md)
- [`rendering-and-assets_A.md`](../../../architecture/framework/rendering-and-assets_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-05`.

| Source | Relevant approach | Antiky result |
| --- | --- | --- |
| [Phaser Arcade Physics](https://docs.phaser.io/phaser/concepts/physics/arcade) | A world owns fixed collision updates and a simple spatial index. | Keep one fixed owner and a private query adapter. Do not couple physics to a Scene. |
| [Godot `CharacterBody3D`](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html) | Script-driven kinematic motion handles slide, slope, snap, step, and moving platforms during physics ticks. | Preserve the tested deep motor and meaningful contacts without adopting a node hierarchy. |
| [Bevy 0.19 `FixedUpdate`](https://docs.rs/bevy/latest/bevy/prelude/struct.FixedUpdate.html) | Physics, AI, and rules run in a fixed schedule separate from render updates. | Run actor intent and motion in the Slice 02 system list. Do not add Bevy's general schedules or ECS. |
| [Unity 6 `CharacterController.Move`](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/CharacterController.Move.html) | The caller supplies desired motion; the controller constrains it and reports collision flags. Gravity remains explicit. | Keep input and gravity explicit and return an immutable movement result. |
| [Unreal Engine 5.8 movement components](https://dev.epicgames.com/documentation/en-us/unreal-engine/movement-components-in-unreal-engine) | Character Movement is deep and network-aware; experimental Mover separates input from simulation ticks and movement modes. | Keep a small motor/query seam. Defer modes, correction, prediction, and networking. |
| [Rapier JavaScript character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/) | A reusable controller corrects desired translation and supports slopes, steps, snap, platforms, and collision events. | Use it as boundary evidence, not a dependency. Revisit only with a second consumer or measured gap. |

BroMetal is pinned and installed at `0.15.0`; `npm ls brometal --all` confirms it. That version
matched the [published package](https://registry.npmjs.org/brometal/latest) on the review date. Its
[README](https://github.com/ericdrowell/brometal) keeps the runtime thin and its
[changelog](https://github.com/ericdrowell/brometal/blob/main/CHANGELOG.md) records typed runtime
errors. No upgrade is needed.

Keep collision, actor state, paths, and digests on the CPU for headless and future server use. Keep
sprite shading and visual animation on the GPU. BroMetal accepts whole typed actor buffers, so
prepare one bounded nine-actor batch per rendered frame. Add no readback. Slice 05 can move more
presentation work or compute behind a measured `RenderDriver`.

The complete [`UNDER_REVIEW_A.md`](../../../adr/UNDER_REVIEW_A.md) was reviewed. Candidate 1 needs
the narrow ADR in owner question 1. Candidate 13 is inherited from Slice 02. Candidates 2, 3, and
15 do not block this slice because it adds no runtime schema, ECS storage, or extension API.

## Current state and reference

- `brometal-town/physics/character-motor.ts` is a 1,286-line generic motor with wall, slide,
  corner, step, ledge, slope, penetration, moving-platform, and deterministic-input behavior.
- Its 13 focused tests pass, but `advance(delta, input)` owns an accumulator and mutable state.
- The reference creates one hero and eight NPCs without stable IDs. It updates motor, path progress,
  stride, camera, and prepared sprite data from variable browser delta in the renderer callback.
- The current renderer reports its actor batch and per-frame bytes. It reads motor state directly.
- Framework has no character module or actor inspection. Slice 02 plans `EngineSession`; it is not
  implemented at this alignment revision.

| Capability | Decision | Source or required result |
| --- | --- | --- |
| Generic motor and regression tests | `MOVE` | `brometal-town/physics/character-motor.ts` and `.test.ts`; move without duplicate implementations. |
| Motor-owned accumulator | `REMOVE` | `advance()` conflicts with session clock authority; retain one fixed-step operation. |
| Town physics adapter and actor policy | `EXTEND` | Keep under `antiky-town/gameplay`; it consumes compiled or current Town collision data. |
| Stable actor IDs and inspection | `CREATE` | No current actor records or Tools exist. |
| Actor render preparation | `CREATE` | Renderer must consume immutable previous/current poses and interpolation alpha. |
| General physics, ECS, movement history | `DEFER` | No second consumer or requirement proves these contracts. |

## Deliverables

### Framework

- Add a `character/` module with the approved motor, narrow `CharacterPhysicsWorld`, immutable
  config/state/contact/result values, finite-input validation, and exactly-one-step execution.
- Preserve current collision behavior and move the focused tests beside the module. Do not leave a
  second motor under the reference demo.
- Keep Framework free of Town, DOM, React, Node.js, and BroMetal imports.

### Integration and tools

- Add fixed UUIDv7 entity IDs and deterministic authoring records for the hero and eight NPCs.
- Add one Town actor system. It derives NPC intent, steps each motor in stable entity-ID order, and
  publishes a completed immutable snapshot and digest after the whole step succeeds.
- Keep the Town collider and walk-surface adapter private. Keep camera smoothing and visual
  interpolation in render preparation. Make the renderer read prepared actor poses only.
- Add `list_actors` and `get_actor` to the existing development client, HTTP action bridge, MCP
  Tools, and `antiky tool`. Return bounded structured facts, not motor objects or runtime indexes.
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
  -> EngineSession assigns one completed-step ID
  -> Town actor system steps stable actor IDs through the Framework motor
  -> authoritative CPU actor state and last-completed immutable snapshot
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
| Physics query or actor-system failure | Stop further steps, keep the last completed inspection/render snapshot, and publish one diagnostic |
| BroMetal failure | Stop drawing safely and preserve inspectable CPU actor state |
| Reload, reconnect, disposal, or later request | Reload keeps actor IDs but creates new session/runtime IDs; reconnect reads live state; dispose once; reject later work |

Actor Tools remain local, read-only, production-excluded development operations behind the current
credential, origin, and payload limits. No input Tool is exposed, so this slice adds no remote
movement authority.

## CPU-to-GPU path

- Authoritative CPU state: nine fixed-step actor states and the last completed snapshot.
- Changed Antiky range: previous/current prepared poses for all nine actors.
- Actual BroMetal update unit: one whole bounded actor attribute batch per rendered frame.
- Normal GPU readback: zero.
- Stable resources: actor atlas, program, buffers, bind groups, and pass resources stay alive.
- Failure and disposal: preserve CPU facts; stop or release each GPU resource exactly once.
- Measurements: record actor steps, physics queries, contacts, CPU step time, upload writes, bytes,
  draw count, and resource creation/disposal against the reference.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Confirm dependencies and capture actor trajectories, captures, collision counts, and upload baseline | Reference tests and saved baseline facts | `Record Slice 03 baseline` |
| `CP-01` | Move and refactor the motor into Framework with no private clock | Moved regression tests and import-boundary tests | `Move character motor to Framework` |
| `CP-02` | Add stable actors, fixed Town system, snapshots, digest, and prepared render poses | Headless repeatability, parity, and render-read-only tests | `Run Town actors in EngineSession` |
| `CP-03` | Add actor inspection clients and general user documentation | Direct, HTTP, CLI, and MCP contract tests; manual docs review | `Add actor inspection tools` |
| `CP-04` | Run the temporary complete verifier and save the receipt and summary | One clean complete run | `Verify Slice 03 characters` |

Each checkpoint includes its tests and leaves the repository in a working state.

## Test plan

- Move all existing motor regressions and test validation, immutable returns, one-step execution,
  stable contact order, finite values, and the approved fixed delta.
- Test equal hero input, NPC paths, actor order, and step counts for equal states and digests.
- Test one update per session step, zero or many steps per render pulse, pause, single-step, and
  different render rates. Confirm rendering cannot mutate actor state.
- Test missing ground, walls, slopes, steps, ledges, penetration, moving support, adapter failure,
  duplicate IDs, unknown actors, disposal, and reconstruction.
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

- [ ] Owner input is `ANSWERED`, Slice 02 is complete, and the required physics ADR is accepted.
- [ ] Framework owns one fixed-step motor and the original regressions still pass.
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
