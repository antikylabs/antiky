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
3. **Antiky has useful pieces, not the complete behavior.** Stable UUIDv7 identity, normalized
   pointer state, numeric draw data, ordered render passes, inspection records, and camera-follow
   examples exist. A reusable transform tracker, GPU readback, render-ID-to-entity mapping, shared
   selection record, Studio selection, and reusable 2D camera do not.
4. **The required selection path has clear owners.** The BroMetal driver owns the GPU pick pass and
   readback. Framework converts the temporary GPU value to a stable `EntityId` and records the
   selection. Studio shows and inspects that same entity.
5. **GPU picking is required for this Antiky objective.** The owner wants Studio to trace a clicked
   rendered item back to its Framework entity. CPU hit testing remains useful comparison evidence,
   but a CPU-only proof does not complete this objective. BroMetal `0.17.2` has no public readback
   API. The implementation plan must check the current BroMetal release and use the BroMetal patch
   and upstream workflow if that general capability is still missing.
6. **Antiky is open source and available from the repository today; npm distribution is a separate
   concern.** Framework is MIT-licensed and its source can be used directly. The workspace's npm
   manifest has `private: true`, version `0.0.0`, and no published registry artifact. Those facts
   describe package distribution, not whether Antiky is open source.
7. **The next deliverable is an executable integration proof, not a product version.** Build
   checked-in Framework behavior, automated tests, and one runnable Antiky/BroMetal example that
   proves the complete GPU-to-entity-to-Studio path. A fixture of roughly a few dozen objects matches
   the issue's scale; it is not a permanent Framework limit.
8. **Keep general renderer work separate.** `mat4.orthographic` is the clearest possible BroMetal
   primitive. A perspective-depth formula mismatch is established in source, but calling it a
   BroMetal defect requires an authoritative WebGPU reference and exact-version failing regression.
   Inversion and project/unproject still need proven general demand. GPU target readback now has a
   concrete Antiky use and is general renderer behavior. Any contribution must follow the
   exact-version, failing-test, narrow-patch, upstream-and-retire workflow.

## Research documents

| Document | What it answers |
| --- | --- |
| [`00-research-plan.md`](00-research-plan.md) | Questions, evidence lines, scope, and governing constraints |
| [`01-request-and-current-coverage.md`](01-request-and-current-coverage.md) | The request, credibility of the current reply, and exact BroMetal/Antiky coverage |
| [`02-minimum-slice-and-technical-options.md`](02-minimum-slice-and-technical-options.md) | The smallest useful boundary, tracker shapes, CPU/GPU picking, camera ownership, and proof fixture |
| [`03-delivery-ownership-and-decisions.md`](03-delivery-ownership-and-decisions.md) | Open-source availability, delivery options, ownership, and recommended defaults |
| [`subagent_outputs/`](subagent_outputs/) | Six raw read-only specialist reports retained unedited as evidence |

## Research-question status

| Question | Status | Answer location |
| --- | --- | --- |
| Requester's actual need and BroMetal response | Answered within available issue evidence | Request and current coverage |
| Reusable entity/transform coverage | Answered | Request and current coverage; minimum slice |
| GPU pointer-to-entity-to-Studio coverage | Answered | Request and current coverage; technical options; GPU/Studio re-audit |
| Reusable 2D camera coverage | Answered | Request and current coverage; technical options |
| How people can use Antiky today | Answered for the current snapshot | Delivery and ownership |
| What belongs in Antiky or BroMetal | Answered | Delivery ownership matrix |
| BroMetal maintainer intent | Open external evidence | Await a maintainer response on issue #8 |
| Requester adoption and detailed semantics | Open external evidence | Ask only if the owner authorizes issue coordination |
| Recommended next step | Answered | Defaults below |

## Recommended next step

The research supports moving to a plan with these defaults:

1. Build checked-in Framework behavior, automated tests, and one runnable Antiky/BroMetal
   integration example. This is an executable proof, not a release or package version.
2. Use roughly a few dozen objects in the fixture because that matches the issue's stated scale. Do
   not treat that number or the proof's transform fields as permanent Framework limits.
3. Give each selectable draw or instance a temporary numeric ID for one rendered frame. Keep the
   matching stable Framework `EntityId` map until the GPU result returns.
4. Render those IDs to a GPU pick target, read the clicked pixel asynchronously, reject stale
   results, and resolve the value to the stable Framework entity.
5. Record that entity as temporary Framework selection and show the same entity in Studio's
   hierarchy and inspector.
6. Add the requested 2D pan, zoom, follow, and coordinate-conversion behavior.
7. Do not make a general ECS, npm publication, MCP integration, or the requester's canal application
   a prerequisite for this proof. Do not create a separate package yet.
8. Do not post another GitHub reply unless the owner explicitly asks for one.

No further owner decision is needed before planning this direction.

## Important unresolved evidence

- No BroMetal maintainer response establishes ecosystem ownership or acceptance.
- The requester's BroMetal version, bundler, coordinate convention, hit shapes, overlap/fidelity
  needs, and support expectations are unknown.
- No end-to-end test traces a pointer through GPU readback, stable entity resolution, and Studio.
- No reusable 2D camera proof covers conversion round trips, pan, zoom, follow, and resize.
- No independent consumer has installed an Antiky package artifact.
- No picking performance, bundle, or compatibility measurement exists.
- The local BroMetal driver and patch set are not a released external surface.

## Direction and ADR alignment

The findings do not contradict accepted ADRs. The GPU stores a temporary number, not the durable
identity of an object. The driver retains the matching number-to-`EntityId` map for the frame being
read. Framework receives the stable `EntityId` and owns temporary selection state. Studio reads that
selection through inspection data. BroMetal only needs a general GPU readback operation; it does not
need to know about Framework entities or Studio.

If a later objective creates a separate package or changes npm distribution, record that product
decision then. It does not need to block this implementation plan.
