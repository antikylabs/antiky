# Minimum slice and technical options

This document identifies the smallest behavior supported by the evidence and compares bounded
technical shapes. It does not select an implementation plan. Detailed inputs are in the raw
[`entity`](subagent_outputs/01-entity-transform-coverage.md),
[`picking`](subagent_outputs/02-picking-selection-coverage.md), and
[`camera`](subagent_outputs/03-camera-coordinate-coverage.md) reports. The owner-directed selection
scope is in the
[`GPU-to-Studio re-audit`](subagent_outputs/05-gpu-framework-studio-trace.md).

## Required Antiky integration

**Established scope distinction.** The external issue asks for click-to-entity behavior but does not
require a GPU or Studio. The owner selected a broader Antiky result because Studio must identify the
Framework entity behind a clicked rendered item. The required acceptance path is:

```text
selectable Framework EntityId
        ↓
lifetime-local numeric render ID
        ↓
BroMetal GPU object-ID pass
        ↓
asynchronous clicked-pixel readback
        ↓
same-frame render ID → stable EntityId lookup
        ↓
temporary Framework selection
        ↓
development inspection transport
        ↓
Studio hierarchy selection and entity inspection
```

The transform and 2D-camera behavior can remain independent of BroMetal objects. The GPU selection
path cannot. It requires the Framework BroMetal driver, stable Framework identity, temporary
selection state, inspection transport, and Studio. It does not require completing a general ECS,
publishing an npm package, adding MCP operations, or taking ownership of the canal application.

**Established reusable inputs.** Antiky can reuse its stable ID implementation, semantic pointer
shape, immutable-value and bounded-validation practices, ordered render passes, numeric per-instance
data, inspection transport, headless testing seams, and frame-rate-independent exponential damping
pattern. Point lights already prove a feature-specific stable-ID-to-render-slot map. Town proves a
real multi-pass frame through the Framework BroMetal driver.

**Established non-reusable inputs.** The point-light service is not a general tracker. Inspection
DTOs are read-only projections, not state ownership. `EngineSession` is orchestration, not an entity
store. Demo cameras are game-specific. The current driver has no pick result boundary or readback,
and Studio has no selected-entity state or canvas-selection bridge.

## Tracker shapes to evaluate later

| Shape | What it owns | Advantages | Risks and limits |
| --- | --- | --- | --- |
| **Caller-owned records plus pure helpers** | The caller owns keys, lifecycle, and transform collection. Antiky supplies validation, camera/conversion, and hit-test functions over bounded records. | Smallest dependency and closest to “helper, not framework.” No generic world model is invented. | Each consumer can repeat lifecycle and indexing policy. Inspection and future authoring/runtime projection require adapters. |
| **Tiny Framework-owned spatial registry** | A private map owns add/remove/replace/list/get for stable key to 2D transform/selectable shape. Camera and inspection remain separate. | Gives one complete, testable boundary and a natural stable-key return from picking. A fixture of roughly a few dozen objects matches the external issue. | It must be specialized entity-associated storage and explicitly authoring or runtime state. Identity, mutation, rotation/scale, ordering, and errors become product policy; it can accidentally grow into a parallel ECS. |
| **General Framework `World`/ECS first** | Entities, components, relationships, queries, projections, selection, and sessions. | Aligns with long-term architecture vocabulary. | The issue does not require it; storage and query design remain open; it delays the useful slice and violates the project's proof-before-abstraction direction. |

**Inferred assessment.** The first two tracker shapes remain credible. Completing a general `World`
or ECS is not a prerequisite for the proof. Any Framework-owned tracker must still use stable
Framework entities and must not create a parallel identity model.

## Picking options

### Bounded CPU hit testing

**Inferred mechanism.** Convert the click sample to world space or project selectable shapes to
screen space, scan a bounded list, apply visibility and a deterministic topmost rule, and return the
record's stable key.

**Comparison value.** The issue says “a few dozen” objects. An `O(n)` scan on click can be tested
headlessly and is a credible technique for that external helper. It does not trace a rendered GPU
item to its Framework entity, so it does not satisfy this Antiky objective by itself.

**Limits.** Declared rectangles, circles, or polygons can be exact for their contract but may differ
from transparent sprite pixels, irregular meshes, culling, blend order, or depth. Camera conversion,
selectable bounds, visibility, and the tie-break must be authoritative rather than duplicated
approximately across systems.

### GPU object-ID picking

**Inferred mechanism.** Render a temporary numeric alias for each selectable draw or instance,
read the clicked pixel asynchronously, and resolve the lifetime-scoped alias back to a stable ID.

**Established current ingredients and gaps.** The render contract can carry arbitrary numeric
per-instance values, ordered off-screen passes, depth, one sample, and nearest filtering. Town proves
the Framework driver with a real frame. Draws still have no semantic owner or first-class pick ID.
BroMetal `0.17.2` creates off-screen textures with internal `COPY_SRC` use but exposes no public
pixel readback. The ID path therefore still needs a pick target and pipelines, stable owner mapping,
retained same-frame alias data, stale-result handling, and a supported readback boundary.

**Why the owner selected it.** A GPU ID can follow the rendered geometry, culling, and depth when
the pick pass applies the same relevant rules. More importantly, it proves the exact trace Studio
needs: rendered item to stable Framework entity.

### Comparison

| Concern | Bounded CPU | GPU object ID |
| --- | --- | --- |
| Current fit | No renderer change; missing spatial data and conversion only | Render-pass ingredients exist; semantic ownership, pick pass, readback, and alias lifetime are missing |
| Fixture cost | Small inferred cost; must measure | Extra pass and asynchronous GPU-to-CPU transfer |
| Fidelity | Exact for declared shapes | Potentially matches rendered geometry/depth |
| Proof | Deterministic headless tests plus one visual integration | GPU integration, format, async, stale-frame, MSAA/blend, and device-loss tests |
| Stable identity | Carry the stable key directly | Numeric pixel is temporary; ADR 0011 requires immediate reverse mapping |

**Established owner direction.** GPU object-ID picking is the required Antiky path. CPU hit testing
can remain a comparison, test oracle, or separate helper option. It is not the completion path for
this objective.

## Camera shapes and ownership

### Renderer-neutral Antiky camera

**Inferred shape.** Own canonical 2D state—viewport size, center, zoom, optional target, bounds, and
delta time—and expose projection plus world/viewport conversions as plain numeric values. Accept
semantic pan/zoom intent; do not own DOM listeners. Emit a matrix that the existing render contract
or direct BroMetal code can consume.

This shape reuses the proven easing technique without extracting any demo rig wholesale. It also
avoids wrapping an externally mutated BroMetal `Camera`, which has setters but no pose or lens
getters.

### General BroMetal math plus Antiky policy

**Inferred ownership split.** Renderer-general math may belong upstream; entity targeting and
interaction policy remain in Antiky:

| Candidate | Ownership implication | Evidence status |
| --- | --- | --- |
| `mat4.orthographic` | Strongest small BroMetal candidate; its own shipped 2D example hand-writes it. | **Inferred upstream fit; no maintainer approval.** |
| Correct WebGPU perspective depth | BroMetal correctness defect candidate, separate from 2D behavior. | **Established mismatch in `0.17.2`; requires exact-version failing test before patching.** |
| Matrix inversion / project / unproject | General math can help several renderer users. A fixed-plane 2D helper can also own simpler conversion. | **Inferred candidate; need a second use or maintainer direction.** |
| Render-target readback | General renderer capability required by the selected GPU path. | **Verify current BroMetal; patch locally and contribute upstream if it is still absent.** |
| Follow, damping, dead zones, bounds, entity target resolution | Product and game policy. | **New Antiky behavior if Antiky owns the slice.** |

ADR 0021 permits a focused upstream BroMetal contribution only when it helps renderers generally or
corrects an error. The `team-brometal` workflow additionally requires a version check, failing
regression test, narrow contribution, and later patch retirement. No patch is justified merely to
host Antiky scene policy.

## Input and coordinate contract gaps

These are small but must be explicit before implementation planning:

1. CSS pixels, device pixels, or normalized input at the helper boundary.
2. World plane, origin, positive Y direction, and units per screen unit.
3. Whether pointer coordinates clamp outside the canvas.
4. A click-time position snapshot; current `pointerdown` can use stale coordinates until movement.
5. Programmatic-only zoom versus wheel and pinch input. The real pointer type has neither wheel nor
   pinch even though generated prose claims wheel coverage.
6. Camera-centered versus pointer-centered zoom.
7. Manual pan while following: disable follow, offset it, or snap back.
8. Bounds, dead zone, reset, long-frame, and damping behavior.

## Required integration proof

The deliverable is checked-in Framework behavior, automated tests, and one runnable Antiky/BroMetal
integration example. It is not a package or release version. The proof must include:

- roughly a few dozen selectable objects, matching the issue's fixture scale without creating a
  product limit;
- stable Framework `EntityId` values for the selectable objects;
- a temporary numeric ID for each selectable draw or instance in one rendered frame;
- a retained map from those numeric values to stable IDs until readback completes;
- a GPU object-ID pass that follows the visible depth and relevant discard rules;
- asynchronous readback of the clicked pixel and rejection of stale results;
- a temporary Framework selection record for the resolved stable ID;
- inspection transport that carries the selection to Studio;
- Studio hierarchy highlighting and inspection of the same entity;
- 2D pan, zoom, follow, resize, and world/screen conversion behavior.

Verification needs four levels: headless alias and selection tests, driver contract tests, a real GPU
readback test, and a browser-to-Studio end-to-end test. A general ECS, npm publication, MCP support,
and the canal application are not prerequisites.

## Remaining gaps

- BroMetal `0.17.2` has no public readback. The plan must check the current release before defining a
  local patch and upstream contribution.
- The pick target format, no-hit value, coordinates, alpha/discard behavior, and asynchronous error
  behavior are not implemented.
- No generic render-ID allocator retains its reverse map until a readback completes.
- Town's rendered actors and props do not all map to retained Framework inspection entities.
- Framework has no temporary selection record, and Studio has no selected-entity UI.
- The implementation plan must choose and document the 2D coordinate and camera behavior. This is
  an engineering choice, not owner homework.
- No end-to-end proof covers the complete GPU-to-Framework-to-Studio path.
