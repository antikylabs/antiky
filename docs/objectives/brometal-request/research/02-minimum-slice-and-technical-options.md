# Minimum slice and technical options

This document identifies the smallest behavior supported by the evidence and compares bounded
technical shapes. It does not select an implementation plan. Detailed inputs are in the raw
[`entity`](subagent_outputs/01-entity-transform-coverage.md),
[`picking`](subagent_outputs/02-picking-selection-coverage.md), and
[`camera`](subagent_outputs/03-camera-coordinate-coverage.md) reports.

## Smallest useful slice

**Inferred from the issue and current code.** A useful first slice can remain renderer-neutral and
session-optional:

```text
caller-owned stable key
        ↓
bounded entity ↔ 2D transform records
        ↓
2D camera center/zoom/follow + viewport/world conversion
        ↓
click sample + selectable shape + deterministic overlap rule
        ↓
the same stable key
```

It does not require a scene graph, general ECS, render graph, GPU readback, Studio, MCP, inspection,
or command history. A pure helper can remain outside Framework state projections. If Framework owns
a mutable spatial registry, ADR 0009 requires classifying it as authoring or runtime state and
keeping later projections separate; ADR 0001 requires specialized entity-associated storage rather
than a parallel entity model.

**Established reusable inputs.** Antiky can reuse its stable ID implementation, semantic pointer
shape, immutable-value and bounded-validation practices, headless testing seams, and
frame-rate-independent exponential damping pattern. BroMetal can already consume a plain
view-projection matrix and remains outside entity/input policy.

**Established non-reusable inputs.** The point-light service is not a general tracker. Inspection
DTOs are read-only projections, not state ownership. `EngineSession` is orchestration, not an entity
store. Demo cameras are game-specific. The BroMetal driver has no role in the issue's minimum
render-independent helper.

## Tracker shapes to evaluate later

| Shape | What it owns | Advantages | Risks and limits |
| --- | --- | --- | --- |
| **Caller-owned records plus pure helpers** | The caller owns keys, lifecycle, and transform collection. Antiky supplies validation, camera/conversion, and hit-test functions over bounded records. | Smallest dependency and closest to “helper, not framework.” No generic world model is invented. | Each consumer can repeat lifecycle and indexing policy. Inspection and future authoring/runtime projection require adapters. |
| **Tiny Framework-owned spatial registry** | A private map owns add/remove/replace/list/get for stable key to 2D transform/selectable shape. Camera and inspection remain separate. | Gives one complete, testable boundary and a natural stable-key return from picking. A few-dozen-object map matches current evidence. | It must be specialized entity-associated storage and explicitly authoring or runtime state. Identity, mutation, rotation/scale, ordering, and errors become product policy; it can accidentally grow into a parallel ECS. |
| **General Framework `World`/ECS first** | Entities, components, relationships, queries, projections, selection, and sessions. | Aligns with long-term architecture vocabulary. | The issue does not require it; storage and query design remain open; it delays the useful slice and violates the project's proof-before-abstraction direction. |

**Inferred assessment.** The first two shapes are credible. The general `World` shape is not
supported by this request. A working caller-owned cut can prove semantics before promotion; a tiny
registry is justified only if the proof needs lifecycle ownership or a second Antiky consumer.

## Picking options

### Bounded CPU hit testing

**Inferred mechanism.** Convert the click sample to world space or project selectable shapes to
screen space, scan a bounded list, apply visibility and a deterministic topmost rule, and return the
record's stable key.

**Why it fits the stated case.** The issue says “a few dozen” 2D objects. An `O(n)` scan on click
avoids GPU synchronization and can be tested headlessly. This is a fit inference, not a measured
performance result; the proof should measure its actual object count and click frequency.

**Limits.** Declared rectangles, circles, or polygons can be exact for their contract but may differ
from transparent sprite pixels, irregular meshes, culling, blend order, or depth. Camera conversion,
selectable bounds, visibility, and the tie-break must be authoritative rather than duplicated
approximately across systems.

### GPU object-ID picking

**Inferred mechanism.** Render a temporary numeric alias for each selectable draw or instance,
read the clicked pixel asynchronously, and resolve the lifetime-scoped alias back to a stable ID.

**Established blockers.** Antiky's generic draw contract has no owner or per-instance pick alias.
BroMetal `0.17.2` creates off-screen textures with internal `COPY_SRC` use but exposes no public
pixel readback. An ID path therefore needs render-contract changes, a pick target and pipelines,
alias lifetime fencing, asynchronous error/stale-frame behavior, and a supported readback boundary.

**Potential value.** It can match rasterized geometry, culling, and depth if the pick pass reproduces
alpha/discard and ordering correctly. That fidelity is not an established issue requirement.

### Comparison

| Concern | Bounded CPU | GPU object ID |
| --- | --- | --- |
| Current fit | No renderer change; missing spatial data and conversion only | Missing render ownership, aliases, pick pass, and public readback |
| Few-dozen 2D cost | Small inferred cost; must measure | Extra pass and GPU-to-CPU synchronization |
| Fidelity | Exact for declared shapes | Potentially matches rendered geometry/depth |
| Proof | Deterministic headless tests plus one visual integration | GPU integration, format, async, stale-frame, MSAA/blend, and device-loss tests |
| Stable identity | Carry the stable key directly | Numeric pixel is temporary; ADR 0011 requires immediate reverse mapping |

**Inferred research direction.** CPU bounds are the lower-risk proving method for the stated case.
This is not a final selection. If the owner requires pixel-accurate occlusion or transparent-sprite
semantics, that requirement changes the comparison and may justify GPU evaluation.

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
| Render-target readback | General renderer capability only if GPU picking or diagnostics proves it necessary. | **No action for the minimum CPU path.** |
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

## A common acceptance fixture

**Inferred research recommendation.** Competing shapes should be evaluated against the same small
fixture rather than different demos:

- a bounded set of overlapping 2D entities with stable keys and explicit shapes;
- add, move, remove, and list/get behavior if the registry owns lifecycle;
- pan, zoom, follow, reset, bounds, and aspect-ratio changes;
- world-to-screen-to-world round trips;
- one click that deterministically returns the expected stable key;
- no browser, GPU, EngineSession, Studio, or inspection dependency in the core test;
- one real BroMetal integration that consumes the resulting matrix and identity result.

If shared Studio selection later enters scope, it should reuse the same picked stable key through a
separate selection service and transport proof. It should not enlarge the initial game-side helper
by default.

## Remaining gaps

- The implementation plan still needs to choose simple, documented 2D coordinates and camera
  behavior. This is an engineering choice, not owner homework.
- The requester has not stated whether simple hit shapes are sufficient, so the first plan should
  use them as the smallest working default.
- No benchmark or end-to-end proof exists for either picking option.
- No current Antiky-owned 2D demo proves the entire slice.
- No second independent consumer has established whether a registry or pure-helper boundary is the
  stable reusable cut.
