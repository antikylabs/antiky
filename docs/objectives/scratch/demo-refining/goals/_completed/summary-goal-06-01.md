# Goal 06-01 — finish colour management in point-light-expo

**Complete.** Every required outcome met; the acceptance test passes within its 2/255 tolerance.

## Action needed from the owner

**None.** Every bug found during this step was fixed, including two that were not mine and are
described below.

## What landed

| Item | Outcome |
|---|---|
| The encode | `encodeSrgb` in the five shaders that write a lit final pixel, applied once, last, after the tone-map. |
| The curve | The piecewise sRGB inverse, not a 2.2 gamma. `max` guards the toe because `pow` of a negative is undefined and a tone-mapped value can land fractionally below zero. |
| The wash knobs | `uDiffuseLift`, `uTextureContrast`, `uSaturation`, both grey washes, the presentation values and the renderer lines that set them — deleted, not re-tuned. `rg` returns zero hits. |
| Unlit constants | The colours reaching `contact-shadow` and `foundry-glow` are converted to linear where they enter, so encode returns exactly what was authored. |
| Tests | A colour-pipeline acceptance test, plus two repository invariants covering the encode the way the existing ones cover the decode. |

## Measured

| | before | after |
|---|---|---|
| luminance mean | 0.0327 | **0.0970** |
| luminance p50 | 0.0201 | **0.0949** |
| luminance p95 | 0.1048 | **0.2550** |
| local contrast | 4.622 | **6.768** |

Both changes are visible in that and pull in opposite directions, which is the check that they are
real: the encode alone would put p95 near 0.357, and deleting the washes pulled it back to 0.255.

The goal predicted p95 would "climb back toward its pre-goal-04 value of ≈0.090". It went past it,
and that is correct rather than excessive — the pre-goal-04 image had both transfer halves missing
*and* the washes present. **Verified the encode is not doubling:** BroMetal calls
`context.configure` with `gpu.getPreferredCanvasFormat()` and no `viewFormats`, which returns
`bgra8unorm` or `rgba8unorm` and never an `-srgb` variant, so nothing else encodes.

The frame was looked at. Rocks carry visible material, the ground reads as moss and leaf litter, and
the three relay lights read as separate coloured pools rather than one wash.

## One decision, made against the goal's recommendation

The goal's recommended default was that **every** final-pixel shader encodes, including the three
that write authored constants. Five do. `onboarding` does not, deliberately.

Its atlas is classified `authored` by `pipeline-invariants.test.mjs` — display-space UI art — and it
is composited onto a display-space buffer, so passing it through unchanged **is** the identity.
Decoding and re-encoding computes the same answer more slowly and loses precision doing it. That
classification was made in a later session than the goal text and is the better answer.

This is not the "two rules" the goal warned against. The rule is that the lit pipeline is linear from
sample to write; the UI layer never enters that pipeline. When 06-02 gives the lit passes a shared
HDR target, this shader stays outside it.

## Three defects found that were not part of this step

**`brometal prod` and `brometal dev` disagree on constant folding.** `pow(safe, 1 / 2.4)` compiles to
`0.4166666666666667` in prod and stays `1.0 / 2.4` in dev, so the committed `.gen.ts` depended on
which mode last ran. My encode introduced the first division in any shader here, which is what
exposed it. Worked around by writing the exponent as a literal, with the reason at the site.
**Worth reporting upstream:** two compiler modes should not emit different text.

**`npm test` was already red at HEAD before this step started, for two unrelated reasons.**

*First*, `game projects contain no delivery host or sibling-demo source imports` matched *comments* —
goal 05's provenance notes naming `packages/demos/scripts/build-detail-normal.mjs` and friends. A
sentence about where bytes came from is not an import. Fixed by stripping comments before matching,
and verified it still fails on a real sibling-demo import.

*Second*, `demos:stage` failed with `ANTIKY_ARTIFACT_FILE_SET_INVALID (combat-arena): Build output
has missing or extra files` — with nothing missing and nothing extra. `filesBelow` walks with
`localeCompare(name, 'en')` while the expected list uses the default code-unit `.sort()`, and the
check compares the two element by element. The orderings disagree on case and punctuation:
`template-wall-Dzn8tX6E.glb` sorts before `template-wall-detail-a-Dmly8Er6.glb` by code unit and
after it by locale. Goal 05's wall panels were the first filenames to expose it. Both lists are now
sorted the same way, with a regression test proven to fail when the sort is removed.

## Outstanding

- **Palette albedo is still authored in display space** where it feeds *lit* shaders. Converting it
  changes lighting rather than the transfer function, so it was left alone here on the goal's
  instruction not to touch lights. *Handled by 06-02 or later* — the constants reaching the two
  unlit shaders were converted, which is what this step needed.
- **`uExposure` is still a per-material uniform.** *Handled by 06-02*, which moves it to the post
  pass. Moving it here would have blurred the two steps' evidence.
- **Local contrast is 6.77 against a floor of 8.5.** Expected: that floor is the end state of all of
  goal 06, not of this step.
