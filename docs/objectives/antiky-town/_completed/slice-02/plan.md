# Slice 02: Run Antiky Town Through a Fixed Engine Session

For a short review, answer the questions in [`owner-input_H.md`](owner-input_H.md).

## Control

| Field | Value |
| --- | --- |
| Status | `COMPLETE` |
| Owner | Antiky Framework maintainers |
| Outcome | One `EngineSession` advances Antiky Town in bounded fixed steps and supports pause, resume, and one-step control |
| Owner input | [`owner-input_H.md`](owner-input_H.md) |
| Architecture decisions | Accepted framework ADRs below, including [ADR 0016](../../../adr/framework/0016-give-platform-work-to-game-host_H.md) |
| Depends on | [`../slice-01/plan.md`](../slice-01/plan.md) completed |
| Alignment revision | `ae7099001fbcad25d77dbe3638df82e5798d7621` |
| Review date | `2026-08-04` |
| Complete check | `node --experimental-strip-types --experimental-transform-types docs/objectives/antiky-town/slice-02/verification/verify.mjs` |
| Evidence | [`outputs/s02-20260805T145240Z/receipt.json`](outputs/s02-20260805T145240Z/receipt.json) |

The goal runner must read the complete owner-input file. It must stop on a `PENDING` answer. It
must also stop until the required host-lifecycle ADR is accepted and BroMetal is current.

Goal command:

```text
/goal implement docs/objectives/antiky-town/slice-02/plan.md until complete
```

## Review summary

- Add a headless `EngineSession` with one fixed clock and one immutable system order.
- Run Town-owned update code through the session and render once for each browser frame.
- Give the UI, CLI, MCP, Studio-compatible client, and tests the same session controls.
- Add Framework-owned ID generation and let `antiky generate id <kind>` reuse it.
- Do not add an ECS, public scheduler, render graph, physics service, or scripting interface.

## Outcome

A developer can run, inspect, pause, resume, and single-step one Antiky Town session without
rebuilding its state or letting the browser render rate decide simulation time.

### Observable behavior

- `antiky dev` starts one Town session and reports its session, world, runtime, and clock facts.
- Equal starting state, inputs, system order, and completed steps produce the same tested digest.
- A long browser frame runs no more than the approved step limit and reports discarded time.
- Pause preserves state. Single-step advances one tick and renders one paused frame.
- Direct, human CLI, MCP, and Studio-compatible calls report the same control result.
- An invalid or stale control request returns a stable code and changes no session state.

### Non-goals

- Moving character types or collision ownership into Framework. Slice 03 does that work.
- A public system registry, dependency graph, phase scheduler, plugin API, or hot-loaded script.
- A general `RenderDriver`, GPU compute authority, or new render graph. Slice 05 owns that work.
- Durable session history, networking, rollback, time scaling, slow motion, or multiple worlds.

## Chosen shape

```text
human CLI, agent MCP, Studio-compatible client, or Town UI
  -> typed development client and browser host controller
  -> EngineSession control and ordered command boundary
  -> fixed clock -> immutable Town system list -> Town runtime state
  -> one render preparation call -> BroMetal -> WebGPU
  -> one immutable inspection snapshot for all clients
```

| Owner | Owns in this slice | Does not own |
| --- | --- | --- |
| `@antiky/framework` | Session identity, fixed clock, lifecycle, system order, command order, revisions, inspection, and disposal | DOM, React, browser events, BroMetal, or Town rules |
| Antiky Town | One private system adapter, semantic movement input, current Town state, and the update/render seam | General host APIs or framework clock rules |
| Demo host | Canvas, platform events, visibility, frame pulses, paused-frame rendering, and the development bridge | Simulation time or game decisions |
| CLI and MCP | Transport and presentation over the typed development client | A second session service or MCP Resources |
| BroMetal | Typed shader compilation, stable GPU resources, draw work, and WebGPU errors | Session time, world state, or command authority |

Use one ordered list of typed systems. Freeze it when the session starts. Do not add priorities,
dependencies, dynamic registration, or parallel execution. A later real consumer can prove those
features.

## Required reading

- [`owner-input_H.md`](owner-input_H.md)
- [Objective agent guidance](../AGENTS.md); [`CLAUDE.md`](../CLAUDE.md) routes to it.
- [`../SLICE_WORKFLOW_A.md`](../SLICE_WORKFLOW_A.md)
- [`../IMPLEMENTATION_PLAN_A.md`](../IMPLEMENTATION_PLAN_A.md)
- [`../SLICE_FEEDBACK_H.txt`](../SLICE_FEEDBACK_H.txt)
- [General development-harness research](../../general-stuff/DEV_HARNESS_RESEARCH_A.md)
- [General inspection direction](../../general-stuff/INSPECTION_TOOLING_A.md)
- [General release and versioning direction](../../general-stuff/RELEASE_VERSIONING_A.md)
- [ADR 0006: Keep BroMetal inside the render driver](../../../adr/framework/0006-brometal-render-driver_H.md)
- [ADR 0007: Use commands to change world state](../../../adr/framework/0007-commands-as-mutation-boundary_H.md)
- [ADR 0008: Let EngineSession own worlds](../../../adr/framework/0008-engine-session-owns-worlds_H.md)
- [ADR 0009: Keep state projections separate](../../../adr/framework/0009-separate-state-projections_H.md)
- [ADR 0010: Serialize at boundaries](../../../adr/framework/0010-serialize-at-boundaries_H.md)
- [ADR 0011: Use stable IDs](../../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md)
- [ADR 0013: Give simulation all inputs explicitly](../../../adr/framework/0013-explicit-simulation-inputs_H.md)
- [ADR 0001: Use MCP Tools for local development](../../../adr/cli/0001-use-mcp-tools-for-development_H.md)
- [`world-and-session-model_A.md`](../../../architecture/framework/world-and-session-model_A.md)
- [`commands-events-and-persistence_A.md`](../../../architecture/framework/commands-events-and-persistence_A.md)
- [`rendering-and-assets_A.md`](../../../architecture/framework/rendering-and-assets_A.md)
- [`GOOD_ENGINEERING_H.md`](../../../GOOD_ENGINEERING_H.md)

## Research and decision review

The research used current primary sources on `2026-08-04`.

| Source | Relevant approach | Antiky result |
| --- | --- | --- |
| [Phaser 4.1 Arcade Physics](https://docs.phaser.io/api-documentation/class/physics-arcade-world) | A fixed physics rate is independent from rendering. Pause, resume, and single-step are explicit. | Use explicit session controls and a separate render pulse. Do not copy Phaser's complete scene runtime. |
| [Godot stable interpolation](https://docs.godotengine.org/en/stable/tutorials/physics/interpolation/physics_interpolation_introduction.html) and [pause modes](https://docs.godotengine.org/en/stable/tutorials/scripting/pausing_games.html) | Game logic uses fixed ticks. Rendering interpolates. Pause policy distinguishes work that can continue. | Keep fixed systems separate from render work. Make visibility and explicit pause rules testable. |
| [Bevy 0.19 time](https://docs.rs/bevy/latest/bevy/time/struct.Time.html) | Real, virtual, and fixed clocks have different meanings. Tests can advance time manually. | Expose real-frame input and fixed simulation output separately. Do not add Bevy's general schedules. |
| [Unity 6 fixed updates](https://docs.unity3d.com/6000.0/Documentation/Manual/fixed-updates.html) | One frame can run zero or many fixed updates. A maximum time prevents endless catch-up. | Use an accumulator with an explicit elapsed-time and step cap. |
| [Unreal Engine 5.8 sub-stepping](https://dev.epicgames.com/documentation/en-us/unreal-engine/physics-sub-stepping-in-unreal-engine) | Maximum substep time and count trade accuracy for bounded CPU work. Ordered callbacks need care. | Bound work and publish dropped-time diagnostics. Do not add threads in this slice. |
| [PlayCanvas application timing](https://developer.playcanvas.com/user-manual/react/api/hooks/use-app/) | `maxDeltaTime` prevents tab-return spikes, but the main update stays frame-delta based. | Keep the useful long-frame cap. Use a fixed authoritative clock instead of variable game time. |
| [MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) and [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) | Browser pulses vary and pause in background tabs. An accumulator decouples them from simulation. | Treat the browser callback as an elapsed-time source only. Reset its baseline after resume. |

BroMetal is pinned and installed at `0.15.0`; `npm ls brometal --all` confirms it. That version
matched the [npm registry](https://registry.npmjs.org/brometal/latest) on the review date. The upgrade,
shader parity test, and full repository check pass at the alignment revision. Before a later pre-1.0 upgrade, review its [README](https://github.com/ericdrowell/brometal) and [changelog](https://github.com/ericdrowell/brometal/blob/main/CHANGELOG.md).

BroMetal compiles typed TypeScript shaders ahead of time. Its runtime owns programs, buffers,
textures, render targets, compute dispatch, draw work, and WebGPU failures. Version `0.15.0` adds typed errors and `createRenderer(canvas, { onError })`; publish asynchronous errors in diagnostics.

BroMetal `0.15.0` does not publish the generic shader `discard()` helper that Town needs. The guarded
post-install patch supplies it. Keep this BroMetal-bound feature narrow until a release supplies it.

Keep the fixed clock and authoritative systems on the CPU so they run headlessly with no GPU readback.
Keep foliage, water, cloth, lighting, and other per-vertex or per-fragment work on the GPU. Send time
and changed render data once per frame, and keep GPU resources stable. BroMetal compute and storage
buffers are later candidates behind the Slice 05 `RenderDriver`; GPU state stays nonauthoritative.

The shared release and versioning direction was reviewed; Slice 02 changes no release policy.

Accepted ADRs require one session writer, explicit fixed inputs, stable order, separate state copies,
and Tools instead of duplicate MCP Resources. The complete [`UNDER_REVIEW_A.md`](../../../adr/UNDER_REVIEW_A.md)
was reviewed. Candidate 13 needs a narrow accepted ADR because this slice moves timing and input
across the browser-host boundary. Candidates 1, 6, and 15 do not block this fixed-clock slice.

## Current state and reference

- Slice 01 is complete and its [receipt](../slice-01/outputs/s01-20260805T014602Z/receipt.json)
  proves the point-light, CLI, MCP, and focused-host paths.
- `LiveDemoStage` owns browser input, visibility, the BroMetal loop, and UI pause.
- `brometal-town` derives variable frame time, caps it at `0.05` seconds, and owns current actor,
  camera, and presentation updates. Its character motor already uses `1/60` fixed steps.
- Pausing currently stops and restarts the BroMetal loop. The loop elapsed time restarts too.
- Framework exports IDs, inspection, and point-light APIs from `framework/src/index.ts`. It has no `SessionId` or `EngineSession`.

| Capability | Decision | Source and proof under `packages/`, or required result |
| --- | --- | --- |
| Stable IDs | `EXTEND` | `framework/src/identity/ids.ts` and `ids.test.ts`; add `SessionId` and Framework-owned ID generation. |
| Point-light service | `EXTEND` | `framework/src/point-light/service.ts` and `service.test.ts`; add session order and disposal. |
| Inspection | `EXTEND` | `framework/src/inspection/snapshot.ts` and `snapshot.test.ts`; add session and clock facts. |
| Development client and action broker | `EXTEND` | `cli/src/development/client.ts`, `host/actions.ts`, `mcp/tools.ts`, and their CLI tests. |
| `EngineSession` and fixed clock | `CREATE` | No framework export or test exists; add headless code and direct tests. |
| Town host and update/render seam | `EXTEND` | `demos/src/react/LiveDemoStage.tsx`, `brometal-town/index.ts`, and current loop and motor tests. |
| General scheduler, ECS storage, and scripting | `DEFER` | No proved need in this slice. |
| General RenderDriver and GPU compute integration | `DEFER` | Slice 05 owns the boundary. |
| CLI ID generation | `CREATE` | `cli/src/cli.ts` has no generator; keep it as an adapter over Framework ID generation. |

## Deliverables

### Framework

- Add branded UUIDv7 `SessionId` creation and parsing beside the existing ID factories.
- Add one supported Framework ID-generation function for games. Let the specific factories and CLI
  reuse that implementation.
- Add a headless `EngineSession` with one world, one fixed clock, one immutable ordered system list,
  explicit per-step input, pause, resume, single-step, inspection, and exactly-once disposal.
- Let the session own a small list of typed disposable services. Do not add a service locator.
- Add one ordered command boundary. Route Slice 01 point-light changes through it.
- Increment the world revision once for an accepted authoring change. Keep entity revision and
  point-light event sequence meanings unchanged.
- Return immutable session snapshots. Keep DOM, React, Node.js, and BroMetal imports out of core.

### Integration and tools

- Split the Town-owned fixed update from its once-per-frame render call without moving Town state
  types into Framework. Keep `town-study` available as the reference.
- Register the private Town system list at session creation. Give each step the input snapshot and
  its completed-step ID. Render once after zero or more steps.
- Connect UI, visibility, direct client, HTTP action, MCP, and `antiky tool` controls to the same
  session operations. Add `get_session_status`, `pause_simulation`, `resume_simulation`, and
  `step_simulation`. Add no MCP Resources.
- Add `antiky generate id <world|entity|command|session>`. Use Framework factories so the CLI does
  not encode UUID structure itself.
- Use the installed BroMetal `0.15.0` baseline. Handle typed creation and asynchronous WebGPU
  errors through the current host and inspection diagnostics. Do not expand the local shader patch.

### User-facing documentation

- Add `docs/user-facing-docs/framework/engine-sessions.md` as a general concept and how-to page.
- Update CLI development guidance with session control and `antiky generate id` examples.
- Update the MCP Tool catalog with the four session tools and retry-safe step example.
- Record Studio documentation as `N/A` if its connection workflow does not change.

## Data and authority path

```text
browser elapsed time and semantic input snapshot
  -> host validation and pause policy
  -> EngineSession accumulator and fixed-step assignment
  -> ordered commands -> ordered systems -> authoritative runtime state
  -> immutable inspection and prepared render state
  -> Town render call -> BroMetal -> WebGPU
```

`SessionId`, `WorldId`, and `RuntimeInstanceId` have different meanings. A browser reconstruction
disposes the old session and gets new session and runtime IDs. System order is fixed at creation.
Completed-step count, command sequence, control revision, and world revision only increase. A
rejected or no-op request changes none of the revisions that describe changed state.

The host records one semantic input snapshot for each completed step. Catch-up steps can use the
same browser snapshot, but each receives its own step ID. Rendering and GPU state never decide a
command or clock result.

## Safe behavior

| Event | Required result |
| --- | --- |
| Negative, non-finite, or malformed elapsed time | Stable rejection, diagnostic, and unchanged clock and state |
| Elapsed time above the approved limit | Bounded steps, retained fractional remainder, and reported discarded time |
| Pause or resume repeated | Idempotent result and no rebuild |
| Step while running or with a stale expected count | Stable rejection and no state change |
| Visibility resume after an explicit pause | Stay paused |
| Point-light command rejected or no-op | Keep session world revision and all state copies unchanged |
| BroMetal creation, device-loss, or validation failure | Stop drawing safely, preserve inspectable CPU state, and publish the typed error |
| Browser reload, client reconnect, disposal, or later request | Reload creates new session and runtime IDs; reconnect reads the live session; dispose once; reject later work |

The local inspection credential and origin checks protect session controls. The feature is excluded
from production builds. Existing bounded HTTP and MCP payload limits remain. This slice does not
define general principals, roles, or remote permissions.

## Implementation checkpoints

| ID | Deliverable | Main proof | Commit message |
| --- | --- | --- | --- |
| `CP-00` | Confirm BroMetal `0.15.0` and capture timing, visual, and error baselines | Package, shader-parity, and reference checks | `Record Slice 02 baseline` |
| `CP-01` | Add `SessionId`, fixed clock, ordered systems, lifecycle, and deterministic headless tests | Framework unit and import-boundary tests | `Add fixed engine sessions` |
| `CP-02` | Add the Town update/render seam, semantic input assignment, point-light command order, and session inspection | Town, parity, pause, step, and disposal tests | `Run Town through EngineSession` |
| `CP-03` | Add typed client, HTTP, MCP, UI controls, ID generation, and general user docs | Direct, CLI, MCP tests and manual doc review | `Add session development controls` |
| `CP-04` | Run the temporary complete verifier and save the receipt, facts, checks, measurements, and summary | One clean complete run | `Verify Slice 02 session clock` |

Each checkpoint includes its tests and leaves the repository in a working state.

## Test plan

- Test exact fixed-step boundaries, zero-step frames, multi-step frames, fractional carry, limits,
  discarded time, invalid elapsed values, and large step counts without unsafe integer overflow.
- Test equal initial state, explicit inputs, step counts, and system order with equal state digests.
- Test stable system order, immutable lists, one writer, command ordering, revisions, no-op and
  rejection behavior, owned-service disposal, and requests after disposal.
- Test pause, repeated pause, resume, single-step, stale expected step, first frame, hidden tab,
  explicit-pause precedence, and no catch-up after resume.
- Test one input snapshot per fixed step, zero or many updates per browser frame, one render per
  visible frame, and one paused render after single-step.
- Test point-light results and all state projections before and after session routing.
- Test direct, development-client, HTTP, MCP, and human `antiky tool` parity. Confirm MCP discovery
  exposes Tools only.
- Test every ID kind, invalid kind, plain output, and machine-readable output for
  `antiky generate id`.
- Test BroMetal `0.15.0` shader output, typed startup failures, asynchronous error reporting,
  stable resources, zero normal GPU readback, and unchanged Town reference captures.
- Test framework import boundaries. Check affected user-facing links, commands, and examples manually.
- Run package tests, `npm run check`, and the temporary complete check from one clean start.

For a reported error, add a failing regression test before the fix. Keep all temporary complete
verification under this slice's `verification/` folder. Do not add it to a package manifest or
shared script folder. Delete it after the final outputs pass.

## Completion checks

- [x] Owner input is `ANSWERED` and the required host-lifecycle ADR is accepted.
- [x] Slice 01 remains complete and BroMetal is locked at the current published version.
- [x] Antiky Town uses one session clock and one immutable system order.
- [x] Equal inputs and steps produce the tested equal state digest.
- [x] Long frames stay within the approved step limit and report discarded time.
- [x] Pause, resume, visibility, and one-step behavior preserve session state.
- [x] Point-light commands use session order and keep existing results and projections.
- [x] Direct, CLI, Studio-compatible, MCP, and UI controls use one service implementation.
- [x] `antiky generate id` supports all four stable ID kinds.
- [x] BroMetal and GPU work remain behind the approved boundary with zero normal readback.
- [x] Failure, reload, reconnect, disposal, and security checks pass.
- [x] Affected user-facing documentation matches shipped behavior.
- [x] Framework tests, package tests, `npm run check`, and the complete check pass.
- [x] The evidence receipt validates and links all required proof.

## Run and evidence rule

Use the shared workflow for isolation, permissions, retries, rollback, and receipt content.

- Isolation: Use one worktree, browser runtime, output folder, and strict port set for the run.
- Retry: Retry one transient browser or GPU start only after classification. Do not retry a stable
  validation, clock, or authority rejection.
- Rollback: Return to the latest passing checkpoint if a regression cannot be fixed forward.
- Special authority: Use the existing local development credential. Add no production authority.
- After completion: Framework and CLI maintainers own checks and feedback. Retire controls only through a later accepted API change.

The temporary verifier writes and validates a versioned `receipt.json`, `confirmation-checks.md`, `facts.json`, and `measurements.json` in one new `outputs/{run-id}/` folder. Record actual revisions, ports, IDs, limits, attempts, measurements, diagnostics, commands, and changed user-facing pages.

Update `../slice-list.md` from the run facts. In `slice-summary.md`, state what changed in Framework, CLI, Studio, the demo, and BroMetal; how to test it; and any needed ADR.
