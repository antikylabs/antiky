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

1. **`traversal-study`.** Its ramp now supplies light colour, so the question is narrower than it
   was: do the `kloofendal` coefficients tint the ramp's shadow end, or replace the flat term the
   ramp multiplies? Coefficients are already baked at `src/sh9-irradiance.gen.ts`. Decide by
   measuring both, and record the numbers.
2. **`antiky-town`.** It already has a two-term `uSkyColor`/`uGroundColor` split, so this is an
   upgrade to something real rather than a replacement for a constant. **It is the fairest test in
   the repository of whether nine coefficients earn their bake step over two hand-picked colours.**
   If they do not, say so with the measurement and leave the split alone.
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
