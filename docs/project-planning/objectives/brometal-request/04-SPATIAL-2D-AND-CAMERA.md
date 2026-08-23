# Spatial 2D state and camera

This document selects the renderer-neutral position and camera slice. It describes a narrow runtime
position projection plus an orthographic camera; it does not create a general entity system or claim
that position alone is a complete transform model.

## Evidence and constraint

Framework already has stable `EntityId` values (`packages/framework/src/identity/ids.ts:10-21,94-126`),
and the point-light service proves that a small private ID-keyed map can return immutable state
(`packages/framework/src/point-light/service.ts:259-319`). The only current reusable-looking position
value is still coupled to point-light records (`packages/framework/src/point-light/records.ts:1-27`).
The generic world types are validated inspection projections, not a mutable state implementation
(`packages/framework/src/inspection/world.ts:21-117,267-415`).

Framework ADR 0001 permits specialized private maps and forbids prematurely selecting a general ECS.
ADR 0009 separates authoring, runtime, and render data. Those decisions rule out using an inspection
DTO as state and rule out building a generic `World` merely to hold this fixture.

## State shapes considered

### Caller-owned array plus pure helpers

This is the smallest code shape. It leaves every consumer to repeat copying, immutable reads,
sequence, deterministic listing, rebuild, and disposal behavior. It also gives Framework no reusable
runtime tracking behavior, which is one of the issue-aligned needs.

### Small Framework runtime position store

This is selected. The caller owns entity creation, removal authority, labels, durable data, and any
rotation/scale/shape values. Framework copies the current positions for known stable IDs into a
specialized runtime store. The store can later be replaced behind its feature boundary without
changing identity.

### General transform registry or ECS

This would decide hierarchy, local/world composition, arbitrary component storage, queries,
commands, persistence, and lifecycle before any of them is required. It is rejected.

The selected store costs more than pure functions because it must validate, copy, order, sequence,
rebuild, and dispose state. Its narrow surface and API-surface tests are the guard against becoming a
parallel `World`.

## Position record and store

The expected module home is an existing Framework source area such as
`packages/framework/src/spatial-2d/`; it is not a new npm package. The public record is versioned and
contains only:

```ts
type Position2DRecordV1 = Readonly<{
  schemaVersion: 1;
  entityId: EntityId;
  position: readonly [number, number];
}>;
```

The exact spelling can follow repository conventions, but the behavior is fixed:

- accept only canonical existing Framework `EntityId` values and finite XY numbers;
- copy caller input and return frozen records so later caller mutation cannot change retained state;
- support `get`, deterministic `list`, insert-or-replace position, explicit removal, complete rebuild,
  and idempotent disposal;
- order `list` by stable `EntityId`, not incidental map insertion history;
- increment one monotonic runtime sequence only when retained state changes;
- reject duplicate IDs in a complete rebuild;
- remove rows absent from a complete rebuild without retaining references;
- reject mutation after disposal; and
- belong to the production world's simulation state, with `EngineSession` controlling lifecycle and
  disposal (`packages/framework/src/sessions/engine-session/contract.ts:37-50,165-179`); and
- permit standalone construction only as a test or pure-helper seam, not as a second production
  authority.

The store does not create or validate entity membership beyond the supplied ID. The authoritative
world can rebuild it through private session-owned runtime code. Internal fixed-step systems can
replace positions without a command for every movement, as permitted by Framework ADR 0007. Studio,
agents, gameplay clients, services, and other external callers must use versioned commands for any
important world change; this store is not an external write API.

Frequent position changes, camera state, selection, and render state remain temporary by default under
Framework ADR 0002. This slice does not emit durable events for frame-by-frame movement or camera
updates.

The store must not expose:

- generic entity creation or deletion;
- rotation, scale, hierarchy, parent/child composition, or arbitrary components;
- authoring persistence, commands, events, queries, or spatial indexing;
- interpolation policy; or
- GPU IDs, render pipelines, BroMetal objects, or Studio state.

The fixture keeps its additional visual values in its own records. This is a deliberate cost: a later
consumer that proves shared rotation or scale will need a later, named extension instead of finding
unstated semantics in this API.

## Camera contract

`Camera2D` is a renderer-neutral stateful controller with pure conversion outputs. It must not import
BroMetal, the DOM, Studio, or the position store.

Canonical state is:

```text
center: [x, y]
viewHeight: positive world-unit span
followEntityId: EntityId | null
followOffset: [x, y]
optional bounds: min/max XY
follow smoothing state
```

The public operations must cover:

- read/reset camera state;
- `worldToViewport` and `viewportToWorld` without clamping;
- a plain column-major orthographic view-projection matrix;
- pan from a normalized viewport delta;
- `zoomBy(factor, anchor?)`, with a factor greater than one magnifying the view;
- begin and clear follow by stable `EntityId`;
- update follow from a caller-resolved presentation position and explicit delta time;
- apply or replace optional bounds; and
- update viewport width and height for aspect changes.

### Coordinate and resize behavior

- World space is XY with positive Y upward.
- Normalized viewport space is bottom-origin with centre `[0.5, 0.5]`.
- `viewHeight` is independent of CSS size and device-pixel ratio.
- Visible width is `viewHeight * viewportWidth / viewportHeight`.
- Resize preserves centre and visible height; it recomputes visible width.
- Conversion functions keep off-screen values instead of clamping them.
- The emitted matrix and conversion functions must agree at centre and all four corners.

### Pan and zoom behavior

- A content drag moves the camera centre opposite the drag.
- Manual pan clears follow explicitly.
- Anchored zoom preserves the world point under the supplied normalized anchor.
- Missing anchors use viewport centre.
- Constructor options provide positive minimum and maximum visible heights. Invalid or reversed bounds
  fail immediately rather than allowing a singular projection.

### Follow behavior

- The camera stores the stable follow identity but does not own entity lookup.
- Every smoothing update receives delta time as an explicit argument. It does not read a system clock,
  which applies Framework ADR 0013 to this presentation-time behavior.
- The caller supplies the same presentation position used by visible and pick draws. Town's existing
  interpolation regression shows why following fixed simulation state while drawing interpolation is
  incorrect (`packages/demos/antiky/antiky-town/tests/render-interpolation.test.ts:13-26`).
- Follow uses frame-rate-independent exponential easing. Use a documented default half-life of 0.1
  seconds and allow construction-time override.
- First update, explicit reset, target replacement, missing-to-present transition, or an update gap
  greater than 0.25 seconds snaps to the target rather than easing from stale state.
- A missing followed identity leaves the current centre in place and reports no fabricated position.
  The caller can clear or retry follow.
- Optional bounds clamp the visible rectangle after follow. If the view is wider or taller than a
  bounded axis, centre that axis within the bounds.

Existing Traversal and Combat camera code proves the exponential technique but remains game-specific
(`packages/demos/antiky/traversal-study/src/presentation.ts:66-87` and
`packages/demos/antiky/combat-arena/src/presentation.ts:243-253`). The new module reimplements the
small earned behavior; it does not extract an entire demo rig.

## Host interaction contract

The camera consumes semantic values only. The host owns these raw-event corrections:

1. `pointerdown` calculates and clamps normalized XY from that event before it signals activation.
2. The game receives a nested immutable one-frame click sample, or an equivalent explicit XY pair,
   so a later `pointermove` cannot change the requested pixel.
3. Existing drag deltas remain bottom-origin normalized values and reset after each presented frame.
4. A canvas wheel listener normalizes `deltaMode` and `deltaY` into one bounded, one-frame semantic
   zoom intent. It prevents page scroll only while the game canvas owns the interaction.
5. The CLI development host and website demo host implement the same semantic contract. Generated
   Studio project-service output is rebuilt and verified from source.

The current game input has no zoom field (`packages/framework/src/game/contract.ts:20-29`), and the
current host sets `clicked` without refreshing position (`packages/cli/src/host/game-server.ts:419-438`).
Tests must demonstrate both defects before the code changes, as required by repository instructions.

Pinch, multipointer gestures, inertial pan, and gesture arbitration are not hidden inside this work.
The first fixture treats activation as selection and held-pointer drag as pan; it does not invent a
click-release threshold.

## Presentation and render extraction

The fixture creates one immutable presentation list per displayed frame. That list contains stable
entity ownership, presentation positions, and fixture-owned visual data. Both visible and pick draw
preparation consume that list. The camera follow resolver also reads it.

This ordering prevents three sources of truth:

```text
runtime Position2D store
        -> presentation interpolation/projection
                -> camera follow position
                -> visible numeric draw data
                -> pick numeric draw data + stable entity ownership
```

Temporary GPU IDs do not flow backward into the store, camera, or presentation records.

## Required tests

### Position store

- valid and invalid schema, ID, finite coordinates, duplicate rebuild IDs, and unknown fields;
- caller mutation cannot change stored values;
- create/replace/remove/get/list and deterministic order;
- no-op versus real-change sequence behavior;
- complete rebuild removes obsolete rows;
- missing ID behavior and idempotent disposal;
- mutation after disposal; and
- public API surface has no generic component/entity writer or fixture capacity.

### Camera

- centre and four corners in landscape, portrait, and square viewports;
- world -> viewport -> world round trips, including off-screen values;
- resize preserves centre and `viewHeight`;
- pan direction and distance;
- anchored zoom invariant and min/max clamping;
- follow identity, offset, missing target, pan detach, reset, replacement, and long-gap snap;
- equivalent results for equal elapsed time divided into 30, 60, and 120 updates;
- bounds when the view is smaller and larger than the bounded world; and
- matrix projection agrees with the conversion helpers.

### Input and integration

- `pointerdown` samples its own CSS coordinate before movement;
- outside/captured input clamps consistently;
- wheel modes normalize to bounded semantic intent and reset once per frame;
- CSS, drawing-buffer, device-pixel-ratio, edge, and Y-orientation cases agree;
- visible and pick draws use the same presentation position; and
- camera follow uses that presentation position.

Existing Framework import-boundary tests must continue to prove that spatial and camera modules are
headless and renderer-neutral (`packages/framework/tests/import-boundary.test.mjs:27-65,79-90`).

## Explicitly not covered

This slice does not add a general transform, scene graph, ECS, dynamic entity service, spatial query,
CPU hit test, Studio editor camera, project/unproject for arbitrary 3D planes, BroMetal camera wrapper,
or BroMetal `mat4.orthographic` contribution. Renderer-general orthographic math can be proposed later,
but it does not block the small Framework implementation.
