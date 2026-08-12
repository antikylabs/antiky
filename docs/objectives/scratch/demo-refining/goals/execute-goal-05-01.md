# Execute goal 05-01: finish the ambient work

Part 1 of 4 of what remains in [goal 05](execute-goal-05.md). Covers the rest of **item 4**.

## Prerequisites

- Goal 05's landed work. `packages/demos/scripts/bake-sh9-irradiance.mjs` exists and is validated:
  zero negative irradiance across 15,000 sampled directions, up-to-down luminance ratio 10.1:1.
- Read goal 05's "SH-9 is not automatically better than a hand-tuned ambient" section first. It is
  the reason this is its own step rather than a formality.

## `/goal` objective

Two demos still light their ambient without reference to which way a surface faces. Finish them, and
settle the one that measured worse.

## Required outcome

1. ~~**`traversal-study`.**~~ **Done.** The ramp decides level, the sky decides colour: the
   coefficients are scaled until their spherical average matches the ramp's darkest step, and the
   shader adds them in proportion to how *un*lit a surface is. A face in full sun sees the ramp
   alone; a face turned away picks up real sky direction instead of one hand-picked blue. Changed
   11.3% of the frame — the shadowed faces, which is exactly the set it should touch. `kloofendal`
   is bright midday, so its raw band-0 is about eleven times the ramp's shadow end; dropping it in
   unscaled would have washed the shadows out completely. See `src/ambient.ts`.
2. **`antiky-town` — baked and validated, not yet wired.** `venice-sunset` is committed at
   `src/sh9-irradiance.gen.ts`: zero negative irradiance across 3,000 directions, up-to-down
   luminance ratio 5.05:1.

   **The interesting part is what it reproduces.** The town's hand-picked constants are
   `SKY_COLOR [0.24, 0.38, 0.68]` (cool blue) and `GROUND_COLOR [0.56, 0.27, 0.15]` (warm brown).
   The measured sky lands at `[0.58, 0.69, 1.06]` looking up and `[0.16, 0.13, 0.13]` looking down —
   independently the same decision, cool above and warm below, arrived at from a photograph rather
   than by eye. Whoever picked those two colours picked well.

   That reframes the remaining question. This is not "will SH-9 fix a wrong ambient" but "do nine
   coefficients earn their bake step over two colours that are already right". The honest test is
   whether the *second band* — the part two colours cannot express, where light varies around the
   horizon rather than just up-versus-down — is visible on the plaza. Wire it, capture both, and if
   the answer is no, **say so and leave the split alone.** That is a legitimate outcome and it is
   worth more to this repository than a change nobody can see.

   Normalisation: the existing split averages about 0.105 in luminance over the sphere
   (`uSkyIntensity` 0.46, `uGroundIntensity` 0.12) against the bake's band-0 of 0.495, so the scale
   factor is about 0.212. Five programs bind these uniforms — `worldProgram`, `awningProgram`,
   `propProgram`, `waterFeatureProgram` and `actorEdgeProgram`, which shares the voxel shader.
3. **`combat-arena` — an owner decision, not an implementation.** SH-9 measured worse than its
   hand-tuned ambient with both HDRIs this goal names (5.99 hand-tuned, 5.87 `blue-photo-studio`,
   5.68 `neon-photostudio`), because both are studio captures and studio light is deliberately even.
   Either the owner picks an environment with real directional structure, or this stays as it is and
   the goal records that combat-arena keeps its hand-tuned ambient. Do not wire it a third time
   hoping for a different number.

## Required tests and evidence

- **AC-L4** on a convex prop: hue difference between the most sky-facing and most ground-facing lit
  face at least 15 degrees, luminance ratio at least 1.8:1.
- **The normalisation reference is the old ambient's hemisphere average, not its constant term.**
  Getting this wrong removed a quarter of `combat-arena`'s fill and made it measure darker and
  flatter. The mistake is available in both demos here.
- A capture per demo, looked at, with local contrast before and after.
- `npm test` green; `npm run demos:verify` at its known targets.

## Explicit non-goals

- Do not re-tune exposure to compensate. The bake decides direction; the demo's existing exposure
  decides level, and mixing the two leaves no way to tell which moved the picture.
- Do not add a second HDRI per demo, or blend two.
