# Execute goal 06-02: one HDR target and exactly one tone-map

Part 2 of 6 of [goal 06](execute-goal-06.md). Work packet **W B.2(D)**.

## Prerequisites

- **[06-01](_completed/execute-goal-06-01.md)** landed and captured. This step's whole test is "the image did
  not move", which means nothing unless the image was already right.
- **Goal 02's W A.2** — the `offscreen-multisampling` patch, which keeps 4× MSAA alive through
  `drawTo`. Present at `scripts/patch-brometal/offscreen-multisampling.mjs`. This is hard-blocking:
  without it the first offscreen pass here silently throws away the anti-aliasing the demo has
  today, and the aliased-edge check below is what proves it held.

## `/goal` objective

Right now every material shader tone-maps its own output and applies its own exposure. That means
the demo has three tone-maps, three exposures, and no single place where the frame becomes an image.
Anything added later — shadows, bloom, a grade — has to be threaded through all three.

Render the scene into one high-precision target instead, and do exposure, tone-mapping and the
encode once, in a post pass, at the end.

## This step must look like nothing happened

That is the point of it. It is plumbing. If the captured frame moves, the tone-map, the exposure or
the encode is wrong, and it must be found before going any further — every later step is measured
against this frame, so a mistake buried here silently corrupts four more captures.

## The state today, verified

- **The HDR target needs no patch.** BroMetal fixes every offscreen target to `rgba16float`
  (`dist/runtime/webgpu.js:15`, used at `:778` and `:808`). There is no format option to pass and
  nothing to add — `drawTo` gives you a 16-bit float target already. Do not go looking for a
  `format` field on target options; there isn't one.
- **Depth attachments are never sampleable** in BroMetal. Irrelevant here, but it is the constraint
  that shapes 06-04, and it is worth knowing before designing the target layout.
- Three shaders tone-map today: `reliquary-model`, `reliquary-floor`, `foundry` — two calls each.
- `uExposure` is a uniform on those same three (`src/shaders/reliquary-model.shader.ts:125`,
  `reliquary-floor.shader.ts:85`, `foundry.shader.ts:59`), set from
  `RELAY_PRESENTATION.exposure` (`src/presentation.ts:9`, value `1.24`) at `src/renderer.ts:144`,
  `:156` and `:170`.
- `src/renderer.ts` is 308 lines. It grows through the rest of goal 06 — split it by responsibility
  when it crosses 500, not to satisfy a count.

## Required outcome

1. **The scene renders into one RGBA16F target** via `drawTo`, with MSAA preserved.
2. **One post pass** reading that target and applying, in order: exposure, one ACES tone-map, one
   sRGB encode. That is the only place any of those three happen.
3. **No material shader calls `tonemapACES`.** They return linear HDR values and stop there.
4. **`uExposure` is no longer a per-material uniform.** It becomes a single uniform on the post
   pass. `RELAY_PRESENTATION.exposure` stays as the value's home.
5. **The encode moves out of the material shaders and into the post pass**, so 06-01's per-shader
   copies collapse to one. Update `pipeline-invariants.test.mjs` to match: the assertion changes
   from "every final-pixel shader encodes" to "exactly one shader encodes, and it is the post pass".
   The decode assertions are untouched.
6. **All six shaders draw into the target**, including `contact-shadow`, `foundry-glow` and
   `onboarding`. If the onboarding overlay is meant to sit outside tone-mapping, say so explicitly
   and draw it after the post pass — do not leave it ambiguous.

## Required tests and evidence

- **Invariance. This is the acceptance test.** Mean per-channel difference between the 06-01
  capture and this one is **under 3/255**.
- **Aliased-edge pixel count does not increase.** This is the proof that W A.2's MSAA patch survived
  the offscreen pass. A rise here means MSAA was dropped, not that the image got sharper.
- **W0.4's "no `tonemapACES` under `src/shaders/`" assertion passes**, and the demo's shaders still
  agree on one key direction and one fog range.
- `npm test` green; `shader-output-parity` green with every `.gen.ts` regenerated and committed.
- A committed `visual-metrics.json` sidecar.

## Explicit non-goals

- Do not add bloom, a grade or a vignette while the post pass is being built, however tempting it is
  to do it "while you're in there". Those are 06-06, and adding them here destroys the invariance
  test that is this step's only real check.
- Do not add a shadow pass. That is 06-04.
- Do not add MRT, a deferred path, or sampled depth. Blocked or expensive, and not needed.
- Do not change materials, lights, ambient or fog.

## Engineering constraints

- Only `packages/demos/antiky/point-light-expo`. Touching `combat-arena`, `traversal-study` or
  `antiky-town` is a scope error — those are goal 07.
- Tests are required for code changes. For a reported bug, write the failing test first.
- Short one-line commit messages. No coauthor tags. One commit for this step.
- Capture PNGs are not committed. The sidecar is.
- Preserve unrelated dirty worktree changes.
- No screen-space derivatives — the DSL exposes no `dpdx`, `dpdy` or `fwidth`.
- Keep handwritten files under 500 lines.
- Do not loosen a budget bound to pass.

## Capture protocol

Use the Antiky MCP, not a hand-rolled script. Fence with `get_latest_build` → `get_runtime_status`
→ `get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to the **same fixed step
count used in 06-01** — the invariance test is worthless if the two captures are of different
moments.

## Completion definition

Complete when the scene renders through one RGBA16F target, exactly one pass applies exposure,
tone-map and encode, no material shader tone-maps, the before/after mean difference is under 3/255,
the aliased-edge count has not risen, and `npm test` is green.
