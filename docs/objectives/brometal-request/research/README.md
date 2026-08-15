# BroMetal request research

**Research date:** 2026-08-14

This research answers the questions in [`00-research-plan.md`](00-research-plan.md) against the
owner's [`objective.md`](../objective.md) and
[BroMetal issue #8](https://github.com/ericdrowell/brometal/issues/8). It does not choose an
implementation plan or authorize an external issue reply.

**Owner correction:** Antiky Framework is open source. Its MIT-licensed source is available from
the repository today. The `private: true` package-manifest value discussed below is an npm
publication guard, not a statement about source access or licensing.

## Headline conclusions

1. **The requester proposed their own companion; they did not ask Antiky to build it.** They want a
   small render-independent layer for a few dozen transforms, click-to-entity picking, and a 2D
   pan/zoom/follow camera. BroMetal's listed maintainer had not answered whether it belongs in the
   ecosystem at the research snapshot.
2. **The open-source statement is established; the feature and release statements need narrower
   wording.** Antiky is open source and working in the same problem area. “Already provides” is not
   supported for all three complete reusable capabilities. “Release this weekend” was still a
   future prediction at the snapshot, so it was unverified rather than disproven.
3. **Antiky has ingredients, not the three reusable capabilities.** Stable UUIDv7 identity,
   normalized pointer state, a position value, bounded inspection DTOs, render contracts, and
   several camera-follow examples exist. A general tracker, screen/world conversion,
   pointer-to-stable-entity hit path, and reusable 2D camera do not.
4. **Framework is the right home for the missing work.** It can track the objects, handle clicks,
   and provide the camera without changing BroMetal's drawing code. A full ECS or Studio selection
   system would be much larger than this request.
5. **The first version does not require a BroMetal change.** For a few dozen 2D objects, simple CPU
   click checks are enough to prove the feature. GPU picking can wait unless a real example needs
   exact pixel-level selection.
6. **Antiky is open source and available from the repository today; npm distribution is a separate
   concern.** Framework is MIT-licensed and its source can be used directly. The workspace's npm
   manifest has `private: true`, version `0.0.0`, and no published registry artifact. Those facts
   describe package distribution, not whether Antiky is open source.
7. **The next step is a small working example.** Build the missing pieces in Framework, prove them
   together in one Antiky example, and only then decide what code is worth reusing elsewhere.
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
| [`03-delivery-ownership-and-decisions.md`](03-delivery-ownership-and-decisions.md) | Open-source availability, delivery options, ownership, and recommended defaults |
| [`subagent_outputs/`](subagent_outputs/) | Five raw read-only specialist reports retained unedited as evidence |

## Research-question status

| Question | Status | Answer location |
| --- | --- | --- |
| Requester's actual need and BroMetal response | Answered within available issue evidence | Request and current coverage |
| Reusable entity/transform coverage | Answered | Request and current coverage; minimum slice |
| Pointer-to-entity picking coverage | Answered | Request and current coverage; technical options |
| Reusable 2D camera coverage | Answered | Request and current coverage; technical options |
| How people can use Antiky today | Answered for the current snapshot | Delivery and ownership |
| What belongs in Antiky or BroMetal | Answered | Delivery ownership matrix |
| BroMetal maintainer intent | Open external evidence | Await a maintainer response on issue #8 |
| Requester adoption and detailed semantics | Open external evidence | Ask only if the owner authorizes issue coordination |
| Recommended next step | Answered | Defaults below |

## Recommended next step

The research supports moving to a plan with these defaults:

1. Build the missing pieces inside Framework. Do not create another package yet.
2. Keep the first version small: a few dozen 2D objects, simple transforms, and no general ECS.
3. Start click detection with simple object shapes on the CPU. Do not build GPU picking yet.
4. Add a basic 2D camera with pan, zoom, and follow. Let the implementation plan choose sensible
   behavior and prove it with tests.
5. Prove the whole flow in one small Antiky example.
6. Leave Studio selection, MCP selection, npm publishing, and the requester's canal application out
   of the first plan.
7. Do not post another GitHub reply unless the owner explicitly asks for one.

We can start planning now. The owner only needs to speak up if they want a separate package now or
want a GitHub reply sent now.

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

If a later objective creates a separate package or changes npm distribution, record that product
decision then. It does not need to block this implementation plan.
