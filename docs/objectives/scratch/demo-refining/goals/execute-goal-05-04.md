# Execute goal 05-04: the VFX pass

Part 4 of 4 of what remains in [goal 05](execute-goal-05.md). Covers **items 2, 8 and the rest of
9**.

## `/goal` objective

Every effect in these demos is an untextured primitive on a shared timing curve. Give them texture
and give them independent timing.

## What is already done

**AC-V3 is green.** `arena-glow` and `traversal-glow` pulsed their alpha on one shared frequency with
only a per-instance phase, so instances drifted into unison and breathed as one mechanism. Both now
vary the rate per instance, with a test that catches a regression.

**Contact shadows are already unlit and soft-edged**, from goal 03 — `smoothstep(1, 0.12, length)`
is a smooth analytic falloff. What they lack is *variation*, which is AC-V4's subject, not AC-V1's.

## Required outcome

1. **Textured soft billboards for every VFX program** (item 8). Today zero of the three glow shaders
   sample a texture.
2. **Contact shadows and ring decals textured** (item 2). `antiky-town` is exempt — it casts real
   shadows through five depth-from-light passes and has no decal blobs to replace.
3. **Timing rebuilt on curves, snap and secondary elements** (the rest of item 9).
4. **An `antiky-town` VFX inventory first.** No audit document examined it, so there is no verified
   list to work from. Produce one before deciding what applies.

## Required tests and evidence

- **AC-V4**: every VFX program declares and samples at least one `sampler2D`.
- **AC-V1**: in a VFX-only capture, the per-pixel luminance gradient along every effect's outer
  boundary is at most 0.10 per pixel — every effect falls off over at least 10 pixels.
- **AC-V2**: drive one impact event through the projection code and record emitted instance values
  per frame. Peak scale within 3 frames; alpha at frame 10 at most 25% of peak; Pearson correlation
  between the scale and alpha curves under 0.9; at least two elements with lifetimes differing by at
  least 1.5x. `combat-arena/tests/presentation.test.ts:62` is the precedent for this style.
- `npm test` green.

## Worth measuring before assuming

A texture is not automatically better than a smooth analytic falloff — an analytic radial gradient is
smoother than any 512² texture and costs no memory. AC-V4 exists because VFX that are *only*
primitives read as primitives, which is a statement about variation rather than about edges. Measure
the contact shadow both ways before replacing something that already works.
