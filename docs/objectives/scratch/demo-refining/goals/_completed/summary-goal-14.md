# Summary — goal 14: give Antiky a way to build and check texture atlases

**Status: complete. All nine outcomes met.**

**Date:** 2026-08-15
**Commits:** `5ed168d`, `c3ed478`, `21128c7`, `9d47a46`
**Goal file:** [`execute-goal-14.md`](execute-goal-14.md)

## Action needed from the owner

| # | What | Why it needs you |
|---|---|---|
| 1 | **The textures directory grew from ~7.1 MB to ~17 MB.** Padded atlases are larger by construction, and the authored sources moved to `assets/textures/source/` so the packer has a hash-verified input. PNGs are LFS-tracked, so the cost lands on LFS rather than git objects. | repo weight |
| 2 | **Two atlases were upsampled to preserve their authored aspect exactly** — material 313.5x418 → 384x512, prop 418x470 → 512x576. Vegetation was already 384x512 and is unchanged. The alternative was ~5% aspect drift for ~25% fewer pixels. | a judgement call, reversible |
| 3 | **All four demo sidecars were re-shot.** `sourceDigest` hashes `packages/demos/scripts`, and the goal specifies putting the tool there, so adding it invalidated every sidecar and turned 22 budget tests red on staleness alone. No budget was loosened. | expected, not a regression |

## What was delivered

1. **`packages/demos/scripts/build-texture-atlas.mjs`** — a slicer with two emit modes over one
   slicing core.
2. **`--layers`** (one image per tile, no gutter, no cross-tile pixels — the shape goal 15 consumes)
   and **`--padded`** (single atlas, power-of-two cells, extruded gutter).
3. **The gutter derived, not guessed — 64px.** `town-voxel` does `surfaceUv.scale(0.82)`, so one tile
   spans 1/0.82 world units; the material tile is 1254/4 = 313.5px, giving ~257 texels per world
   unit. At `FAR_DEPTH = 180` with fovY 0.57 and a 720px viewport, world-per-pixel is
   2·180·tan(0.57/2)/720 ≈ 0.1465, so texels/pixel ≈ 37.7 — **mip 5.24**. Rounded up, a tile must
   stay clean to **mip 6**, and a mip-N texel averages 2^N source texels, so the gutter is **2^6 =
   64px**. The derivation is in the tool's header.
4. **A JSON companion that describes the layout** — per-tile inner rectangles in normalised
   coordinates, gutter width, emit mode, and a hash of the input image. Existing `tiles`, `usage` and
   `provenance` blocks preserved.
5. **All three world atlases rebuilt padded**, receipts regenerated: material 2048x1920 (12 rects),
   prop 2560x1408 (8), vegetation 2048x1280 (8), each `gutter: 64`.
6. **All four consumers address the inner rectangle.** `town-voxel` reads `tileRects` through
   `src/town/art/atlas-layout.ts`; `town-prop` and `town-awning` (via `town-dynamic-props.ts`) and
   `town-foliage` compute their rect on the CPU into `iUvRect`, so those shaders needed no change.
   No `(column + uv) / 4` grid math remains anywhere. `atlasGridUniform` re-derives the grid and
   throws at construction if it disagrees with any published rectangle.
7. **The structural invariant is green on all three atlases.**
8. **A gutter rule in `asset-fidelity-policy.mjs`**, with the honest note that a `"gutter": 64` typed
   into JSON is a claim, and `pipeline-invariants.test.mjs` is what opens the image and proves it.
9. **The sprite atlas measured and left alone.** `antiky-wayfarer-cardinal-atlas.png` measures
   **0.00/255 at mip 3**, rising to **7.56 mean / 20 worst at mip 6**. None of it is realised: it
   loads `filter: 'nearest'` with no mip chain and no anisotropy. No mips, no gutter, no change. The
   numbers are recorded at the binding site.

## The measurement

Mip a tile inside the atlas, mip the same tile in isolation, compare their borders. The isolated tile
is ground truth because it has no neighbour to bleed from.

| atlas | before (mean / worst) | after |
|---|---|---|
| `town-material-atlas-v1` | 29.70 / 163 | **0.00 / 0** |
| `town-prop-atlas-v2` | 8.00 / 181 | 0.00 / 0 |
| `town-vegetation-atlas-v2` | 3.12 / 85 | 0.00 / 0 |
| **all three, sample-weighted** | **15.59 / 181** | **0.00 / 0** |

15.59 sits on the goal's stated 15.1 baseline, so the method matches the one the goal describes.

**The number that separates the two halves of the fix:** a rebuild with power-of-two cells but a
**zero** gutter measures **21.84 / 163**. Alignment alone buys 29.70 → 21.84; the extruded gutter
takes it to zero. Neither half is sufficient.

**Why zero is a real result rather than a definitional one.** The compared band deliberately reaches
one texel *past* the rectangle. A band that only looked inside scored 0.00 on the vegetation atlas
**as it shipped** — its cells were already 64-aligned with tiles hard against each other — so that
version of the measurement would have called a bleeding atlas clean. A test asserts this: *"the
measurement is not satisfied by alignment alone."* This is the same failure mode that made the
original version of this goal wrong, caught this time.

## The invariant proven able to fail

Red in both directions, then restored — and the rebuilt PNG hashes back to the committed
`fedb546d5cab`, which doubles as a determinism check:

- **Zero gutter** → *"a 0px gutter is thinner than the 64px a mip-6 average reaches"*.
- **Lying gutter** (declares 64, extrusion replaced with black) → *"declares a gutter of 64 but 2687
  of 2688 inner-rectangle edges differ from the pixel outside them — the edge was never extruded."*

**The invariant had to be moved to a different probe.** It compared pixels across the **cell**
boundary — where two tiles' gutters meet, which is *supposed* to change abruptly. It reported 82%
abrupt on a correctly packed atlas and passed vacuously on the two alpha atlases whose margins are
transparent. It now probes the **inner rectangle's** edge against the gutter pixel beside it, which
is what extrusion actually promises.

## The capture, and looking at it

| | baseline | after | move |
|---|---|---|---|
| luminance mean | 0.116026 | 0.115990 | −0.03% |
| luminance p95 | 0.361779 | 0.362011 | +0.06% |
| localContrast median | 7.7478 | 7.7499 | +0.03% |
| saturation mean | 0.31997 | 0.319706 | −0.08% |
| hard edges | 0.010912 | 0.010773 | −1.3% |
| localContrast p10 | 1.696 | 1.6262 | −4.1% |

Barely moved, which is what the goal requires — a large move would have meant the addressing change
was wrong rather than the padding working. The p10 local contrast is the one non-trivial move, and it
and the drop in hard edges are the direction a removed fringe pushes.

**The frames were looked at, and the honest finding is that no fringe is visible in either.** The
capture pose's furthest surfaces are roughly 40-60 world units out, not the 180-unit far plane the
gutter is sized for. Whole-frame mean absolute difference is 1.43/255 and the top-changed blocks are
walking townspeople and wind-swayed foliage, not surfaces.

So the defect was rendered directly instead: one tile's mip-6 footprint, the way a GPU builds it.
**Before**, the meadow-grass tile is ringed by cream, brown and near-black from the tiles beside it in
the file. **After**, the same ring is more of the tile's own olive-green. That is the fringe, and its
removal. This was checked by eye, not inferred — the previous atlas result was wrong precisely
because nobody looked.

## Test state

`npm test` exits 0. `npm run demos:verify` is **56/60**, with four failures, all pre-existing and
verified as such:

- **33, 36, 37** — `traversal-study` model formation, value structure, hue dominance. Its source was
  untouched by this work and its measured numbers moved by 0.000024 across the re-shoot.
- **54** — `no material shader tone-maps`, failing on three BroMetal demos not touched here.

**Test 48 — the atlas gutter invariant — was one of the failures the goal named as pre-existing, and
is now green.** No new failures.

## Why this outlives the three atlases

The lasting deliverable is the slicer and the measurement, not three rebuilt images. Every atlas has
this property; it stays hidden while a texture is drawn near its authored size with `nearest`
filtering and appears the moment anything is minified, mipped, filtered or rotated. The actor atlas
is safe **today** because of how it is sampled, not because it was built correctly — which is why its
number is recorded rather than its file changed.
