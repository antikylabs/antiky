# Implementation strategy

This document selects the delivery shape, gives the dependency order, and estimates the work in
reviewable units rather than calendar time. The strategic choice is one proof-first Antiky vertical
slice: earn narrow Framework behavior through a dedicated 2D fixture, use the BroMetal driver for the
required GPU trace, and carry the stable result through existing inspection into Studio.

## Strategic choice

The implementation will deliver:

- a small Framework runtime position store keyed by existing `EntityId` values;
- a renderer-neutral orthographic 2D camera;
- reliable click and semantic wheel-zoom input at the host boundary;
- a BroMetal-driver selection capability with asynchronous stable-ID results;
- temporary Framework selection inspection;
- Studio hierarchy highlight and selected-entity details; and
- one runnable, automated 2D GPU-selection integration fixture.

Reusable behavior belongs in existing Framework modules. The fixture is the first consumer and proof,
not the place where the reusable implementation remains. No separate package is created.

## Evidence basis

The strategy is based on current source boundaries, not only on the research summary:

| Planning claim | Current source evidence |
| --- | --- |
| Pointer input has click and drag but no wheel intent, and `pointerdown` does not take its own coordinate sample. | `packages/framework/src/game/contract.ts:20-29`; `packages/cli/src/host/game-server.ts:419-438`. |
| Narrow copied demo contracts make a host-input addition a compatibility and test concern. | `packages/framework/src/game/contract.ts:9-17`; `packages/framework/tests/game/contract.test.ts:100-151`. |
| The base render driver is synchronous and BroMetal target state is private to its driver. | `packages/framework/src/render/render-contract.ts:140-153`; `packages/framework/src/render/brometal-driver.ts:130-137,274-305`. |
| BroMetal `0.17.2` targets have no public read method. | `packages/framework/package.json:22-24`; `node_modules/brometal/dist/runtime/render-target.d.ts:42-50`. |
| The semantic snapshot already crosses the host and CLI boundary. | `packages/cli/src/host/game-server.ts:144-177,343-371`; `packages/cli/src/development/types.ts:46-99`; `packages/cli/src/development/browser-client.ts:221-249`. |
| Studio already polls the full snapshot and renders a stable-ID hierarchy without selected state. | `packages/studio/app/src/development/coordinator.ts:170-207`; `packages/studio/app/src/components/InspectionPanel.tsx:26-103,137-175`. |

These boundaries explain why input, readback, selection observation, and Studio UI are separate work
tracks even though the final acceptance path is one trace.

## Delivery options considered

| Option | Advantage | Cost or failure | Decision |
| --- | --- | --- | --- |
| Documentation or issue reply only | Small and externally visible. | Does not create any missing capability and cannot prove the owner's Studio trace. | Reject. |
| CPU helper first | Headless and inexpensive for a few dozen declared shapes. | Cannot prove displayed GPU pixel to Framework entity. It also introduces CPU shapes and overlap rules that the selected path does not need. | Reject as completion path. |
| Separate BroMetal companion | Closest to the issue author's product idea. | Forces package, generic identity, publication, versioning, and support decisions before Antiky proves its own need. | Defer. |
| General Framework World/ECS first | Could host every future entity feature. | Storage, query, hierarchy, and mutation policy remain open; it delays the demonstrated slice and conflicts with ADR 0001. | Reject. |
| Dedicated Antiky integration slice | Proves the complete owner-selected behavior while keeping each new API narrow and exercised. | Crosses Framework, BroMetal, CLI, Studio, and real GPU testing. | Select. |

The selected option has the largest immediate integration cost, but it is the only option that closes
the stated gap without inventing a product promise.

## Dependency graph

```text
A. Freeze input, coordinates, DTOs, and fixture acceptance
   ├── B. Check current BroMetal and establish public readback
   ├── C. Build Framework Position2D and Camera2D
   └── D. Build selection state and inspection contract

B + A ──> E. BroMetal-driver GPU ID path
D + A ──> F. Existing CLI transport + Studio selection UI
C + D + E + F ──> G. Runnable fixture and complete end-to-end proof
G ──> H. Evidence, architecture-document reconciliation, and closeout
```

B, C, and D can proceed independently after A. E must not use private BroMetal WebGPU fields while B
is unresolved. F must not invent Studio-local semantics before D freezes the stable selection record.
G must not be declared complete against fake readback or a Studio fixture that did not receive the GPU
result.

## Phase A: freeze contracts and the proof shell

**Purpose:** remove ambiguity before several packages encode different meanings.

1. Define the click sample, retained displayed-frame description, coordinate spaces, drawing-buffer
   conversion, no-hit value, result fences, position record, camera state, and selection observation from
   [`01-SELECTION-AND-SPATIAL-VOCABULARY.md`](01-SELECTION-AND-SPATIAL-VOCABULARY.md).
2. Add failing tests for the current `pointerdown` stale-coordinate behavior before changing host code.
3. Add the dedicated dev-only 2D fixture shell with stable IDs and world-inspection entities, but do
   not fake a successful GPU result.
4. Fix the object count at approximately 32 for deterministic test data only. Do not export a maximum.
5. Select opaque generated geometry, one-sample picking, depth-aware overlap, and empty background as
   the first fidelity contract. Alpha-perfect and blended picking stay out.

This phase comes first because coordinate and identity drift would invalidate every later unit and GPU
test. Its estimate is **1-2 work units**.

## Phase B: establish the BroMetal readback prerequisite

**Purpose:** obtain a supported renderer-general way to read a bounded target region asynchronously.

1. Check the latest published BroMetal package and current upstream TypeScript before designing a
   patch. The repository snapshot uses `0.17.2`; installed code alone is not the version check.
2. If the current release already exposes suitable readback, use the `team-brometal update` path and
   revalidate every exact-version local patch before adopting it.
3. If it remains absent, first add an exact-version failing regression against unpatched BroMetal. It
   must prove a pixel written earlier in the same submit/present path can be read, not merely return an
   old target value.
4. Add one version-guarded, idempotent local patch for a general asynchronous pixel or bounded-region
   readback primitive. Register it in the patch runner and its allowlist.
5. Open one focused upstream pull request against current BroMetal TypeScript in the same work. Put
   the PR URL and retirement conditions in the patch header.
6. Keep `EntityId`, Studio, selection, and alias lifetime out of BroMetal.

An upstream merge is not a prerequisite for Antiky because the local patch carries the work until a
released BroMetal version contains it. This phase is **2-3 work units**. It can expand if a BroMetal
upgrade forces revalidation or rewriting of the existing patch set.

## Phase C: build renderer-neutral 2D behavior

**Purpose:** deliver the issue-aligned position and camera behavior without coupling it to GPU objects.

1. Add immutable validated `Position2D` records and a private map-backed runtime store.
2. Keep caller-owned entity membership and durable records. Support deterministic `get`, `list`,
   position replacement, complete rebuild, monotonic sequence, and idempotent disposal.
3. Add `Camera2D` with orthographic projection, normalized/world conversion, pan, anchored zoom,
   stable-ID follow by caller-supplied presentation position, optional bounds, resize, and deterministic
   smoothing/reset behavior.
4. Emit plain numeric matrices and values. Do not import BroMetal, Studio, DOM types, or the runtime
   position store into the camera module.
5. Add host-owned one-frame semantic wheel intent for the runnable zoom proof. Keep pinch out.

This work can proceed beside Phase B after Phase A fixes coordinates. It is **2-4 work units**. Wheel
input is the likely expansion because it touches both development and website hosts plus copied
contract guards.

## Phase D: define Framework selection observation

**Purpose:** give the async driver result one temporary semantic home before Studio consumes it.

1. Add a small in-memory latest-request selection controller. It accepts only stable driver results.
2. Add the validated nested-version selection record as an optional `InspectionSnapshot` section.
3. Fence by request order, runtime identity, world identity, driver generation, current entity
   existence, and disposal. Do not reject only because ordinary world revision advanced.
4. Treat a valid latest no-hit as a clear. Treat an unmapped nonzero ID or readback failure as an
   error that preserves the prior selection.
5. Clear selection when the selected entity is removed or its runtime/world retires.

This phase is **1-2 work units** and can proceed beside B and C. It must finish before Studio UI work.

## Phase E: implement the GPU ID path in the BroMetal driver

**Purpose:** implement ADR 0022 without making the normal frame loop wait for GPU readback.

1. Add renderer-neutral pick request/result and instanced pick-description types, then expose an
   additional selection capability on `BroMetalRenderDriver`. Keep the three-method base
   `RenderDriver` unchanged unless a second driver proves that every driver needs the same method.
2. Make a synchronous selectable submission bind the visible frame to a deep-copied pick description,
   captured target size, and presentation sequence. A click captures that last-presented state before
   simulation advances; an on-demand ID pass replays it instead of picking the next frame.
3. Require one stable owner per declared instance and one reserved three-component
   `aEntityPickId` instance attribute. The driver validates the binding and counts, allocates the GPU
   IDs, injects the encoded values, owns the target, and retains each request-frame map.
4. Reserve `0` for no hit and allocate positive frame-local aliases. Prefer exact multichannel byte
   encoding in BroMetal's current `rgba16float` target only if real GPU tests prove the complete encode,
   store, read, and decode round trip. If that proof fails, stop, record it, amend the plan, and create
   a separate target-format regression, patch, and focused upstream PR. Do not widen the readback PR
   or lower identity correctness silently.
5. Keep normal and selectable submission synchronous. The selection extension reports an
   asynchronous stable-ID result separately; the simulation and presentation loops never await it.
6. Permit at most one active GPU read and one replaceable latest queued request. The active request
   retains its copied displayed-frame data and map; the queued request retains only its copied frame
   until promotion. Release superseded data and invalidate publication on disposal or device
   generation change.

This phase requires B and the contracts from A. It is **3-5 work units**. Exact target encoding and a
reliable GPU harness are the largest uncertainty.

## Phase F: use the existing transport and add Studio selection

**Purpose:** carry the stable Framework result to the existing semantic inspection consumer.

1. Compose optional selection into game inspection and validate it at local and serialized boundaries.
2. Reuse runtime snapshot publication, runtime-instance fencing, `DevelopmentSnapshotV2`, and Studio's
   existing coordinator polling. Add no selection endpoint, event stream, iframe `postMessage`, or MCP
   operation.
3. Derive Studio selection from `snapshot.inspection.selection`; do not duplicate an authoritative
   `selectedEntityId` in Studio coordinator state.
4. Reveal and highlight the exact hierarchy entity and show its label, stable ID, revision, and
   components. Distinguish unsupported, empty, stale, outside a bounded view, and inconsistent missing
   states.

This phase requires D but can proceed beside E with a validated synthetic stable result. It is **2-4
work units**. The existing transport is the small part; accessible reveal and missing/stale UI behavior
are the larger part.

## Phase G: complete the integrated proof

**Purpose:** prove that all cut points operate together in the real runtime.

1. Finish the dedicated 2D selection fixture with about 32 stable, selectable, opaque items, depth
   overlap, empty space, runtime position changes, drag pan, wheel zoom, follow, and resize.
2. Use the same presentation positions and geometry rules for visible draw, retained pick description,
   and camera follow. Consume each click and capture the displayed state before advancing simulation
   or submitting the next presentation.
3. Publish all selectable entities in `WorldInspection` so Studio can examine the selected item.
4. Prove visible item -> retained displayed-frame replay -> GPU pixel -> temporary GPU ID -> retained
   request-frame map -> stable `EntityId` -> Framework selection -> existing inspection -> Studio
   highlight and details.
5. Prove no-hit clear, rapid latest-click wins, resize/orientation, entity removal, and runtime reload
   clear. Prove pending-read reload fencing deterministically at the driver/selection seams.

This phase requires C, D, E, and F. It is **2-4 work units**. A real browser-to-Studio WebGPU test is
the most likely source of harness work or platform flakiness.

## Phase H: reconcile evidence and close the slice

**Purpose:** leave a truthful source-based capability statement.

1. Record real GPU and end-to-end evidence, including supported fidelity and any measured cost.
2. Update API documentation and architecture guides that still describe the first selection method as
   undecided. ADR 0022 remains the authority.
3. Record whether the narrow APIs stayed reusable and whether later package extraction has evidence.
4. Audit the BroMetal patch retirement state against the released dependency actually in use.
5. Do not turn closeout into an issue reply, release announcement, or npm publication.

This phase is **1 work unit** if the prior phases produced durable evidence.

## Effort range and assumptions

A **work unit** is one reviewable, test-backed implementation increment. It measures change scope,
not elapsed time or staffing. The phase ranges total approximately **14-25 work units**, expected to
become roughly **6-8 bounded goal-sized slices** during `create-goals`.

The range assumes:

- current BroMetal remains close enough to `0.17.2` that readback can be added without a renderer
  rewrite;
- the existing RGBA16F target can carry an exact tested temporary ID; if it cannot, a recorded plan
  amendment and separate target-format contribution will expand the work;
- the existing development snapshot path accepts a lockstep selection addition;
- the fixture can use opaque generated geometry; and
- a real WebGPU environment can be made reliable in repository tests.

The two largest blow-up risks are BroMetal readback/target behavior and the real WebGPU-to-Studio test
environment. If either assumption fails, preserve correctness and reduce scope elsewhere; do not
replace the required GPU proof with CPU selection.

## Deliberate exclusions

This strategy does not include:

- a general ECS, general `World` implementation, transform hierarchy, arbitrary component store,
  spatial index, persistence, or command/event system;
- CPU picking, CPU hit shapes, or CPU overlap policy as a completion requirement;
- durable selection/history, multi-select, hierarchy-to-canvas focus, or selection as gameplay input;
- MCP selection, feedback-queue work, a Studio editor camera, or detached scene editing;
- transparent blended-surface, alpha-perfect sprite, MSAA, touch, pinch, general 3D, or 2.3D picking;
- retrofitting every demo, changing Town into a 2D canal example, or publishing the fixture on the
  website;
- npm publication, a new companion package, release/version promises, or independent install proof;
- the requester's canal application, external support, issue/Discord outreach, or BroMetal ecosystem
  endorsement;
- BroMetal orthographic/inverse math, the separate perspective-depth candidate, or a new renderer
  abstraction.

These exclusions are not claims that the work has no value. They protect the complete GPU-to-entity-
to-Studio result from being replaced by adjacent infrastructure or product work.
