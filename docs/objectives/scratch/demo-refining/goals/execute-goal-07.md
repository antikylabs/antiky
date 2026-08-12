# Execute goal 07: carry the render slice to combat-arena, traversal-study and antiky-town

## Prerequisites

Complete [execute goal 06](execute-goal-06.md) first. `point-light-expo` is the **reference
implementation** for this goal: its colour pipeline, HDR target, shadow pass, ambient model, post
chain and BRDF are the shape to follow. Read that demo's `src/renderer.ts` and `src/shaders/` before
writing a line here.

Goal 06's prerequisites still apply and must still be green: the capture harness and frame-statistics
library (W0.1, W0.2, W0.2b), the per-demo visual budgets (W0.3) for all three demos in this goal, the
pipeline invariant tests (W0.4), and both BroMetal patches (W A.1 linear render-target filtering,
W A.2 MSAA preserved in `drawTo`, `dist/runtime/webgpu.js:761` and `:235`).

`antiky-town` now has a capture at `evidence-captures/antiky-town-canvas.png`. **Look at it before
touching that demo.** It is a materially better image than the other three — real cast shadows, a sky
gradient with a visible sun, warm-lit against cool-shadowed surfaces, textured materials and a composed
frame — which means this goal's job there is to hold that quality while the pipeline changes
underneath it, not to improve it. Its W0.3 budget does not exist yet: author it in this goal from the
current capture as a **regression guard**, not as a target to chase.

## `/goal` objective

Carry work packets W B.1 through W B.5 of `06-WORK-PACKETS.md` to
`packages/demos/antiky/combat-arena`, `packages/demos/antiky/traversal-study` and
`packages/demos/antiky/antiky-town`, one demo at a time, in the same strict order goal 06 used,
adapted to each demo's own materials and scene.

Copy the reference implementation by hand. **Duplication across the demos is expected and accepted** —
it is the slice process, and goal 12 extracts `BroMetalRenderDriver` from the resulting
implementations rather than from a framework designed up front.

Where a demo must diverge from the reference, the divergence carries a comment saying so and why.
Undocumented divergence is exactly how `combat-arena` ended up with three shaders disagreeing about
where the sun is (`src/shaders/ship-model.shader.ts:65-66`, `src/shaders/arena-model.shader.ts:62`,
`src/shaders/arena-surface.shader.ts:62`) and three fog ranges fading to three different near-blacks
(`ship-model.shader.ts:77`, `arena-model.shader.ts:72`, `arena-surface.shader.ts:72`).

**`antiky-town` materially increases this goal and that must not be absorbed silently.** It is the
largest antiky demo — roughly 12,500 lines under `src/` with its own voxel surface mesher, foliage
system, water features, sprite batching, a 1,286-line character motor and 13 shader files, many of
them already paired with a dedicated shadow variant. Budget it as more work than `combat-arena` and
`traversal-study` combined. It is also the repository's only **2.3D** artifact, so including it is
what finally gives ADR 0004's equal-support-for-2D-3D-2.3D commitment real render evidence instead of
an assumption.

The three demos may run as parallel tracks — their owned-file sets are disjoint — but within each
demo the packets are strictly serial.

## Required outcome

When the work is complete, all three demos must have:

> **Half of W B.1 already landed.** Goal 04 added the sRGB decode on albedo sample across all ten
> texture-sampling shaders in the four Antiky demos, with `pipeline-invariants.test.mjs` asserting
> every albedo sampler decodes, no data texture is decoded, and every copy of the helper is
> identical. **What remains here is the encode on output.** Do not re-add the decode.
>
> Note what that leaves behind: `antiky-town` already encodes (`town-post.shader.ts:268`) so it is
> correct end to end, but the other three demos have no post pass and therefore no encode at all.
> They are currently decoded-but-not-encoded, which is why they measure darker than before goal 04
> — combat-arena p95 0.101 -> 0.081, point-light-expo 0.090 -> 0.050, traversal-study 0.400 -> 0.258.
> That is the cancellation described below coming apart, and closing it is this packet's job.

1. **W B.1 — managed colour.** sRGB decode on albedo sample, lighting in linear, one encode on
   output, matching the reference. Colour-pipeline unit test per demo.
2. **W B.2 — one HDR RGBA16F scene target and exactly one tone-map** in a post pass. For
   `traversal-study` this also ends an existing inconsistency: only **1 of its 3 shaders tone-maps at
   all** today — `src/shaders/traversal-surface.shader.ts:72` does,
   `src/shaders/traversal-model.shader.ts:56` (which draws **all 13 catalog GLBs**) and
   `src/shaders/traversal-glow.shader.ts:57` do not.
3. **W B.3 — one directional key light and a PCF shadow map** per demo, writing distance-to-light
   into an RGBA16F colour target. One sun direction per demo, asserted by W0.4.
4. **W B.4 — hemispheric ambient and baked vertex AO** replacing each demo's flat ambient constant.
5. **W B.5 — bloom, colour grade and vignette** on the HDR target.
6. **A real energy-conserving GGX BRDF** in each demo's shading helpers, carried from the reference.
   `combat-arena`'s ship shader has **zero specular at all** today — `ship-model.shader.ts:70-73`
   scales the authored texture by diffuse terms and nothing else — which is fatal against a Rocket
   League target. Its rim term is computed at `:69` and then gated behind the emissive parameter at
   `:74`, so it appears only on dashing ships; ungate it.
7. **`traversal-study`'s three-step toon ramp replaced wholesale.**
   `traversal-model.shader.ts:51-52` is `0.54 + smoothstep(0.18, 0.25, diffuse) * 0.2 +
   smoothstep(0.62, 0.7, diffuse) * 0.24` — a ramp spanning 0.54→0.98, a **1.81:1 maximum contrast
   ratio**, with no view-dependent term at all. That single expression, applied to all 13 GLBs, is on
   its own a complete explanation for why the platformer looks flat. Do not port the band constants.
8. **One agreed sky per demo.** `traversal-study` currently renders **three** different sky colours in
   one frame: fog to `(0.55, 0.65, 0.66)` (`traversal-model.shader.ts:56`), fog to
   `(0.52, 0.63, 0.65)` (`traversal-surface.shader.ts:71`), and `clearColor: [0.38, 0.57, 0.68]`
   (`src/renderer.ts:297`). One value, one source.
9. **`antiky-town` aligned to the reference without losing what it already does right** (see In
   scope), and holding a genuine HDR range for the first time.
10. **All three demos' W0.3 visual budgets green**, with a committed `visual-metrics.json` sidecar per
    packet per demo, and `antiky-town`'s budget authored as part of this goal.

## In scope

- Per demo, in order: W B.1 → W B.2 → W B.3 → W B.4 → W B.5. Each packet is a separate commit ending
  in a fresh capture the implementer actually looks at.
- **Name the reference.** Each demo's renderer carries a comment naming `point-light-expo` as the
  implementation it was copied from, so the next reader knows which is authoritative and goal 12 knows
  what to diff.
- **Comment every deliberate divergence** on the line above it, in the form W0.4 can parse. A demo
  legitimately needs a different sun angle, a different exposure and a different grade; it does not
  legitimately need three sun angles.

**`antiky-town` is an audit-and-align, not a rebuild. Chesterton's Fence applies hard here.** Unlike
the other demos it already renders offscreen and already post-processes:

- It creates a 1024²/2048² shadow target and draws a full shadow pass into it
  (`src/town/index.ts:271`, `:904`), sampling the result as an ordinary colour texture through
  `uShadowMap` — which is the same approach the reference uses. **Do not replace this with a second
  shadow system.** Reconcile the two and keep the one that measures better.
- It creates a full-canvas scene target (`src/town/index.ts:748`) and resolves it through a single
  post shader that grades, tone-maps and gamma-encodes in the right order and in one place
  (`src/town/shaders/town-post.shader.ts:268` — `gammaCorrect(tonemapACES(positiveGrade), 2.2)`),
  followed by a vignette. That is already W B.2's and most of W B.5's shape.
- **The actual W B.2 gap is the format.** `createRenderTarget(renderer, { width, height, depth: true })`
  requests no HDR format, so the scene target has no headroom, nothing can exceed 1.0, and bloom has
  nothing to bloom. Moving it to RGBA16F is the change; the plumbing already exists.
- **The scene target's alpha channel is load-bearing.** The water features deliberately do not alpha
  blend and instead write linear camera distance into scene alpha, standing in for the depth buffer
  BroMetal cannot sample (`src/town/shaders/town-water-features.shader.ts:48-49`,
  `src/town/art/town-water-features.ts:456`). Any format or blend change **must preserve that
  convention** or must replace it deliberately and prove the water still reads. This is the single
  highest-risk edit in the goal.
- It already loses 4× MSAA today, because everything it draws goes through an offscreen pass and
  `drawTo` forces `passSamples = 1`. W A.2 recovers it, so `antiky-town` should show an aliased-edge
  count that **decreases** here while the other two only hold steady.
- Thirteen shader files, most with a paired `-shadow` variant, all needing the same colour treatment.
  Do the voxel surface first, then props and awnings, then sprites, then foliage and water — sprites
  and foliage are alpha-cutout paths where a wrong decode shows up as fringing, and water is the one
  with the depth-in-alpha contract.

**Delete rather than port**, per `04-COMPLEXITY-REDUCTION.md`:

- `uGradeColor` / `uGradeMix` (`traversal-model.shader.ts:24-25`), whose runtime values at
  `traversal-study/src/renderer.ts:307-314` currently replace ~90% of the cloud texture and ~78% of
  the cliff texture with flat colour.
- `vWash` (`traversal-model.shader.ts:42`) — hemispheric ambient does this properly.
- `heightGlow` (`arena-surface.shader.ts:65`) and `heightHaze` (`traversal-surface.shader.ts:70`) —
  hand-rolled fake aerial perspective, superseded by real fog plus bloom.
- Any `min(specGGX, …)` clamp, and `uExposure` as a per-material uniform.

**Contact shadows leave the lit path.** `combat-arena` draws them as **cubes**
(`src/combat-projection.ts:240` and `:245`, through the surface batch created from `createCube()` at
`:227`); `traversal-study` draws an opaque squashed sphere (`src/renderer.ts:425`) whose normals are
still spherical, which is why the capture reads as a hole punched in the platform. Move both to an
unlit soft-edged path as part of W B.3. `antiky-town` already casts real shadows and needs none of
this.

`traversal-study` runs `cull: 'none'` (`src/renderer.ts:297`); turn on back-face culling in the same
change unless a specific surface needs double-siding, and prove it with an unchanged capture.

Capture through the Antiky MCP with the fence-and-retry sequence, and use `pause_simulation` →
`step_simulation` to a fixed step count for comparable frames. There is no seed; do not write an
acceptance criterion of the form "the same inputs produce the same frame".

## Required tests and evidence

Per demo, at minimum, prove:

- **Colour-pipeline unit test.** A known albedo under a known light lands within **2/255** of the
  analytically computed value.
- **W B.2 invariance.** Mean per-channel difference between pre- and post-packet captures is under
  **3/255**, and aliased-edge pixel count does not increase — for `antiky-town` it must **decrease**,
  which is the direct proof that W A.2 restored the MSAA its offscreen pass was already discarding.
- W0.4 passes: no `tonemapACES` outside the single post shader; all shaders in a demo agree on one key
  direction, one fog range and one sky colour, or carry a deliberate-divergence comment; every
  `*.shader.ts` has an up-to-date `*.shader.gen.ts`.
- **Shadow probes.** A probe in the ground shadow of a designated object is **≥ 25%** darker than a
  reference probe on the same material 200 px away; luminance standard deviation on a flat lit plane
  is **< 0.02**; the shadow's near edge is within **4 px** of the contact point.
- **Cost.** Frame time increases by no more than **40%** over W B.2, from `antiky tool
  get_render_stats`. Measure `antiky-town` separately at both shadow resolutions — it switches between
  1024² and 2048² on canvas width (`src/town/index.ts:270`).
- **Ambient.** Up-facing versus down-facing ambient contribution differs by **≥ 30%**; an
  inside-corner probe is **≥ 15%** darker than a flat-surface probe of the same material.
- **Bloom.** A probe 20 px from a known emissive is **≥ 20%** brighter than with bloom disabled, with
  monotonic falloff; `clippedHigh` stays inside budget; corner luminance is **10–25%** below centre.
- **Ramp contrast, `traversal-study` only.** The replacement shading response measured as data has a
  brightest-to-darkest luminance ratio of **≥ 6:1** (today 1.81:1). Checkable without rendering.
- **Specular presence, `combat-arena` only.** On a designated ship hull, the 95th-percentile luminance
  inside the hull ROI is **≥ 2×** its median. Today the hull has no specular term, so the ratio is
  near 1.
- **Water depth contract, `antiky-town` only.** A regression test written **before** the format change
  asserting that the linear camera distance recovered from scene alpha matches the expected value for
  a known fragment. If the contract is replaced rather than preserved, the test moves to the
  replacement and the water still passes its own visual probes.
- **All three W0.3 budgets green** on every bound at the end of W B.5, with `visual-metrics.json`
  committed per packet.
- `npm test` green after every commit, including `antiky-town`'s existing suites — its
  `src/town/art/town-validation.test.ts` and character-motor tests are the regression net for edits
  to geometry and placement code.

## Explicit non-goals

- Do not modify `point-light-expo`. If the reference needs a fix, that is a change to goal 06's output
  and must be justified as a bug, not a preference — and it must be captured and re-verified against
  goal 06's acceptance criteria.
- Do not extract a shared render package, material package, or `BroMetalRenderDriver`. Goal 12 does
  that, from the implementations this goal completes.
- Do not deduplicate the demos' shader code "while you are in there". Convergence is the input to goal
  12, not a task here.
- Do not rewrite `antiky-town`'s voxel mesher, character motor, sprite batching or town generation.
  This goal touches its render path and its shaders. Its foliage placement and water look are goal 08.
- Do not delete `antiky-town`'s existing shadow pass or post shader to replace them with copies of the
  reference. Reconcile, measure, keep the better one, and say which in the commit.
- Do not accept any solution requiring screen-space derivatives — no `dpdx`, `dpdy` or `fwidth` exists
  in BroMetal's DSL, verified against `node_modules/brometal/dist/dsl/builtins.d.ts`. This also blocks
  specular anti-aliasing; note it as a known limitation.
- Do not add SSAO, depth of field, TAA, MRT or deferred rendering, and do not build a depth prepass to
  replace `antiky-town`'s depth-in-alpha convention.
- Do not fix the UV collapse or restore normal maps — Track C. Do not do art direction, VFX or
  composition — goal 08.
- Do not loosen a W0.3 bound to make a packet pass.

## Engineering constraints

- Demos hand-roll rendering **per demo**. Copying the reference implementation by hand is the intended
  method, not a shortcut to be optimised away.
- Tests are required for every code change. Regression test first when fixing a reported bug: write
  it, watch it fail, then fix the code. The water depth contract above is exactly this.
- Short one-line commit messages. No coauthor tags. One commit per packet per demo.
- Capture PNGs are **not** committed — `.antiky/` is gitignored and `*.png` is LFS here. The committed
  artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes.
- Two packets may run in parallel only if their owned-file sets are disjoint. The three demos qualify;
  packets within one demo do not.
- Keep handwritten files under 500 lines; split by responsibility when a renderer crosses it.
  `antiky-town/src/town/index.ts` is already far past that and will grow here — decompose it by
  responsibility as part of the work, not as a separate cleanup.

## Completion definition

The goal is complete only when all three demos have all five packets landed in order with per-packet
captures and committed sidecars, all three colour-pipeline unit tests pass within 2/255, the shadow,
cost, ambient and bloom probes pass for each, `combat-arena` has a measurable specular response and
one sun direction, `traversal-study` has a ≥ 6:1 shading response and one sky colour, `antiky-town`
holds a real HDR range with its water depth contract intact and its aliased-edge count reduced, and
all three W0.3 visual budgets are green on every bound.

If a criterion cannot be met, report the failing measurement plainly and stop. Do not carry an
unverified packet forward into the next one, and do not let a demo diverge from the reference without
saying so in the code.
