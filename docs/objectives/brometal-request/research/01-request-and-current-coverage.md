# Request and current capability coverage

**Research snapshot:** 2026-08-14 America/Chicago

This document compares [BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8)
with BroMetal `0.17.2`, Antiky's committed source, accepted ADRs, tests, and current release surface.
The raw evidence is retained in
[`subagent_outputs/00-issue-brometal-surface.md`](subagent_outputs/00-issue-brometal-surface.md),
[`subagent_outputs/01-entity-transform-coverage.md`](subagent_outputs/01-entity-transform-coverage.md),
[`subagent_outputs/02-picking-selection-coverage.md`](subagent_outputs/02-picking-selection-coverage.md),
and [`subagent_outputs/03-camera-coordinate-coverage.md`](subagent_outputs/03-camera-coordinate-coverage.md).

## Evidence labels

- **Established** means verified in primary source, accepted ADR, executable test, installed package,
  or dated registry/API result.
- **Claimed** means asserted in an issue comment or direction document but not demonstrated by the
  current released surface.
- **Inferred** means a conclusion drawn from established evidence. It is not implemented behavior.

## What the requester actually proposed

**Established — issue author.** The requester is building a 16-bit canal visualization with a few
dozen clickable ships and a follow camera. They are considering a separate, opt-in helper that does
not change BroMetal's render path and that supplies:

1. lightweight position or transform tracking;
2. pointer-event-to-entity picking; and
3. a simple 2D pan, zoom, and follow camera.

They ask whether that companion belongs in the BroMetal ecosystem. They say that they intend to
build and share it; they do not ask BroMetal or Antiky to implement it for them.

**Inferred minimum contract.** The narrowest useful interpretation is a caller-supplied entity key,
a mutable 2D transform registry, a camera with center and zoom plus optional follow, viewport/world
conversion, and bounded hit testing that returns the registered key. The issue does not establish a
need for UUIDs that survive reloads, an ECS, hierarchy, events, Studio selection, physics, spatial
indexing, or GPU picking.

**Gap.** The issue does not define rotation, scale, transform hierarchy, object shapes, overlap
priority, alpha/depth fidelity, pan gestures, zoom anchoring, follow damping, bounds, serialization,
or the package API. Those details cannot be treated as requirements yet.

## What BroMetal and Antiky have answered

**Established.** The issue was open with one comment at the research snapshot. The commenter,
`shadowcodex`, had GitHub association `CONTRIBUTOR`; npm listed `ericdrowell` as the BroMetal package
maintainer. No listed BroMetal maintainer had answered the ecosystem or ownership question. See the
[issue API](https://api.github.com/repos/ericdrowell/brometal/issues/8),
[comments API](https://api.github.com/repos/ericdrowell/brometal/issues/8/comments), and
[comment](https://github.com/ericdrowell/brometal/issues/8#issuecomment-5299608314).

**Claimed — contributor comment.** The comment says that Antiky Framework and Studio are building
something similar, provide parts of the requested behavior, are open source, and were planned for a
weekend release. It gives no API, install command, demo, test, or release artifact.

**Resolved comparison.** The claim is directionally true but operationally overstated:

- **Established:** Antiky has stable entity identity, normalized pointer state, immutable
  position values, inspection DTOs, rendering contracts, and several working camera-follow
  implementations.
- **Established:** Antiky does not have a reusable general tracker, pointer-to-entity hit path,
  reusable 2D camera, or installable Framework package.
- **Inferred:** Antiky is building foundations in the same problem area, but it cannot truthfully
  tell an external BroMetal user that the requested helper already exists.

## Capability matrix

| Requested need | BroMetal `0.17.2` | Antiky committed/source surface | Assessment |
| --- | --- | --- | --- |
| Lightweight entity identity | No entity or scene ownership API. | Branded UUIDv7 `EntityId` creation and parsing are implemented, tested, and root-exported in source. | **Partial:** stable identity exists only in Antiky. |
| Track a few dozen transforms | Matrices and per-instance attributes exist, but no transform registry, lifecycle, or query API. | A position-only immutable `Transform` is coupled to point-light records. The point-light service uses a private ID-keyed map, while generic world/entity/component types are inspection-only DTOs. | **Missing as reusable behavior.** A caller must still own collection, create/remove/update, and queries. |
| Pointer input | The renderer exposes its canvas; examples attach DOM listeners directly. | The host maps pointer movement to normalized bottom-origin coordinates and supplies down, active, click, and drag state. Five copied demo contracts expose only `x/y`; `pointerdown` does not capture a fresh immutable click position. | **Partially implemented:** input exists, reliable semantic click sampling needs a bounded correction. |
| Pointer to scene/world | BroMetal exposes world-to-view and perspective view-projection, but no inverse, project/unproject, ray, or viewport abstraction. | Demos repeat private matrix math and camera-relative direction helpers. No public conversion API exists. | **Missing.** |
| Scene/world to stable entity | No public picking, hit-test, readback, or entity-mapping API. Off-screen textures internally use `COPY_SRC`, but no public readback exists. | No semantic hit testing exists. Generic draw calls carry no owner or per-instance pick ID; point lights demonstrate only a feature-specific stable-ID-to-slot mapping. | **Missing.** |
| Selection and inspection | Outside BroMetal's current scope. | World snapshots retain stable IDs, but there is no selection record, generic entity lookup, canvas/hierarchy convergence, or MCP get/set/clear selection. | **Not required for the issue minimum; missing for the larger Studio direction.** |
| 2D projection | `createCamera` is a reusable perspective camera. The shipped 2D example writes its own orthographic matrix because `mat4.orthographic` is absent. | Town has a private orthographic shadow-light helper, not a reusable player camera. Framework exports no camera module. | **Missing as public 2D camera behavior.** |
| Pan and zoom | Absolute perspective pose and FOV setters are available. | The host has drag deltas, but no camera consumes them. The pointer contract has no wheel/pinch value; generated docs incorrectly claim wheel input. | **Missing as composed behavior.** |
| Follow and damping | Examples implement follow locally around the perspective camera. | Traversal, Combat Arena, and Town contain different working follow/easing implementations tied to game state. | **Proven ingredients, no reusable contract.** |
| Render independence | BroMetal's current public surface is a small compiler/runtime with no scene graph. | Accepted host/game and driver boundaries permit renderer-neutral state and input behavior. | **Good architectural fit:** the helper need not change BroMetal's render path. |
| External installation | BroMetal is published at `0.17.2`. | `@antiky/framework` is private, version `0.0.0`, source-only, and absent from npm and GitHub releases at the snapshot. | **Not externally consumable as a supported package.** |

## Important implementation facts

### Entity and transform coverage

**Established.** `packages/framework/src/identity/ids.ts` implements canonical UUIDv7 entity IDs.
`packages/framework/src/point-light/records.ts` implements an immutable three-number position, but
its type, documentation, and validation error remain coupled to the point-light vertical slice.
`packages/framework/src/point-light/service.ts` proves that a small private ID-keyed map is viable,
but its public operations are point-light reads and power changes, not generic lifecycle or
transform updates.

**Established direction, not implementation.** Framework ADR 0001 requires stable entities,
versioned components, typed relationships, systems, and queries while rejecting a premature general
ECS. The world/session architecture still leaves storage and query layout open. This request is
evidence for a small map-backed slice, not permission to fill in the whole future world model.

### Picking coverage

**Established.** The implemented path stops after host pointer normalization. There is no shared
screen/world conversion, selectable registry, hit test, stable draw-owner mapping, selection state,
or generic selected-entity inspection. Existing demo clicks trigger jump, interact, or aim; none
selects a rendered entity.

**Claimed architecture.** Rendering and Studio guides describe future owner mappings and a shared
selection service, but they explicitly leave the first canvas-selection method undecided. They
cannot be counted as product coverage.

### Camera coverage

**Established.** BroMetal supplies a headless, allocation-conscious perspective camera. Antiky
supplies normalized pointer input, resize behavior, generic matrix uniforms, and multiple tested
follow/damping examples. Those parts are independently owned and have not converged into a 2D
camera module. Framework ADR 0004 requires equal 2D, 3D, and 2.3D support, so this is an
implementation gap rather than a direction mismatch.

**Established formula mismatch; inferred defect candidate.** Inspected BroMetal `0.17.2` code uses
an OpenGL-style perspective-depth formula, while Antiky's local WebGPU projection uses and tests a
`0..1` depth mapping. Classifying this as a BroMetal defect and upstreaming a correction still
requires an authoritative WebGPU reference and a failing exact-version BroMetal regression. It is
separate from the requested 2D helper.

## Open evidence

- The BroMetal maintainer has not said whether a separately owned companion is welcome.
- The requester has not said whether they would adopt an Antiky implementation.
- Their BroMetal version, bundler, coordinate convention, hit shapes, fidelity needs, and support
  expectations are unknown.
- No independent external project has installed the Framework source folder or a packed artifact.
- No end-to-end proof covers pointer input through stable entity identity.
- No reusable 2D-camera proof covers pan, zoom, follow, coordinate round trips, and resize.
