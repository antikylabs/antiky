# Summary — goal 10: fix how the work is presented

**Completed:** 2026-08-11
**Commits:** `632b500`, `079c325`
**Goal file:** [`execute-goal-10.md`](execute-goal-10.md)

## Action needed from the owner

**Two items, both small.**

| # | What | Why it needs you |
|---|---|---|
| 1 | **The Glass Garden poster master needs one recapture** to close a 14.7% mean-luminance gap against a 10% budget. | The code is fine — see the finding below. Closing the last gap means regenerating the 2560x1440 master from the current runtime, which is a media task with an art call in it (which frame of an animating scene is the poster), not a code change. |
| 2 | **Confirm the new page copy reads right.** `/demos` now states the WebGPU requirement once, at page level. | It is visitor-facing copy on your site. Wording is yours. |

No bug found during this goal is outstanding.

## The headline: three of the nine stated defects were not real

This goal's premises came from an audit of local artifacts, and measurement disagreed with three of
them. Recording that plainly, because the audit is otherwise accurate and these are the exceptions.

**Requirement 3 — "no committed capture that is uniformly one colour".** There are no committed
captures. `**/.antiky/` is gitignored (`.gitignore:26`) and `git ls-files` returns **zero** tracked
files under `.antiky/captures/`. The blank PNGs are stale local artifacts. They are also **black**,
not "blank white" as stated, and there are **five**, not three — the audit missed one in
`point-light-expo`. Re-running `demos:shoot` produces non-blank frames for both Three.js demos
(`orbital-atlas` p95 0.057, `glass-garden` p95 0.831), so the capture path works today.

**Requirement 4 — "the poster is roughly 40% clipped white with no material read".** Measured, the
poster clips **0.017%** of pixels — about 200x inside the 2% budget — and shows lit material, ground
contact and visible shadows. The runtime capture clips 0.010%. The "near-black void" capture the
audit cites is one of the same stale artifacts. Recorded with numbers in
`packages/demos/threejs/glass-garden/poster-parity.json`.

**Requirement 9's second half was real and is fixed**, as were 7, 8 and the first half of 9.

## What landed

| # | Outcome | What changed |
|---|---|---|
| 1 | Honest WebGPU story | New `gated` phase: a browser without WebGPU gets the **poster plus a caption**, not a red error card. Requirement stated once at page level. |
| 2 | `town-study` promoted | New `DemoTier`. The three fullscreen-quad studies moved into "BroMetal shader studies"; Town Study stands alone as the engine artifact. |
| 5 | Mobile `/demos` runs | Thumbs render an activation button; a running thumb accepts pointer input instead of swallowing it. |
| 6 | Posters not cropped past their subject | Mobile stages use `background-size: contain`. A portrait container with `cover` showed roughly the middle 35% of a 16:9 master. |
| 7 | Orbital Atlas resizes once | Extracted `createResizeGuard` in both Three.js demos. |
| 8 | Luminous Reef plankton | Now shaded by distance to a point inside the cell. |
| 9 | Shader Study craters and dither | Craters likewise; `filmGrain` moved after `tonemapACES`. |
| — | Copy | Solar Forge described as what it implements. Developer error strings replaced with visitor-facing copy. |

## Findings worth keeping

**The resize bug was a unit mismatch, and the fix is now unit-tested.** `canvas.width` is *device*
pixels; `canvas.clientWidth` is *CSS* pixels. With `setPixelRatio(2)` they can never be equal, so the
guard never fired and the drawing buffer was reallocated sixty times a second. Rather than copy
glass-garden's inline version, both demos now share one small named unit, so the test the goal asked
for — one `setSize` across 100 frames — runs without a GPU.

**Two shaders had the same bug ten lines from a correct example.** Both the plankton and the craters
floored into a grid, hashed the cell, and thresholded with no local-distance test, so every selected
cell filled as a solid square. In `luminous-reef` the correct construction — cell, local offset,
point, distance — sits **ten lines above** in `bubbleGlow`. A test now asserts both terms use the
same construction, because the divergence is what let the broken one survive review.

**An error card is a bug report addressed to the wrong person.** The old behaviour told a Safari
visitor their browser was wrong, eight times on one page. A still frame captured from the running
study is evidence; that is what they get now, with one honest sentence explaining it.

## Outstanding

| Item | Disposition |
|---|---|
| Glass Garden poster recapture | **Owner decision above.** Clipping is within budget; only the 14.7% luminance gap remains, and the scene animates. |
| `orbital-atlas` local contrast 0.00 on a fresh capture | **Not this goal.** It is a dim scene, not a broken one. No budget exists for the six non-Antiky demos — that is M2 on the register. |
| Five stale blank PNGs under `.antiky/` | **No action.** Gitignored, never committed, and regenerated non-blank on demand. |
