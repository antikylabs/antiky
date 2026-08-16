# Execute goal 06: build the reference render slice in point-light-expo

**This goal runs as six separate steps.** Each one is independently shippable, ends in its own
commit and its own capture, and has its own file. Run them with `/goal` in order. Do not batch them.

| Step | What it does | Packet |
| --- | --- | --- |
| [06-01](_completed/execute-goal-06-01.md) | Finish colour management — the encode on output, wash knobs deleted | W B.1(D) |
| [06-02](execute-goal-06-02.md) | One HDR target and exactly one tone-map | W B.2(D) |
| [06-03](execute-goal-06-03.md) | A specular model that does not need a ceiling | outcome 6 |
| [06-04](execute-goal-06-04.md) | One sun and a shadow map | W B.3(D) |
| [06-05](execute-goal-06-05.md) | Ambient that knows which way is up | W B.4(D) |
| [06-06](execute-goal-06-06.md) | Bloom, grade and vignette, and the budget green | W B.5(D) |

06-03 is not a packet in `06-WORK-PACKETS.md`. It is this goal's required outcome 6 — replacing
`specGGX`'s clamps with an energy-conserving model — given its own step because it needs the
headroom 06-02 builds and because 06-04 is large enough without it.

## Prerequisites

Complete goals 00, 01 and 02 first. All three are done. This goal consumes their output and cannot
be verified without it:

- **Goal 00** — ADR `framework/0021` placed, so a game module owning BroMetal directly is an
  explicitly permitted path rather than an ambiguous one, and `npm test` green at HEAD (W0.1b).
- **Goal 01** — `capture_frame` working on the asset-heavy demos (W0.1), `npm run demos:shoot`
  wrapping the Antiky MCP (W0.2), the frame-statistics library (W0.2b), the per-demo visual budget
  `packages/demos/antiky/point-light-expo/tests/visual-budget.test.mjs` (W0.3), and the pipeline
  invariant tests (W0.4). Without W0.2b nothing in this goal is measurable.
- **Goal 02** — both BroMetal patches: linear filtering on render-target samplers (W A.1) and MSAA
  preserved in `drawTo` (W A.2). Both present under `scripts/patch-brometal/`. W A.2 is
  hard-blocking for 06-02; W A.1 is hard-blocking for 06-04 and 06-06.
- **Goal 04** — landed the sRGB decode. 06-01 adds the encode that pairs with it. **Do not re-add
  the decode.**

## `/goal` objective

Build the reference render slice — colour management, an HDR scene target, a directional key light
with a shadow map, hemispheric ambient with baked ambient occlusion, and a post chain — inside
`packages/demos/antiky/point-light-expo` and nowhere else.

`point-light-expo` goes first because its entire premise is point lighting, which makes it the
honest test of the approach before the pattern is carried anywhere. A lighting showcase whose lights
paint a flat fill instead of a gradient is the clearest available signal of whether this slice works.

Hand-roll everything inside the demo. This implementation is the first of the working
implementations that goal 12 extracts `BroMetalRenderDriver` from; goal 07 produces the rest, across
`combat-arena`, `traversal-study` and `antiky-town`. Extraction from a single implementation is the
failure mode that decision exists to avoid, so this goal deliberately stops at one demo.

## Where the demo starts

Measured before step 06-01, and the numbers every step is judged against:

| Metric | Now | Bound |
| --- | --- | --- |
| Local contrast (median) | **3.16** | ≥ 8.5 |
| Luminance p05 | 0.0040 | — |
| Luminance p95 | 0.0500 | — (was 0.090 before goal 04's decode) |
| `clippedHigh` / `clippedLow` | — | ≤ 2% each |

## Things every step inherits

These apply to all six and are repeated in each file, because an agent running one step should not
have to read this one to stay in bounds.

- **One demo only.** Touching `combat-arena`, `traversal-study` or `antiky-town` is a scope error,
  not a favour. `antiky-town` is in scope for the wider objective and is the largest demo in it, but
  it is deliberately not the reference — it already owns offscreen targets, a shadow pass and a
  single post tone-map, so building the slice there first would let existing machinery hide a
  mistake instead of exposing it. Read it before goal 07; do not edit it here.
- **No shared extraction.** No render package, no material package, no `BroMetalRenderDriver`. Goal
  12 does that, from two implementations.
- **No screen-space derivatives.** BroMetal's DSL exposes no `dpdx`, `dpdy` or `fwidth` — verified
  against `dist/dsl/builtins.d.ts`. The same gap blocks Toksvig and LEAN specular anti-aliasing;
  record that as a known limitation rather than designing around it.
- **No SSAO, depth of field, TAA, MRT or a deferred path.** All need sampled depth or history
  reprojection; both are blocked or expensive, and none is needed for these scenes.
- **No asset work.** Do not re-pack assets, restore normal maps or fix the UV collapse — Track C.
- **No art direction.** No VFX rework, composition or per-demo stylisation. That is goal 08.
- **Budgets are the owner's.** Do not loosen a W0.3 bound to make a step pass.
- Tests are required for every code change. For a reported bug, write the failing test first and
  watch it fail.
- Short one-line commit messages, no coauthor tags, one commit per step.
- Capture PNGs are **not** committed — `.antiky/` is gitignored and `*.png` is LFS here. The
  committed artifact is the `visual-metrics.json` sidecar.
- Preserve unrelated dirty worktree changes. Do not clean the tree.
- Keep handwritten files under 500 lines. `renderer.ts` starts at 308 and grows through 06-02, 06-04
  and 06-06; split by responsibility when it crosses the line, not to satisfy a count.

## Capture protocol

Every step ends in a capture that the implementer **actually looks at**. Use the Antiky MCP, not a
hand-rolled script. Fence with `get_latest_build` → `get_runtime_status` →
`get_capture_capabilities`; retry `CAPTURE_BUILD_STALE`, `CAPTURE_RUNTIME_STALE` and
`CAPTURE_DIMENSIONS_MISMATCH`; drive `pause_simulation` → `step_simulation` to a fixed step count so
frames are comparable across a change. Use **the same step count for all six steps** — 06-02's
acceptance test is a before/after comparison and is worthless if the two frames are different
moments. There is no deterministic seed; `capture_gameplay_sequence` declares itself
non-deterministic.

## Completion definition

Complete when all six steps have landed in order, each with its own capture and committed sidecar,
the colour-pipeline unit test passes within 2/255, the shadow and bloom probe tests pass, the
frame-time budget holds, the wash knobs and per-material tone-maps are gone by grep, and
`point-light-expo`'s W0.3 visual budget is green on every bound.

If a step's acceptance criteria cannot be met, stop and report that plainly with the measurement
that failed. Do not proceed to the next step on an unverified one, and do not substitute a
subjective judgement for a probe measurement — that substitution produced every finding in the
audit this objective came from.
