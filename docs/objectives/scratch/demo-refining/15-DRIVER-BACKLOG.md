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

The driver is **capable and now proven twice**. It has the contract, the implementation, a second
implementation proving portability, a sprite test satisfying `docs/adr/framework/0004-23d_H.md`, and
**two demos rendering through it** — `point-light-expo` and `antiky-town`, both captured, both inside
their sealed visual budgets. Goal 12 names that as the critical acceptance criterion.

Whether that promotes the render driver from a **Direction** claim to a Current one under
`packages/website/PRODUCT.md`'s taxonomy is the repository owner's call, not this note's. The public
wording is unchanged here.

## SOLVED — point-light-expo renders through the driver

**Two faults, both fixed.** The demo now captures, the visual budget passes 10/10, the suite is
88/88, and `rg` finds no BroMetal resource creation in its `src`.

1. **`uTime` bound on a program that does not declare it** — see the section above.
2. **`uBillboard` bound to a texture *key* instead of a texture.**
   `createContactShadowBatch`'s `setup` did `program.uniforms.uBillboard.set(billboardTexture as
   never)`, where `billboardTexture` is the string `'vfx-billboard'`. BroMetal answered *"uniform
   'uBillboard' (sampler2D) expects a texture created from this WebGPU renderer"*. `setup` runs
   during pipeline registration, before the driver has loaded any texture, so there was nothing to
   bind anyway — the frame names it by key, exactly as the floor's five maps do. The `as never` cast
   is what let it typecheck. Deleting the line was the entire fix.

**Before and after**, against sidecar `b0a7fbae`:

| | before | after | drift |
|---|---|---|---|
| mean luminance | 0.128856 | 0.120989 | **2.0/255**, inside the 3/255 budget |
| p95 | 0.660144 | 0.644686 | |
| local contrast | 8.7395 | 8.63 | |

### How it was actually found, which matters more than the bug

Twelve hypotheses were eliminated blind across four sessions. What ended it was fixing the
**diagnosability**, not forming a thirteenth.

`capture_frame` is not external — it is Playwright in
`packages/cli/src/host/managed-capture-runtime.ts`. It now installs `pageerror`, `console` and
`requestfailed` handlers that append to the file named by **`ANTIKY_BROWSER_LOG`**, and does nothing
at all when that variable is unset:

```
ANTIKY_BROWSER_LOG=/tmp/browser.log npm run demos:shoot -- --demo <slug>
```

The first instrumented run produced *no output*, and that was the decisive result: the host catches a
module-entry rejection, so Playwright never sees an uncaught error. Adding one `console.error` in the
demo's own catch made the message and stack appear immediately.

**The lesson worth carrying:** when a harness reports only a timeout, fix the harness before forming
another hypothesis. Four sessions of elimination cost far more than the twenty minutes the
instrumentation took.

## SOLVED — antiky-town renders through the driver

**Done in one pass, and the capture is bit-identical to the baseline.** `rg` finds no BroMetal
resource creation under its `src`, the demo's suite is 48/48, and every measured value in the
sidecar is unchanged:

| | before | after | drift |
|---|---|---|---|
| mean luminance | 0.116026 | 0.116026 | **0.0/255** |
| p95 | 0.361779 | 0.361779 | |
| local contrast | 7.7478 | 7.7478 | |
| saturation | 0.31997 | 0.31997 | |

Sixteen pipelines, five driver-owned textures, two targets, three passes. Only `capturedAt`, the
source digest and the seal moved.

### Two contract gaps this demo found, both now closed

Neither was a capability the driver was refusing on purpose; both were simply things
`point-light-expo` did not happen to need.

1. **`TargetRequest.filter`.** The driver hardcoded `filter: 'linear'` on every target it made, over
   BroMetal's own `nearest` default. `town-shadow` packs one depth into R and G as a whole part and
   a fraction (`stored.x + stored.y / 255`), so interpolating it decodes to a depth belonging to
   neither texel and fills every shadow edge with acne. The default stays `linear`, because a bloom
   chain is the common case and point-sampling it produces blocky glow — a target holding numbers
   rather than an image now says `nearest` and says why.
2. **`DrawCall.vertexData` and `DrawCall.indices`.** The die-cut characters' side walls are extruded
   from the alpha contour of whichever sprite frame is showing, so the mesh — vertex *count*
   included — is rebuilt every frame. Instance rows cannot express that: there is no fixed
   per-instance shape to write rows into. These are the per-vertex twin of `instanceData` and behave
   the same way, uploaded immediately before the draw.

### What made it a single pass

Both of the traps recorded above were designed out rather than debugged out.

- **`setup` binds geometry, static instance rows and static numeric uniforms — never a texture.**
  Every sampler in the demo is named in the frame by texture key. The awning, prop and foliage
  instance rows *are* static — a building does not move and the wind lives in a uniform — so they
  are uploaded once with the geometry rather than re-sent 60 times a second.
- **No uniform record is spread into a pipeline that does not declare all of it.** The town has four
  near-misses that would each have thrown on a GPU: fog strength is 0.22 on land and 0.2 on water;
  the two water shaders declare no `uShadowSlopeBias`; the water shader has four practical-light
  slots where the voxel and sprite shaders have eight; and `uSkyIntensity`/`uGroundColor` exist only
  on the land shaders. Each is a separate frozen record, and the shader's real interface was read by
  importing the `.shader.gen.ts` and printing `Object.keys(default.uniforms)` — never by grep, which
  also counts the type parameter.

### The harness that proves it without a browser

`tests/renderer-construction.test.ts` builds the whole town runtime in Node against
`tests/support/brometal-stub.ts`, which answers only the names a compiled shader declares, then
submits one real frame and asserts the two targets' filters. Adding one undeclared uniform to the
frame makes it fail with `BroMetal: program "shader[...]" has no uniform named "..."` — verified, not
assumed. Getting there needed `.ts` extensions on the demo's relative imports, which Vite resolved
and Node could not; that is the same gap `point-light-expo` hit on one file.

Every texture the driver fetches is checked to exist on disk, because a missing one rejects
`loadTextures`, which rejects construction, which publishes no frame — and the harness reports that
as a bare timeout with no clue which file is absent.

**The capture succeeded on the first run.** `ANTIKY_BROWSER_LOG` recorded nothing but the inspection
socket closing at shutdown.

### Two things worth knowing for the next demo

- **The source digest covers the framework, not just the demo folder.** Touching
  `packages/framework/src` invalidates all four sidecars, so a framework change means re-sealing
  every demo, not only the one being worked on. `combat-arena`, `point-light-expo` and
  `traversal-study` were re-shot for that reason and their numbers did not move.
- **`traversal-study` fails its own local-contrast budget at 0.58, and did so before this work.**
  Re-sealing reproduced the same number. It is a pre-existing problem, not a migration regression.

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
2. ~~Matrix uniforms passed as plain arrays instead of `Float32Array`~~ — **eliminated by reading
   BroMetal's types.** `UniformHandle.set` accepts `Float32Array | readonly number[]` for every
   vector and matrix type (`runtime/uniforms.d.ts`), so `Array.from(...)` is legal. Worth knowing:
   the contract's `UniformValue` union does not list typed arrays even though `isContractValue`
   accepts them, so a caller must convert. That is a wart, not the fault.
3. ~~The status overlay's `uAtlas` sampler left unbound while the run is playing~~ — **found, fixed,
   and not the whole fault.** The old code bound it once at construction; the rewrite only bound it
   after the run ended, so on frame one the program had no texture at all. That is a genuine bug and
   the fix is kept — a rejected draw, not a hidden panel — but the capture still times out.
4. ~~A draw issued with instance buffers that were never populated~~ — **eliminated as the *first*
   failure, and the fault has been localised much further. See below.**

### The failure is in construction, not in the frame loop

This is the session's one real finding, and it replaces the guesswork above.

Every hypothesis 1-4 was a guess costing a full build-and-capture cycle to test blind, so instead the
failure was made *observable*. `game.ts` now wraps `createRelayRenderer` in a try/catch that publishes
a blank frame instead of rejecting. The failure mode changed immediately:

| Before | After |
|---|---|
| `CAPTURE_RUNTIME_TIMEOUT` — nothing ever published | `The captured frame is a single flat colour` |

The fallback path ran, which means **`createRelayRenderer` throws**. The frame loop is never reached,
so every remaining hypothesis about draw calls, instance buffers and pass order is looking in the
wrong place. What throws is one of: pipeline registration, texture loading, or `configureTargets`.

Checked and cleared since:

- **No duplicate pipeline key.** The only repeated string literal is `'player'`, in `inspection.ts`,
  which is inspection data and never reaches `registerPipeline`.
- **Texture URLs resolve correctly.** `new URL('../assets/...', import.meta.url).href` is the same
  form the demo used before the migration, and Vite rewrites it at build time.

**The remaining channel problem.** `scripts/shoot-demos.mjs` plumbs no page console and no `pageerror`
handler, and it does not surface `context.report` notes on a failed capture — so the thrown message
itself is still not readable from the harness. Getting it needs either a browser console on
`npm run dev:demos point-light-expo`, or a one-line `page.on('console')` in the shoot script. The
second is probably worth doing on its own merits: right now any demo that throws at construction
reports only a timeout, which is what made this cost four blind cycles.

**Remove before merge.** The try/catch in `game.ts` is marked `TEMPORARY DIAGNOSTIC`. It converts a
loud failure into a silent blank frame, which is right for diagnosis and wrong for a merged demo.

### Construction is clean under stubs — so the throw is inside a real BroMetal call

`tests/renderer-construction.test.ts` now builds the **entire** relay renderer in Node and it
**passes**, registering more than fifteen pipelines without throwing. Getting there needed a Node
stand-in for four browser things and one for BroMetal itself, and each gap is worth knowing:

| Gap | Why Node hits it | Stand-in |
|---|---|---|
| `virtual:blackout-relay/*` | Vite virtual modules for the floor textures | `registerHooks` resolve to a data URL |
| `fetch` of a `file:` URL | the GLB models are fetched by URL | served off disk, so the models **parse for real** |
| `createImageBitmap` | decoding a GLB's embedded images | dimensions only |
| `document.createElement('canvas')` | the onboarding overlay paints text | recording no-op 2D context |
| `createProgram` and friends | the driver imports them as **free functions**, and each looks the renderer up in a private WeakMap only a real WebGPU renderer is in | `tests/support/brometal-stub.ts`, which re-exports the real package and overrides exactly four names |

That last row is the reason a stub *renderer* was never going to be enough, and it is also the reason
this test had never existed.

**What the passing test proves and does not prove.** Everything construction does in pure data —
pipeline keys, target descriptions, texture declarations, instance layouts, the GLB parse — is
correct. The throw is therefore inside one of the four real BroMetal calls.

**The strongest remaining hypothesis, and why the test cannot yet see it.** The stub's programs answer
*any* uniform, attribute or instance-attribute name through a `Proxy`. A real BroMetal program does
not: it rejects a name the compiled shader never declared. So a `setup` callback that binds `aUv` or
`aNormal` on a **depth** pipeline — whose shader declares only `aPosition` — passes the stub and
throws on a GPU. The six depth pipelines share their geometry setup with their lit twins, which is
exactly the shape that produces this.

**That hypothesis is now eliminated too.** The generated shader carries `attributes`,
`instanceAttributes` and `uniforms` as **runtime** fields, not only as type parameters, so the stub
was made strict: every binding record throws on a name its shader never declared. Construction still
passes. No `setup` callback binds anything undeclared, on a lit pipeline or a depth twin.

**Texture fetching is eliminated as well.** The test now prints and checks every URL the driver
loads. There are six, and both `file:` ones — `detail-normal-512.png` and `vfx-billboard-256.png` —
exist on disk. The other four are the Vite virtual floor modules, which the bundler rewrites.

### Where that leaves it

Everything about construction that can be checked without a GPU has been checked and is correct:
pipeline keys, declared bindings, target descriptions, texture URLs, instance layouts, and the GLB
parse — the models are parsed from their real bytes in this test, not faked.

**A diagnostics channel exists and is worth knowing about.** `packages/cli/src/bin.ts tool
get_diagnostics --project <manifest>` reports runtime health while `npm run dev:demos <slug>` is
running. For this failure it returns `ANTIKY_SOURCE_BUILD_FAILED — "source update did not produce a
ready runtime."`, which confirms the shape but still does not carry the thrown message. Neither the
dev-service log nor `.antiky/` holds a browser console. The tool list also includes
`get_render_stats`, `get_render_evidence` and `get_event_log`, none of which were tried.

**Two further hypotheses died on inspection, both worth recording so they are not retried:**

- *Eager target creation.* The pre-migration demo built its scene and bloom targets lazily inside the
  frame and rebuilt them on resize; the driver builds them at construction. Still a real difference,
  still unexplained, but BroMetal clamps any zero dimension to 1, so it does not obviously throw.
- *`filter: 'linear'` forced onto the shadow map.* The driver hardcodes linear filtering for every
  target, and WebGPU cannot linearly filter a depth texture — which looked decisive until reading
  `shadow-pass.ts`: the shadow map clears to `[1, 1, 1, 1]` and stores distance in a **colour**
  texture, which is filterable. `depth: true` there requests a depth *attachment* for the test, not a
  sampled depth format. The pre-migration scene target also combined `depth: true` with
  `filter: 'linear'`. Not the fault.

### A real bug, found and fixed: `uTime` bound on a program that does not declare it


`npm run dev:demos point-light-expo` prints, on every build:

```
[shaders] ⚠ relay-ring.shader.ts — uniform 'uTime' is declared but never used
[shaders] ⚠ reliquary-model.shader.ts — uniform 'uTime' is declared but never used
```

A uniform BroMetal reports as unused is **stripped from the compiled program**, so the program has no
`uTime` to bind. The built bundle nevertheless sets it:

```js
{ pipeline: "rings", uniforms: { uViewProj: y, uTime: t.time, uBillboard: { texture: "vfx-billboard" } } }
```

Setting a uniform a program does not have is exactly the class of error a real BroMetal program
rejects and a permissive stub accepts. The pre-migration demo bound its uniforms by hand and simply
never set the stripped one; the frame data now sets it declaratively for every pipeline.

**Why the construction harness does not catch it yet.** The strict stub validates binding names, but
only for what construction touches — the `setup` callbacks. Frame uniforms are set at *submit* time,
and the test never submits a frame. Extending it to build one frame and submit it through the driver
against the strict stub is a small change and would either confirm this or clear it, with no capture
cycle and no browser.

**Confirmed and fixed.** I first talked myself out of this by grepping `uTime` in
`relay-ring.shader.gen.ts` and counting four hits — but those are the *type parameter* and the WGSL
source text, not the runtime `uniforms` map. Importing each compiled shader and inspecting
`default.uniforms` gives the real answer:

| Declares `uTime` | Does not |
|---|---|
| `foundry`, `foundry-glow`, `night-backdrop`, `relay-ring`, `reliquary-model` | `reliquary-floor`, `contact-shadow`, `bloom-blur`, `bloom-extract`, `model-depth`, `onboarding`, `post`, `surface-depth` |

The migration hoisted `uTime` into the shared `perFrame` uniform record, which the **floor** draw
spreads — and `reliquary-floor` does not declare it. The pre-migration code bound uniforms
per-program by hand, so it simply never set `uTime` on the floor. A value every lit material happens
to want is not automatically a value every one of them has. `uTime` now lives in `litDraw`, whose
pipelines all declare it, and the floor keeps the rest of `perFrame`.

**The test that catches it** is the second case in `renderer-construction.test.ts`: it builds one
real frame from the simulation's own view and submits it through the driver against the strict stub.
It failed with `program "unlabelled" has no uniform named "uTime"` before the fix and passes after.
Construction alone never touched it, because uniforms are bound at submit time.

**Reusable lessons.** A shader warning in the dev log describes the *source*; the compiled interface
is the `uniforms` object in the `.shader.gen.ts` file, and `grep` on that file will happily count the
type parameter and mislead you. Import it instead.

### Still failing after that fix — there is a second fault, in construction

`npm run demos:shoot -- --demo point-light-expo` still returns `CAPTURE_RUNTIME_TIMEOUT` with the
`uTime` bug fixed and all 88 demo tests passing. That is consistent with everything else recorded
here: the blank-frame fallback proved the catch around `createRelayRenderer` runs, so construction
throws, and `uTime` was a *frame-time* fault sitting behind it. Two faults, one now closed.

So the remaining throw is in something only a real WebGPU device rejects.

Two more candidates were checked and cleared after the `uTime` fix:

- **Empty geometry uploaded at construction.** The stub's bindings now reject `undefined`, `null` and
  zero-length data, and `setIndices` rejects an empty index buffer. Construction still passes, so no
  batch is built without geometry.
- **The two PNG textures 404-ing.** `dist/assets` contains four JPGs and three GLBs and no PNG, which
  looked damning. They are **inlined as base64 data URLs** in the bundle instead — `data:image/png`
  appears twice — so both resolve without a network fetch at all.

**Eleven hypotheses are now eliminated with evidence.** The honest position is that the remaining
fault cannot be identified from Node, because everything Node can observe has been made observable
and is correct. It needs the browser's error, which no tool in this repository surfaces. The two candidates left are the WGSL
pipeline creation itself and the eager target creation described below. Both need a browser to
observe, and the harness cannot narrow them further — which makes surfacing the browser error the
next step rather than another hypothesis. `scripts/shoot-demos.mjs` cannot do it (`capture_frame` is
an external tool with no console plumbing), so this needs a browser on
`npm run dev:demos point-light-expo`.

### Two things fixed on the way

- **`renderer.ts:43` imported `./shaders/reliquary-floor.shader.gen` with no extension**, where every
  other shader import carries `.ts`. Vite resolved it, so the build and the typecheck were both
  clean; Node could not, which is how it surfaced. Fixed.
- **`createRenderTarget` was cleared as a suspect.** The driver passes an options object and
  BroMetal's implementation is positional, which looked like a real mismatch — but the exported
  wrapper unpacks the object before delegating, so the call is correct.

### One real behavioural difference from the pre-migration demo, not yet explained

The original renderer created its scene and bloom targets **lazily, inside the frame**, and rebuilt
them when the canvas size changed (`renderer.ts:350,384` before the migration). The driver's
`configureTargets` creates them **eagerly at construction**. Nothing yet shows this throws, and
BroMetal clamps a zero dimension to 1, but it is a genuine change in when the canvas is measured and
it should be ruled in or out rather than left unmentioned. BroMetal refuses
   that with "no instance data — call set(...) before draw()", which is the exact failure
   `presentation.test.ts:296` was written to guard and which no headless test can see. The suspects
   are the six depth pipelines: they receive `depthInstanceData`, but nothing verifies those arrays
   were written before the shadow pass runs on the very first frame.

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
