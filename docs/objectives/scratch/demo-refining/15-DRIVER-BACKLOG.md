# What each demo still needs from the render driver

**Date:** 2026-08-14
**Required by:** `goals/execute-goal-12.md` outcome 8 — *"every demo still hand-writing BroMetal is
implicitly claiming the driver cannot do its work. That claim must be checked, not assumed."*
**Authority:** `docs/adr/framework/0021-brometal-render-driver-ownership_H.md`.

Every demo in this repository hand-writes BroMetal today. That is nine implicit claims that the
driver cannot do their work, and this document checks them against what the driver actually
supports rather than accepting them.

## What the driver supports today

`packages/framework/src/render/brometal-driver.ts`, against the contract in
`packages/framework/src/render/render-contract.ts`:

| Capability | Contract shape |
|---|---|
| Named pipelines, with blend mode and one-time geometry setup | `PipelineDefinition`, supplied at construction |
| Render targets sized as a fraction of the canvas, with depth and multisampling | `TargetRequest` |
| Ordered passes, each into a target or the canvas, with an optional clear | `RenderPass` |
| Uniforms: numbers, number lists, another pass's output, a named texture | `UniformValue` |
| Per-instance attribute rows | `DrawCall.instanceData` |
| Skipping a draw entirely | `instances: 0` |
| Registering a pipeline after construction, for assets loaded at runtime | `registerPipeline()` |
| Releasing every program and target it made | `dispose()` |

## The five demos that cannot use it at all, and why that is not the driver's fault

`shader-study`, `solar-forge`, `luminous-reef`, `glass-garden` and `orbital-atlas` are
**framework-free by design**. `packages/demos/tests/dev-host.test.mjs:72,95` asserts they carry no
`@antiky/framework` dependency and that the string does not appear in their source. That fence
exists to prove BroMetal and Three.js work standalone.

The driver ships inside `@antiky/framework`, so using it would break the fence. **These five are not
driver backlog.** Moving them is a product decision about whether the fence should stay, not a
missing feature. Goal 12 explicitly forbids relaxing it.

## The four Antiky demos: what is genuinely missing

Checked by reading each demo's BroMetal use, not inferred.

| Demo | `createProgram` | `instanceAttributes` | `drawTo` | `createRenderTarget` | textures |
|---|---|---|---|---|---|
| `point-light-expo` | 24 | 49 | 9 | 6 | 13 loaded, 11 made |
| `combat-arena` | 29 | 63 | 10 | 8 | 15 loaded, 13 made |
| `traversal-study` | 13 | 41 | 8 | 5 | 7 loaded, 9 made |
| `antiky-town` | 17 | 47 | 2 | 3 | 7 loaded |

**Nothing in that table is a missing driver feature.** Every one of those calls has a contract
shape: a program is a pipeline, an instance attribute upload is `instanceData`, a `drawTo` is a
pass with a target, a render target is a `TargetRequest`, a loaded texture is a construction-time
texture. The work is transcription, not capability.

Two things were found missing while checking, and **both are now fixed**:

1. **Additive blending was unreachable.** The driver's pipeline options typed `blend?: 'alpha' |
   'add'`. BroMetal accepts `'none' | 'alpha' | 'additive'`. Every glow, ring and effect pipeline in
   all four demos uses `additive`, so the driver would have rejected most of the effect work in the
   repository. Fixed, with a test that builds one pipeline of each blend mode.
2. **Instance rows and textures had no contract shape at all.** Added as `DrawCall.instanceData` and
   `{ texture: key }`, which is what ADR 0021 means by "assets, and typed updates".

### The real blocker, and it is not a feature

The remaining obstacle to moving `point-light-expo` is **size, not capability**:

- ~20 programs, several of them paired — every instanced batch has a second depth-only program for
  the shadow pass.
- Three of them are built from GLB models loaded asynchronously, so pipeline construction is
  `await`-shaped while `createBroMetalRenderDriver` is synchronous.
- The frame is five passes deep — shadow, scene, bloom extract, two blur directions, post — with
  the scene pass alone issuing eleven draws in a deliberate order that comments in
  `renderer.ts:417-430` explain and that a careless port would silently reorder.

**One genuine contract gap followed from the second point, and it is now closed:** pipelines were
supplied only at construction, and three of this demo's pipelines cannot exist until a GLB has
loaded. `registerPipeline` was added for exactly that. Nothing else about the migration is a
capability question.

## Backlog, ranked

| # | What the driver needs | Why | Which demos |
|---|---|---|---|
| ~~1~~ | ~~**Register a pipeline after construction**~~ — **done**, `registerPipeline(key, definition)` | Three catalog batches per demo are built from GLB models fetched at runtime, so those pipelines cannot exist before the driver does. Registering over a live key is refused rather than silently replacing a program. | all four |
| 2 | **A render-target texture that outlives one frame**, sampled by a later frame | The shadow map is written in one pass and read in the next; that already works. What does not is a target a demo wants to keep across frames for temporal work. Nothing needs this today — listed so it is not mistaken for supported. | none yet |
| 3 | **Per-pipeline depth state** | BroMetal ties depth-write to blend mode with no separate control, which `renderer.ts:354-360` documents as a real trap — a post quad with depth writing on erased an overlay. The driver inherits that coupling rather than fixing it. | `point-light-expo` |

**Nothing on this list now blocks a migration.** Items 2 and 3 are recorded so the next person does
not rediscover them; neither is needed by any demo today.

## Honest status

The driver is **capable but unproven**. It has the contract, the implementation, a second
implementation proving portability, and a sprite test satisfying `docs/adr/framework/0004-23d_H.md`.
It has **no demo running on it**, which goal 12 names as its critical acceptance criterion, and
under `packages/website/PRODUCT.md`'s taxonomy that keeps the render driver a **Direction** claim
rather than a Current one. The public wording already says exactly that and must not be changed
until a demo actually renders through it.
