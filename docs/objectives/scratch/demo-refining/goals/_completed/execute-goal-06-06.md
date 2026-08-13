# Execute goal 06-06: bloom, grade and vignette, and the budget green

Part 6 of 6 of [goal 06](execute-goal-06.md). Work packet **W B.5(D)**. This is the step where the
demo's visual budget is expected to finally pass on every bound.

## Prerequisites

- **[06-05](execute-goal-06-05.md)** landed and captured.
- **Goal 02's W A.1** — the `render-target-filtering` patch
  (`scripts/patch-brometal/render-target-filtering.mjs`). Bloom is a downsample chain, and a
  downsample chain on a point sampler produces blocky glow that crawls when the camera moves. This
  is hard-blocking, not a nicety.

## `/goal` objective

Add the three post stages that read the HDR target 06-02 built: bloom, a colour grade, and a
vignette. Then delete the fake self-illumination that exists only because nothing else in the frame
was bright.

## What gets deleted, not ported

These exist because the demo had no bloom and no real specular, so things that should have glowed
were faked by adding light to themselves. Real specular arrived in 06-03 and real bloom arrives
here, so they go:

| What | Where |
| --- | --- |
| The per-instance `emissive` lift on rocks and stumps | `src/reliquary-model-layout.ts` |
| The `pulse` self-illumination sine | `src/shaders/foundry.shader.ts:183` |
| The `pulse` self-illumination sine | `src/shaders/reliquary-model.shader.ts:265` |

Genuine emissives — the forge, the relays — keep their emission. The distinction is whether the
thing is a light source or was merely pretending to be one so it would not disappear.

## Required outcome

1. **Bloom** as a downsample/upsample chain reading the HDR target, with a threshold that picks up
   genuine emissives and real specular highlights and leaves lit diffuse surfaces alone.
2. **A colour grade** in the same post chain. One place, applied once, before the tone-map that
   06-02 established.
3. **A vignette**, present but restrained — the corner-luminance bound below is what "restrained"
   means numerically.
4. **The fake emission deleted** per the table above, with the commit stating what was removed and
   what replaced it.
5. **The demo's W0.3 visual budget green on every bound.** Local contrast median **≥ 8.5** (it was
   3.16 before goal 06 started), `clippedHigh` **≤ 2%**, `clippedLow` **≤ 2%**.

## Required tests and evidence

- **Bloom probe.** A probe 20 px from a known emissive is **≥ 20%** brighter than the same probe
  with bloom disabled, and the falloff is monotonic with distance.
- **Bloom does not wash the frame.** `clippedHigh` stays inside its 2% budget.
- **Vignette.** Corner luminance sits **10–25%** below centre luminance. Both ends of that range are
  real: under 10% is invisible, over 25% is heavy-handed.
- **The full W0.3 budget green**, every bound, with the numbers stated.
- **`rg 'pulse'` over the demo's shaders** returns only genuine animation, no self-illumination.
- A capture before and after, looked at, with the numbers stated.
- `npm test` green; `shader-output-parity` green with `.gen.ts` regenerated.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- **Do not do art direction, VFX rework, composition or the stylisation brief.** That is goal 08, and
  the temptation is strongest right here, at the end, with a post chain in your hands.
- **Do not extract a shared render package, a material package or a `BroMetalRenderDriver`.** Goal 12
  extracts the driver from two working implementations; this goal produces the first. Extracting
  from one is the exact failure mode that decision exists to prevent.
- Do not touch `combat-arena`, `traversal-study` or `antiky-town`. That is goal 07, which carries
  this pattern to the other three.
- Do not add depth of field or TAA.
- **Do not loosen a budget bound to make this pass.** If local contrast will not reach 8.5, stop and
  report the number with what was tried. Budgets are changed by the owner, not by the agent failing
  them.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed. The sidecar is.
- Preserve unrelated dirty worktree changes.
- Keep handwritten files under 500 lines; the post chain is a clean thing to own its own file.
- No screen-space derivatives.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to the same fixed step
count used in the previous steps.

## Completion definition

Complete when bloom, grade and vignette read the HDR target, the fake emission is deleted, all three
probe measurements pass, and `point-light-expo`'s W0.3 visual budget is green on every bound.

**This step also closes goal 06.** When it lands, write `_completed/summary-goal-06.md` covering all
six steps, move all seven files into `_completed/`, repoint every link that references them, and
mark the row Done in [`README.md`](README.md). Goals 07, 09, 11 and 12 all wait on this.
