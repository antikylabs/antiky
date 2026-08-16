# 12 — Adversarial critique of the visual measurement system

**Date:** 2026-08-11
**Reviewer role:** external critic. Nothing here was written by the agent that built the system.
**Scope:** `scripts/frame-stats.mjs`, `scripts/tests/frame-stats.test.mjs`,
`packages/demos/antiky/*/tests/visual-budget.test.mjs`,
`packages/demos/tests/pipeline-invariants.test.mjs`, `packages/demos/*/*/visual-metrics.json`,
`scripts/shoot-demos.mjs`, and the goal-01 summary that draws conclusions from them.
**No code was changed.** Every number below was reproduced by running the shipped module against
synthetic images and against the ten committed baselines.

---

## Plain-language glossary (each term defined once, here)

| Term | One sentence |
|---|---|
| **sRGB / encoded** | The way colour is stored in a PNG — a byte 0–255 that is deliberately *not* proportional to how much light the pixel represents. |
| **Linear light** | Actual light quantity, proportional to photons. Byte 128 is half-way in storage but only ~21.6% of the light of byte 255. |
| **Luminance (Y)** | How bright a pixel is to the eye, ignoring hue — a weighted mix of red, green and blue in linear light. |
| **L\*** | Perceptual lightness, 0–100. Equal steps in L\* look like equal steps in brightness; equal steps in linear Y do not. |
| **Percentile (p05, p95)** | Sort all pixels by brightness; p05 is the brightness 5% of the way up the list, p95 is 95% of the way up. |
| **Value structure** | An artist's term: does the picture have real darks, real lights and a managed range in between? |
| **Local contrast** | Brightness variation *within a small neighbourhood* — what makes a surface read as three-dimensional rather than as flat paint. |
| **Clipping** | A pixel jammed against the end of the storable range — no detail left. |
| **Gamut clipping** | A *colour* that is too saturated to store, so one channel hits 255 even though the pixel is not bright. Different problem, same symptom in the bytes. |
| **Tone mapping** | The last step of rendering, which squeezes a wide range of light into the narrow range a screen can show. |
| **Vacuous pass** | A test that reports success because it found nothing to check, not because the thing it checks is correct. |

---

## Verdict, up front

**The engineering is careful and the plumbing is sound. The measurements are not valid for the
purpose they are being used for.** Specifically:

> **The headline metric, `luminanceSpread`, is not measuring contrast. It is measuring peak
> brightness under a different name. Across the ten committed baselines, `spread` and `p95`
> correlate at r = 0.990 and differ by an average of 5.2%. They are one number reported twice —
> so eight of the thirteen "failing" assertions in `npm run demos:verify` are four facts
> double-counted.**

This is not a tuning problem. It is structural, and it follows from a choice in
`scripts/frame-stats.mjs:152`: taking `p95 − p05` in **linear light**. In linear light, p05 is
pinned near zero for any scene that contains a shadow, so the subtraction removes nothing.

The consequence is that the system cannot tell good lighting from bad. I verified this directly
against the shipped module:

| Synthetic frame | What it actually looks like | `spread` | Verdict under the budgets |
|---|---|---|---|
| Half pure-black void, half flat 230-grey | Zero modelling, zero form, objectively terrible | **0.791** | Passes every budget; would rank 2nd of 10 |
| Smooth sinusoidal mid-tone modelling | Reads as lit three-dimensional form | **0.240** | Fails all four demos' budgets |
| Textbook low-key key light, rich shadow modelling, no clipping | Good chiaroscuro lighting | **0.092** | Fails; **statistically identical to `point-light-expo`'s "failing" 0.090** |

The third row is the fatal one. A demo the audit correctly calls flat and unlit
(`00-VISUAL-DIAGNOSIS.md:60-78`) and a well-lit low-key frame produce the **same score**. A metric
that cannot separate those two cases cannot be used to judge whether goals 06 and 07 succeeded.

That said — the failing demos really are bad. The audit in `00-VISUAL-DIAGNOSIS.md` is doing the
work here, and it is doing it well. The metrics are agreeing with a correct conclusion for the
wrong reason, which is the most dangerous kind of agreement, because it will keep agreeing after
the conclusion stops being true.

---

## What is genuinely right (so the criticism is calibrated)

These are not throwaway compliments; I tried to break each one and failed.

1. **The sRGB decode is correct.** `frame-stats.mjs:23-26` implements the piecewise IEC 61966-2-1
   transfer function exactly, including the 0.04045 / 12.92 linear segment that people routinely
   drop in favour of a plain 2.2 power. The 256-entry lookup table at `:28` is the right
   optimisation.
2. **The Rec.709 weights are correct and correctly applied.** `frame-stats.mjs:14-16, 62-66`.
   0.2126 / 0.7152 / 0.0722 are the right coefficients for relative luminance **because sRGB and
   Rec.709 share primaries**, and they are applied *after* linearisation, which is the part
   most implementations get wrong. Applying them to raw bytes would be a real bug; it is not here.
3. **The percentile interpolation is standard and correct.** `frame-stats.mjs:30-38` is exactly
   numpy's default `linear` method (`(n-1)·f`, interpolate between neighbours). No off-by-one.
4. **`Float64Array.prototype.slice.call(...).sort()` sorts numerically.** `frame-stats.mjs:138`.
   You were right to be suspicious — `Array.prototype.sort` defaults to *string* comparison — but
   `slice` on a `Float64Array` returns a `Float64Array`, and `%TypedArray%.prototype.sort` is
   numeric ascending by default. I verified it: `[10,9,100,2,0.5] → [0.5,2,9,10,100]`.
   **Not a bug.** It is needlessly obscure — `luminances.slice()` is identical and readable — but
   it is correct.
5. **`readPixels` is more robust than it looks.** `frame-stats.mjs:56-60`. I tested a genuine
   1-channel greyscale PNG and a 16-bit PNG against sharp 0.35.3: it normalises both to 3-channel
   8-bit on `raw()` decode, so the `data[offset+1]` / `data[offset+2]` reads cannot run off the
   end. **Not a bug.** Worth an explicit assertion (see F-12) but not a defect.
6. **The 0.85 threshold in the ramp test is right and the spec was wrong.**
   `frame-stats.test.mjs:63-68` asserts `p95 > 0.85` where `06-WORK-PACKETS.md:100` demanded
   `> 0.9`. The comment is correct: a byte-linear ramp's 95th percentile is byte 242, which
   decodes to 0.888. Asserting `> 0.9` would have asserted that the module *fails* to linearise.
   Good catch, correctly reasoned. Please reconcile the spec text.
7. **"Tests that fail on purpose" is the right design.** `summary-goal-01.md:67-80`. Splitting the
   red target-tracker from the green regression gate is exactly right, and the reasoning is sound.
8. **Escalating the TEXCOORD_0 false pass rather than burying it** (`summary-goal-01.md:106-110`)
   is the correct instinct. My complaint below is that the same class of defect was not then
   swept for.

---

## Section A — This is *wrong*

Ordered by how much damage it does.

### A-1 — `luminanceSpread` and `luminanceP95` are the same measurement
**`scripts/frame-stats.mjs:148-152`; all four budgets, e.g. `combat-arena/tests/visual-budget.test.mjs:28,37`**

In linear light, p05 collapses toward zero for essentially any scene containing shadow, so
`p95 − p05 ≈ p95`. Measured over the ten committed baselines:

- Pearson **r(spread, p95) = 0.990**
- Mean relative difference **|spread − p95| / p95 = 5.2%**
- In 9 of 10 demos, p05 is under 3% of p95. Only `traversal-study` (p05 = 0.108) differs, and it
  is the demo with a flat sky filling the frame.

So `combat-arena`'s two independent-looking gates — `spread ≥ 0.35` and `p95 ≥ 0.35` — are the
same gate. The precision claim in `summary-goal-01.md:77-80` ("spread and highlights fail on all
four antiky demos … a precise statement of what is wrong") is not precise; it is one finding
counted twice.

Worse, what the surviving number measures is *peak brightness*, not contrast. The half-void frame
above scores 0.791 by having one flat bright region and one flat black one. That is the exact
pathology named in the brief, and it is not hypothetical: `orbital-atlas` reports
`p05 = p50 = 0.000981` (identical to six decimals), meaning **more than half the frame is one
single dark value** — a flat space backdrop — and its "spread" is entirely the stars.

**Fix.** Compute percentiles on **L\*** (perceptual lightness) rather than linear Y, and report
p05, p50 and p95 as three independent numbers with three independent bounds. Drop `spread` as a
gate, or keep it as a derived display value only.

**Bounded criterion.** After the change, over the ten baselines,
`|r(L*spread, L*p95)| < 0.85`, and the two synthetic frames "half-void/half-flat" and
"smooth mid-tone modelling" must rank in the correct order (the modelled frame higher on the
local-contrast metric of A-6).

*Evidence this changes real conclusions:* recomputed in L\*, the ranking is not the same table.
`traversal-study` moves from **4th to 10th** (L\* spread 29.1, dead last), and `solar-forge` moves
from 6th to 4th. A ranking that inverts under a change of measurement space is not a ranking.

### A-2 — `clippedHigh` measures gamut clipping, not exposure, and contradicts the stated art direction
**`scripts/frame-stats.mjs:133-134`; every budget's clipping test, e.g. `point-light-expo/tests/visual-budget.test.mjs:44-45`**

`clippedHigh` counts a pixel when **any single channel** reaches 255. That is not the same as "the
highlight is blown". Verified against the shipped module:

- `rgb(255, 10, 10)` → **`clippedHigh = 1.0` (100% of pixels)** at luminance **0.215** — mid-grey
  brightness. A saturated red is reported as a totally blown frame.
- A 128×128 frame of neutral mid-grey ground with a magenta `rgb(255,40,220)` VFX disc covering
  ~13% of the frame → **`clippedHigh = 12.87%`**, against a **≤ 2%** budget. **Not one pixel in
  that frame is over-exposed.** It is a saturated colour, which is a different thing.

This puts two budgets in direct mathematical conflict for the same demo.
`point-light-expo`'s stated reference look is *"League of Legends: a strong key light, deep
shadows, **saturated ability effects**"* (`point-light-expo/tests/visual-budget.test.mjs:9`), and
its own colour budget demands `meanSaturation ≥ 0.25` (`:54`). Saturated effect colours live at the
gamut edge by construction. **The demo cannot satisfy its saturation budget and its clipping budget
simultaneously if it delivers its reference look.** The same trap applies to `combat-arena`
(Rocket League — saturated boost trails) and to `orbital-atlas`, whose 2.52% "clipping"
(`summary-goal-01.md:35`) is almost certainly **stars**, which are supposed to be white points.

**Fix.** Separate the two concepts.
- `clippedHigh` → count pixels where **all three** channels are 255 (genuinely blown, no detail).
- Add `gamutEdge` → fraction where any single channel is 255 but not all three. Report it; do not
  gate on it, or gate it far more loosely.

**Bounded criterion.** `rgb(255,10,10)` reports `clippedHigh = 0` and `gamutEdge = 1`;
`rgb(255,255,255)` reports `clippedHigh = 1` and `gamutEdge = 0`. Re-shoot `orbital-atlas`; its
`clippedHigh` must drop below 0.5%.

### A-3 — `meanSaturation` is maximised by near-black pixels, so the colour budget rewards darkness
**`scripts/frame-stats.mjs:74-81`; every budget's colour test, e.g. `antiky-town/tests/visual-budget.test.mjs:53-54`**

`(max − min) / max` is HSV saturation. It is scale-invariant, which means it is **completely
insensitive to how bright the pixel is** — and its denominator goes to zero in shadow, so it is
numerically unstable exactly where most of these frames live. Verified:

- `rgb(1, 0, 0)` → **`meanSaturation = 1.000`** at luminance 0.00006. Maximum colourfulness from a
  pixel indistinguishable from black.
- A field of near-black cool-tinted noise (bytes 0–3 red/green, 4–8 blue — i.e. what a tastefully
  blue-tinted shadow looks like) → **`meanSaturation = 0.999`**, luminance 0.0002. It passes the
  ≥ 0.20 budget with room to spare while being, visually, black.

This is not theoretical: across the ten committed baselines,
**r(meanLuminance, meanSaturation) = −0.70** (−0.78 against log luminance). The darker the demo,
the "more colourful" it measures. `luminous-reef` tops the table at 0.964
(`summary-goal-01.md:30`) with a mean luminance of 0.038 — that number is an artefact of its
darkness, not a finding about its palette.

The practical damage: `summary-goal-01.md:77-80` concludes *"clipping and saturation already
pass … what is wrong [is] value structure, not colour"*. **That conclusion is unsupported.** The
saturation budget is being passed by the demos being dark, which is the same defect the spread
budget is trying to catch. Fix the darkness and this metric will fall — and a naive reading will
call that a regression.

Your stated reasoning — that encoded space answers "how colourful does this look" — is defensible
as a *space* choice. It is the *formula* that is wrong. HSV S is not a colourfulness metric in any
space.

**Fix.** Replace with the standard no-reference colourfulness metric (Hasler & Süsstrunk 2003),
computed on the encoded bytes, which is exactly where they defined it:
`rg = R − G`, `yb = ½(R + G) − B`, `M = √(σ²rg + σ²yb) + 0.3·√(μ²rg + μ²yb)`. It is
brightness-aware by construction, it is a decade-plus field standard, and it is about fifteen lines.
Keep the current value under a name that says what it is, such as `meanHsvSaturation`, if you want
continuity.

**Bounded criterion.** The near-black cool-noise frame scores below 15% of the score of a
mid-luminance frame with the same hue angles. `r(meanLuminance, colourfulness)` over ten re-shot
baselines has |r| < 0.4.

### A-4 — A partially off-frame probe silently measures a different rectangle
**`scripts/frame-stats.mjs:88-94`**

The bounds logic clamps `left`/`top` to 0 and `right`/`bottom` to the frame, then only errors when
the result is *empty*. A rectangle that is partly outside slides and resizes with no signal.
Verified on an 8×8 frame:

- Requested `{x: -2, y: 0, width: 4, height: 4}` → returned **`pixels: 16`**, the requested count,
  but sampled from `x = 0..3`, **not** `x = −2..1`.

The caller gets a plausible pixel count and cannot tell it was served a different region. This
matters because probes are the foundation of the *good* criteria in `06-WORK-PACKETS.md` — the
shadow probe at `:222`, the acne probe at `:224-226`, the bloom probe at `:247`. Those tests
compare two rectangles; if one silently slides, the comparison is meaningless and green.

**Fix.** Reject any rectangle not wholly inside the frame, or return an explicit
`clamped: true` plus the actual rectangle sampled.

**Bounded criterion.** `{x: -2, y: 0, width: 4, height: 4}` on an 8×8 frame throws (or reports
`clamped: true` with `rect: {x:0,...,width:2}`). Add the case to `frame-stats.test.mjs` beside the
existing fully-off-frame test at `:146-160`, which is the only one covered today.

### A-5 — `clippedLow` is not the mirror of `clippedHigh`, so crushed blacks are unmeasured
**`scripts/frame-stats.mjs:135`**

`clippedHigh` fires when the **max** channel is 255 (any channel at the top). `clippedLow` fires
when the **max** channel is 0 — which requires **all three** channels to be zero. The two are not
symmetric. Verified: `rgb(0, 200, 100)` reports `clippedLow = 0` despite the red channel being
fully crushed.

Consequently `clippedLow` reads 0.000000 in all ten baselines — not because nothing is crushed, but
because the condition is nearly unreachable. There is currently **no measurement of crushed
shadows at all**, which is precisely the failure mode a dark, muddy renderer produces, and which
`01-RENDERING-VOCABULARY.md:183` explicitly names ("crushed and over-contrasty").

**Fix.** Define both consistently and document the choice: `clippedHigh` = all channels at 255,
`clippedLow` = all channels at 0, plus `gamutEdge` per A-2.

**Bounded criterion.** A synthetic frame that is 30% `rgb(0,0,0)` reports `clippedLow = 0.30`; a
frame that is 30% `rgb(0,200,100)` reports `clippedLow = 0` and a non-zero
`channelCrushed` counter. Neither case is tested today.

### A-6 — A single full-frame aggregate cannot carry this weight. Stated plainly: no.
**Applies to every metric in `frame-stats.mjs:144-157`**

You asked directly, so: **no, full-frame aggregates cannot do this job, and the two counterexamples
you proposed are both real.** I built and measured them:

- Half black void, half flat bright: `spread` **0.791** — would rank 2nd of 10.
- Smooth mid-tone modelling with genuine three-dimensional read: `spread` **0.240** — fails all
  four budgets.

The reason is that every current metric is **order-invariant**: shuffle the pixels of a frame at
random and every reported number is identical. But "flat, lifeless rendering" is a statement about
*spatial* structure — about whether brightness varies *across a surface*. A histogram cannot see
that, ever, by construction.

This also means the audit's own headline complaints are literally invisible to the harness.
`00-VISUAL-DIAGNOSIS.md:15-17` says *"nothing in any of these scenes casts a shadow, and almost
nothing has a bright side and a dark side"*, and `:78` says *"photoscanned rock rendered as flat
cardboard"*. Both are local-contrast and high-frequency-detail statements. **Not one shipped metric
can detect either.**

**Fix — the single highest-value addition in this document.** Add a tiled local-contrast measure:
split the frame into a grid (32×18 tiles at 1280×720 gives 40×40 px tiles), compute L\* standard
deviation per tile, and report the **median** and the **75th percentile** across tiles. Median tile
contrast is the direct numeric answer to "squint at it — is everything the same value?"
(`01-RENDERING-VOCABULARY.md:23`). Add a second measure of high-frequency detail: mean absolute
Laplacian (each pixel minus the average of its four neighbours) on L\*, which is the standard
cheap sharpness/detail proxy and is exactly what "flat cardboard" destroys.

**Bounded criterion.** On the four synthetic frames above, `medianTileContrast` must order them
*modelled > low-key-lit > high-key > half-void*, with the half-void frame last. And
`meanAbsLaplacian` on a normal-mapped surface must exceed the same surface with normal mapping
disabled by ≥ 3× — which is already the criterion `06-WORK-PACKETS.md:287-288` wrote and which the
current module cannot evaluate.

### A-7 — The 9.8× claim does not survive contact with a perceptual space
**`docs/objectives/scratch/demo-refining/goals/_completed/summary-goal-01.md:44-47`**

The claim is *"`glass-garden` has 9.8× the luminance spread of `combat-arena`"*. Three separate
problems, any one of which is disqualifying.

1. **It is a brightness ratio wearing a contrast label.** Per A-1, `spread ≈ p95`. The sentence
   reduces to "glass-garden's 95th-percentile pixel is 9.8× brighter", which nobody would present
   as evidence about lighting quality.
2. **It is an artefact of the measurement space.** Recomputed in L\*, the same two frames are
   **2.48×** apart, not 9.78×. Computed as dynamic range in stops (log₂ p95/p05 — the film and HDR
   convention), `combat-arena` is *wider* than `glass-garden` (10.9 vs 6.8 stops) because its
   shadows go deeper. Three defensible ways of asking "which has more range" give 9.8×, 2.5×, and
   0.6×. **The 9.8× figure is the most flattering of the three to the conclusion being argued.**
   I do not think that was deliberate, but it is the number that got published.
3. **It is confounded by content, as you suspected.** `glass-garden` is a bright glass garden,
   `combat-arena` is a night-time space arena with a black backdrop and `vec3(0.006, 0.01, 0.018)`
   fog (`combat-arena/src/shaders/arena-model.shader.ts:73`). Comparing their full-frame
   percentiles compares subject matter. A fair comparison would probe matched regions — a lit
   surface facing the key in each — not whole frames.

The neighbouring claim at `:41-43` — that the AAA-referenced demos have *"less value range than the
small procedural shader studies"* — is also weakened: in L\*, `combat-arena` (34.9) sits between
`shader-study` (38.6) and `point-light-expo` (33.1), and the "shader studies" lead shrinks from
~1.8× to ~1.15×. There is a real gap. It is not the gap the table states.

The observation at `:48-50` — that `antiky-town` and `town-study` report identical numbers — is
**correct and well spotted**. Their p05, p95 and spread agree to all six recorded decimals, which
is far past coincidence.

**Fix.** Restate the table in L\*, add stops as a second column, add the local-contrast column from
A-6, and mark the six non-budgeted demos as *context, not comparison*. Delete the 9.8× sentence or
replace it with the region-matched comparison.

**Bounded criterion.** Every ratio quoted in a summary is accompanied by the same ratio computed in
a second space; if they differ by more than 2×, the ratio is not quoted as evidence.

### A-8 — The budgets assert against a committed JSON file, not against a render
**`packages/demos/antiky/*/tests/visual-budget.test.mjs:19-23` (all four); `scripts/shoot-demos.mjs:266-268`**

Every budget test reads `visual-metrics.json` from disk and asserts on its contents. Nothing binds
that file to a build. The sidecar (`shoot-demos.mjs:103-123`) records `capturedAt` and
`warmUpFrames` and **no** git revision, no `acceptedBuildRevision` (which
`captureWithFence` already has in hand at `:181`), no GPU, no driver, no browser build.

So `npm run demos:verify` can be turned from 13-red to all-green by editing ten numbers in a JSON
file, and no test anywhere would notice. Given that the owner has explicitly said they cannot
validate this work visually, this is the one finding with a governance dimension rather than only
a technical one. I am not alleging anything; I am pointing out that the loop has no closure, and a
future agent under pressure to make a red suite green has a frictionless path.

**Fix.** Record `acceptedBuildRevision`, the git commit SHA, and the reported GPU/adapter string in
the sidecar. Add a check that the recorded revision matches `git rev-parse HEAD` for the demo's
source tree, skipping with an explicit "baseline is stale, re-shoot" message rather than passing.

**Bounded criterion.** Editing `visual-metrics.json` by hand and running `npm run demos:verify`
produces a *stale baseline* failure, not a pass.

### A-9 — Two invariants can be satisfied by making the renderer worse
**`packages/demos/tests/pipeline-invariants.test.mjs:61-77` and `:134-154`**

*Tone mapping (`:61-77`).* The test flags any shader containing `tonemapACES` except a file ending
`post.shader.ts`. Only `antiky-town` has such a file (`town-post.shader.ts`); `combat-arena`,
`point-light-expo` and `traversal-study` have **no post pass at all**. The test never asserts that
a post pass exists. Therefore the cheapest way to turn it green is to **delete the tone-mapping
calls**, shipping un-tone-mapped output that clips hard — strictly worse than today, and the test
goes green.

*Fog (`:134-154`).* The pattern requires **numeric literals**:
`smoothstep(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*length\(uCameraPosition`. `point-light-expo` already
writes `smoothstep(uFogStart, uFogEnd, ...)` (`reliquary-model.shader.ts:180`,
`reliquary-floor.shader.ts:128`, `foundry.shader.ts:185`) and therefore **matches zero times and
passes vacuously**. The test is satisfiable by replacing literals with uniforms — that is,
by *hiding* the values rather than by *unifying* them — and it then cannot check anything.
This is the same defect class as the TEXCOORD_0 false pass recorded at
`summary-goal-01.md:106-110`, and it is still live.

**Fix.** For tone mapping: additionally assert each demo *has* exactly one post pass that contains
a tone-map call. For fog: stop parsing shader text. Assert instead that each demo exports a single
fog constant/uniform and that every shader's fog term derives from it — or, better, replace with a
runtime probe: two probes on the same material at different depths must differ in luminance by a
demo-declared amount.

**Bounded criterion.** Deleting a `tonemapACES(...)` call must make the suite *more* red, not less.
Converting a numeric fog literal to a uniform must not change the fog test's result.

### A-10 — The key-light invariant does not evaluate half the demos
**`packages/demos/tests/pipeline-invariants.test.mjs:110-132`**

The pattern only matches `const <key|sun|light|keyLight|sunDirection> = normalize(vec3(...))`.
I ran it: it matches in `combat-arena` (3 shaders) and `traversal-study` (2 shaders), and
**zero times** in `antiky-town` and `point-light-expo`. `antiky-town` has **thirteen** shaders under
`src/town/shaders/` and is silently exempt from the one invariant most likely to catch its problem.

It is also fragile in both directions. False negative: any light stored in a uniform, computed,
declared `let`, or named `sunDir`/`mainLight`/`L` is invisible. False positive: the vectors are
compared as **normalised text**, so `vec3(0.38, 0.9, 0.28)` and `vec3(0.380, 0.9, 0.28)` are
"disagreement", and a deliberate fill or rim light that happens to be named `light` is reported as
a bug.

**Fix.** Delete the regex. Assert instead that each demo exports one `KEY_LIGHT_DIRECTION` constant
and that no shader file constructs a `normalize(vec3(` literal in a lighting position — a rule that
is checkable, teachable, and has a single obvious remedy. Or move it to a runtime probe: a probe on
a key-facing surface must be brighter than a probe on an away-facing surface of the same material,
per object.

**Bounded criterion.** The rewritten test must *fail* on `antiky-town` today or a written note must
record why `antiky-town` is exempt. A test that examines zero files must report that, not pass.

### A-11 — The remaining two invariants are similarly evadable
**`pipeline-invariants.test.mjs:79-90` and `:92-108`**

- `antiky-town` has **no `scripts/` directory**, so `assetScripts()` (`:42-59`) skips it entirely
  and both asset invariants are vacuous for it.
- `:82` `delete\s+\w+\.normalTexture` misses `material.normalTexture = undefined`, destructuring
  omission, `Reflect.deleteProperty`, filtering during a copy, or simply never writing it.
- `:97` `\buvs\.push\(|paletteU` misses any typed-array or index-assignment UV writer.
- `:99` `attributes.TEXCOORD_0` — the already-tightened one — still only proves the string appears;
  a script can read it and discard it.

All four test **the wrong layer**. They ask whether a source file contains a string; the thing you
care about is whether the *shipped asset* has a normal map and authored UVs, and whether the
*shader samples them*.

**Fix.** Replace both with artifact assertions: parse the built GLB and assert ≥ N materials carry
a `normalTexture` and that `TEXCOORD_0` accessors have a bounding box larger than a single texel.
This cannot be evaded by rewording source.

**Bounded criterion.** Reintroducing the original UV-synthesis bug in a *differently worded* script
still fails the test.

### A-12 — `--runs n` silently discards every run but the last
**`scripts/shoot-demos.mjs:233-268`**

`sidecar` is reassigned inside the loop at `:253` and only the final value is written at `:268`. A
flag that exists to build confidence through repetition produces exactly one data point and no
variance. `summary-goal-01.md:83-86` cites *"three consecutive runs each"* as evidence — but
nothing recorded how much the numbers moved between them, so **the measurement system has zero
published repeatability data.**

This matters more than it looks. The demos are animated, capture is timed by
`warmUpFrames: 60` with a wall-clock `delay(2_000)` at `:231`, and there is no fixed timestep or
seed. Frame-to-frame variation is therefore an uncontrolled variable, and budgets of the form
`spread ≥ 0.35` are being written to two decimal places against it.

**Fix.** Keep all runs; record min/median/max per metric plus the run count in the sidecar. Assert
budgets against the **median**.

**Bounded criterion.** `--runs 5` writes five sets of numbers and a spread. If the max−min of
`p95` across runs exceeds 10% of the median, the shoot fails with "capture is not repeatable —
lock the frame" rather than silently committing one sample.

---

## Section B — This is *incomplete*

Not wrong, but the system claims more coverage than it has.

**B-1 — Named probes are built, unit-tested, and never wired in.**
`frame-stats.mjs:87-108` and `:116-117` implement probes; `frame-stats.test.mjs:122-160` tests
them; and then `shoot-demos.mjs:252` calls `readFrameStats(pngPath)` with **no options**, and
`buildMetricsSidecar` (`:103-123`) has no field to hold probe output. The one capability that could
answer A-6 is dead in the shipped path. `06-WORK-PACKETS.md:102` also required probes to come from
"a per-demo config file, not magic numbers"; no such file exists.

**B-2 — The `luminanceP05` bound was specified, dropped, and is still depended on.**
`06-WORK-PACKETS.md:110` requires each demo to declare `luminanceP05` bounds. No budget file
declares one — `spread` was substituted. But `06-WORK-PACKETS.md:246` (packet W B.4(D)) still
lists *"W0.3's `luminanceP05` bound is now met (the scene reaches genuine darks)"* as an acceptance
criterion. **That bound does not exist**, so goal B.4 has an unsatisfiable acceptance criterion.
This is not cosmetic: p05 is the only shipped number that tests "does the scene reach genuine
darks", and removing it in favour of `spread` is *what created* the collinearity in A-1.

**B-3 — Two of goal 06's probe criteria are mis-scaled and will not behave as intended.**
- `06-WORK-PACKETS.md:224-226`: *"luminance standard deviation inside a probe rectangle is under
  0.02"*. That is an **absolute** threshold in linear light, where one 8-bit step is worth 0.0005
  at byte 20 but 0.0087 at byte 250. So 0.02 permits **40 quantisation steps** of acne on a dark
  surface and only **2** on a bright one. It is near-trivially passed in shadow and near-impossible
  on a sunlit plane. Express it as a coefficient of variation (σ/μ) or in L\*.
- `06-WORK-PACKETS.md:222-223`: *"at least 25% darker"* for a cast shadow. 25% in linear light is
  **0.42 stops**, or ΔL\* of only 4–8. A real cast shadow (key removed, ambient only) is 3–6×
  darker — ΔL\* ≈ 25. The criterion would green-light a barely-perceptible tint as "has shadows".
  Ask for ≥ 2× (1 stop) at minimum; 3× is closer to the reference looks.

**B-4 — Nothing in the system is HDR, and the vocabulary should stop implying it is.**
The captured PNG is 8-bit, post-tone-map, display-referred. Dynamic range in the rendering sense
(scene-referred, pre-tone-map, unbounded) is *destroyed* by tone mapping before the measurement
happens — that is tone mapping's job. If you want to know whether the renderer has real range, the
measurement has to be on the pre-tone-map buffer, not the screenshot. Nothing here is wrong about
this yet, but `01-RENDERING-VOCABULARY.md` and the budgets are one careless sentence away from
claiming it.

**B-5 — No colour-space assertion on the capture.** The module assumes sRGB
(`frame-stats.mjs:7-9`). Nothing asserts the canvas is `srgb` rather than `display-p3`, and nothing
asserts the screenshot was not colour-managed in transit. If a future Chromium or a different
display changes this, every number shifts and no test notices. One assertion on the PNG's embedded
profile (or its absence) closes it.

**B-6 — Missing measures that the field would consider table stakes.**
In rough order of value here: local contrast (A-6), colourfulness (A-3), high-frequency detail
(A-6), histogram shape (what fraction of pixels sit in the bottom decile — the direct measure of
"muddy"), spatial distribution (rule-of-thirds / centre-vs-corner luminance, which
`06-WORK-PACKETS.md:250` already wants for vignette), and hue diversity (circular variance of hue
weighted by chroma and luminance — the direct measure of "everything is the same brown").

**B-7 — No reference-based comparison.** Once a demo lands a look the owner approves, the strongest
possible gate is "this frame is within ΔE / FLIP tolerance of the approved frame". That is one
sharp regression test worth more than all four budgets, and it needs no thresholds to be
*authored* — the approved frame *is* the threshold. This is the natural end state for goals 06–07,
and nothing currently points at it.

---

## Section C — This is a matter of *taste* (I disagree, but you are not wrong)

- **Saturation in encoded space.** Your reasoning at `frame-stats.mjs:68-73` is sound: the
  delivered image is what the eye sees. I would keep the encoded space and change the *formula*
  (A-3). The space is taste; the formula is not.
- **Excluding budgets from `npm test`** (`summary-goal-01.md:67-75`). Correct call, well argued.
- **Committing metrics rather than frames.** Reasonable, given `.antiky/` is gitignored. But it is
  what makes A-8 possible, so it comes with an obligation to record provenance.
- **`Object.freeze` on the return values** (`frame-stats.mjs:103, 144, 156`). Harmless. Slightly
  unusual for a plain-data return. No objection.
- **Whether spread lives in L\* or in stops.** Either is defensible. Linear light is not.

---

## Direct answers to the six questions

**1. Are these the right metrics?** No. Three of the four are actively misleading (A-1 spread, A-2
clipping, A-3 saturation), and the fourth (p95) is fine but is doing spread's job too. What is
missing that matters most is **local contrast** — the single measure that distinguishes "flat" from
"lit", and the one the whole diagnosis rests on. After that: colourfulness, high-frequency detail,
perceptual weighting (L\*), and spatial distribution. Colour-space concerns are handled correctly.
HDR is a category error here (B-4).

**2. Is the maths right?** Mostly yes, and better than average. The sRGB decode, Rec.709 weights,
percentile interpolation and the typed-array sort are all correct — I verified each. The real bugs
are definitional, not arithmetic: the clipping asymmetry (A-5), the gamut/exposure conflation
(A-2), the saturation instability at low luminance (A-3), and the silent probe clamp (A-4).

**3. Are the thresholds defensible?** Not as written. Two are wrong **in principle**: a well-lit
low-key frame scores 0.092 and fails (A-1), and a high-key daylight frame — `traversal-study`'s own
LittleBigPlanet reference — scores 0.296 against its 0.40 budget and fails (A-1). And
`point-light-expo` cannot satisfy its clipping and saturation budgets at the same time if it
delivers its stated look (A-2). Your instinct in the brief is correct: **these metrics currently
punish good art.**

**4. Does a single full-frame statistic work?** No. Both of your counterexamples are real and I
measured them (A-6). Full-frame histograms are order-invariant and therefore structurally blind to
the thing being diagnosed. Supplement, do not replace: keep p05/p50/p95 in L\* as exposure
descriptors, add tiled local contrast and a detail measure as the actual quality gates, and move
the pass/fail authority to probes.

**5. Are the invariants sound?** No. Two can be satisfied by making the renderer worse (A-9), one
does not evaluate half the demos (A-10), and the other two are string-matching at the wrong layer
(A-11). The TEXCOORD_0 false pass was not an isolated incident; it was the first instance of the
house style. Every one of the five is a regex over source, and every one has a rewording that
evades it.

**6. Is the comparison table fair?** No (A-7). It is a brightness ranking labelled as a contrast
ranking, the 9.8× figure is the most favourable of three defensible framings (2.48× in L\*, 0.62×
in stops), it is confounded by scene content, and the ranking inverts under a change of measurement
space — `traversal-study` goes from 4th to last. The duplicate-demo observation at `:48-50` is
solid. The rest of the table should not be used to justify work until it is restated.

---

## What you should personally decide, versus what an engineer should just fix

**Yours to decide — these are art direction, and no engineer should choose them for you:**
1. **Whether each demo's reference look is actually the target.** Everything downstream is
   arithmetic once these are fixed. Sanity check: LoL and Rocket League are *not* low-contrast, but
   they are also not high-key — they are mid-key with deep shadow and saturated accents.
2. **How dark each demo is allowed to be.** Some of these scenes are legitimately dark. Say so
   per demo, in words, and the p05 bound follows.
3. **Whether `point-light-expo` prioritises saturated VFX or clean highlights** (A-2). They pull
   against each other and you cannot have both at maximum.
4. **The approved frame for each demo, once one exists** (B-7). Only you can say "that one".
   That single act is worth more than every threshold in the repository.
5. **Whether motion capture gets unblocked** — already correctly raised at
   `summary-goal-01.md:14`. Agreed that it is a real gap; camera shake cannot be measured from a
   still frame.

**An engineer should just fix these — no judgement call involved:**
- A-4 (silent probe clamp), A-5 (clipping asymmetry), A-12 (`--runs` discarding data), B-1 (probes
  unwired), B-5 (colour-space assertion). These are defects with one correct answer.
- A-2, A-3 (metric definitions), A-1/A-6 (add L\* and local contrast). The *choice* of metric is
  technical; only the *threshold* is yours.
- A-8 (provenance in the sidecar), A-9/A-10/A-11 (invariants rewritten as artifact and runtime
  assertions), B-2 (the dangling p05 criterion), B-3 (rescale the two probe criteria).
- A-7 (restate the summary table). The conclusion may well survive; the arithmetic behind it should
  be redone first.

**Sequencing suggestion.** Do A-6 (local contrast) and A-4 first, before goals 06 and 07 start
producing work to be judged. A-6 is the metric that will actually tell you whether the lighting
work succeeded, and A-4 is a prerequisite for every probe criterion those goals depend on.
Everything else can follow. Do **not** re-tune the existing thresholds — they are measuring the
wrong quantity, and tuning them is effort spent making a broken instrument more precise.

---

## Reproduction

All numeric claims were produced by running the shipped `scripts/frame-stats.mjs` unmodified
against synthetic PNGs and against the ten committed `visual-metrics.json` files, on
sharp 0.35.3 / Node 22.15.0, on 2026-08-11. No repository file was modified during this review.
