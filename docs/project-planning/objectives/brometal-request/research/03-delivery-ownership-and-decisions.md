# Delivery, ownership, and decisions

This document answers whether Antiky can provide the requested behavior, where it belongs, and what
the next plan should do. Packaging evidence is retained in
[`subagent_outputs/04-external-product-fit.md`](subagent_outputs/04-external-product-fit.md). The
owner-directed integration evidence is retained in the
[`GPU-to-Studio re-audit`](subagent_outputs/05-gpu-framework-studio-trace.md).

## Open-source availability and package distribution

**Established at the 2026-08-14 snapshot.** Antiky Framework is open source, MIT-licensed, and
available from the repository. Separately, it did not have a versioned npm distribution:

- `packages/framework/package.json` uses npm's `private: true` publication guard, remains at
  version `0.0.0`, and exports TypeScript source;
- the shared TypeScript configuration uses `noEmit: true`;
- `@antiky/framework` was absent from npm;
- the checked Antiky GitHub repositories had no releases;
- the repository describes its workspaces as private/pre-release.

**Established source use; unverified drop-in package operation.** The MIT license permits reading,
copying, modifying, and using Framework source now. The research did not test whether the current
workspace can be consumed unchanged as a drop-in dependency by an independent project. A dry-run
package contained raw TypeScript, tests, fixtures, scripts, and configuration but no emitted
JavaScript, declaration build, package README, or consumer smoke test.

**Inferred.** Turning off npm's publication guard is not by itself a registry-release plan. A
versioned npm distribution needs an intentional artifact, JS/types or an explicit source-package
toolchain, a file allowlist, install documentation, packed-artifact tests, and an independent
consumer proof. None of that changes Framework's existing open-source status.

**Established.** Framework does not depend on CLI or Studio. Its only declared runtime dependency
is exact-pinned `brometal@0.17.2`. The issue helper could therefore remain independent of CLI, React,
Studio, and MCP, but adopting the full 233-symbol Framework source surface is conceptually much
larger than the requested spatial helper.

## The Framework driver owns the GPU part

**Established local behavior, not released package behavior.** The Framework has a BroMetal driver
and generic frame contracts. Town and Point Light Expo now construct the driver, submit real frames,
and have headless driver-integration tests. The contract can describe ordered off-screen passes,
numeric per-instance data, depth, one sample, and nearest filtering. No Antiky release contains this
work yet.

**Established gap.** The driver has no pick result or readback operation. BroMetal `0.17.2` exposes
off-screen drawing and sampling but no public pixel readback. Antiky also applies local BroMetal
patches that are not part of a Framework package artifact.

**Inferred ownership.** The external helper's transform and camera behavior can remain independent
of rendering. The owner-required Antiky proof cannot: the Framework BroMetal driver must own the GPU
ID pass and readback. BroMetal should own only the general readback primitive. Framework should own
the temporary ID map, stable entity resolution, selection record, and inspection data. Studio should
own selection display and inspection behavior.

## Bounded delivery shapes

| Shape | What Antiky would provide | Fit and tradeoff |
| --- | --- | --- |
| **A. Candid response only** | Correct the current claim, document which ingredients exist, welcome the requester's own helper, and coordinate only on genuinely general BroMetal needs. | No new product or dependency; respects the requester's stated intent. It does not give Antiky a reusable proof or fulfill an offer to provide the behavior. |
| **B. Proof-first Antiky integration, then narrow Framework surface** | Prove transform tracking, the 2D camera, and the complete GPU-ID-to-Framework-entity-to-Studio path in one owned use case. Promote only the boundaries that earn reuse. | Best match to Antiky's demo-first direction and Studio goal. Source use remains available immediately; npm publication stays separate. |
| **C. Independent zero-runtime-dependency companion** | Publish a small package that accepts caller-owned keys, pointer data, shapes, and targets; BroMetal is an example adapter rather than a dependency. | Closest to “helper, not framework” and useful outside Antiky. It creates a separately versioned product, documentation and support surface, and possible duplication with Framework identity/transforms. |
| **D. Publish the whole Framework immediately** | Treat the current Framework as the issue answer and publish it as a versioned npm package. | Weak fit. Registry packaging is unfinished, the API is much larger than the need, the three capabilities are not complete, and driver patches complicate external behavior. |

**Inferred recommendation.** The owner's GPU and Studio direction selects Shape B. Prove the
complete Antiky integration before deciding whether any renderer-neutral part also belongs in a
separate companion. Do not begin with Shape D or claim the current source already fulfills the
issue.

Shape A remains an honest alternative if Antiky does not want to commit to external support. The
requester already intends to build their own companion, so implementation is an Antiky product
choice, not an obligation created by the issue.

## Capability ownership

| Capability | Research disposition | Reason |
| --- | --- | --- |
| Stable UUIDv7 entity identity | **Reuse existing Antiky** for every Framework entity | ADR 0011 fixes Framework entity identity as UUIDv7. A neutral companion may accept caller-owned keys only if it does not redefine Framework `EntityId`. |
| Semantic pointer `x/y`, down, active, click, drag | **Reuse existing Antiky**, with a click-sampling correction if needed | The host already owns raw DOM input. The spatial helper should consume semantic values, not listeners. |
| Entity/transform tracking for the proof | **New Antiky only if the proof needs owned lifecycle** | Current tracking is point-light-specific. The example's object count matches the issue fixture, not a Framework limit. |
| Neutral 2D transform/selectable shapes | **New Antiky** if Antiky implements | The current position value is point-light-coupled and has no update/query contract. |
| Viewport/world conversion | **New Antiky camera/spatial behavior** | No public Antiky or BroMetal conversion API exists. |
| GPU pick ID on each selectable draw or instance | **New Framework render preparation and driver behavior** | Numeric draw data exists, but no semantic owner, pick pass, or pick result exists. |
| Public asynchronous target readback | **Verify BroMetal, then patch and contribute upstream if absent** | BroMetal `0.17.2` has internal copy support but no public readback. The operation is useful to renderers generally. |
| Temporary GPU ID to stable `EntityId` map | **New Framework behavior** | ADR 0011 permits a numeric alias only within one state copy and lifetime. The stable ID must leave that boundary. |
| Temporary selection record and inspection transport | **New Framework and development-host behavior** | Framework must publish the stable selected entity; raw GPU values and BroMetal objects must not cross into Studio. |
| Pan/zoom/follow and damping policy | **New Antiky** if an Antiky-owned use case proves it | Existing demos supply techniques, not a reusable contract. |
| Studio hierarchy selection and entity inspection | **New Studio behavior required by this objective** | Studio must show and inspect the same stable entity returned by the GPU path. |
| MCP selection operations | **No action for this proof** | The selection record should permit future MCP use, but MCP is not required for the one-way GPU-to-Studio proof. |
| `mat4.orthographic` | **Potential upstream BroMetal contribution** | General renderer math and already hand-written by BroMetal's own 2D example. Maintainer approval and test-first contribution work are still absent. |
| WebGPU perspective depth formula | **Investigate as a separate upstream defect candidate** | The source-formula mismatch is established; defect and upstream classification remain inferred until an authoritative reference and exact-version failing regression support them. |
| Matrix inverse/project/unproject | **Evaluate upstream only with proven general demand** | The 2D helper can initially own bounded fixed-plane conversion. |
| BroMetal render driver | **Extend existing Framework behavior** | It is the accepted owner of Antiky GPU work and now has two migrated demo consumers. |
| Public package build, versioning, docs, install proof | **New Antiky delivery work** | Required before an external user can consume any claimed Antiky solution. |
| Canal dashboard product and its policy | **Requester-owned; no action** | Antiky should provide reusable capability, not take ownership of their application. |
| Ecosystem hosting or endorsement | **Await BroMetal maintainer direction** | The issue has no maintainer answer. |

## Questions answered

1. **Does Antiky already cover the requested behavior?** No. It covers valuable ingredients, not
   any of the three complete reusable behaviors or external delivery.
2. **Is Antiky's Framework direction a bad fit?** No. Stable identity, separate render data, the
   Framework-owned BroMetal driver, inspection transport, and Studio match the required path. A
   general ECS is not a prerequisite.
3. **Has Antiky diverged from this path?** No. Existing decisions require stable IDs, separate game
   and render data, temporary GPU IDs, and GPU work inside the Framework driver. The selected path
   follows those rules.
4. **Should implementation be planned?** Yes. Build checked-in Framework behavior, tests, and one
   runnable Antiky/BroMetal example that reaches Studio selection.
5. **Does BroMetal need changes?** Probably for public asynchronous readback. Check the current
   release first. If the capability is still absent, use a focused local patch and upstream pull
   request without putting Framework entity policy into BroMetal.

## Recommended defaults for the plan

The plan should use these defaults:

1. Put reusable state, stable identity, selection, and camera behavior in Framework. Do not create a
   new package yet.
2. Keep Framework's existing UUIDv7 `EntityId` as the stable result. Use numeric GPU values only for
   one rendered frame, and keep their stable-ID map until readback returns.
3. Extend the Framework BroMetal driver with the GPU pick pass and readback boundary.
4. Verify current BroMetal support. If readback is still missing, patch it locally, send the general
   change upstream, and retire the patch when a released version includes it.
5. Carry the resolved stable ID through temporary Framework selection and inspection transport.
6. Make Studio highlight and inspect that same entity.
7. Add the requested 2D pan, zoom, follow, and coordinate-conversion behavior.
8. Prove the complete path in one runnable example with roughly a few dozen objects. That fixture is
   not a product limit or package version.
9. Do not make a general ECS, npm publication, MCP integration, or the canal application a
   prerequisite. Do not post to GitHub unless the owner explicitly asks.

No further owner decision is needed before planning this direction.

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
- ADR 0021 gives Antiky GPU work to the Framework BroMetal driver. It permits a general readback
  operation upstream while keeping Framework entity and selection policy out of BroMetal.

Creating a separate package or changing npm distribution would be a later product decision. Neither
needs to block the first Framework implementation plan.

## Unresolved external evidence

- BroMetal maintainer intent and ecosystem hosting remain unknown.
- Requester adoption and exact functional requirements remain unknown.
- No independent consumer or packed-artifact proof exists.
- No performance or bundle measurement exists.
- The local render-driver branch and BroMetal patch PRs are not a released dependency surface.
