# BroMetal request

<!-- Generated. Regenerate when a phase completes. -->

**Phase:** Planning
**Started:** 2026-08-14

The owner asked whether Antiky already covers the needs discussed in BroMetal issue #8, whether
Framework is a good fit, and whether implementation should be planned. The plan now calls for one
Antiky-owned proof: reusable 2D position and camera behavior plus a real displayed-pixel -> GPU ID ->
stable Framework `EntityId` -> Studio selection trace. The owner's original words and concerns remain
unchanged in [`objective.md`](objective.md).

## Needs the owner

Nothing blocks `create-goals` or the internal implementation proof. External issue communication,
package publication, support promises, and broader bidirectional selection remain later owner choices;
they do not block this plan.

| # | What | Blocks |
| --- | --- | --- |
| - | None | Nothing blocks `create-goals`. |

## Plan documents

| # | Document | What it decides |
| --- | --- | --- |
| 00 | [`Capability diagnosis`](00-CAPABILITY-DIAGNOSIS.md) | Separates current ingredients, actual gaps, the external issue, and the owner-required Antiky result. |
| 01 | [`Selection and spatial vocabulary`](01-SELECTION-AND-SPATIAL-VOCABULARY.md) | Defines identities, click and GPU lifetimes, coordinate spaces, selection observation, and ownership. |
| 02 | [`Implementation strategy`](02-IMPLEMENTATION-STRATEGY.md) | Selects the proof-first vertical slice, dependency order, work-unit range, risks, and exclusions. |
| 03 | [`BroMetal readback and GPU ID path`](03-BROMETAL-READBACK-AND-GPU-ID-PATH.md) | Selects public one-pixel readback, exact temporary-ID encoding, retained displayed-frame replay, and bounded stale/disposal rules. |
| 04 | [`Spatial 2D state and camera`](04-SPATIAL-2D-AND-CAMERA.md) | Selects a narrow runtime position store, orthographic camera, semantic input, and presentation ownership. |
| 05 | [`Framework selection and Studio observation`](05-FRAMEWORK-SELECTION-AND-STUDIO.md) | Selects temporary Framework selection, existing inspection transport, and Studio selected-entity behavior. |
| 06 | [`Integration proof and verification`](06-INTEGRATION-PROOF-AND-VERIFICATION.md) | Defines the dedicated fixture, four proof levels, acceptance matrix, and closeout evidence. |
| 07 | [`Upstream delivery and decisions`](07-UPSTREAM-DELIVERY-AND-DECISIONS.md) | Records the BroMetal patch/PR route, ADR alignment, delivery limits, and later owner choices. |

## Research

[`research/`](research/README.md) established that Antiky is a good architectural fit but lacks the
complete behavior. It also established that Antiky Framework is already MIT-licensed open source,
while npm publication is a separate unresolved product choice. External maintainer intent and
requester adoption remain unknown and do not block the internal proof.

Some raw research reports predate accepted Framework ADR 0022. The numbered plan applies that later
decision: GPU selection is required, the driver retains the clicked presentation and its temporary-ID
map through asynchronous readback, only stable `EntityId` crosses the driver boundary, and Studio
selects that entity.

## Goals

The next lifecycle phase is `create-goals`, which will cut bounded implementation contracts from the
dependency order in [`02-IMPLEMENTATION-STRATEGY.md`](02-IMPLEMENTATION-STRATEGY.md).

**Open**

| Goal | Delivers | Prerequisites | Needs owner |
| --- | --- | --- | --- |
| - | No executable goals exist yet. | Run `create-goals`. | No |

**Completed**

| Goal | Summary | Outcome |
| --- | --- | --- |
| - | None | No goals have been executed for this objective. |

## What this objective will not do

- Build a general ECS, general `World`, transform hierarchy, spatial index, or persistence layer.
- Treat CPU picking as completion or add CPU hit-shape policy for the GPU proof.
- Publish Framework to npm, create a companion package, promise a release, or take on external
  support.
- Build the requester's canal application, change Town into that application, or post to issue #8
  without explicit owner authorization.
- Add durable, multi-, bidirectional, MCP, feedback, gameplay, or editor selection.
- Solve transparent/blended/MSAA picking, touch/pinch, broad 3D/2.3D selection, or every demo.
- Bundle unrelated BroMetal camera, matrix, target-format, or perspective-depth work into readback.
- Publish the integration fixture on the website or turn it into an art/marketing deliverable.
