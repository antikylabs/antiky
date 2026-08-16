# Execute goal 06-05: ambient that knows which way is up

Part 5 of 6 of [goal 06](execute-goal-06.md). Work packet **W B.4(D)**.

## Prerequisites

- **[06-04](execute-goal-06-04.md)** landed and captured, with its shadow probes green.

## `/goal` objective

Ambient light in this demo is a single constant added to everything. A floor, a ceiling and the
inside of a corner all receive exactly the same amount, which is why nothing in the scene reads as
having a shape until a direct light hits it.

Replace it with two things: an ambient term that varies with which way a surface faces, and an
occlusion value baked into the geometry so corners and crevices are darker than open faces.

## The state today, verified

`src/presentation.ts:11-18` holds two flat constants:

```
surfaceAmbient: { color: [0.34, 0.4, 0.36], strength: 0.96 }
floorAmbient:   { color: [0.3, 0.36, 0.3],  strength: 1.08 }
```

Both are single colours applied uniformly. `catalogMaterial.ambientStrength` (`:25`) is a third
multiplier on the same idea — check whether it survives 06-01's knob deletion and remove it here if
it did.

This is also the step where the demo's **`luminanceP05` finally has a reason to drop**: with ambient
no longer painting a floor under every pixel, the scene can reach genuine darks.

## Required outcome

1. **Hemispheric ambient.** A sky colour and a ground colour, blended by the surface normal's
   vertical component. Up-facing surfaces take the sky, down-facing take the bounce.
2. **The flat constants gone.** No single-colour ambient constant survives in the demo; grep finds
   none.
3. **Vertex ambient occlusion baked at build time** for static geometry, stored per vertex and
   multiplied into the ambient term only — **not** into direct light. Occlusion that dims direct
   light is the classic mistake here and it makes shadowed areas look flat and grey.
4. **The bake is a build step, not a runtime cost**, and it is deterministic: running it twice on
   the same geometry produces byte-identical output.
5. **Only static geometry is baked.** Anything that moves keeps an analytic ambient term.

## Required tests and evidence

- **Direction matters.** An up-facing and a down-facing surface under the same light differ in
  ambient contribution by **≥ 30%**.
- **Corners matter.** An inside-corner probe is **≥ 15%** darker than a flat-surface probe of the
  same material.
- **`luminanceP05` now meets its W0.3 bound.** This is the step where that number is expected to
  come good.
- **Occlusion does not touch direct light.** A probe in full sun inside a baked-dark corner is not
  measurably darker than the same material in the open under the same sun. This is the regression
  test for the mistake named above, and it is worth writing even though nothing has made it yet.
- **The bake is deterministic** — run twice, compare bytes.
- **`clippedLow` stays inside its budget** (ceiling 2%). Darkening the scene is the point; crushing
  it to black is not.
- A capture before and after, looked at, with the numbers stated.
- `npm test` green; `shader-output-parity` green with `.gen.ts` regenerated.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- **Do not add SSAO.** It needs sampled depth, which BroMetal does not give you, and the offline
  bake is both cheaper and better for static geometry.
- Do not add image-based lighting or a light probe grid. Hemispheric ambient is the 80/20 here.
- Do not bake lighting, only occlusion. A baked light freezes the sun in place and 06-06 still has
  to change the image.
- Do not add bloom, a grade or a vignette. That is 06-06.
- Do not touch the shadow map. If ambient exposes a shadow defect, report it — do not fix it here,
  because a fix folded into this step has no capture of its own to be judged against.
- Do not re-pack assets, restore normal maps or fix the UV collapse. Those are Track C.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`. Touching `combat-arena`, `traversal-study` or
  `antiky-town` is a scope error — those are goal 07.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed. The sidecar is.
- Preserve unrelated dirty worktree changes.
- Keep handwritten files under 500 lines; split by responsibility when the bake code lands.
- No screen-space derivatives.
- Do not loosen a budget bound to pass.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to the same fixed step
count used in the previous steps.

## Completion definition

Complete when ambient varies with surface direction, occlusion is baked into static geometry and
applied to ambient only, all five measurements pass including `luminanceP05` against its bound,
`npm test` is green, and a fresh capture has been looked at beside 06-04's.
