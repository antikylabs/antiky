# Progress — goal 06-06: bloom, grade and vignette, and the budget green

**Partly complete.** The grade, the vignette and — the headline — **the whole W0.3 budget green on
every bound** landed. Bloom did not, and the fake emission deletion depends on it.

**Commit:** `501f744` — Add a linear-light grade and vignette to the post pass

## Action needed from the owner

**One decision.** Whether bloom is still wanted now that the budget is green without it.

The goal's premise was that bloom is what carries local contrast over 8.5. It is already at **8.70**,
from the grade alone. Bloom would still add what only bloom adds — light spilling off genuine
emissives — but it is no longer load-bearing for any bound, which changes the trade.

## What landed

| Outcome | State |
| --- | --- |
| 1. Bloom | **Not done** |
| 2. Colour grade, one place, before the tone-map | **Done** |
| 3. Vignette, restrained | **Done** — corners 20.7% below centre |
| 4. Fake emission deleted | **Not done** — see below |
| 5. W0.3 budget green on every bound | **Done** |

**Outcome 4 is deliberately not done rather than skipped.** The goal's own reasoning is that the fake
self-illumination exists because nothing else in the frame was bright, and that real bloom replaces
it. Deleting it without bloom would simply make those objects dimmer, which is the opposite of the
intent. It stays with the bloom work.

## The budget, green for the first time

| Bound | Value | Limit |
| --- | --- | --- |
| local contrast median | **8.70** | ≥ 8.5 |
| `clippedHigh` | **0** | ≤ 2% |
| `clippedLow` | **0** | ≤ 2% |
| `edges.hard` | 0.01069 | ≤ 0.0115 |
| ground shadow vs lit ground | 40.2% | ≥ 25% |
| onboarding panel spread | 0.143 | ≥ 0.11 |

Local contrast was **3.16 before goal 06 started** and 6.73 after 06-02. p95 0.413, saturation 0.553.

## The grade, and a defect it made and measured

Two moves in linear light, before the tone-map: saturation toward the relay colours, and contrast
about a pivot at 0.18 — mid grey in linear light, not 0.5, which is mid grey only after the display
curve.

**The obvious form of that contrast curve is wrong, and it looked like a pass.** A straight line
through the pivot, `pivot + (v - pivot) * gain`, sends everything below `pivot / gain` negative.
Clamping at zero turns a gradient into a plateau of pure black:

| | local contrast | `clippedLow` |
| --- | --- | --- |
| straight line, gain 1.12 | 8.54 | **33.5%** |
| power curve, gain 1.22 | 8.70 | **0** |

The straight line cleared the local-contrast floor *while destroying a third of the frame*. Worth
keeping as the example: one metric passing is not the same as the frame being right, and the fix was
`pivot * (v / pivot) ^ gain`, which has the same slope at the pivot and maps zero to zero.

`tests/post-grade.test.ts` asserts the curve maps black to black **and** demonstrates that the
straight-line form does not, so the regression cannot come back quietly.

## The vignette is measured on the function, not the frame

A corner probe reads 89% below centre, and almost all of that is "the floor does not reach here" —
this scene's corners are the black void. The vignette is a multiplier on radius, so it is mirrored
and asserted directly: corners land **20.7%** below centre, inside the goal's 10–25% band, with
monotonic falloff and nothing inside radius 0.27 touched at all.

## The hard-edge metric has now been re-derived twice for the same reason

0.0085 → 0.0095 in 06-04, and 0.0095 → 0.0115 here. Both times the rise was contrast the step
deliberately added, and both times that was separated by evidence rather than assumed — in 06-04 by
capturing the same sun with shadows off, and here by the fact that **nothing but a post-pass curve
changed between the two captures**.

It still catches what it was built for: losing multisampling moved it 0.0068 → 0.0103 with the scene
otherwise identical. But it is confounded by scene contrast and a contrast-invariant formulation
would be better. Registered as **A14**.

## An unrelated thing that surfaced

`antiky-town` and `combat-arena` now fail their budgets on a stale `source.digest`, and **neither has
a single tracked change in this session** — `git diff` over the whole session is empty for both.
Both directories carry gitignored `.antiky/` and `dist/` build output that this session's repeated
`brometal prod` and dev-server runs rewrote.

If `sourceDigest` is hashing build output, it is answering "has anything in this directory changed"
when the question is "has the demo changed", and every capture will look stale after any build.
Registered as **A15**; it is a defect in the evidence tooling rather than in either demo.
