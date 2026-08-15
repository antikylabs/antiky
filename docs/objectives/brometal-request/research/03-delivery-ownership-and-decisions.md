# Delivery, ownership, and decisions

This document answers whether Antiky can provide the requested behavior, where it belongs, and what
the owner must decide before `create-plan`. Packaging evidence is retained in
[`subagent_outputs/04-external-product-fit.md`](subagent_outputs/04-external-product-fit.md).

## External reality

**Established at the 2026-08-14 snapshot.** An external BroMetal user cannot install a supported
Antiky Framework package:

- `packages/framework/package.json` is private, version `0.0.0`, and exports TypeScript source;
- the shared TypeScript configuration uses `noEmit: true`;
- `@antiky/framework` was absent from npm;
- the checked Antiky GitHub repositories had no releases;
- the repository describes its workspaces as private/pre-release.

**Established permission; unverified operation.** The Framework's MIT license permits reading,
copying, and using its source. Consuming it from a checkout is plausible but was not tested in an
independent project, so it cannot be offered as demonstrated installation behavior. A dry-run
package contained raw TypeScript, tests, fixtures, scripts, and configuration but no emitted
JavaScript, declaration build, package README, or consumer smoke test.

**Inferred.** Removing `private` is not a release plan. External delivery needs an intentional
artifact, versioning, JS/types or an explicit source-package toolchain, a file allowlist, install
documentation, packed-artifact tests, and an independent consumer proof.

**Established.** Framework does not depend on CLI or Studio. Its only declared runtime dependency
is exact-pinned `brometal@0.17.2`. The issue helper could therefore remain independent of CLI, React,
Studio, and MCP, but adopting the full 233-symbol Framework source surface is conceptually much
larger than the requested spatial helper.

## The local render driver is not the answer

**Established local state, not released behavior.** The local committed source has a BroMetal
render-driver subpath and generic frame contracts, but no migrated demo proves it and no release
contains it. Antiky's root postinstall also applies five local BroMetal patches that are absent from
a Framework package artifact. Some driver behavior depends on those patched target options.

**Inferred.** The requested helper should not depend on the driver. The requester explicitly wants
a render-independent layer, and entity state, CPU hit testing, and a 2D camera can exchange plain
keys, shapes, and matrices. This avoids making their use depend on unreleased driver work or local
BroMetal patches.

## Bounded delivery shapes

| Shape | What Antiky would provide | Fit and tradeoff |
| --- | --- | --- |
| **A. Candid response only** | Correct the current claim, document which ingredients exist, welcome the requester's own helper, and coordinate only on genuinely general BroMetal needs. | No new product or dependency; respects the requester's stated intent. It does not give Antiky a reusable proof or fulfill an offer to provide the behavior. |
| **B. Proof-first Antiky slice, then narrow Framework surface** | Prove the small renderer-neutral tracker/helper, CPU picking, and 2D camera in one owned use case. Promote only the boundary that earns reuse, then package it through narrow Framework entries when the release gate exists. | Best match to Antiky's demo-first direction and existing identity/input foundations. External consumption waits for packaging, and the full Framework package still brings BroMetal unless packaging separates the spatial surface. |
| **C. Independent zero-runtime-dependency companion** | Publish a small package that accepts caller-owned keys, pointer data, shapes, and targets; BroMetal is an example adapter rather than a dependency. | Closest to “helper, not framework” and useful outside Antiky. It creates a separately versioned product, documentation and support surface, and possible duplication with Framework identity/transforms. |
| **D. Publish the whole Framework immediately** | Treat the current Framework as the issue answer and make it installable. | Weak fit. Packaging is unfinished, the API is much larger than the need, the three capabilities are not complete, and driver patches complicate external behavior. |

**Inferred recommendation.** If the owner's statement “we can provide” means Antiky should build a
real capability, the evidence supports Shape B. Prove the small renderer-neutral cut first, then use
actual reuse and package constraints to choose a narrow Framework surface or Shape C. Do not begin
with Shape D or claim the current source already fulfills the issue.

Shape A remains an honest alternative if Antiky does not want to commit to external support. The
requester already intends to build their own companion, so implementation is an Antiky product
choice, not an obligation created by the issue.

## Capability ownership

| Capability | Research disposition | Reason |
| --- | --- | --- |
| Stable UUIDv7 entity identity | **Reuse existing Antiky** for every Framework entity | ADR 0011 fixes Framework entity identity as UUIDv7. A neutral companion may accept caller-owned keys only if it does not redefine Framework `EntityId`. |
| Semantic pointer `x/y`, down, active, click, drag | **Reuse existing Antiky**, with a click-sampling correction if needed | The host already owns raw DOM input. The spatial helper should consume semantic values, not listeners. |
| Few-dozen entity/transform registry | **New Antiky only if the proof needs owned lifecycle** | Current tracking is point-light-specific. A caller-owned-record shape may be sufficient and is smaller. |
| Neutral 2D transform/selectable shapes | **New Antiky** if Antiky implements | The current position value is point-light-coupled and has no update/query contract. |
| Viewport/world conversion | **New Antiky camera/spatial behavior** | No public Antiky or BroMetal conversion API exists. |
| Bounded pointer-to-stable-key hit test | **New Antiky** for the minimum proof | Product-level spatial behavior; CPU bounds need no renderer change. |
| Pan/zoom/follow and damping policy | **New Antiky** if an Antiky-owned use case proves it | Existing demos supply techniques, not a reusable contract. |
| Shared Studio/hierarchy/MCP selection | **No action for this minimum request** | It is a larger editor-session feature. Add it only if explicitly selected as the product boundary. |
| `mat4.orthographic` | **Potential upstream BroMetal contribution** | General renderer math and already hand-written by BroMetal's own 2D example. Maintainer approval and test-first contribution work are still absent. |
| WebGPU perspective depth formula | **Investigate as a separate upstream defect candidate** | The source-formula mismatch is established; defect and upstream classification remain inferred until an authoritative reference and exact-version failing regression support them. |
| Matrix inverse/project/unproject | **Evaluate upstream only with proven general demand** | The 2D helper can initially own bounded fixed-plane conversion. |
| Render-target readback / GPU IDs | **No action for the stated minimum** | Current requirements do not justify the larger render path. Upstream only if pixel-accurate picking proves it necessary and renderer-general. |
| BroMetal render driver | **No action for this request** | Unreleased and contrary to the requester's render-independent boundary. |
| Public package build, versioning, docs, install proof | **New Antiky delivery work** | Required before an external user can consume any claimed Antiky solution. |
| Canal dashboard product and its policy | **Requester-owned; no action** | Antiky should provide reusable capability, not take ownership of their application. |
| Ecosystem hosting or endorsement | **Await BroMetal maintainer direction** | The issue has no maintainer answer. |

## Questions answered

1. **Does Antiky already cover the requested behavior?** No. It covers valuable ingredients, not
   any of the three complete reusable behaviors or external delivery.
2. **Is Antiky's Framework direction a bad fit?** No. Renderer-neutral state, semantic host input,
   stable identity, and equal 2D support fit the need. A general ECS, full inspection stack, or
   render-driver dependency would be a bad-sized implementation.
3. **Has Antiky diverged from this path?** No accepted ADR contradicts a constrained slice. A
   Framework registry must use UUIDv7 entity identity, remain specialized entity-associated
   storage, and be classified as authoring or runtime state with separate projections.
4. **Should implementation be planned?** Yes, if the owner intends a supported Antiky capability:
   plan a proof-first, bounded, renderer-neutral slice. Do not plan the full Framework release as a
   substitute for the missing behavior.
5. **Does BroMetal need changes first?** No for the minimum CPU path. General math and the separate
   perspective defect may merit focused upstream work, but the helper should not wait for them.

## Owner decisions before planning

Planning must not silently choose these:

1. **Commitment and audience:** Is the outcome an Antiky-supported external capability, an
   Antiky-internal proof that may later publish, or only a candid issue response?
2. **Product home:** Should an earned API live in narrow Framework subpaths or in an independent
   zero-runtime-dependency companion? Shape B can postpone the final choice until the proof exists.
3. **Identity:** Framework identity is UUIDv7 under ADR 0011. If the product is instead a neutral
   companion, should it accept caller-owned stable keys and provide an Antiky adapter without
   redefining Framework `EntityId`?
4. **Transform scope:** Is position-only 2D sufficient, or must the first contract include rotation,
   scale, hierarchy, interpolation, or create/remove lifecycle?
5. **Picking fidelity:** Are explicit CPU bounds with a deterministic topmost rule sufficient, or
   must selection follow rendered alpha, occlusion, and depth?
6. **Camera contract:** Choose projection, world plane/origin/Y direction, zoom input and anchor,
   pan/follow precedence, bounds, dead zone, and damping/reset behavior.
7. **Proof owner:** Which Antiky-owned example proves a few dozen objects, clicks, and follow without
   taking ownership of the requester's canal project?
8. **Release:** Is public pre-release packaging part of this objective, or a separate prerequisite
   objective after the reusable cut is proven?
9. **Issue communication:** Should the existing “already provides” and “release this weekend” claim
   be clarified now? No external reply should be sent without owner direction.

## Direction and ADR alignment

The recommended research direction does not contradict accepted ADRs:

- ADR 0001 permits simple private specialized storage, but it must remain associated with Framework
  entities rather than becoming a parallel entity model or premature general ECS.
- ADR 0004 makes a reusable 2D capability valid Framework work.
- ADR 0009 lets a pure helper remain outside Framework projections. A Framework-owned mutable
  registry must be classified as authoring or runtime state and keep projections separate.
- ADR 0011 fixes Framework entity identity as UUIDv7 and allows temporary numeric aliases only
  inside bounded hot paths. Caller-owned keys apply only to a neutral companion boundary.
- ADR 0020 keeps raw platform input in the host and semantic camera/pick intent in product code.
- ADR 0021 keeps scene and interaction policy out of BroMetal while allowing general math and defect
  fixes upstream.

**Inferred governance gap.** Choosing a separately versioned companion versus Framework subpaths,
and committing to a public release boundary, are durable product/ownership decisions. If the owner
selects either, planning should determine whether an ADR or AIP is required rather than burying the
decision in implementation goals.

## Unresolved external evidence

- BroMetal maintainer intent and ecosystem hosting remain unknown.
- Requester adoption and exact functional requirements remain unknown.
- No independent consumer or packed-artifact proof exists.
- No performance or bundle measurement exists.
- The local render-driver branch and BroMetal patch PRs are not a released dependency surface.
