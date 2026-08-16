# Summary — goal 15: give BroMetal the texture capabilities WebGPU already has

**Status: complete as scoped. Five of six outcomes met; outcome 5 deferred by owner instruction.**

**Date:** 2026-08-15
**Commits:** `7a99bf2`, `48307e9`, `2659423`, `c5775b0`, `c416bee`, `a219b70`
**Goal file:** [`execute-goal-15.md`](execute-goal-15.md)

## Action needed from the owner

| # | What | Why it needs you |
|---|---|---|
| 1 | **The two upstream pull requests were not opened.** You said local patches only on this pass, so both modules read *"Upstream: not yet submitted."* instead of naming a PR. **This is the one thing that leaves ADR 0021 unsatisfied** — it requires a focused upstream PR per patch, and a patch with no PR becomes permanent by default. Two patches now sit in that state. The skill's `pr` command opens them when you want. | ADR 0021 compliance |
| 2 | **`texture-array-sampler.mjs` is 714 lines**, inside the cohesion-review band in `GOOD_ENGINEERING_H.md`. The skill requires one module per upstream contribution, so splitting it would split the PR. Most of the bulk is verbatim before/after text the runner needs, and it is decomposed internally into four apply phases. Left whole deliberately. | a judgement call |
| 3 | **The layer URL list for the material atlas is hand-written.** Vite can only resolve literal `new URL` paths, and it inlines these as base64 data URLs (pre-existing under library mode), so a data URL carries no filename and the runtime guard can only check the count. Order and naming are asserted in a test that runs against source. | fragility worth knowing |
| 4 | **`atlasGridUniform` is now used only by tests**, though the prop and vegetation atlases still validate through it. Left alone rather than removing a validator without a mandate. | dead-ish code |

## What was delivered

1. **`scripts/patch-brometal/sampler-lod-clamp.mjs`** — `lodMinClamp` and `lodMaxClamp` on
   `TextureOptions`, forwarded to the 2D sampler **only when set**, so an unset clamp keeps WebGPU's
   own defaults rather than a policy invented here. An inverted range throws at `createTexture`,
   naming the mistake, instead of surfacing as a detached WebGPU validation failure.
2. **`scripts/patch-brometal/texture-array-sampler.mjs`** — a `sampler2DArray` DSL type end to end:
   parsed, carried through the IR, emitted as `texture_2d_array<f32>` with a three-argument
   `textureSample`, bound with `viewDimension: '2d-array'`, uploaded with layers, and **mipped per
   layer**. Its header traces all eleven files `sampler3D` touches and says which wanted the array
   type. **`compiler/emit-glsl` is deliberately excluded** — nothing in `dist/` imports it and
   `compileShaderSource` emits WGSL only, so adding an array type there would ship untested GLSL
   claiming to work.
3. **`antiky-town` renders its material atlas as twelve array layers**, built by goal 14's
   `--layers` mode. `town-voxel` **lost its grid derivation entirely** — columns, rows, gutter insets
   and the per-fragment rectangle are all deleted, replaced by
   `texture(uMaterialAtlas, surfaceUv, atlasTile)`. The prop and vegetation atlases keep their
   gutter, so both routes are live in one demo.
4. **The tile-boundary measurement is zero.** See below.
5. **Two upstream pull requests — NOT DONE, deferred by owner instruction.** See owner item 1.
6. **`scripts/tests/patch-brometal.test.mjs` covers both**, 13/13 green, including the runner's own
   guarantees.

## The measurement

Goal 14's `measureBorderError` was reused **unmodified** — same helper, same band running
`firstX-1 … lastX+1`, so it reaches one texel *past* the rectangle.

| mip | authored source, no gutter | padded atlas (goal 14) | **layers (goal 15)** |
|---|---|---|---|
| 2 | 26.277 mean / 218 worst | 0.000 | **0.000 / 0** |
| 4 | 29.757 / 189 | 0.000 | **0.000 / 0** |
| 6 | 29.704 / 163 | 0.000 | **0.000 / 0** |

Zero on all twelve layers at mips 2, 4 and 6 — 36 measurements over 15984 / 3888 / 864 samples, so
not vacuous for want of data.

**Be precise about what that zero means.** For a layer image the rectangle *is* the whole image, so
the band's outer ring falls off the image and there is no neighbour to read. The zero is therefore an
assertion, not a budget: any non-zero reading would mean a layer was cut wrong. The test says exactly
that. What makes it meaningful rather than circular is the contrast — the same helper on the same
source pixels measures **> 30** on the packed fixture in the same test.

**The substantive guarantee is elsewhere, and it is the real result:** the per-layer mip test drives
the shipped `generateWebgpuMipmaps` against a recording device and asserts **no view anywhere has
`arrayLayerCount > 1`**. A multi-layer view is the only way a coarse mip could cross layers, and
there is none. That is what deletes the defect rather than mitigating it.

## The runtime tests now run on a real GPU

The patch is proven on device, not only against a stub.
`packages/demos/tests/texture-array-gpu.test.mjs` builds an array texture through BroMetal's own
patched `buildWebgpuTextureArray`, samples it, and reads pixels back:

| Assertion | Result |
| --- | --- |
| the array binds with no WebGPU validation error | pass |
| layer 0 returns layer 0's colour, layer 1 returns layer 1's | pass |
| at mip 6 each layer keeps its own colour, not an average of both | pass |

Proven able to fail: expecting layer 0 to hold the other layer's colour turns it red with the actual
pixel printed. The stub tests remain as the cheap fast check; this is the one that would catch a
wrong layer index landing on a similar-coloured material.

One deliberate limit: the WGSL doing the sampling is written in the test rather than produced by
BroMetal's compiler, which has no public entry point from Node. So this proves the **runtime** half —
upload, view dimension, per-layer mips. The compiler half is covered by the WGSL-emission test and
the demo capture.

**Corrected 2026-08-15.** This was first written as "there is no headless WebGPU here", which was
wrong, and the harness described below now exists. A real device is reachable from a plain Node test — probed and confirmed as
`device ok: apple`. What is missing is a *test harness* exposing it: the only code that launches a
browser is the capture runtime, reachable only through `capture_frame`, which returns a whole-frame
PNG and cannot answer "does sampling layer 1 return layer 1's colour". Two details make the
capability look absent when it is not — the profile directory must be a real path, and the page must
be on a secure origin (`http://127.0.0.1`, not `about:blank`).

That gap is now written up in
[`docs/objectives/inspection-tooling/rendering-brometal-and-visual-evidence.md`](../../../inspection-tooling/rendering-brometal-and-visual-evidence.md)
with the working launch recipe and a ~150-line proposal. **It bears directly on this goal:** a wrong
layer index that happened to land on a similar-coloured material would pass every test here.

## The capture

| | baseline | now | move |
|---|---|---|---|
| luminance mean | 0.115990 | 0.116117 | +0.000127 |
| p95 | 0.362011 | 0.362014 | +0.000003 |
| localContrast median | 7.7499 | 7.7491 | −0.0008 |
| saturation | 0.319706 | 0.319639 | −0.000067 |

Inside capture noise, which is what a correct addressing change should look like. The frame was
looked at: limestone, terracotta and slate roofs, timber framing, cobblestone, canal water and both
striped market awnings read correctly, so the layer indices map to the materials they name — the
failure mode a silent off-by-one would produce.

## Test state

`npm test` exits 0. `npm run demos:verify` is **56/60**, failing on exactly the four pre-existing
cases — 33, 36, 37 (`traversal-study`) and 54 (`no material shader tone-maps`). No new failures.

## Traps worth knowing

- **A framework change invalidates all four demo sidecars**, not just the one you touched, because
  `sourceDigest` covers shared framework source. `demos:verify` showed 28 failures until the other
  three demos were re-shot; their diffs are pure capture noise.
- **Write the failing test first, and watch the message.** The six new patch tests failed with
  `'sampler2DArray' is not a valid GPU type`, `buildWebgpuTextureArray is not a function` and
  `generateWebgpuMipmaps is not a function` — each naming the missing piece, which is how you know
  the test is wired to the thing you are about to build rather than passing by accident.
- **`sampler3D` is not a substitute and was not reused.** A 3D texture's mips blend along Z, so
  slices would average into each other: the same defect by another route.

## What this closes

Goal 14 built padding because BroMetal could not do better. Padding is now the fallback rather than
the plan: the prop and vegetation atlases still use it, the material atlas does not need it, and the
tile-boundary measurement has stopped being a budget to stay under and become an assertion that the
number is zero.

That is the difference between managing a defect and removing it — for one atlas, with the capability
now in place for the rest.
