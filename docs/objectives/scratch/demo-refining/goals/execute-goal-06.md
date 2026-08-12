# Execute goal 06: build the reference render slice in point-light-expo

## Prerequisites

Complete goals 00, 01 and 02 first. This goal consumes their output and cannot be verified without
it:

- **Goal 00** — ADR `framework/0021` placed, so a game module owning BroMetal directly is an
  explicitly permitted path rather than an ambiguous one, and `npm test` green at HEAD (W0.1b).
- **Goal 01** — `capture_frame` working on the asset-heavy demos (W0.1), `npm run demos:shoot`
  wrapping the Antiky MCP (W0.2), the frame-statistics library (W0.2b), the per-demo visual budget
  `packages/demos/antiky/point-light-expo/tests/visual-budget.test.mjs` (W0.3), and the pipeline
  invariant tests (W0.4). Without W0.2b nothing in this goal is measurable.
- **Goal 02** — both BroMetal patches: linear filtering on render-target samplers (W A.1, against
  `dist/runtime/webgpu.js:761`) and MSAA preserved in `drawTo` (W A.2, against
  `dist/runtime/webgpu.js:235`). W A.2 is hard-blocking: without it, the first offscreen pass in
  this goal silently discards the 4× MSAA the demo has today.

Do not start any step below whose prerequisite step in this goal is not landed and captured.

## `/goal` objective

Build the reference render slice — colour management, an HDR scene target, a directional key light
with a shadow map, hemispheric ambient with baked ambient occlusion, and a post chain — inside
`packages/demos/antiky/point-light-expo` and nowhere else.

This covers work packets W B.1 through W B.5 of `06-WORK-PACKETS.md` for one demo. `point-light-expo`
goes first because its entire premise is point lighting, which makes it the honest test of the
approach before the pattern is carried anywhere. A lighting showcase whose lights paint a flat fill
instead of a gradient is the clearest available signal of whether this slice works.

Hand-roll everything inside the demo. This implementation is the first of the working implementations
that goal 12 extracts `BroMetalRenderDriver` from; goal 07 produces the rest, across `combat-arena`,
`traversal-study` and `antiky-town`. Extraction from a single implementation is the failure mode that
decision exists to avoid, so this goal deliberately stops at one demo.

## Required outcome

When the work is complete, `point-light-expo` must have:

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

1. **W B.1 — managed colour.** Albedo decoded from sRGB to linear on sample in-shader, all lighting
   evaluated in linear, and one encode on output. BroMetal exposes no sRGB texture format
   (`dist/runtime/webgpu.js:836-842`), so the decode is in the shader by necessity, not by choice.
2. **W B.2 — one HDR scene target and exactly one tone-map.** The scene renders into RGBA16F;
   exposure and a single ACES tone-map run in a post pass. No material shader calls `tonemapACES`.
3. **W B.3 — one directional key light and a PCF shadow map.** One sun, one depth-from-light pass, a
   4-tap soft lookup. BroMetal depth attachments are never sampleable, so the shadow pass writes
   distance-to-light into an ordinary RGBA16F colour target — the approach BroMetal's own
   `DrawToOptions.clear` documentation describes.
4. **W B.4 — hemispheric ambient and baked vertex AO** replacing the flat constant ambient at
   `src/presentation.ts:11-14`, with AO baked into static geometry at build time.
5. **W B.5 — bloom, colour grade and vignette** as post stages reading the HDR target.
6. **A real BRDF.** BroMetal's `specGGX` is the distribution term only — no Fresnel, no geometry
   term, and a hard-coded `0.25` where the real denominator belongs. The clamps that exist purely to
   contain it (`src/shaders/reliquary-model.shader.ts:60` `min(specGGX(...), 1.5) * 0.12` and
   `src/shaders/foundry.shader.ts:36` `min(specGGX(...), 2.4) * (0.16 + metalness*0.84)`) are gone,
   replaced by an energy-conserving GGX that needs no ceiling.
7. **The scar tissue deleted, not re-tuned.** `uDiffuseLift`, `uTextureContrast`, `uSaturation`
   (`src/shaders/reliquary-model.shader.ts:84-86`, values at `src/presentation.ts:21-26`) and the
   `mix(vec3(0.48, 0.48, 0.48), …)` grey-wash (`src/shaders/reliquary-model.shader.ts:166`, and the
   floor's copy at `src/shaders/reliquary-floor.shader.ts:113`) are removed. `uExposure` stops being
   a per-material uniform (`src/presentation.ts:9`) and moves to the single post stage.
8. **The demo's W0.3 visual budget green**, and a committed `visual-metrics.json` sidecar per step.

## In scope

- The five packets run **strictly in order**, each independently shippable and each ending in a fresh
  capture that the implementer actually looks at. Do not batch them into one change.
- **W B.1 first.** Record the bug's shape in the commit and in the test: the missing sRGB decode and
  the missing gamma encode cancel exactly for unlit passthrough, which is why this survived review —
  an untextured or unlit surface looks correct. They stop cancelling the moment you multiply by a
  light, so all lighting maths currently happens in display space. That is the whole explanation for
  the milky look, and it is why the wash knobs were added.
- **W B.2 is plumbing and must look like plumbing.** Its only visible change is none. If the captured
  frame moves, the tone-map, the exposure or the encode is wrong — find it before continuing.
- **W B.3 shadow-map budget.** `shadowFactor` is radial, not directional
  (`shader-functions/library-source.js:711` — its body is `distance(worldPos, lightPos) / range`), so
  place a virtual light at `sceneCentre - sunDirection * D`. Keep `D ≤ 3 × sceneRadius` so
  `range ≤ 4 × sceneRadius`. This scene is ≈16×11 (`src/presentation.ts:41-44`), giving `range ≤ 60`
  and ≈0.03 world units of quantisation. A `range` pushed to 400 "to be safe" detaches every contact
  shadow, because the quantum becomes 0.2 units.
- **W B.4** covers both the ambient term and the offline vertex-AO bake for static geometry.
- **W B.5** adds bloom, grade and vignette on the existing HDR target, and depends on W A.1 — a
  downsample chain on a point sampler produces blocky, crawling glow.
- Delete rather than port: the per-instance `emissive` lift on rocks and stumps in
  `src/reliquary-model-layout.ts`, and the `pulse` self-illumination sines at
  `src/shaders/foundry.shader.ts:183` and `src/shaders/reliquary-model.shader.ts:178`. Both exist
  because nothing else in the frame moved; real specular and bloom replace them.
- Capture with the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` →
  `get_runtime_status` → `get_capture_capabilities`, retry `CAPTURE_BUILD_STALE`,
  `CAPTURE_RUNTIME_STALE` and `CAPTURE_DIMENSIONS_MISMATCH`, and use `pause_simulation` →
  `step_simulation` to a fixed step count so frames are comparable across a change. There is no
  deterministic seed; `capture_gameplay_sequence` declares itself non-deterministic.

## Required tests and evidence

At minimum, prove:

- **The colour pipeline unit test (W B.1's real proof).** A known albedo under a known light produces
  an output within **2/255** of the analytically computed value. This is a unit test of the transfer
  functions, not an eyeball check, and it is the single acceptance test that decides this goal.
- `rg 'uDiffuseLift|uTextureContrast|uSaturation'` over the demo returns **zero** hits, and so does a
  search for the `mix(vec3(0.48` grey-wash.
- **W B.2 invariance.** Mean per-channel difference between the pre-packet and post-packet capture is
  **under 3/255**, and the aliased-edge pixel count does **not increase** — the second half proves
  W A.2's MSAA patch held through the offscreen pass.
- W0.4's "no `tonemapACES` under `src/shaders/`" assertion passes, and the demo's shaders agree on one
  key direction and one fog range.
- **W B.3 shadow probes.** A named probe rectangle in the ground shadow of a designated prop is
  **≥ 25%** darker in luminance than a reference probe on the same material 200 px away. No acne:
  luminance standard deviation inside a probe on a flat lit plane facing the sun is **< 0.02**. No
  peter-panning: the shadow's near edge is within **4 px** of the contact point.
- **W B.3 cost.** Frame time increases by no more than **40%** versus W B.2, measured through
  `antiky tool get_render_stats`, not estimated.
- **W B.4 ambient.** An up-facing and a down-facing surface under the same light differ in ambient
  contribution by **≥ 30%**; an inside-corner probe is **≥ 15%** darker than a flat-surface probe of
  the same material; `luminanceP05` now meets its W0.3 bound.
- **W B.5 bloom.** A probe 20 px from a known emissive is **≥ 20%** brighter than the same probe with
  bloom disabled, and falloff is monotonic with distance. `clippedHigh` stays inside its W0.3 budget.
  Corner luminance sits **10–25%** below centre luminance.
- **The demo's W0.3 budget is green on every bound** at the end of W B.5, and each packet commits a
  `visual-metrics.json` sidecar.
- `npm test` green, and the demo's existing shader-output-parity check still passes — every
  `*.shader.ts` has an up-to-date `*.shader.gen.ts`.

## Explicit non-goals

- Do not touch `combat-arena`, `traversal-study` or `antiky-town`. Those are goal 07.
  `antiky-town` is in scope for this objective and is the largest demo in it, but it is deliberately
  not the reference — it already owns offscreen targets, a shadow pass and a single post tone-map
  (`packages/demos/antiky/antiky-town/src/town/index.ts:271`, `:748`, `:904`, `:932`, and
  `src/town/shaders/town-post.shader.ts:268`), so building the slice there first would let existing
  machinery hide a mistake instead of exposing it. Read that demo before goal 07; do not edit it here.
- Do not extract a shared render package, a material package or a `BroMetalRenderDriver`. Goal 12
  extracts the driver from two working implementations; this goal produces the first of them.
- Do not accept any solution requiring screen-space derivatives. BroMetal's DSL exposes no `dpdx`,
  `dpdy` or `fwidth` — verified against `node_modules/brometal/dist/dsl/builtins.d.ts`. The same gap
  blocks Toksvig and LEAN specular anti-aliasing; record that as a known limitation rather than
  designing around it here.
- Do not add SSAO, depth of field, TAA, MRT or a deferred path. All need sampled depth or history
  reprojection; both are blocked or expensive, and none is needed for these scenes.
- Do not re-pack assets, restore normal maps or fix the UV collapse. Those are Track C packets.
- Do not do art direction, VFX rework, composition or the per-demo stylisation brief. That is goal 08.
- Do not loosen a W0.3 bound to make a step pass. Budgets are changed by the owner, not by the agent
  failing them.
- Do not tune the wash knobs. They are deleted.

## Engineering constraints

- Demos hand-roll rendering **per demo**. Duplication between demos is expected and accepted here.
- Every antiky demo including `antiky-town` is in scope for this objective. This goal owns exactly
  one of them; touching another is a scope error, not a favour.
- Tests are required for every code change. When fixing a reported bug, write the regression test
  first, watch it fail, then fix the code.
- Short one-line commit messages. No coauthor tags. One commit per packet, not one per goal.
- Capture PNGs are **not** committed — `.antiky/` is gitignored, evidence is session-scoped, and
  `*.png` is LFS here. The committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes. Do not clean the tree.
- Keep handwritten files under 500 lines. `renderer.ts` will grow through this goal; split by
  responsibility when it crosses that line, not to satisfy a count.

## Completion definition

The goal is complete only when all five packets have landed in order, each with its own capture and
committed sidecar, the colour-pipeline unit test passes within 2/255, the shadow and bloom probe
tests pass, the frame-time budget holds, the wash knobs and per-material tone-maps are gone by grep,
and `point-light-expo`'s W0.3 visual budget is green on every bound.

If a packet's acceptance criteria cannot be met, stop and report that plainly with the measurement
that failed. Do not proceed to the next packet on an unverified one, and do not substitute a
subjective judgement for a probe measurement — that substitution is what produced every finding in
this audit.
