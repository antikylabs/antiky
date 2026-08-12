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
