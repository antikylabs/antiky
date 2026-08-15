# BroMetal request research

**Research date:** 2026-08-14

This research answers the questions in [`00-research-plan.md`](00-research-plan.md) against the
owner's [`objective.md`](../objective.md) and
[BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8). It does not choose an
implementation plan or authorize an external issue reply.

## Headline conclusions

1. **The requester proposed their own companion; they did not ask Antiky to build it.** They want a
   small render-independent layer for a few dozen transforms, click-to-entity picking, and a 2D
   pan/zoom/follow camera. BroMetal's listed maintainer had not answered whether it belongs in the
   ecosystem at the research snapshot.
2. **The existing issue reply mixes an overstated current claim with unverified future intent.**
   Antiky is working in the same problem area, but “already provides” is not supported by a complete
   API or install artifact. “Release this weekend” was still a future prediction at the snapshot;
   the absence of an artifact then made it unverified, not disproven.
3. **Antiky has ingredients, not the three reusable capabilities.** Stable UUIDv7 identity,
   normalized pointer state, a position value, bounded inspection DTOs, render contracts, and
   several camera-follow examples exist. A general tracker, screen/world conversion,
   pointer-to-stable-entity hit path, and reusable 2D camera do not.
4. **The Framework direction fits the need and has not diverged from it.** A small
   renderer-neutral spatial slice aligns with stable identity, host/game separation, equal 2D
   support, and proof-first promotion. A general ECS, full Studio selection system, or render-driver
   dependency would be too large for the stated request.
5. **The minimum path does not require a BroMetal change.** Bounded CPU hit testing over explicit
   2D shapes can use caller or Antiky IDs and plain camera matrices. GPU object-ID picking is a
   larger fidelity option that current Antiky contracts and BroMetal's public API do not support.
6. **Antiky cannot offer an installable solution today.** `@antiky/framework` is private,
   source-only, `0.0.0`, and absent from npm and checked GitHub release surfaces. Publishing the
   whole Framework would still not fill the missing behavior.
7. **If Antiky intends to provide the capability, research supports a proof-first implementation
   plan.** Prove one bounded renderer-neutral slice in an Antiky-owned use case, then promote the
   earned API into narrow Framework subpaths or a separate companion. Do not promise a package or
   create a general world model before the cut is proven.
8. **Keep general renderer work separate.** `mat4.orthographic` is the clearest possible BroMetal
   primitive. A perspective-depth formula mismatch is established in source, but calling it a
   BroMetal defect requires an authoritative WebGPU reference and exact-version failing regression.
   Inversion, project/unproject, and readback need proven general demand. Any contribution must
   follow the exact-version, failing-test, narrow-patch, upstream-and-retire workflow.

## Research documents

| Document | What it answers |
| --- | --- |
| [`00-research-plan.md`](00-research-plan.md) | Questions, evidence lines, scope, and governing constraints |
| [`01-request-and-current-coverage.md`](01-request-and-current-coverage.md) | The request, credibility of the current reply, and exact BroMetal/Antiky coverage |
| [`02-minimum-slice-and-technical-options.md`](02-minimum-slice-and-technical-options.md) | The smallest useful boundary, tracker shapes, CPU/GPU picking, camera ownership, and proof fixture |
| [`03-delivery-ownership-and-decisions.md`](03-delivery-ownership-and-decisions.md) | External availability, delivery shapes, capability ownership, ADR alignment, and owner decisions |
| [`subagent_outputs/`](subagent_outputs/) | Five raw read-only specialist reports retained unedited as evidence |

## Research-question status

| Question | Status | Answer location |
| --- | --- | --- |
| Requester's actual need and BroMetal response | Answered within available issue evidence | Request and current coverage |
| Reusable entity/transform coverage | Answered | Request and current coverage; minimum slice |
| Pointer-to-entity picking coverage | Answered | Request and current coverage; technical options |
| Reusable 2D camera coverage | Answered | Request and current coverage; technical options |
| External consumability and dependency cost | Answered for the current snapshot | Delivery and ownership |
| Existing Antiky versus new Antiky versus upstream versus no action | Answered in principle | Delivery ownership matrix |
| BroMetal maintainer intent | Open external evidence | Await a maintainer response on issue #8 |
| Requester adoption and detailed semantics | Open external evidence | Ask only if the owner authorizes issue coordination |
| Product and policy choices | Open by design | Owner decisions below |

## Decisions needed from the owner

Planning should not silently choose these:

1. **Commitment:** Is the result an externally supported Antiky capability, an internal proof that
   may later publish, or only a candid issue response?
2. **Product home:** Should an earned API become narrow Framework subpaths, or a separate
   zero-runtime-dependency companion? A proof-first slice can postpone the final choice.
3. **Identity and transform:** Framework entities must keep ADR 0011 UUIDv7 identity. Should a
   neutral companion accept caller-owned keys without redefining Framework identity? Is position
   sufficient, or must the first contract include rotation, scale, hierarchy, interpolation, and
   lifecycle?
4. **Picking fidelity:** Are bounded CPU shapes and a deterministic topmost rule sufficient, or
   must selection match rendered alpha, occlusion, and depth?
5. **Camera policy:** Choose projection, world plane and axes, zoom input and anchor, pan/follow
   precedence, bounds, dead zone, damping, and reset behavior.
6. **Proof target:** Which Antiky-owned example should prove the few-dozen-object workflow without
   taking ownership of the requester's canal application?
7. **Release scope:** Is package publication part of this objective, or a later delivery objective
   after the reusable boundary exists?
8. **Issue communication:** Should the existing availability claim be clarified now, and should the
   requester be asked for missing semantics? No reply has been sent by this research.

## Important unresolved evidence

- No BroMetal maintainer response establishes ecosystem ownership or acceptance.
- The requester's BroMetal version, bundler, coordinate convention, hit shapes, overlap/fidelity
  needs, and support expectations are unknown.
- No end-to-end test identifies a stable entity from a pointer event.
- No reusable 2D camera proof covers conversion round trips, pan, zoom, follow, and resize.
- No independent consumer has installed an Antiky package artifact.
- No picking performance, bundle, or compatibility measurement exists.
- The local BroMetal driver and patch set are not a released external surface.

## Direction and ADR alignment

The findings do not contradict accepted ADRs or the owner's concern about Framework fit when the
slice stays inside their constraints. A Framework-owned registry must use UUIDv7 entity identity,
remain specialized entity-associated storage, and be classified as authoring or runtime state with
separate projections. A neutral companion can accept caller-owned keys without redefining Framework
identity. Both shapes support renderer-neutral camera/hit-test behavior, semantic input supplied by
the host, and only renderer-general changes upstream to BroMetal.

Choosing a separately versioned companion or committing Framework to a public package boundary may
be a durable ownership decision. If the owner selects either, the later plan should determine
whether an ADR or AIP is needed rather than hiding that choice in implementation goals.
