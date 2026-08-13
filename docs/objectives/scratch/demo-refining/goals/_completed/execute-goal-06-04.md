# Execute goal 06-04: one sun and a shadow map

Part 4 of 6 of [goal 06](execute-goal-06.md). Work packet **W B.3(D)**.

## Prerequisites

- **[06-03](execute-goal-06-03.md)** landed and captured.
- **Goal 02's W A.1** — the `render-target-filtering` patch, giving render-target samplers linear
  filtering (`scripts/patch-brometal/render-target-filtering.mjs`). A shadow lookup on a point
  sampler is four copies of the same texel, which is not a soft lookup.

## `/goal` objective

The demo has point lights and nothing that casts. Add one directional key light — a sun — and a
shadow map, with a soft four-tap lookup so the edges are not stair-stepped.

This is the largest of the six steps and the one most likely to look wrong in interesting ways.
The acceptance tests below are all mechanical probes for that reason: "does it have shadows" is not
a judgement call here.

## The constraint that shapes the whole design

**BroMetal depth attachments are never sampleable.** You cannot render depth and then read it. The
shadow pass therefore writes **distance to the light** into an ordinary RGBA16F colour target —
which is the approach BroMetal's own `DrawToOptions.clear` documentation describes, so this is the
intended route rather than a workaround.

**`shadowFactor` is radial, not directional.** Its body is `distance(worldPos, lightPos) / range`
(`shader-functions/library-source.js:711`). A sun has no position, so place a virtual light at
`sceneCentre - sunDirection * D`.

**Keep `D ≤ 3 × sceneRadius`, so `range ≤ 4 × sceneRadius`.** This scene is about 16 × 11
(`src/presentation.ts:41-44`: minimum `[-8.2, -0.7, -5.95]`, maximum `[8.2, 2.75, 5.1]`), which
gives `range ≤ 60` and roughly **0.03 world units** of quantisation.

A `range` pushed to 400 "to be safe" makes the quantum 0.2 units and **detaches every contact
shadow from the thing casting it.** If shadows float, this is the first number to check.

## Required outcome

1. **One directional key light**, its direction stated once in the demo and agreed on by every
   shader that uses it — `pipeline-invariants.test.mjs` already asserts one key direction per demo
   and will catch a disagreement.
2. **One depth-from-light pass** writing distance into an RGBA16F target.
3. **A four-tap soft lookup** in the material shaders, sized so the softening is visible without
   smearing contacts.
4. **The virtual light placed by the rule above**, with `D` and `range` computed from the scene
   bounds in code rather than typed as constants. If someone changes the bounds, the shadow map
   should follow.
5. **The existing point lights kept.** This demo's premise is point lighting; the sun is an addition,
   not a replacement.

## Required tests and evidence

- **Shadow probe.** A named probe rectangle in the ground shadow of a designated prop is **≥ 25%**
  darker in luminance than a reference probe on the same material 200 px away.
- **No acne.** Luminance standard deviation inside a probe on a flat lit plane facing the sun is
  **< 0.02**.
- **No peter-panning.** The shadow's near edge is within **4 px** of the contact point. This is the
  test that catches a `range` set too large.
- **Cost.** Frame time increases by no more than **40%** versus 06-02, measured through
  `antiky tool get_render_stats`. Measured, not estimated.
- A capture before and after, looked at, with the numbers stated.
- `npm test` green; `shader-output-parity` green with `.gen.ts` regenerated.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- Do not add cascades, a second shadow-casting light, or shadows from the point lights. One sun.
- Do not add SSAO, depth of field, TAA, MRT or a deferred path. All need sampled depth or history
  reprojection; both are blocked or expensive here.
- Do not accept anything needing screen-space derivatives — no `dpdx`, `dpdy` or `fwidth` exist.
- Do not change ambient. That is 06-05, and changing both at once makes it impossible to tell which
  one darkened the scene.
- Do not add bloom or a grade. That is 06-06.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`. Touching `combat-arena`, `traversal-study` or
  `antiky-town` is a scope error — those are goal 07.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed. The sidecar is.
- Preserve unrelated dirty worktree changes.
- **`renderer.ts` is at 308 lines and this step adds a pass to it.** When it crosses 500, split it by
  responsibility — the shadow pass is a clean thing to lift out — not merely to satisfy a count.
- Do not loosen a budget bound to pass.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to the same fixed step
count used in the previous steps.

## Completion definition

Complete when one sun casts through one distance-to-light pass with a four-tap lookup, all four
probe and cost measurements pass, `npm test` is green, and a fresh capture has been looked at beside
06-03's. If a probe cannot be met, stop and report the measurement that failed — do not substitute a
subjective judgement for it, and do not carry an unverified step into 06-05.
