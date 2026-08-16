# Summary — goal 06-06: bloom, grade and vignette, and the budget green

**Complete.** All five required outcomes landed, and the demo's W0.3 visual budget is green on every
bound for the first time since this objective began.

**Commits:** `501f744` — grade and vignette; `f17382d` — bloom, and the fake self-illumination deleted

## Action needed from the owner

**None.** One defect was found and fixed during the step, and it is described below because the way
it presented is worth knowing: it cleared the local-contrast floor *while destroying a third of the
frame*.

## The budget, green on every bound

| Bound | Value | Limit |
| --- | --- | --- |
| local contrast median | **8.67** | ≥ 8.5 |
| `clippedHigh` | **0** | ≤ 2% |
| `clippedLow` | **0** | ≤ 2% |
| `edges.hard` | 0.0105 | ≤ 0.0115 |
| ground shadow vs lit ground | 40.4% | ≥ 25% |
| bloom halo ratio | 2.008 | ≥ 1.8 |
| onboarding panel spread | 0.143 | ≥ 0.11 |

**Local contrast was 3.16 when goal 06 started.** It was 6.73 after 06-02, 7.61 after 06-05, and is
8.67 now.

## What landed

| Outcome | State |
| --- | --- |
| 1. Bloom, threshold picking emissives not lit diffuse | **Done** |
| 2. Colour grade, one place, before the tone-map | **Done** |
| 3. Vignette, restrained | **Done** — corners 20.7% below centre |
| 4. Fake emission deleted | **Done** |
| 5. W0.3 budget green on every bound | **Done** |

### Bloom

Three quarter-resolution passes over an already-drawn scene: extract, blur across, blur down.

- **Extracted from the HDR target before exposure and before the tone-map.** That is the only place
  "is this brighter than white" can still be asked — after ACES everything is inside 0..1 and a
  genuine emissive is indistinguishable from a well-lit surface.
- **Thresholded on the brightest channel, not luminance.** A saturated relay at (3, 0.2, 0.2) has a
  luminance of 0.78 and would fall under any threshold that leaves lit diffuse alone, while being
  three times over white in red and obviously glowing.
- **Colour preserved by scaling, not by subtracting per channel.** Subtracting drags everything
  toward white; scaling keeps the relay's hue.
- **Quarter resolution and `filter: 'linear'`** — goal 02's `render-target-filtering` patch, which
  the goal called hard-blocking and is. On a point sampler the taps between texels snap back onto
  texel centres and the chain produces blocky glow that crawls with the camera.

Measured against the same frame with bloom off: a probe 20 px beyond the blue relay's edge is
**22.7% brighter**, against the goal's 20% bar. Falloff is monotonic — 51.6% at the rim, 5.7% at
30 px, 0.1% at 45 px, 0.0% beyond. `clippedHigh` stayed at **0**.

### The fake self-illumination is gone

| What | Where | Was |
| --- | --- | --- |
| Per-instance emissive lift on rocks | `reliquary-model-layout.ts` | 0.018 |
| Per-instance emissive lift on stumps | `reliquary-model-layout.ts` | 0.02, 0.035 |
| `pulse` self-illumination sine | `foundry.shader.ts` | `0.92 + sin(…) * 0.08` |
| `pulse` self-illumination sine | `reliquary-model.shader.ts` | `0.94 + sin(…) * 0.06` |

The pulses were light sources made to breathe so they would read as light sources, in a frame with
nothing bright enough to bleed. Bloom does that job properly now. Genuine emission — the forge, the
relays — keeps the amount each instance declares; only the sine and the rock/stump lifts went.
`rg 'pulse'` over the demo's shaders returns comments and nothing else.

## The defect this step made, and how it presented

The grade's contrast curve. The obvious form is a straight line through a pivot,
`pivot + (v - pivot) * gain` — and it sends everything below `pivot / gain` negative. Clamping that
at zero turns a gradient into a plateau of pure black.

| | local contrast | `clippedLow` |
| --- | --- | --- |
| straight line, gain 1.12 | **8.54** | **33.5%** |
| power curve, gain 1.22 | **8.70** | **0** |

**It cleared the floor this whole goal exists to clear, while a third of the frame had been
destroyed.** One metric passing is not the same as the frame being right — the same lesson 06-03's
false energy premise and 06-04's invalid peter-panning tracer taught, arriving a third way.

The fix is `pivot * (v / pivot) ^ gain`: same slope at the pivot, same intent, and it maps zero to
zero so darks compress toward black without ever reaching it. `tests/post-grade.test.ts` asserts the
curve maps black to black **and** demonstrates that the straight-line form does not.

The pivot is 0.18 — mid grey in linear light, not 0.5, which is mid grey only after the display
curve and would crush everything this scene contains.

## The vignette is measured on the function, not the frame

A corner probe reads 89% below centre and almost all of that is "the floor does not reach here" —
this scene's corners are the black void. The vignette is a multiplier on radius, so it is mirrored
and asserted directly: corners land **20.7%** below centre, inside the goal's 10–25% band, falloff
monotonic, and nothing inside radius 0.27 touched at all.

## The hard-edge metric has now been re-derived twice

0.0085 → 0.0095 in 06-04, and 0.0095 → 0.0115 here. Both times the rise was contrast the step
deliberately added, and both times that was separated by evidence rather than assumed — here by the
fact that **nothing but a post-pass curve changed between the two captures**.

It still catches what it was built for: losing multisampling moved it 0.0068 → 0.0103 with the scene
otherwise identical. But it is confounded by scene contrast, and goal 07 will meet the same confound
three more times. Registered as **A14**.

## Left failing

`npm test` green. `npm run demos:verify` reports the atlas gutter (goal 14) and material tone-maps in
the other demos (goal 07), both long-standing and out of scope, plus stale `source.digest` on
`antiky-town` and `combat-arena` — **neither of which has a single tracked change in this session**.
Both carry gitignored `.antiky/` and `dist/` output that repeated builds rewrote, so `sourceDigest`
appears to be hashing build output. Registered as **A15**; it is a defect in the evidence tooling
rather than in either demo, and as it stands every sidecar looks stale after any build.
