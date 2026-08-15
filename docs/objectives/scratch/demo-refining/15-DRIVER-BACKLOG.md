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
| Owning textures: fetched from a URL, or built from a canvas or bitmap | `TextureSource`, `loadTextures()` |
| Fixed-size targets, for a shadow map whose resolution is a quality setting | `TargetRequest.size` |
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

### Why this migration cannot be done in pieces

Worth stating plainly, because it is the reason the demo has not moved and it is not obvious.

The scene pass draws the demo's own programs into a render target that the bloom chain then samples.
Moving only the bloom and post passes to the driver would need the driver to hand its scene target
back to the demo so the demo could draw into it — and ADR 0021 forbids exactly that: *"the driver
must not hand a BroMetal object back out"*. Moving only the scene pass has the mirror problem.

So for this demo the migration is **all-or-nothing**: every pipeline moves in one pass, or none
does. There is no intermediate state that both compiles and keeps the frame correct. That is a
property of this demo's frame, not a gap in the driver.

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

Three gaps were found by attempting the migration rather than by reasoning about it, and all three
are closed: the missing `additive` blend mode, textures and instance rows having no contract shape,
and — found last, when the shadow pass was read — targets being sizeable only as a fraction of the
canvas. A shadow map is a fixed 2048 by authoring choice and must not change when the canvas does.

## Honest status

The driver is **capable but unproven**. It has the contract, the implementation, a second
implementation proving portability, and a sprite test satisfying `docs/adr/framework/0004-23d_H.md`.
It has **no demo running on it**, which goal 12 names as its critical acceptance criterion, and
under `packages/website/PRODUCT.md`'s taxonomy that keeps the render driver a **Direction** claim
rather than a Current one. The public wording already says exactly that and must not be changed
until a demo actually renders through it.

## The migration, fully written and not yet running

`wip/goal-12-driver-migration` now holds the **whole** `point-light-expo` migration. Every file is
converted, and the state is precise:

**What passes**

- `rg 'createProgram\(|createTexture\(|createRenderTarget\(|loadTexture\(|createBuffer\('` over
  `point-light-expo/src` returns **zero hits**. Outcome 4's literal evidence check is met.
- `tsc --noEmit` is clean for the demo.
- All **86** of the demo's tests pass, including the resource-leak and instance-storage tests, which
  were rewritten to assert the surviving intent now that the seams they injected into moved to the
  driver.
- `vite build` succeeds and the bundle contains the driver.

**What does not**

- `npm run demos:shoot -- --demo point-light-expo` fails with `CAPTURE_RUNTIME_TIMEOUT`. The demo
  builds and loads but never publishes a frame, so something throws at runtime that no unit test
  reaches — every test here runs without a GPU.

So outcome 4 is met on the letter and **not in substance**: a demo that does not render has not
moved onto the driver in any sense that matters. Outcome 5 is unmet — there is no after-capture.

**Where to look first.** In rough order of likelihood, none yet eliminated:

1. ~~`configureTargets` called outside `renderer.present(...)`~~ — **tested and eliminated.** Moving
   it inside the present callback changed nothing; the timeout is identical. The call now sits
   inside anyway, matching the original, but that is not the fault. Do not spend a second session
   on it.
2. A uniform the old code set once at construction but the new code sets per draw, or vice versa,
   where BroMetal rejects the timing rather than the value.
3. A draw issued with instance buffers that were never populated. BroMetal refuses that with "no
   instance data — call set(...) before draw()", which is the exact failure
   `presentation.test.ts:296` was written to guard and which no headless test can see.

The fastest way in is a browser console on `npm run dev:demos point-light-expo`, which the capture
harness deliberately does not surface.

## The earlier half-landed state, for reference

`wip/goal-12-driver-migration` holds the first half of the `point-light-expo` migration. It is **not
merged** and the demo does not build there — that is expected, and the branch exists so the attempt
could be made without risking a working tree.

**Converted, and typechecking clean:**

| File | What it produces now instead of BroMetal resources |
|---|---|
| `render-batches.ts` | `PipelineDefinition` per batch, plus plain `Float32Array` instance rows |
| `reliquary-models.ts` | pipeline + depth pipeline + three `TextureSource`s from the GLB's embedded images |
| `onboarding.ts` | two pipelines and three canvas-backed `TextureSource`s |
| `shadow-pass.ts` | `SHADOW_TARGET`, `SHADOW_RECEIVER_UNIFORMS`, `SHADOW_CASTER_UNIFORMS` |
| `relay-visuals.ts`, `reliquary-model-layout.ts` | unchanged except that `upload()` calls are gone — the frame's `instanceData` replaces them |

Four framework changes were needed to get there, all merged and tested on the main branch:
`PipelineProgram` as a permissive `setup` parameter, a loosely-typed `shader` field so `setup` keeps
contextual typing, `TargetRequest.size`, and driver-owned textures.

**Still to convert — three files:**

- `renderer.ts` — the orchestration. Build one driver, register ~20 pipelines, configure four
  targets, and emit the frame that `frame-shape.test.ts` already pins.
- `detail-normal.ts` and `vfx-billboard.ts` — two more `createTexture` calls, found only by grepping
  after the five scoped files were done. Both become `TextureSource`s.

**Then three test files**, whose dependency-injection seams point at the factories that changed:
`renderer-resources.test.ts`, `catalog-model.test.ts`, `render-batches.test.ts`. They should inject
into the driver's `createProgram` / `createTexture` seams instead.

**Then the capture**, against the sidecar at `b0a7fbae` — p95 0.660, local contrast 8.74 — with the
goal's budget of under 3/255 mean per-channel.
