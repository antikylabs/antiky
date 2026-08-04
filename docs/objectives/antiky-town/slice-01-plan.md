# Slice 01: First Complete Object

## Control block

| Field | Value |
| --- | --- |
| Status | `NOT READY` |
| Owner | Antiky project owner |
| Plan approver | Antiky project owner |
| Selected option | `1A. Feature-first market lamp` — recommended, not approved |
| Selection state | `PROPOSED` |
| Depends on | [`slice-00-plan.md`](slice-00-plan.md): development harness and minimum inspection |
| Framework alignment date | 2026-08-04 |
| Framework alignment revision | `840c606d7aca894f22f2e033ffa3e33e7ca71ab4` |
| Evidence revision | `PENDING` |
| Complete verification command | `npm run verify:slice-01 --workspace @antiky/demos` |
| Run state | `NOT STARTED` |
| Evidence receipt format | `antiky.slice-receipt/v1` |
| Evidence receipt path | `docs/objectives/antiky-town/evidence/slice-01/{runId}/receipt.json` |

The plan is ready for review. Feature implementation is not ready. The project owner must approve
the Slice 0 choices and option `1A`. Slice 0 must then pass. The readiness table names the remaining
prework.

After those gates pass, use:

```text
/goal implement docs/objectives/antiky-town/slice-01-plan.md until complete
```

The goal must stop at any failed readiness gate. It must not implement Slice 0 as hidden Slice 01
work.

## Required reading

| Document | Why it controls this slice |
| --- | --- |
| [`SLICE_WORKFLOW_A.md`](SLICE_WORKFLOW_A.md) | Defines the shared gates, evidence rules, and success rubric |
| [`IMPLEMENTATION_PLAN_A.md`](IMPLEMENTATION_PLAN_A.md) | Defines the first-object outcome, options, and evidence |
| [`DEV_HARNESS_RESEARCH_A.md`](DEV_HARNESS_RESEARCH_A.md) | Defines the Slice 0 host, inspection, MCP, reload, and GPU-tool boundary |
| [`slice-00-plan.md`](slice-00-plan.md) | Defines the required harness implementation, contracts, proof, and completion gate |
| [`Antiky Town README`](../../../packages/demos/src/demos/antiky-town/README.md) | Defines Antiky Town ownership and reference rules |
| [`brometal-town/index.ts`](../../../packages/demos/src/demos/brometal-town/index.ts) | Contains the reference practical lights and BroMetal update path |
| [`GOOD_ENGINEERING_H.md`](../../GOOD_ENGINEERING_H.md) | Requires small, proved changes and deep modules |
| [`world-and-session-model_A.md`](../../architecture/framework/world-and-session-model_A.md) | Defines stable IDs, component runtime data, and state copies |
| [`commands-events-and-persistence_A.md`](../../architecture/framework/commands-events-and-persistence_A.md) | Defines commands, trusted context, events, replay, and correction |
| [`rendering-and-assets_A.md`](../../architecture/framework/rendering-and-assets_A.md) | Defines render preparation, changed ranges, BroMetal ownership, and diagnostics |
| [`protocols-and-serialization_A.md`](../../architecture/framework/protocols-and-serialization_A.md) | Defines local typed calls and encoded boundaries |
| [`ADR 0006`](../../adr/framework/0006-brometal-render-driver_H.md) | Keeps BroMetal out of framework core |
| [`ADR 0007`](../../adr/framework/0007-commands-as-mutation-boundary_H.md) | Requires commands for authoritative changes |
| [`ADR 0009`](../../adr/framework/0009-separate-state-projections_H.md) | Keeps authoring, runtime, and render state separate |
| [`ADR 0011`](../../adr/framework/0011-stable-ids-and-runtime-aliases_H.md) | Selects UUIDv7 stable IDs and temporary numeric aliases |

## Goal

### Outcome

An accepted authoring command changes the base power of one market lamp through Antiky Framework,
and the new value is visible in the town and available through structured inspection.

### Why this slice exists

This slice proves the first complete framework path. It starts with stable authored data. It passes
through authority, history, runtime state, and render state. It ends in the existing BroMetal town
renderer. The slice will show which small framework parts the second object can reuse.

### Observable behavior

At completion:

1. The configured Antiky Town route shows the same town as the `town-study` reference.
2. `Market Lamp West 01` starts with the reference base power of `1.05`.
3. An authorized command can set the base power to a finite value from `0` through `4`.
4. The new power changes the light on the next rendered frame without a page reload.
5. Entity inspection reports the same ID, value, revision, and render slot as the headless query.
6. An unauthorized, malformed, duplicate, stale, or out-of-range command makes no state change.
7. Correction-based undo restores the prior base power as a new accepted fact.

The renderer can keep its current small flicker effect. The command changes the lamp's base power.
Flicker does not change authoring state and does not add an accepted event on each frame.

### Non-goals

- A general entity-component-system storage engine or scheduler.
- A general command, event-store, or database platform.
- Durable storage across a process restart.
- The Slice 2 fixed-step session clock.
- Porting every town light or every town object.
- The Slice 5 render graph or general `RenderDriver` implementation.
- State-preserving module replacement.
- Studio panels, networking, multiplayer authority, or production authentication.
- A BroMetal partial-uniform-write API.

### Approved differences from the reference

None. An owner can approve a recorded difference before implementation. The new route can expose
inspection and command controls that the reference route does not have.

## Named object and reference values

The slice uses reference practical-light slot `0`.

| Field | Required value |
| --- | --- |
| Label | `Market Lamp West 01` |
| Stable entity ID | One fixed, opaque UUIDv7 assigned in authored content before implementation |
| Transform position | `[-3.565, 4.237, 6.82]` world units |
| Point-light color | `[1, 0.52, 0.22]` linear RGB |
| Point-light radius | `4` world units |
| Point-light base power | `1.05` unitless multiplier |
| Reference render slot | `0` |
| Initial authoring revision | `1` |

The assigned UUIDv7 becomes part of the reference fixture and must not change after rename, reload,
replay, or a complete state rebuild.

## Reference and baseline

| ID | Reference fact | How to reproduce or measure it | Stored evidence | Status |
| --- | --- | --- | --- | --- |
| `REF-01` | The `town-study` route is the visual and behavior reference | Run the current development host and open the route | Baseline capture is not yet stored | `FAIL` |
| `REF-02` | Slot `0` has position `[-3.565, 4.237, 6.82]`, radius `4`, color `[1, 0.52, 0.22]`, and base power `1.05` | Inspect `PRACTICAL_LIGHTS` in the reference source | `brometal-town/index.ts`, lines 106-114 at the alignment revision | `PASS` |
| `REF-03` | The renderer multiplies base power by a small mode-dependent flicker | Inspect `updatePracticalLights` | `brometal-town/index.ts`, lines 513-560 at the alignment revision | `PASS` |
| `REF-04` | Slot `0` reaches the world, actor-edge, actor, and water programs | Inspect the practical-light uniform setup and update | `brometal-town/index.ts`, lines 482-560 at the alignment revision | `PASS` |
| `REF-05` | The demo reports `16` draws and `1,152` dynamic actor bytes per frame | Read the current `report` call | This number does not include all uniform uploads | `PASS` |
| `REF-06` | Actual full-frame CPU-to-GPU writes and resource counts are known | Capture the same camera and mode with Slice 0 diagnostics or an approved tool | No runtime capture exists | `FAIL` |

The implementation must keep the `town-study` route runnable. It must preserve town geometry,
camera, movement, actors, water, materials, shadows, and the other seven practical lights.

## Framework alignment snapshot

This snapshot describes code at revision `840c606d7aca894f22f2e033ffa3e33e7ca71ab4`.

| Area | Current fact | Direct evidence |
| --- | --- | --- |
| Framework exports | `@antiky/framework` exports no capability | `packages/framework/src/index.ts` contains only `export {}` |
| Framework tests | The package has no test script or test files | `packages/framework/package.json` has only `dev` and `typecheck` scripts |
| Antiky Town | The demo is scaffolded and unregistered | `antiky-town/index.ts` contains only `export {}`; the registry has no Antiky Town loader |
| Slice 0 | An executable plan exists; implementation, baselines, and owner choices do not | `slice-00-plan.md` and `DEV_HARNESS_RESEARCH_A.md` |
| Reference town | The current town is a working `DemoFactory` with eight fixed practical lights | `brometal-town/index.ts` and the `town-study` loader |
| BroMetal | Version `0.14.0` supplies typed programs and `UniformHandle.set` | `packages/demos/package.json`, lock file, and installed type declarations |
| Uniform writes | BroMetal marks uniform data dirty on each new frame and writes a program's complete uniform block before its first draw | Installed BroMetal `runtime/webgpu.js` at the alignment revision |
| Required schema | UUIDv7 is selected; the runtime schema library or format is still open | World/session architecture, identity translation and open decisions |
| Command model | The architecture defines the boundary; no command implementation exists | Commands/events architecture and empty framework package |
| GPU inspection | WebGPU Inspector is approved as an optional, pinned development tool; it is not installed | `DEV_HARNESS_RESEARCH_A.md`, WebGPU Inspector assessment |
| Concurrent ADR review | A separate pipeline owns `docs/adr/UNDER_REVIEW.md` | Untracked file; it is not a Slice 01 input unless it changes a named contract |

### Drift rule

Before implementation starts or resumes:

1. Reinspect framework exports, source, tests, Slice 0 evidence, and the reference renderer.
2. Update the alignment revision and all affected capability decisions.
3. Record the change in the drift log.
4. Rerun the readiness gate.

Planned Slice 0 APIs can change before implementation. Slice 01 depends on their meaning, not on the
proposed MCP names in the research document.

## Execution contract

Freeze the run values before the first implementation change. Slice 0 must supply the base run and
receipt tools. It must also supply service, build, runtime, and event identities. The Slice 01
verifier adds the lamp evidence and drives the run.

### Run setup

| Field | Required value or rule | Run value and direct evidence |
| --- | --- | --- |
| Run ID and attempt IDs | Use `slice-01-YYYYMMDDTHHMMSSZ-abcdef0`; start attempts at `1` and increment them for every retry | `PENDING` |
| Source and final revision | Start from one clean full Git revision; record every checkpoint and the final revision | `PENDING` |
| Worktree and branch | Use one dedicated writable worktree and branch; permit no concurrent writer | `PENDING` |
| Dependency lock | Record the SHA-256 digest of root `package-lock.json` | `PENDING` |
| Configuration | Record the digest of the resolved and redacted Slice 0 configuration | `PENDING` |
| Runtime tools | Record exact Node `22.x` or later, npm, OS, and architecture values | `PENDING` |
| Browser and GPU | Record the exact supported WebGPU browser, OS, adapter, and driver | `PENDING` |
| Visual profile | Use the same viewport, pixel ratio, camera, town mode, and flicker capture phase for reference and result | Values are `PENDING` until `REF-01` and `REF-06` pass |
| Deterministic inputs | Use the fixed lamp fixture; record seed, locale, time zone, clock rule, and network profile | `PENDING`; no external network is permitted during verification |
| Isolated resources | Reserve explicit host and inspection ports; use run-specific services, runtime, temporary paths, and evidence directory | `PENDING`; an occupied resource fails preflight |
| Build and runtime identity | Record development-session, service, build, connection, and runtime-instance IDs | `PENDING` |
| Start and resume events | Use Slice 0 build and runtime revision events; each verifier wait has a recorded timeout | `PENDING` until Slice 0 supplies the events |

The verifier must compare the reference and Antiky result with this one run setup. It must not use
an artifact from another run unless the artifact records the same required setup values.

### Delivery permissions

| Operation | Required capability | Allowed scope | Grant source | Expiry or revocation | Audit evidence |
| --- | --- | --- | --- | --- | --- |
| Read repository files and local inspection data | Workspace read and Slice 0 read session | This repository and the active local runtime | Approved goal and Slice 0 session | Run close or session stop | Receipt operation list and inspection IDs |
| Create and remove delivery worktrees | Git worktree access | This repository and run-specific worktree paths only | Approved goal after readiness passes | Run close and verified cleanup | Worktree path, revision, branch, and cleanup result |
| Edit and commit implementation checkpoints | Workspace write and Git commit | Files named by `CP-01` through `CP-05` | Approved option and goal | Run close or goal cancellation | Patch and checkpoint commit IDs |
| Start or stop development processes | Local process and loopback-port access | Explicit run ports and child processes only | Approved goal after readiness passes | Checkpoint cleanup or run close | Supervisor and process lifecycle records |
| Submit lamp commands | `world.light.edit` for `slice-01-editor` | One local test world and fixed lamp | Slice 0 trusted test context | Runtime disposal | Command result and related event IDs |
| Read lamp state | Read permission for test identities | One local test world | Slice 0 trusted test context | Runtime disposal | Inspection records |
| Install or download dependencies | None by default | `DENIED` until the owner approves an exact package and version | Explicit owner approval only | One approved operation | Approval and lock-file change |
| Use production, secrets, deployment, or external messages | None | `DENIED` | None in Slice 01 | Always denied | Receipt records no such operation |

Owner approval is for product choices and visual differences. Routine build, test, inspection,
capture, rollback, and cleanup work must use commands or typed tools.

### Failure, retry, and resume

| Failure class | Detection rule | Maximum automatic retries | Required action and evidence |
| --- | --- | ---: | --- |
| `EXPECTED_REJECTION` | The lamp service returns a required stable rejection for invalid, stale, duplicate, or unauthorized input | `0` | Record before and after state proof; do not resubmit the request |
| `TRANSIENT` | A local tool or service fails and the same run setup has no defect evidence | `2` | Check service health, use recorded bounded backoff, and preserve every attempt |
| `DEFECT` | The same input and run setup give the same wrong result, or a required test fails | `0` | Add required proof, fix the cause, and start a new attempt |
| `STALE_RUN` | Source, lock, config, build, runtime, or reference identity does not match the frozen run setup | `0` | Invalidate affected evidence and reconstruct or start a new run |
| `AUTHORITY_BLOCK` | A step needs an owner choice or capability outside the permissions table | `0` | Stop and request the exact choice or capability |
| `EVIDENCE_FAILURE` | A required capture, receipt link, hash, or inspection record is missing or invalid | `1` | Validate the unchanged run setup, repair the evidence path, and record both attempts |

Resume only from a passing checkpoint whose commit, lock hash, configuration hash, and receipt
fragment still match. Start a new run if those values cannot be proved. An unexplained flaky result
is a defect. A later green attempt does not erase it.

### Software rollback

| Field | Required answer |
| --- | --- |
| Last-known-good revision or artifact | The implementation-start revision for `town-study`, then the latest passing Slice 01 checkpoint |
| Rollback triggers | Reference regression, failed required gate, unsafe authority or lifecycle behavior, corrupt state, or an unrecoverable replacement failure |
| Programmatic action | Create a corrective or revert commit for the owned checkpoint; restart the isolated services from the last-known-good revision; do not rewrite shared history |
| State and data effect | Slice 01 has no durable store; restart from the authored fixture, keep stable world and entity IDs, and issue new runtime IDs |
| Proof after rollback | Run the reference smoke check, affected completed checkpoint tests, and lifecycle health checks in the isolated environment |
| Receipt record | Record the trigger, reverted and replacement commits, prior and new runtime IDs, commands, results, and artifacts |

Correction-based lamp undo remains a product operation. It does not satisfy software rollback.

## Readiness gate

Do not start feature implementation until every applicable row is `PASS`.

| ID | REQUIRED condition | Status | Direct evidence or exact blocker |
| --- | --- | --- | --- |
| `PRE-01` | The owner approved option `1A` or a documented replacement | `BLOCKED` | Option `1A` is recommended but not approved |
| `PRE-02` | Slice 0 is complete | `BLOCKED` | [`slice-00-plan.md`](slice-00-plan.md) is `NOT READY` and not implemented |
| `PRE-03` | The alignment snapshot matches the implementation start revision | `PASS` | Snapshot recorded on 2026-08-04; rerun after any drift |
| `PRE-04` | The lamp visual, draw, upload, and resource baseline is stored | `FAIL` | Source values are known; visual and runtime measurement artifacts are missing |
| `PRE-05` | The outcome, non-goals, and failure behavior are explicit | `PASS` | This plan defines them |
| `PRE-06` | Stable identity, component runtime data, command limits, and test identities are selected or in scope | `PASS` | UUIDv7 is selected; the narrow schema records, limits, and identities are defined below |
| `PRE-07` | The required inspection base exists | `BLOCKED` | Slice 0 must supply the typed inspection service and transport adapters |
| `PRE-08` | Tests and one complete verification command are named | `PASS` | The test and checkpoint sections define them |
| `PRE-09` | Reload, reconnect, failure, and disposal behavior are defined | `PASS` | The lifecycle table defines them |
| `PRE-10` | Authority and local-service security rules are defined | `PASS` | The authority and security sections define them |
| `PRE-11` | Render upload and resource limits have measured reference values | `FAIL` | The source-derived estimate needs a runtime capture; current demo stats omit uniform writes |
| `PRE-12` | No unresolved architecture choice changes package ownership or the public slice contract | `PASS` | The narrow option avoids selecting a general schema library, ECS, event store, or render graph |
| `PRE-13` | The supported browser, Slice 0 service, and required measurement operations are available | `BLOCKED` | Slice 0 is not complete |
| `PRE-14` | The run setup is frozen and its resources are isolated | `BLOCKED` | The worktree, ports, target profile, run ID, and environment hashes are not allocated |
| `PRE-15` | Delivery permissions are explicit and sufficient | `PASS` | The permissions table grants only local Slice 01 work and denies production and external actions |
| `PRE-16` | Failure, retry, resume, and software rollback rules are testable | `PASS` | The execution contract defines exact classes, bounds, resume checks, triggers, and proof |
| `PRE-17` | The receipt writer, validator, path, and start or resume events are available | `BLOCKED` | Slice 0 does not yet supply its base receipt tools or build and runtime events |

### Owner action before the goal can run

1. Approve or replace Slice 0 choices `0A`, `C1`, `0P-A`, and `0T-A`.
2. Complete Slice 0 and its evidence.
3. Approve or replace Slice 01 option `1A`.
4. Capture `REF-01` and `REF-06` through the Slice 0 tools.
5. Allocate and freeze the run setup. Confirm that no run resource is shared.
6. Confirm the receipt writer, validator, and build and runtime events.
7. Change every readiness row to `PASS` with direct evidence.

## Existing capability inventory

Decision values describe what Slice 01 should do after the readiness gate passes.

| ID | Need | Required behavior | Existing API and path | Existing proof | Decision |
| --- | --- | --- | --- | --- | --- |
| `CAP-01` | Stable identity | Brand, create, and validate UUIDv7 IDs | No framework API | Architecture only | `CREATE` |
| `CAP-02` | Runtime component data | Describe and validate the lamp's transform and point light | No framework API | Architecture only | `CREATE` |
| `CAP-03` | Authoring store | Hold one entity, components, and revision | No framework API | None | `CREATE` |
| `CAP-04` | Command, trusted context, and result | Validate, authorize, deduplicate, check revision, and return stable results | No framework API | Architecture only | `CREATE` |
| `CAP-05` | Accepted event, replay, and correction | Keep bounded in-memory facts and rebuild or correct state | No framework API | Architecture only | `CREATE` |
| `CAP-06` | Runtime and render projections | Apply one accepted change and report one dirty render slot | No framework API | Architecture only | `CREATE` |
| `CAP-07` | Typed semantic inspection | Serve versioned snapshots to tests, MCP, and future Studio | Slice 0 must supply the base service | Planned evidence only | `USE` after Slice 0; `EXTEND` with lamp records |
| `CAP-08` | Reference renderer | Draw the current town and practical lights | `brometal-town/index.ts` | Working `town-study` consumer | `EXTEND` with one narrow external base-power seam |
| `CAP-09` | Typed GPU programs | Set typed uniform values and draw | BroMetal `createProgram` and `UniformHandle.set` | Current town | `USE` |
| `CAP-10` | Shader generation | Compile typed shader sources before runtime | `npm run shaders --workspace @antiky/demos` | Current generated shaders | `USE`; no shader change is expected |
| `CAP-11` | Demo host and route | Load a selected `DemoFactory` and dispose it | Demos registry and Slice 0 host | Current `town-study` route; Slice 0 pending | `EXTEND` after the slice passes |
| `CAP-12` | Framework tests | Run headless unit and contract tests | No framework test script | None | `CREATE` |
| `CAP-13` | Low-level GPU capture | Inspect GPU objects, writes, passes, and validation | Optional WebGPU Inspector or approved equivalent | Research only | `DEFER` as a hard dependency; use when available |
| `CAP-14` | Delivery run identity and receipt | Correlate attempts, checkpoints, product IDs, checks, and artifacts | Slice 0 must supply base run IDs, receipt tools, and service, build, and runtime IDs | Planned only | `USE` the Slice 0 base; `EXTEND` with lamp evidence links |

## Missing-capability hypotheses

The repository probes below were read-only.

| ID | Hypothesis | Probe | Result | Decision |
| --- | --- | --- | --- | --- |
| `HYP-01` | Antiky already has a stable-ID or runtime-schema library | Search package manifests, framework source, and the lock file | No Antiky API or selected schema library exists | `CREATE` narrow code |
| `HYP-02` | BroMetal can write only the changed power field to a uniform buffer | Inspect `UniformHandle` and the WebGPU runtime flush | `set` changes retained CPU data; draw writes the complete program uniform block | `USE` current behavior; defer a general BroMetal change |
| `HYP-03` | The current `bytesPerFrame` stat includes all CPU-to-GPU traffic | Inspect the town `report` calculation | It counts two actor instance uploads only; it omits uniform and other writes | `EXTEND` diagnostics through the Slice 0/render seam |
| `HYP-04` | The renderer already accepts an external practical-light value | Inspect the reference module exports and `PRACTICAL_LIGHTS` | The array and update function are private constants | `EXTEND` with a town-local seam |
| `HYP-05` | A generic ECS is needed for one lamp | Map the required data and queries | One entity and two components need typed records and maps only | `DEFER` generic storage |
| `HYP-06` | A durable database is needed for replay and undo proof | Compare the outcome with the event architecture | A bounded in-memory accepted-event list satisfies this slice | `DEFER` durable storage |
| `HYP-07` | GPU readback is needed to inspect lamp state | Trace authoring, runtime, and render state | CPU projections contain the authoritative and submitted values | `DEFER`; normal readback count stays zero |

Any new hypothesis must enter this table before it becomes framework work.

## Expected framework additions

All public exports come from `@antiky/framework`. BroMetal, DOM, React, website, and Node host types
must not enter framework core.

| ID | Addition | Owner and surface | Complexity hidden | Required tests | First consumer |
| --- | --- | --- | --- | --- | --- |
| `FW-01` | Branded `EntityId`, `WorldId`, and `CommandId` with UUIDv7 creation and validation | Framework public ID functions; shared UUID code stays private | UUID syntax, version, variant, clock, and random input | Valid, malformed, wrong-version, deterministic injected source | Lamp content and command envelope |
| `FW-02` | Runtime definitions for entity header, `Transform`, and `PointLight` | Framework public records; explicit validators | Stable type tags, schema versions, fields, units, defaults, limits, edit and save rules | Valid defaults, finite numbers, vector lengths, bounds, stable tags | Market lamp authored record |
| `FW-03` | Feature-first lamp authoring service | One narrow public facade; maps and mutation functions stay private | Single writer, revision, bounded history, and immutable read views | Create, get, rename identity, invalid data, capacity | Antiky Town composition root |
| `FW-04` | `SetPointLightPower` command path and trusted context | Public command and result records; handler details private | Validation order, permission, duplicate ID, expected revision, no-op, stable codes | Accepted, malformed, missing, unauthorized, duplicate, stale, out-of-range, same value | Headless call and MCP adapter |
| `FW-05` | `PointLightPowerSet` accepted fact, replay, and correction-based undo | Event record public to inspection; event application private | Ordered apply, previous value, sequence, source command, correction link | Replay, missing sequence, repeated delivery, undo, redo-as-new-command | Lamp authoring service |
| `FW-06` | Lamp runtime and render projections | Typed framework records with no BroMetal types | Exactly-once revision apply, complete rebuild, slot mapping, dirty entry | Small update equals rebuild; stale or duplicate apply; only slot `0` dirty | Town render adapter |
| `FW-07` | Versioned lamp inspection snapshots | Typed read-only query over the service | Safe copies, IDs, revisions, component data, event links, render binding | Direct query, bounded lists, safe copy, stable ordering | Tests, MCP, future Studio |
| `FW-08` | Framework test command | `@antiky/framework` package script | One repeatable headless suite | The script runs all framework tests | Repository checks |

The feature facade can be lamp-specific. Do not export generic registry, query, scheduler, storage,
or render-graph interfaces in this slice. A second feature must prove those shapes first.

## Expected demo and harness additions

| ID | Addition | Owner | Required behavior | Proof |
| --- | --- | --- | --- | --- |
| `DEMO-01` | Reference practical-light source seam | `brometal-town` demo module | Default factory keeps all current values; an alternate factory can read slot `0` base power | Reference parity test and route capture |
| `DEMO-02` | Market-lamp render adapter | `antiky-town/render` | Resolve the stable ID once, retain render slot `0`, and provide the submitted base power | Fake-sink integration test |
| `DEMO-03` | Antiky Town composition root | `antiky-town/index.ts` | Create the lamp service, projections, inspection adapter, and configured town factory | Demo integration test |
| `DEMO-04` | Slice 01 inspection and command adapters | Slice 0 service plus `antiky-town` adapter | Use framework queries and command service; do not derive state from DOM or BroMetal | Direct-query/MCP parity test |
| `DEMO-05` | Antiky Town route registration | Demo registry and catalog, after all other checks pass | Load the complete slice without changing `town-study` | Route test and browser evidence |
| `DEMO-06` | Complete Slice 01 verifier | Demos package | Run headless, adapter, host, inspection, command, reload, visual, and budget checks from a clean start | `npm run verify:slice-01 --workspace @antiky/demos` |
| `DEMO-07` | Slice 01 receipt mapping | Demos verifier over the Slice 0 receipt tools | Add lamp commands, events, projections, checks, and artifacts to `antiky.slice-receipt/v1` | Receipt contract tests and final receipt validation |

The town-local render seam is a temporary narrow adapter. Slice 5 can replace it with the approved
render-driver design. Do not expose BroMetal through the framework to avoid that future work.

## Implementation options and decision

### 1A. Feature-first market lamp — recommended

Build the two component definitions, narrow lamp service, command handler, event application,
projections, and inspection view that this lamp needs. Use typed records and maps. Export one deep
feature facade. Keep generic storage details private.

Benefits:

- It proves the whole path with the least new surface.
- It does not select a general ECS or schema library without a second consumer.
- Tests can name every transition and failure.

Costs:

- The second object can cause internal changes.
- Some lamp-specific names will not become general framework APIs.

### 1B. Small generic registry

Create generic entity, component, command, event, and projection registries before the lamp.

Benefits:

- A second feature can reuse more code if the shapes are correct.

Costs:

- The first feature must test a larger surface.
- The repository has no second consumer to prove the generic design.
- Generic containers can hide the lamp's authority and revision rules.

Select `1B` only if another approved slice needs the same concrete registry during Slice 01.

### 1C. Full ECS first

Select or build archetypes, queries, scheduling, and change tracking before the lamp.

Benefits:

- It can prepare for high entity counts.

Costs:

- It chooses open storage and scheduler questions before measurement.
- It delays the first visible framework result.
- It creates the most public surface and rework risk.

Select `1C` only after a measured workload shows that typed maps cannot meet it.

### Decision record

| Field | Value |
| --- | --- |
| Proposed option | `1A. Feature-first market lamp` |
| Approved option | `PENDING` |
| Approver | Antiky project owner |
| Date | `PENDING` |
| Reason | It is the smallest complete proof and follows the architecture rule to add behavior before abstraction |

## Data and authority path

```text
headless test, MCP tool, or future Studio control
  -> SetPointLightPower command data
  -> trusted caller context from the local host
  -> lamp authoring service validates and decides
  -> PointLightPowerSet accepted fact
  -> authoring revision and in-memory history
  -> lamp runtime projection
  -> practical-light render entry and dirty slot 0
  -> town-local adapter resolves slot before the frame loop
  -> existing BroMetal uniform handles
  -> visible market lamp
```

| Stage | Owns | Input | Output | Revision or order rule | Failure result |
| --- | --- | --- | --- | --- | --- |
| Command adapter | Encoded-boundary validation only | Versioned command data | Typed command plus host-supplied context | Command ID and expected authoring revision | Stable rejection; no service call for malformed data |
| Lamp authoring service | Authoritative lamp and bounded accepted history | Typed command and trusted context | Accepted, rejected, or no-op result | One writer; revision increments once per accepted change | No state or projection change |
| Event application | Ordered accepted facts | Next event sequence | New authoring value and revision | Missing or repeated sequence fails clearly | Keep prior valid state and diagnostic |
| Runtime projection | Disposable lamp runtime record | Accepted authoring delta or complete state | Runtime alias `0` and base power | Apply each authoring revision once | Keep last valid revision |
| Render projection | Disposable practical-light record | Runtime delta or complete runtime state | Slot `0`, base power, and dirty-entry record | Apply each runtime revision once | Keep last valid render entry |
| Town adapter | BroMetal-facing light values | Render record and presentation flicker | Existing typed uniform values | Resolve stable ID before frequent loop | Keep last submitted value and diagnostic |

### Authority rules

- Authoring state is the source of truth for base power.
- The local host supplies trusted identity, permissions, receipt time, and runtime-instance ID.
- Command data cannot set its own permissions, trusted identity, receipt time, or server revision.
- The test identity `slice-01-editor` has `world.light.edit` permission.
- The test identity `slice-01-viewer` has read permission only.
- Direct tests, MCP, and future Studio use the same lamp service.
- Render state and GPU values never decide command results.

## Contracts and limits

### Stable IDs

- Persistent IDs are branded UUIDv7 strings.
- Authored fixtures contain fixed IDs.
- Runtime entity index `0` and render slot `0` are temporary aliases. They never enter events or
  saved authoring data.
- A caller must not infer object meaning from a UUID timestamp or text.

### Component definitions

| Type tag | Version | Fields | Limits and units | Save rule |
| --- | --- | --- | --- | --- |
| `antiky.component.transform` | `1` | Position as three finite numbers | World units | Authored and inspectable |
| `antiky.component.point-light` | `1` | Linear RGB color, radius, base power | Color values `0..1`; radius `> 0` and `<= 100`; power `0..4` | Authored and inspectable |

Each definition also states defaults, field labels, edit permission, visibility, validation, and
migration version. Explicit local validation functions satisfy Slice 01. This slice does not select
a schema library.

### Command envelope

| Field | Rule |
| --- | --- |
| Protocol version | `1` |
| Command schema version | `1` |
| Command type | `antiky.authoring.set-point-light-power` |
| Command ID | Valid UUIDv7; unique within the runtime instance |
| Target world ID | Valid UUIDv7 that matches the active world |
| Target entity ID | The fixed lamp `EntityId` |
| Expected authoring revision | Non-negative safe integer; must equal the current revision |
| Data | One finite `power` value from `0` through `4` |
| Encoded data limit | At most `4 KiB` at the MCP or other encoded boundary |
| Trusted context | Supplied separately by the host |

An accepted change increments the authoring revision once and appends one
`antiky.event.point-light-power-set` event at schema version `1`. The event stores old and new power,
event sequence, source command ID, entity ID, world ID, resulting revision, authority time, and an
optional correction link.

If the requested power already equals the authoritative value, return `NO_OP`. Do not increment the
revision, add an event, or mark a projection dirty.

### Bounded in-memory history

- Keep at most `256` command results and `256` accepted events for this demo runtime.
- Reject a new change with `HISTORY_CAPACITY_REACHED` before either bound would be exceeded.
- Do not evict a deduplication record while its related accepted event remains in the runtime.
- A controlled runtime reconstruction resets this in-memory history and uses a new runtime-instance
  ID. The stable world and entity IDs do not change.

### Stable results and diagnostics

| Code | Meaning | State change |
| --- | --- | --- |
| `ACCEPTED` | The service accepted one new base power | One event and one revision |
| `NO_OP` | The current value already matches | None |
| `INVALID_COMMAND` | The version, ID, shape, number, or encoded size is invalid | None |
| `WORLD_NOT_FOUND` | The target world is not active | None |
| `ENTITY_NOT_FOUND` | The target entity is absent or is not a point light | None |
| `MISSING_PERMISSION` | Trusted context lacks `world.light.edit` | None |
| `DUPLICATE_COMMAND` | The runtime has already seen the command ID | None; return the related prior result ID |
| `STALE_REVISION` | Expected and current authoring revisions differ | None; return the safe current revision |
| `VALUE_OUT_OF_RANGE` | Power is not finite or is outside `0..4` | None |
| `HISTORY_CAPACITY_REACHED` | Bounded command or event history is full | None |
| `EVENT_SEQUENCE_ERROR` | Replay or projection sees a gap or invalid repeat | None; keep last valid state |

Rejected command diagnostics contain the code, command ID when valid, entity ID when safe, expected
revision, current revision, and runtime-instance ID. They do not expose live objects or trusted
permission data.

## Tool and evidence plan

| ID | Tool | Claim it proves | Command or operation | Required artifact |
| --- | --- | --- | --- | --- |
| `TOOL-01` | Framework test suite | Headless IDs, schemas, commands, events, projections, and queries work | `npm test --workspace @antiky/framework` | Test output |
| `TOOL-02` | Demos test suite | The reference seam and Antiky adapter map only slot `0` | `npm test --workspace @antiky/demos` | Test output |
| `TOOL-03` | Workspace checks | Types, tests, and WebGPU-only policy pass | `npm run check` | Check output |
| `TOOL-04` | Slice 0 inspection service | IDs, values, revisions, results, diagnostics, and render binding agree | Read entity, command, and diagnostic operations | Versioned JSON evidence |
| `TOOL-05` | Slice 0 controlled reload | Runtime reconstruction and reconnect follow the contract | `dev_reload` and status reads | Old and new runtime/build IDs |
| `TOOL-06` | Supported browser and frame capture | The route is reachable and the power change is visible | Slice 0 capture operation at fixed camera and mode | Before, changed, and corrected captures |
| `TOOL-07` | Render diagnostics | Upload bytes, changed entries, draws, and resource counts meet limits | Render-stat resource and fake-sink counters | Structured measurement record |
| `TOOL-08` | Optional pinned WebGPU Inspector | Low-level writes and validation agree during an investigation | Local capture or approved equivalent | Capture ID and summarized facts |
| `TOOL-09` | Complete verifier | All Slice 01 proof runs from a clean start | `npm run verify:slice-01 --workspace @antiky/demos` | Exit code, summary, and artifact index |
| `TOOL-10` | Receipt validator | The run receipt has valid fields, links, results, and artifact hashes | `npm run verify:slice-01:receipt --workspace @antiky/demos -- "$ANTIKY_SLICE_RECEIPT_PATH"` | Validation result |
| `TOOL-11` | Isolated rollback rehearsal | The last-known-good revision remains runnable without changing the active worktree | Slice 01 verifier rollback phase in a temporary worktree | Revision, commands, health result, and cleanup record |

WebGPU Inspector is optional for Slice 01. The internal inspection service and adapter counters must
still produce required semantic and budget evidence. A GPU capture does not prove entity identity,
authority, revision, or undo.

All routine operations in this table are programmatic. An owner can approve a visual difference.
The receipt must record the owner, decision, related capture, and approved difference.

## Evidence receipt

The complete verifier writes one `antiky.slice-receipt/v1` JSON receipt at the path in the control
block. It writes to a temporary file, validates the content, and moves the receipt to its final path
with one rename. A reader must never see a partial receipt. The verifier sets
`ANTIKY_SLICE_RECEIPT_PATH` to that final path for `TOOL-10`.

| Receipt area | Slice 01 requirement |
| --- | --- |
| Identity | Slice ID, run ID, every attempt ID, source revision, final revision, and all checkpoint commits |
| Run setup | Every run-setup value or hash and each allocated resource |
| Correlation | Checkpoint, operation, command, event, authoring, runtime, render, service, build, test, and capture IDs that apply |
| Decisions | Every readiness, acceptance, rubric, owner-review, and final-audit result |
| Recovery | Every failed attempt, failure class, retry, resume, rollback trigger, action, and result |
| Authority | Every changing operation, used capability, target, grant, and denied escalation |
| Process | Unplanned intervention, retry, flaky check, permission escalation, missed check, and blocked duration |
| Artifacts | Stable paths and SHA-256 hashes for stored JSON, captures, logs, and measurements |
| Result | Final status, completion time, and after-completion owner |

Use this correlation path for one accepted lamp change:

```text
run ID
  -> attempt ID
  -> checkpoint ID
  -> correlation ID
  -> command ID
  -> accepted event sequence
  -> authoring revision
  -> runtime ID and projection revision
  -> render slot and projection revision
  -> build ID and runtime-instance ID
  -> test, inspection, measurement, or capture artifact
```

Use `N/A` with a reason when one ID does not apply. Do not store secrets, session tokens, raw
permissions, or unredacted environment values in the receipt.

## BroMetal and CPU-to-GPU plan

### Current behavior that the implementation must respect

BroMetal `0.14.0` retains one `Float32Array` for each program's uniform block. A numeric uniform
`set` updates that CPU array. On the first draw of each new frame, BroMetal writes the complete block
to a retained ring buffer.

The programs affected by practical-light slot `0` have these generated block sizes:

| Program | Uniform block bytes |
| --- | ---: |
| World voxel | `544` |
| Actor edge voxel | `544` |
| Actor sprite | `608` |
| Water | `416` |
| Source-derived total for affected programs | `2,112` per frame when all four draw |

This `2,112` value is a source-derived estimate, not the complete renderer upload count. `REF-06`
must confirm runtime writes before implementation. The current demo's reported `1,152` dynamic
bytes covers actor instance data only.

Slice 01 does not change BroMetal. It must not claim that a four-byte authoring change becomes a
four-byte GPU write. A separate measured proposal can add partial uniform writes if that feature
helps renderers in general.

### Ownership and update path

| Question | Answer |
| --- | --- |
| Authoritative CPU state | Lamp authoring `PointLight.basePower` |
| Accepted change that marks data dirty | One new `PointLightPowerSet` fact |
| Stable ID to compact slot resolution | Resolve fixed lamp `EntityId` to runtime alias `0` and render slot `0` during projection or adapter setup |
| Smallest Antiky changed range | One point-light render entry; field mask contains base power only |
| Actual BroMetal update unit | Complete uniform block for each affected program on its first draw, subject to `REF-06` confirmation |
| Update frequency | Authoring and projection update once per accepted command; existing presentation flicker can update effective color-power values per frame |
| GPU readback | None in the normal command, inspection, projection, and render path |
| Resources that stay alive | Town geometry, programs, uniform buffers, textures, targets, and practical-light slot mapping |
| Failed replacement behavior | Keep the prior valid CPU projection and renderer resources; report a stable diagnostic |
| Disposal owner | Existing demo instance disposes each BroMetal resource once; lamp service and adapters remove listeners once |

The existing fixed eight-light flicker loop can remain during this slice. It must read the projected
base power for slot `0`. It must not scan authoring entities, compare UUID text, parse JSON, replay
events, or create an event on each frame.

### Budget

| ID | Measure | Reference | Allowed result | Tool | Final result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `GPU-01` | Antiky render entries marked by one accepted command | No Antiky projection exists | Exactly `1`: slot `0` | Projection test and render stats | `PENDING` | `PENDING` |
| `GPU-02` | Unrelated lamp base-power entries changed | `0` | `0` | Before/after digest | `PENDING` | `PENDING` |
| `GPU-03` | GPU-to-CPU readbacks in the normal path | `0` by source inspection | `0` | Adapter counters and optional capture | `PENDING` | `PENDING` |
| `GPU-04` | Affected-program uniform bytes per frame | Source estimate `2,112`; runtime baseline pending | No increase caused by the lamp command after like-for-like mode and camera comparison | Render diagnostics | `PENDING` | `PENDING` |
| `GPU-05` | Extra GPU writes caused directly by command submission outside the existing frame path | `0` | `0` | Adapter counters | `PENDING` | `PENDING` |
| `GPU-06` | Program, geometry, texture, target, or buffer recreation for one power change | `0` | `0` | Creation/disposal counters | `PENDING` | `PENDING` |
| `GPU-07` | Draw calls for a like-for-like frame | Reference reports `16`; capture pending | No new draw for the lamp change | Render stats and capture | `PENDING` | `PENDING` |
| `GPU-08` | Static practical-light positions uploaded after setup | Current position uniforms are set during setup | No repeat caused by an authoring power change | Fake sink and adapter counters | `PENDING` | `PENDING` |
| `GPU-09` | Resource creation and disposal balance | Baseline pending | Every owned resource disposes exactly once | Lifecycle test and counters | `PENDING` | `PENDING` |
| `GPU-10` | Extra GPU queue submissions caused by command submission | `0` | `0`; use the existing next-frame path | Render counters and optional capture | `PENDING` | `PENDING` |

### Round-trip checklist

- [ ] CPU authoring state stays authoritative.
- [ ] The normal path has zero GPU readback.
- [ ] The stable entity ID resolves before the frequent render loop.
- [ ] Static position, radius, and color data do not upload because base power changed.
- [ ] Only render entry `0` becomes dirty after the accepted command.
- [ ] The fixed flicker loop reads compact render data, not the authoring world.
- [ ] The command does not rebuild geometry, programs, textures, targets, or buffers.
- [ ] The command does not add a GPU queue submission outside the existing next-frame path.
- [ ] Measurements report actual BroMetal full-block writes without claiming partial writes.
- [ ] Failed updates keep the last valid state and resources.
- [ ] All owned resources and listeners dispose exactly once.

## Structured inspection contract

Names are proposed until Slice 0 fixes its naming convention. The meanings and source service are
required.

| ID | Resource, query, or tool | Required fields or result | Bounds and version | Same service used by |
| --- | --- | --- | --- | --- |
| `INS-01` | Entity list | World ID, authoring revision, lamp ID, label, and component type tags | Version `1`; page size at most `100`; stable ID order | Headless test, MCP, future Studio |
| `INS-02` | Entity inspection by stable ID | Entity header, transform, point light, schema versions, authoring revision, runtime alias, render slot, submitted base power, projection revisions | Version `1`; safe copied data | Headless test, MCP, future Studio |
| `INS-03` | Command submission | Accepted, rejected, or no-op status; stable code; command, entity, world, revision, event, and runtime IDs as applicable | Version `1`; data at most `4 KiB` | Headless call and MCP tool |
| `INS-04` | Correction-based undo | Source command and event, correction command and event, prior and resulting values and revisions | Version `1`; current-revision check required | Headless call and MCP tool |
| `INS-05` | Render binding | Stable entity ID, runtime alias, render slot, dirty field mask, submitted base power, and last applied revision | Version `1`; no BroMetal or GPU object | Integration test, MCP, future Studio |
| `INS-06` | Diagnostics | Stable code, severity, time, run, attempt, correlation, build, and runtime IDs, related safe IDs, revision, and bounded details | Version `1`; bounded list and pagination | Tests, MCP, future Studio |

Read operations are read-only. MCP change tools call the same framework command service as headless
tests. Adapters must not inspect React state, DOM objects, BroMetal programs, or raw GPU objects to
reconstruct lamp state.

## Test plan

The exact file split can become smaller during implementation. The named behaviors cannot disappear.

| ID | Level | Test file or suite | Cases | Expected proof |
| --- | --- | --- | --- | --- |
| `TEST-01` | Unit | `packages/framework/src/identity/ids.test.ts` | Valid UUIDv7, malformed text, wrong version or variant, injected time/random source | Stable IDs are safe and repeatable |
| `TEST-02` | Unit | `packages/framework/src/world/component-definition.test.ts` | Valid transform/light, defaults, non-finite values, vector length, radius/color/power bounds | Runtime component data enforces its contract |
| `TEST-03` | Unit and contract | `packages/framework/src/slices/market-lamp.test.ts` | Valid, malformed, missing entity/world, unauthorized, duplicate, stale, out-of-range, same-value, and full-history commands | Decisions are structured and rejected work is a no-op |
| `TEST-04` | Unit | `packages/framework/src/slices/market-lamp-replay.test.ts` | Ordered replay, gap, duplicate delivery, complete rebuild, correction, redo as a new command | History and recovery preserve true facts |
| `TEST-05` | Unit | `packages/framework/src/slices/market-lamp-projection.test.ts` | Accepted delta, no-op, rejection, stale apply, full rebuild parity, stable slot, dirty mask | State copies apply each revision once |
| `TEST-06` | Contract | `packages/framework/src/slices/market-lamp-inspection.test.ts` | Stable order, safe copy, bounded data, fields, codes, revision, render binding | One typed inspection service reports the full object |
| `TEST-07` | Integration | `packages/demos/src/demos/antiky-town/tests/market-lamp-render.test.ts` | Default source parity, slot `0` update, other slots unchanged, no resource rebuild, no stable ID in frame loop | Town adapter changes only the intended input |
| `TEST-08` | Integration | `packages/demos/src/demos/antiky-town/tests/market-lamp-inspection.test.ts` | Direct and MCP reads match; direct and MCP commands return the same results | Transport adapters do not create a second truth |
| `TEST-09` | Lifecycle | Slice 0 runtime integration suite | Start, command, disconnect, reconnect, controlled reconstruction, dispose, shutdown | Runtime IDs, reset rules, and exactly-once cleanup pass |
| `TEST-10` | Browser and visual | Slice 01 verifier | Default, changed, corrected, invalid command, and failed reload views at fixed camera/mode | Visible result and last-valid recovery match the contract |
| `TEST-11` | Performance | Slice 01 verifier with render counters | Budgets `GPU-01` through `GPU-10` | CPU-to-GPU and lifecycle limits pass |
| `TEST-12` | Boundary | Workspace typecheck and WebGPU-only test | Framework has no BroMetal, DOM, React, website, or host imports; product surfaces stay WebGPU-only | Package ownership is enforced |
| `TEST-13` | Contract | `packages/demos/src/demos/antiky-town/tests/slice-receipt.test.ts` | Valid receipt, missing correlation, duplicate attempt, stale identity, bad hash, failure history, and partial final file | The receipt preserves a complete and valid delivery record |
| `TEST-14` | Delivery | Slice 01 verifier fixtures | Port collision, mismatched build or runtime, interruption and resume, retry exhaustion, denied authority, and prior-checkpoint smoke check | Isolation, recovery, rollback, and authority rules are enforced |

### Required command cases

For each rejected case, record authoring value, revision, event count, runtime value, render value, and
dirty-entry count before and after. All six values must remain unchanged.

For the accepted case:

1. Start at power `1.05`, authoring revision `1`, and event sequence `0`.
2. Submit power `2.0` with a valid command ID, editor context, and expected revision `1`.
3. Require `ACCEPTED`, power `2.0`, revision `2`, event sequence `1`, and dirty slot `0`.
4. Deliver the projection update once and require authoring, runtime, render, and inspection parity.
5. Submit the same command ID again and require `DUPLICATE_COMMAND` with no change.
6. Undo through a correction command at revision `2`.
7. Require power `1.05`, revision `3`, event sequence `2`, and a correction link to the first event.

### Regression-first rule

For a reported error, add and run a failing regression test before the fix. Record both the expected
failure and the passing result in the evidence log.

## Reload, reconnect, recovery, lifecycle, and security

| Change or event | Expected behavior | State guarantee | Evidence |
| --- | --- | --- | --- |
| Framework source change | Slice 0 performs safe browser reconstruction | In-memory authoring resets to the authored fixture; stable world/entity IDs stay; runtime-instance ID changes | Controlled reload test and inspection |
| Antiky Town source change | Slice 0 performs safe browser reconstruction | Same rule as framework source | Controlled reload test |
| Reference town source change | Rebuild and reconstruct both routes when needed | `town-study` remains the parity reference | Both route checks |
| Shader source change | Compile before replacement | A compile failure keeps the last valid generated shader and running renderer | Slice 0 build diagnostics and capture |
| Asset change | Rebuild or reconstruct as defined by Slice 0 | Failed load keeps the last safe running state when possible | Build/runtime diagnostics |
| Configuration change | Restart the supervisor | New service and runtime IDs; no state-preserving promise | Supervisor lifecycle test |
| Inspection disconnect and reconnect | Reconnect to the same live runtime when it still exists | Stable entity/world IDs and current revision match; connection ID can change | MCP parity test |
| Runtime reconstruction | Create a new runtime instance from authored fixture | Power resets to `1.05`, revision to `1`, history to empty; entity ID stays fixed | Reload test |
| Invalid or unauthorized command | Return one stable rejection | No authoring, history, projection, render, or GPU-resource change | Command and adapter tests |
| Projection or adapter failure | Keep last valid authoring and submitted render value | Error is inspectable and does not invent a revision | Failure-injection test |
| Run or evidence interruption | Stop the active attempt and resume only from a matching passing checkpoint | Prior evidence stays immutable; the next attempt gets a new attempt ID | `TEST-14` and receipt history |
| Software rollback | Start the last-known-good revision in an isolated worktree and use a corrective or revert commit when needed | Reference behavior returns; durable migration is not required; new runtime IDs identify reconstruction | `TOOL-11`, `TEST-14`, and receipt record |
| Demo disposal | Remove listeners and dispose each owned BroMetal resource once | No command can reach disposed service; repeated dispose is safe or clearly rejected | Lifecycle counters |
| Process shutdown | Slice 0 stops child processes and local transports | Port and session lock are released | Slice 0 shutdown test |

### Security rules

- Slice 0 local services bind to loopback and use its approved session authentication.
- Read resources do not change state.
- Change tools require explicit trusted identity and `world.light.edit` permission.
- The host derives trusted context. Command data cannot grant authority.
- Diagnostics expose safe IDs and stable codes. They do not expose tokens, raw permissions, live
  JavaScript objects, DOM state, BroMetal resources, or GPU resources.
- Command data and history are bounded.
- A disposed or old runtime-instance ID cannot accept a command.
- Delivery operations stay inside the permissions table. They cannot use production credentials,
  deployment access, external messages, or unapproved network access.
- The receipt and artifacts use redacted configuration values. They never contain secrets or session
  tokens.

## Implementation checkpoints

Start these checkpoints only after the readiness table is all green. Each checkpoint includes its
tests and one short commit.

| ID | Deliverable | Files or ownership | Tests and evidence | Commit message | Status |
| --- | --- | --- | --- | --- | --- |
| `CP-01` | Stable IDs and lamp component definitions | `packages/framework/src/identity` and `world`; public exports only for required records/functions | `TEST-01`, `TEST-02`, framework typecheck | `Add lamp identity and schemas` | `PENDING` |
| `CP-02` | Lamp authoring, command, event, replay, correction, and projections | Feature-first framework module; internal maps/functions stay private | `TEST-03`, `TEST-04`, `TEST-05` | `Add market lamp command flow` | `PENDING` |
| `CP-03` | Typed lamp inspection and Slice 0 adapters | Framework inspection DTO/query plus Antiky Town harness adapter | `TEST-06`, `TEST-08`, versioned inspection artifacts | `Expose market lamp inspection` | `PENDING` |
| `CP-04` | Reference renderer seam and Antiky Town render adapter | Town demo and `antiky-town/render`; no BroMetal in framework | `TEST-07`, default route parity, render counters | `Connect market lamp rendering` | `PENDING` |
| `CP-05` | Antiky Town composition, route, verifier, and delivery receipt | Antiky Town entry, registry/catalog, scripts, receipt contract, and test artifacts | `TEST-09` through `TEST-14`, all acceptance rows, and receipt validation | `Verify Antiky Town slice one` | `PENDING` |

Do not begin Slice 2 or generalize the feature facade during these checkpoints.

## Acceptance ledger

All rows are required.

| ID | REQUIRED result | Evidence method | Status | Direct evidence |
| --- | --- | --- | --- | --- |
| `AC-01` | The Antiky Town route shows the reference town and default lamp | Fixed-camera route test and capture | `PENDING` | None |
| `AC-02` | The fixed lamp ID, label, transform, light fields, and revision are inspectable | Headless and MCP query parity | `PENDING` | None |
| `AC-03` | A valid editor command changes power from `1.05` to `2.0` and revision `1` to `2` | `TEST-03` and MCP result | `PENDING` | None |
| `AC-04` | Malformed, missing, unauthorized, duplicate, stale, and out-of-range commands change no state copy or history | Before/after tests and digest | `PENDING` | None |
| `AC-05` | A same-value command returns `NO_OP` with no revision, event, or dirty entry | Command and projection tests | `PENDING` | None |
| `AC-06` | Accepted history replays to the same authoring state | Replay and digest test | `PENDING` | None |
| `AC-07` | Correction-based undo restores `1.05` at revision `3` without deleting the first fact | Undo test and inspection | `PENDING` | None |
| `AC-08` | Small authoring-to-runtime-to-render updates match a complete rebuild | Projection parity test | `PENDING` | None |
| `AC-09` | One accepted command marks only render slot `0` and the base-power field | Dirty-range test and inspection | `PENDING` | None |
| `AC-10` | The next rendered frame uses the projected base power and preserves presentation flicker | Fake-sink integration and visual capture | `PENDING` | None |
| `AC-11` | Direct framework and MCP calls return the same lamp, result, revision, and render binding | Contract test and versioned JSON | `PENDING` | None |
| `AC-12` | Rejections and undo use stable codes and related safe IDs in diagnostics | Diagnostic contract test | `PENDING` | None |
| `AC-13` | The normal path performs zero GPU readbacks | Counters and optional capture | `PENDING` | None |
| `AC-14` | A power change creates no program, geometry, texture, target, or buffer and adds no draw or queue submission | Render counters and budget checks | `PENDING` | None |
| `AC-15` | Actual uniform upload behavior is measured and does not claim unsupported partial writes | Render stats and source/capture comparison | `PENDING` | None |
| `AC-16` | Failed input or replacement keeps the last valid lamp and renderer state | Failure-injection tests and capture | `PENDING` | None |
| `AC-17` | Reload, reconnect, dispose, and shutdown follow the stated identity and lifecycle rules | Slice 0 integration and lifecycle counters | `PENDING` | None |
| `AC-18` | Framework core compiles and tests without BroMetal, DOM, React, website, or host imports | Typecheck and import boundary test | `PENDING` | None |
| `AC-19` | The `town-study` reference route and its default values still pass | Demos tests and reference capture | `PENDING` | None |
| `AC-20` | All CPU-to-GPU budget rows pass | `TEST-11` and structured render stats | `PENDING` | None |
| `AC-21` | `npm run check` passes | Workspace command | `PENDING` | None |
| `AC-22` | The complete clean-start Slice 01 verifier passes | `npm run verify:slice-01 --workspace @antiky/demos` | `PENDING` | None |
| `AC-23` | The plan has no blocker, unresolved owner choice, placeholder, or unexplained `N/A` | Final plan audit | `PENDING` | None |
| `AC-24` | The run uses the frozen setup and no resource from another run | Preflight, allocation records, and receipt validation | `PENDING` | None |
| `AC-25` | The receipt links each required result through run, attempt, checkpoint, correlation, product, runtime, and artifact IDs | `TEST-13`, `TOOL-10`, and receipt audit | `PENDING` | None |
| `AC-26` | Every failure, retry, and resume follows its class and bound; no unexplained flaky result is hidden by a later pass | `TEST-14` and complete attempt history | `PENDING` | None |
| `AC-27` | The last-known-good revision passes its reference and health checks in an isolated rollback rehearsal | `TOOL-11` and `TEST-14` | `PENDING` | None |
| `AC-28` | Every changing operation stays inside the delivery permissions table and uses no production or external authority | Receipt permissions audit | `PENDING` | None |
| `AC-29` | Every unexpected result has a disposition, and the after-completion record names its owners and paths | Learning-log and final-plan audit | `PENDING` | None |

## Success rubric

Scores: `0` no evidence, `1` partial or one-time manual result, `2` repeatable main path with a
missing edge or proof, `3` complete with repeatable direct evidence. Do not average scores.

| ID | Dimension | Score required | Current score | Evidence or gap |
| --- | --- | --- | --- | --- |
| `RUB-01` | Outcome and scope | `3` | `0` | No implementation or visible Antiky route |
| `RUB-02` | Framework alignment | `3` | `2` | Source snapshot exists; implementation-start refresh and baselines remain |
| `RUB-03` | Framework design | `3` | `1` | Narrow additions are planned but not implemented or tested |
| `RUB-04` | Correctness | `3` | `0` | Required tests do not exist |
| `RUB-05` | Inspectability | `3` | `0` | Slice 0 and lamp inspection do not exist |
| `RUB-06` | Render efficiency | `3` | `1` | Current API behavior is known from source; baseline capture and slice results are missing |
| `RUB-07` | Failure and recovery | `3` | `0` | Failure and reload tests do not exist |
| `RUB-08` | Lifecycle and security | `3` | `0` | Authority rules are planned; service and lifecycle proof are absent |
| `RUB-09` | Reference and performance | `3` | `1` | Source values exist; visual and runtime baselines are missing |
| `RUB-10` | Reproduction and handoff | `3` | `1` | The command is named but does not exist |
| `RUB-11` | Autonomous execution | `3` | `1` | The contract exists; isolated run, receipt, retry, resume, rollback, and authority proof are missing |
| `RUB-12` | Operation and learning | `3` | `1` | Owners and feedback paths are planned; no completed run or disposition evidence exists |

## Evidence log

| Date | Run ID | Attempt | Revision | Evidence ID | Correlation ID | Command or operation | Result | Artifact or output |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| 2026-08-04 | `PLAN` | `0` | `840c606d7aca894f22f2e033ffa3e33e7ca71ab4` | `PRE-03`, `CAP-01` through `CAP-14` | `N/A` | Inspect framework package, demo package, registry, plans, and source | Framework is empty; town and BroMetal seams are recorded | This plan's alignment and inventory tables |
| 2026-08-04 | `PLAN` | `0` | Same revision | `REF-02` through `REF-05` | `N/A` | Inspect `PRACTICAL_LIGHTS`, light update, shader layouts, and demo stats | Slot `0` values, four affected programs, block sizes, and incomplete stats are recorded | This plan's reference and GPU sections |
| 2026-08-04 | `PLAN` | `0` | Same revision | `HYP-01` through `HYP-07` | `N/A` | Search manifests/source and inspect installed BroMetal `0.14.0` runtime | Hypotheses resolved as recorded | Missing-capability table |

## Delivery failure and learning log

| Date | Run and attempt | Class | Unexpected result or intervention | Disposition | Evidence and status |
| --- | --- | --- | --- | --- | --- |
| 2026-08-04 | `PLAN` | `PROCESS_GAP` | The first workflow did not require isolated run identity, a machine-readable receipt, bounded retries, software rollback, or after-completion ownership | Add enforced shared rules and apply them to Slice 01 without changing its product outcome | Workflow, template, and this execution contract; `CLOSED` |

During implementation, record unplanned interventions, retries, flaky checks, permission
escalations, missed checks, and blocked time. Keep every failed attempt in the receipt.

## After completion

| Area | Owner | Signal or source | Trigger | Required action |
| --- | --- | --- | --- | --- |
| Health | Antiky framework and demo maintainers | Complete Slice 01 verifier, reference route smoke check, diagnostics, and GPU/resource budgets | A required check fails or a stable diagnostic reports unsafe state | Triage the run receipt; add a regression test for a defect; use rollback when safety cannot be restored forward |
| Human feedback | Antiky project owner | `docs/objectives/01-FEEDBACK_H.txt` | A person reports a Slice 01 behavior, usability, or visual problem | Triage through the formal objective workflow and link the resulting task to Slice 01 evidence |
| Agent findings | Antiky project owner | `docs/objectives/02-AGENT-FINDINGS_A.txt` | An agent finds a defect, missing proof, or delivery gap | Triage the finding; select a product test, shared rule, capability hypothesis, or accepted decision |
| Regression and rollback | Antiky framework and demo maintainers | Regression suite and the receipt's last-known-good checkpoint | A deterministic regression, authority breach, corrupt state, or unsafe lifecycle result | Stop affected delivery; fix forward or use the software rollback contract; record direct proof |
| Deprecation or retirement | Antiky project owner | Consumer inventory and a passing replacement slice | A later proved framework API replaces the lamp-specific facade or the route has no consumer | Approve the replacement, keep the verifier as regression proof, migrate consumers, then remove obsolete code and contracts |

Slice 01 has no production deployment or continuous production monitor. Those operations are `N/A`
until a later slice adds a hosted runtime.

## Drift and discovery log

| Date | Change or discovery | Effect on the plan | Decision and approver |
| --- | --- | --- | --- |
| 2026-08-04 | BroMetal writes complete program uniform blocks on the first draw of each frame | Slice 01 measures this behavior and does not promise a four-byte GPU write | Proposed in this plan; owner approval pending |
| 2026-08-04 | Current town `bytesPerFrame` omits uniform uploads | Slice 0/render diagnostics must capture real upload counts before implementation | Proposed in this plan; owner approval pending |
| 2026-08-04 | The [Agent Development Lifecycle](https://blog.cloudflare.com/agent-development-lifecycle/) review exposed a delivery-execution gap | Add the run setup, receipt, recovery, permission, and after-completion gates; keep the lamp outcome unchanged | Applied to the shared workflow, template, and this plan before implementation |

## Final completion declaration

Current declaration: **NOT COMPLETE**

The owner can change this declaration to `COMPLETE` only when:

- [ ] Every readiness row is `PASS`.
- [ ] Every acceptance row is `PASS`.
- [ ] Every rubric row scores `3`.
- [ ] The complete verifier passes from a clean start.
- [ ] The evidence names the final implementation revision.
- [ ] The run state is `CLOSED` and the `antiky.slice-receipt/v1` receipt validates.
- [ ] The receipt links every required result and preserves every failed attempt.
- [ ] Every failure has a resolved class and disposition.
- [ ] The rollback rehearsal passes from the recorded last-known-good revision.
- [ ] Every changing operation stayed inside the delivery permissions table.
- [ ] The after-completion record names its owners, signals, feedback paths, and retirement rule.
- [ ] The `town-study` reference remains available.
- [ ] No blocker, unresolved owner choice, placeholder, or unexplained `N/A` remains.
- [ ] The final goal audit confirms the original outcome.

Final evidence revision: `PENDING`

Final audit result: `PENDING`
