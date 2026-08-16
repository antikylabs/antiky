# Execute goal 06-01: finish colour management in point-light-expo

Part 1 of 6 of [goal 06](execute-goal-06.md). Work packet **W B.1(D)**.

## Prerequisites

- **Goals 00, 01, 02** — all done. Goal 01 supplies the capture tooling, the frame-statistics
  library and this demo's visual budget; without them nothing here is measurable.
- **Goal 04** — landed the sRGB **decode** on albedo sample across all ten texture-sampling shaders
  in the four Antiky demos. `pipeline-invariants.test.mjs` asserts every albedo sampler decodes, no
  data texture does, and every copy of the helper is byte-identical. **Do not re-add the decode.**

## `/goal` objective

Colour needs two halves: undo the display curve when a texture is read, and reapply it when a pixel
is written. Goal 04 added the first half. The second half does not exist in this demo, so lighting
maths now runs on correct numbers and then writes them to the screen as though they were already
display-encoded. Everything comes out too dark.

Add the encode, and delete the knobs that were added to fight the dark.

## Why it looked fine before, and why it looks dark now

The missing decode and the missing encode cancelled exactly, but only for a surface that is drawn
straight through with no lighting. Multiply by a light and they stop cancelling, so every lit
surface in this demo was being lit in display space. That is the whole explanation for the milky
look, and it is why `uDiffuseLift`, `uTextureContrast` and `uSaturation` were added.

Goal 04 removed one half of the cancellation. Measured: this demo's luminance p95 fell **0.090 →
0.050**. That number is the missing encode, and closing it is this step's job.

## The state today, verified

- BroMetal never configures an sRGB canvas format — `context.configure` takes
  `gpu.getPreferredCanvasFormat()` (`dist/runtime/webgpu.js:83-84`), which returns `bgra8unorm` or
  `rgba8unorm` and never an `-srgb` variant. **Nothing encodes for us.** The encode is in the
  shader by necessity, not by preference — the same reason the decode is.
- Three shaders tone-map and write final pixels: `reliquary-model`, `reliquary-floor`, `foundry`.
- Three more write final pixels without tone-mapping: `contact-shadow`, `foundry-glow`,
  `onboarding`.
- The knobs, as they sit now (line numbers drift — grep, do not trust them):

  | What | Where |
  | --- | --- |
  | `uDiffuseLift`, `uTextureContrast`, `uSaturation` declared | `src/shaders/reliquary-model.shader.ts:120-122`, read at `:179-181` |
  | The `mix(vec3(0.48, 0.48, 0.48), …)` grey-wash | `src/shaders/reliquary-model.shader.ts:252` |
  | `.add(vec3(uDiffuseLift, …))` | `src/shaders/reliquary-model.shader.ts:253` |
  | The floor's own wash, `mix(vec3(0.38, 0.36, 0.31), sourceDiffuse, uTextureContrast)` | `src/shaders/reliquary-floor.shader.ts:145` |
  | The values behind them | `src/presentation.ts:20` (`floorTextureContrast`), `:21-26` (`catalogMaterial`) |
  | Where they are set | `src/renderer.ts:162-164`, `:167` |

## Required outcome

1. **An `encodeSrgb` helper in every shader that writes a final pixel**, applied once, last, after
   the tone-map. It is the exact inverse of `decodeSrgb`: the piecewise curve, not the 2.2
   approximation, because the two differ most in the darks and this scene lives there.
2. **Declared per shader, not imported.** The BroMetal DSL resolves only module-level helpers
   declared above first use; an imported helper fails to compile. This is the same constraint that
   forced `decodeSrgb` to be copied, and it is already documented in each shader's header comment.
3. **`pipeline-invariants.test.mjs` extended to cover the encode** exactly as it covers the decode:
   every final-pixel shader has one, every copy is identical, and the curve matches the decode's
   inverse. The decode assertions stay as they are.
4. **The knobs deleted, not re-tuned.** `uDiffuseLift`, `uTextureContrast`, `uSaturation`, both
   washes, and the presentation values feeding them are gone from the demo.
5. **`uExposure` untouched here.** It stays a per-material uniform for now and moves to the post
   pass in [06-02](execute-goal-06-02.md). Moving it now would blur the two steps' evidence.

## The one decision this step has to make

The three shaders that do not tone-map — `contact-shadow`, `foundry-glow`, `onboarding` — write
authored constants rather than lit results. Encoding those changes how they look, because the
constants were picked to look right on screen and are therefore already display-encoded.

**Recommended default:** every shader that writes a final pixel encodes, and any constant that was
authored as a display colour is converted to a linear constant in the source so the round trip is a
no-op. State in the commit which constants were converted and what they became. The alternative —
exempting those three — leaves the pipeline with two rules instead of one, and 06-02 has to unpick
it anyway when all six shaders start drawing into a shared target.

## Required tests and evidence

- **The colour-pipeline unit test. This is the acceptance test that decides this step.** A known
  albedo under a known light produces an output within **2/255** of the analytically computed
  value. A unit test of the transfer functions, not an eyeball check.
- **`rg 'uDiffuseLift|uTextureContrast|uSaturation'` over the demo returns zero hits**, and so does
  a search for `mix(vec3(0.48`.
- **A capture before and after, looked at, with the numbers stated.** Luminance p95 should climb
  back toward its pre-goal-04 value of ≈0.090. It will not land exactly there and should not be
  forced to — the wash knobs are gone, so this is not the same image.
- Local contrast is expected to improve but **is not required to reach its 8.5 floor here**. That
  floor is the end state of the whole of goal 06, not of this step.
- `npm test` green, and `shader-output-parity` still passes — every `*.shader.ts` needs its
  `*.shader.gen.ts` regenerated and committed.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- Do not re-add the decode, and do not touch `color.ts` or any other demo's copy of it.
- Do not add the HDR target or move the tone-map. That is 06-02.
- Do not touch `specGGX` or its clamps. That is 06-03.
- Do not change ambient, lights or fog.
- Do not tune the knobs. They are deleted.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`. Touching `combat-arena`, `traversal-study` or
  `antiky-town` is a scope error — those are goal 07.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed (`.antiky/` is gitignored, `*.png` is LFS). The sidecar is.
- Preserve unrelated dirty worktree changes. Do not clean the tree.
- No screen-space derivatives — the DSL exposes no `dpdx`, `dpdy` or `fwidth`.
- Do not loosen a budget bound to pass. Bounds are the owner's to change.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to a fixed step count so
two captures are comparable. There is no deterministic seed.

## Completion definition

Complete when every final-pixel shader encodes once on output, the invariant test covers the encode
the way it covers the decode, the colour-pipeline unit test passes within 2/255, grep finds no wash
knobs, `npm test` is green, and a fresh capture has been looked at beside the previous one with both
sets of numbers written down.
