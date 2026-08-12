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

## Read this before planning: the intake path does not work as described

Goal 05 says to "install the material slugs ... hash-verified through the installer's existing MD5
path (`packages/asset-catalog/src/node/install.ts:45-63`)". That installer reads a `downloads` array
off each catalog entry — per-file URL, size and hash — and refuses anything that does not match.

**No catalog entry has one.** Measured across `packages/asset-catalog/data/poly-haven.generated.json`:

| kind | entries | with a non-empty `downloads` |
| --- | --- | --- |
| texture | 332 | **0** |
| hdri | 332 | **0** |
| model | 331 | **0** |

Every entry carries the key and every one is an empty array. So `installCatalogAsset` cannot fetch a
single asset in the catalog as it stands: there is nothing for it to fetch, and the size and hash
checks it exists to perform have no inputs.

`point-light-expo`'s `forest-floor` receipt predates this and its slug is not in the generated
catalog at all, so it is not a counter-example — it is evidence the generator's output changed shape
at some point and nothing noticed.

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

**The catalog generator is still wrong** and should still be fixed — 995 entries that cannot be
installed is a defect in its own right, and it belongs in its own goal rather than here.

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

### The original finding

**This was the first task of this step, and it is not a material task.** Either the catalog generator
needs to populate `downloads` from Poly Haven's file API, or the intake needs its own fetch path with
its own verification. Until one of those exists, AC-M4 — "at least one Poly Haven texture receipt
with all four maps present and hash-verified" — cannot be satisfied for any demo by any amount of
shader work.

Worth noting what *did* work while this was being established: `bake-sh9-irradiance.mjs` fetches
HDRIs directly from `dl.polyhaven.org` using the upstream id, verifies nothing, and is fine for a
bake whose output is 27 committed floats. That is not a template for shipping texture assets, but it
does prove the URLs are predictable and reachable.

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
