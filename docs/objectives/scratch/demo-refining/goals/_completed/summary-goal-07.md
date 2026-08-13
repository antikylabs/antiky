# Summary — goal 07: carry the render slice to `combat-arena`, `traversal-study` and `antiky-town`

**All fifteen packets landed. The goal's own completion definition is not met**, on three counts:
`traversal-study` misses its local-contrast floor, no demo gained the GGX BRDF required outcome 6
asks for, and `antiky-town` has no colour-pipeline unit test. Each is stated below with its
measurement rather than folded into a pass.

**Commits:** `58ec726`..`01aa3e9`. The packet commits are in the table under *What landed*; the
running record with every measurement is in [`progress-goal-07.md`](progress-goal-07.md).

## Action needed from the owner

Three items. None of them blocks goal 08 from starting — 08 consumes the HDR scene target, and all
three demos have one.

**1. `traversal-study`'s local-contrast floor: 0.1655 against 8.5. Not fixed, and an agent must not
fix it.** This is [`execute-goal-99.md`](../execute-goal-99.md) row **M1** — the budget thresholds
are the agent's proposal, not stated art direction — and both this goal and goal 99 forbid an agent
loosening a bound to make a packet pass.

The number is not a lighting failure. Local contrast is the *median* over 32-pixel tiles, and
**64.4% of this demo's frame is flat sky**, so the median tile is a sky tile by construction and
reads near zero whatever the subject looks like. `point-light-expo`, `combat-arena` and `antiky-town`
clear the bar because their frames are filled edge to edge; this is a side-scroller with an open
horizon. The packet's own measurements — bloom, grade, vignette, clipping — all pass.

Two defensible fixes, and the choice is a judgement about what the metric should mean:

- **Measure the median over tiles that contain subject**, discarding those whose dynamic range is
  under a threshold. Keeps the metric's intent and makes it framing-independent for every demo.
- **Give this demo its own floor**, derived from its own captures.

Registered as goal 99 row **M12**.

**2. Required outcome 6 — the GGX BRDF — did not land in `combat-arena` or `traversal-study`, and
neither did `combat-arena`'s specular acceptance criterion. Not fixed. This is unfinished goal 07
scope, and the owner's decision is where it lands.** The gap was found while closing the goal, not
while executing it: the progress record never mentions specular, and neither does any packet commit.

- `combat-arena/src/shaders/ship-model.shader.ts` still has **no specular term of any kind**. Its
  lit value is `authored * earthshine + authored * (keyLight * 1.15 + fillLight * 0.32)` — diffuse
  and ambient only, which is what the goal file names as "fatal against a Rocket League target". Its
  `rim` is still **gated behind the emissive parameter**, so it appears only on dashing ships; the
  goal asks for it ungated.
- `traversal-study` has an always-on rim and no GGX. A toon demo arguably wants none, but nothing in
  the code says so, and the goal requires a deliberate divergence to carry its reason.
- **The specular-presence criterion — p95 luminance inside the hull ROI ≥ 2× its median — was never
  measured** in `combat-arena`, because the term it measures does not exist.
- The reference's implementation is ready to copy: `specularGGX` at
  `point-light-expo/src/shaders/reliquary-model.shader.ts:74`, with the Fresnel and geometry terms
  BroMetal's `specGGX` leaves out.

Recommendation: cut it as **07-01**, one step per demo, rather than folding it into goal 08 — 08 is
art direction and VFX, and a BRDF change underneath it would make 08's before/after captures
unattributable.

**3. `antiky-town` has no colour-pipeline unit test.** Required outcome 1 asks for one per demo, and
the acceptance criterion is a known albedo under a known light landing within 2/255 of the analytic
value. `combat-arena`, `traversal-study` and `point-light-expo` each have
`tests/colour-pipeline.test.ts`; `antiky-town` does not. Its W B.1 change — replacing
`gammaCorrect(…, 2.2)` with the piecewise `encodeSrgb` — is currently covered only by
`pipeline-invariants`' assertion that the helper copies are identical, which proves the curve is
shared but not that the round trip closes. **Not fixed.** Small and well-bounded; it belongs with
item 2 if 07-01 is cut.

## What landed

| Demo | B.1 colour | B.2 HDR + tone-map | B.3 sun + shadows | B.4 ambient + AO | B.5 bloom/grade/vignette |
| --- | --- | --- | --- | --- | --- |
| `combat-arena` | `58ec726` | `3ab9ea4` | `a1d9a73` | `495d353` | `a789fc4`, `3d83a8d` |
| `traversal-study` | `7f3d6d1` | `d45413e` | `6c7918e`, `061785d`, `031b281` | `cfa9e7b` | `9b1bfa7` |
| `antiky-town` | `aee43b4` | `a2e8df0` | audited, kept (`3d3dcc8`) | audited (`8d30599`) | audited |

`antiky-town`'s W B.3 and W B.5 closed as audits with **no code change**, which is what the goal asks
for where its existing implementation measures better. The evidence is under *Decisions taken*.

The water depth contract was guarded **before** the format change, as the goal requires: `b6b453d`,
four assertions about the convention rather than about pixels, proven able to fail by replacing
`vDepth` with `1`.

## Evidence against the acceptance criteria

| Criterion | `combat-arena` | `traversal-study` | `antiky-town` |
| --- | --- | --- | --- |
| Colour pipeline within 2/255 | **pass** | **pass** | **no test** (owner item 3) |
| W B.2 invariance < 3/255 | **0.876** | **4.27** — attributed | **1.571** |
| Aliased edges must not rise (town: must fall) | interior 9,083 → **9,050** | 2,732 → **2,446** | 22,403 → **15,541** |
| W0.4 pipeline invariants | **pass** | **pass** | **pass** |
| Shadow ≥ 25% darker than lit, same material | **27.6%** at 186 px, later 46.8% | 3,346 px > 10%, 678 > 25% | **22.6%** of the town, p90 38.0% |
| Acne — variance the shadow adds | **0.000000** | — | **none**; 0.194 → 0.178 |
| Ambient, up vs down ≥ 30% | **50%** | not measured | **72–78%** per lobe |
| Ambient, inside corner ≥ 15% | **no AO term** | **no AO term** | AO present, probe not taken |
| Ramp ≥ 6:1 | — | **6.69:1**, 186° of hue | — |
| Specular p95 ≥ 2× median | **not done** (owner item 2) | — | — |
| Water depth contract | — | — | **pass**, `b6b453d` |
| Cost ≤ +40% frame time | **not measured** | **not measured** | **not measured**, either resolution |
| Bloom halo ≥ 20%, vignette 10–25% | not measured | not measured | not measured |
| W0.3 budget green on every bound | **pass** — 8.64 | **fail** — 0.1655 | **pass** — 8.89 |

`npm test` is green: 0 failures. `npm run demos:verify` is 49 pass / 3 fail — the traversal-study
floor above, plus two failures outside this goal's scope, both registered (see *Outstanding*).

## Decisions taken during the goal

- **Where a packet must delete a visual term, the deletion wins and the invariance number is
  reported.** `traversal-study`'s 4.27 is `traversal-model` tone-mapping for the first time and
  `heightHaze` being deleted, both required by the packet. The region breakdown shows the pipeline
  itself neutral: open sky drifted **0.008/255**. A term was not kept to make a budget pass.
- **The acne bar of "standard deviation < 0.02" is unreachable on any textured surface** and was
  replaced by the variance the shadow *adds*, measured against a control with the shadow term off.
  `combat-arena`'s diamond plate reads 0.042 with no shadow at all.
- **The shadow probe pair sits at 186 px rather than 200** in `combat-arena`, because the arena is an
  enclosed box and no pair at exactly 200 had both probes on comparable deck. Stated, not rounded up.
- **`antiky-town`'s shadow pass was kept over the reference's**, per the goal's reconcile-and-measure
  instruction. It wins on four counts, three of which are places the *reference* carries a
  workaround: a true orthographic projection, 16-bit two-channel depth, constant-plus-slope-scaled
  bias, and resolution that tracks canvas width. Replacing it would have been a downgrade.
- **`antiky-town` keeps one deliberate divergence from 06-05**: `ambientVisibility = 0.62 + ao * 0.38`
  lets occlusion reach the direct term, which the reference forbids. Under a low golden-hour sun a
  voxel cavity with no direct visibility term becomes an unlit black notch. The reason is on the line
  above it and a test now fails if the comment is removed.
- **`combat-arena`'s key light moved from 59° to 35° and behind the arena.** At 59° only 1.63% of the
  deck came back darkened by 25% or more and no probe pair could be placed; at 35°, 16.38%.
- **`inverseTonemapACES` is a boundary conversion, not an escape hatch.** Values authored as "what
  the screen shows" — clear colours, fog — are converted where they enter a pipeline that will
  tone-map them. Nothing the renderer lights may use it, and the colour-pipeline test asserts the two
  curves remain inverses.

## Premises in the goal file that measurement refuted

Eight, each verified before the corresponding work was skipped or changed. Six were corrected in the
goal file itself while executing (`a420835`); two more were found in `antiky-town`:

| Stated | Measured |
| --- | --- |
| `combat-arena` has three shaders disagreeing about the sun | already one direction |
| `combat-arena` draws contact shadows as lit cubes | already unlit, radial falloff |
| `traversal-study` runs `cull: 'none'` | already `cull: 'back'` |
| `traversal-study`'s ramp is 1.81:1 | **6.69:1** over 64 sampled stops |
| W B.2 invariance holds per demo under 3/255 | cannot, where the packet must delete a visual term |
| Acne is luminance σ < 0.02 on a lit plane | unreachable on any textured surface |
| `antiky-town`'s scene target "requests no HDR format" | BroMetal fixes every offscreen target to `rgba16float`; it has always had headroom. The real gap was the lost 4× MSAA |
| `antiky-town` is "correct end to end" on colour | it encoded with `gammaCorrect(…, 2.2)` while decoding with the piecewise curve — a round trip that does not close, worst in the darks |

`antiky-town`'s bloom has therefore been working against real HDR content since it was written; it
thresholds at 1.02, above white.

## Outstanding

| Item | Classification |
| --- | --- |
| `traversal-study` local contrast 0.1655 vs 8.5 | **Needs the owner** — goal 99 **M12**, and M1 |
| GGX BRDF absent in `combat-arena` and `traversal-study`; `combat-arena`'s rim still gated; specular criterion unmeasured | **Needs the owner** — scope decision; recommended as goal **07-01** |
| `antiky-town` has no colour-pipeline unit test | **Needs the owner** — same decision as above |
| Baked vertex AO not wired in `combat-arena` or `traversal-study`; inside-corner probe has nothing to measure | Goal 99 **A13** — the bake tool exists and is tested; the reference measured only 3.9% at p10 for a set of convex boulders |
| Frame-time cost bound never measured, in any demo | Goal 99 **M13** — goal 99 **A12** already records that the runtime is capped at display refresh, so the current instrument may not be able to resolve a 40% bound |
| Bloom-halo, vignette-corner and peter-panning probes not taken for these three demos | Goal 99 **M13**, same row — the per-packet probe set was applied unevenly |
| `pipeline-invariants` reports three `brometal/` demos tone-mapping in their materials | Goal 99 **U5** — outside goal 07, which covers the three antiky demos |
| `antiky-town`'s material atlas declares no gutter | Goal 99 **U4** — goals 14 and 15 |

## Process findings worth keeping

Four, and they cost more than the packets did.

- **Capture the control first.** Eight hypotheses about `traversal-study`'s contact shadow were
  generated before anyone captured the demo with the feature *switched off*. Every measurement had
  compared one change against another change, which made all of them uninterpretable. The blob had
  worked from the first attempt.
- **A box mean is the wrong probe for a small localised effect.** The probe was 110 × 40 px and the
  blob covered 241 of them, so a real 20% darkening averaged out to 1.2% — indistinguishable from
  noise. The goal 06 shadow probes worked because their regions were uniformly shadowed by
  construction; that assumption was not rechecked here.
- **A diagnostic that fails to compile still produces a capture**, because the build falls back to
  the last good artifact. One reading was taken from a frame that never contained the diagnostic, and
  a careless colour threshold turned the platform's own orange underside into "the blob draws".
- **A throw during renderer construction presents as `CAPTURE_RUNTIME_TIMEOUT`**, not as an error
  naming the variable, because the runtime never finishes publishing. It happened three times in this
  goal: a missing depth factory, a `const` read in its temporal dead zone, and a uniform the unlit
  shader does not declare.
</content>
</invoke>
