# Execute goal 05-03: real materials from the catalog

Part 3 of 4 of what remains in [goal 05](execute-goal-05.md). Covers **item 6** and the catalog
intake pulled forward from item 12. **This is the largest remaining step by a wide margin** — treat
it as its own goal, not as a packet.

## Prerequisites

- [05-02](execute-goal-05-02.md) for the demos that route material IDs, since a material set is what
  an ID finally selects.
- Goal 05's landed detail-normal work. This layers a per-material normal *over* that tiling one; the
  two are not alternatives.

## `/goal` objective

Bind real Poly Haven material sets — albedo, normal, ARM — to the surfaces named in
`../03-ART-DIRECTION-AND-VFX.md:356-362`, sampled triplanar where the geometry has no UVs worth
keeping and through UVs where it does.

## The catalog is a reference, not a source

Settled by the owner, and worth stating plainly because this goal's wording implies otherwise and an
earlier pass at it got this wrong.

`poly-haven.generated.json` is an **index of what exists** — slugs, licences, upstream ids, tags,
provenance. It is not a delivery mechanism. Every entry carries a `downloads` key and every one is an
empty array, and that is by design: 995 sets of per-file URLs and hashes would be a large, constantly
stale mirror of someone else's file listing.

**Retrieval is the consumer's job.** You look the asset up in the catalog, then go and fetch it.

So goal 05's instruction to install "hash-verified through the installer's existing MD5 path" reads
as if `installCatalogAsset` will do the fetching, and it will not — not because it is broken, but
because it expects descriptors the catalog deliberately does not carry. Anything that needs bytes
brings its own retrieval and its own verification, which is what the tool below does.

### Unblocked — `packages/demos/scripts/install-poly-haven-material.mjs`

Rather than wait on the catalog generator, this fetches the same descriptors from the API the
generator should be reading (`https://api.polyhaven.com/files/<upstream.id>`, which returns `url`,
`size` and `md5` per map per resolution) and applies **both** checks `installCatalogAsset` would
have. `plywood` is installed into `traversal-study` — four maps, 2.9 MB, size and md5 verified — and
**AC-M4 is green**, asserting the receipt names four maps, each with an md5 and a sha256, and each
file on disk being the size the receipt claims.

Two existing tests had to be scoped to model receipts on the way, and the reason is worth carrying:
both walked `manifest.assets` assuming every entry was a catalog *model*. One compared the receipt
list against a fixed array of model IDs; the other read a `derivedPath` and geometry bounds off every
file. A texture receipt has neither. If you add material sets to the other demos, expect the same two
assumptions there.

This is not a workaround for a broken catalog — it is the shape the catalog expects. The lookup and
the retrieval are separate on purpose, and the verification lives with whoever fetches.

### An attempt at binding it, reverted — read this before trying again

The maps were wired into `traversal-model` — triplanar diffuse multiplied into the graded albedo,
roughness folded into the rim — and it made the demo clearly worse. The capture came back with
**brown clouds** and muddy greens.

The mistake is structural, not a tuning problem: `traversal-model` draws **every catalog batch** —
grass blocks, rock, trees, the courier, and the clouds. Binding one material to that shader applies
plywood to all of them. A cloud made of plywood is exactly as wrong as it sounds.

**The fix the demo is already shaped for.** Each catalog batch builds its own program
(`createCatalogBatch` is called thirteen times, one per asset), so material maps belong as a
*per-batch argument* alongside `gradeColor`, `gradeMix` and `wrap` — which are already per-batch for
this same reason. Grass takes `leafy-grass`, platform sides take `plywood`, rock takes
`rock-boulder-dry`, and clouds take **none**, falling back to the palette alone.

That is more installs and a fourth per-batch parameter, but it is the shape the goal's own material
table at `../03-ART-DIRECTION-AND-VFX.md:364-412` describes — a material per *surface*, not per demo.

Also worth carrying: multiply, not mix, when combining a palette tint with a material — mixing washes
the kit's colour toward grey exactly where its identity lives. And a dark material needs its level
compensated; plywood's diffuse is dark enough that multiplying it in cost about a stop of brightness
before anything else was considered.

### AC-M1, measured on `traversal-study` — and what it says about attribution

Three ROIs on the built surfaces, luminance standard deviation, at 1280x720:

| probe | rect | before the material | after |
| --- | --- | --- | --- |
| platform top, left | 410,405 120x40 | 0.0447 | 0.0385 |
| platform side, left | 420,470 130x45 | 0.0633 | 0.0666 |
| platform top, right | 1000,400 120x40 | **0.0154** | **0.0270** |

**All three clear AC-M1's 0.020 floor — and two of them already did before item 6 touched
anything.** The variance was put there by the detail normal (item 1) and the ramp (item 5). What the
plywood added was the third probe, which crossed the threshold, and a slight *reduction* on the
first — a material's own albedo can average down a surface that was already varying.

Two things follow, and both matter more than the pass:

- **AC-M1 does not attribute.** It measures whether a surface varies, not what made it vary, so
  reaching 0.020 does not mean the material path is working. Measure with the material strength at
  zero and at its intended value, as here, or the criterion will happily report success for a demo
  whose material never bound.
- **Record the ROIs in the test file**, which the criterion asks for and which does not exist yet.
  That needs `shoot-demos.mjs` to pass probe rectangles into `readFrameStats` — it already accepts
  them and `probeStats` already returns `luminanceStandardDeviation` — and to write the results into
  `visual-metrics.json` so a budget test can assert on them without a live capture. That plumbing is
  the last piece of making AC-M1 a gate rather than a measurement someone takes by hand.

### Why this goal's wording misleads

Goal 05 says to install the material slugs "hash-verified through the installer's existing MD5 path
(`packages/asset-catalog/src/node/install.ts:45-63`)", which reads as though `installCatalogAsset`
will fetch them. It will not: it consumes per-file descriptors from the entry's `downloads` array,
and the catalog does not carry those. Not a bug — see above. The sentence just names the wrong half
of the split.

One thing established on the way that is worth keeping: `bake-sh9-irradiance.mjs` fetches HDRIs from
`dl.polyhaven.org` by upstream id and verifies nothing, which is acceptable only because its output
is 27 committed floats and a wrong download would produce visibly wrong light. Anything whose bytes
ship needs the size and hash checks the installer script does.

## Required outcome

1. **Catalog intake.** Install the material slugs at `../03-ART-DIRECTION-AND-VFX.md:364-412`, all
   four maps, hash-verified through the installer's existing MD5 path
   (`packages/asset-catalog/src/node/install.ts:45-63`), with receipts in each demo's
   `assets/antiky-assets.json`.
2. **The per-demo route, as written.** `point-light-expo` keeps UVs on the hero scans and gains a
   triplanar normal basis; `combat-arena` splits — ships keep their 1,521 authored UVs, the Kenney
   arena goes fully triplanar; `traversal-study` goes fully triplanar onto fabric and cardboard.
3. **`antiky-town` gets item 6's normal and roughness halves only**, sitting alongside its atlas
   albedo. Its albedo stays on authored UVs. See `packages/demos/antiky/antiky-town/MATERIALS.md`.
4. **Procedural world-space trim for `combat-arena`** — bands from `vWorld.y` into roughness and AO,
   rather than a trim sheet needing a second UV channel the loader does not read.

## Required tests and evidence

- **AC-M1**: three authored ROI rectangles per demo on large flat surfaces, per-pixel luminance
  standard deviation at least 0.020, rectangles stored in the test file. **Note the baseline in goal
  05 is wrong** — it claims below 0.004; `point-light-expo` measured 0.0072 to 0.0272. Re-measure
  each demo rather than inheriting a number.
- **AC-M4**: each demo's `assets/antiky-assets.json` lists at least one Poly Haven texture receipt
  with all four maps present and hash-verified.
- **Cost, measured not estimated.** Albedo plus normal plus ARM triplanar is nine `texture()` calls
  per fragment. Read it from `antiky tool get_render_stats`.
- A capture per demo, looked at. `npm test` green.

## The footgun that will cost you a day if you forget it

**`texture()` inside a DSL helper compiles to `textureSampleLevel(..., 0.0)`** and silently loses the
mip chain, so a triplanar helper crawls at distance. Inline every material sample in the `fragment()`
body. Every triplanar block goal 05 already landed does this, with the reason in a comment.

Also: `Vec3` exposes only `.xy`, `.xz` and `.yz`, so the third projection needs an explicit `vec2`
constructor; and `abs`, `pow` and `step` are scalar-only.

## Explicit non-goals

- Do not buy or evaluate new asset kits. This step is what measures whether they are needed.
- Do not triplanar-project any atlas. See `MATERIALS.md` for why and where.
- Commit assets separately from source so the source diff stays reviewable.
