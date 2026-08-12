# Execute goal 05: give the existing assets real materials

> **Items 1, 3, 5, 10 and AC-V3 have landed.** What remains runs as four separate steps, each
> independently shippable. Run them with `/goal` in order; the detail is in each file.
>
> | Step | What is left | Items |
> | --- | --- | --- |
> | [05-01](execute-goal-05-01.md) | Finish the ambient work — **`traversal-study` and `antiky-town` done**; only `combat-arena` left, and it needs an owner decision, not code | rest of 4 |
> | ~~[05-02](execute-goal-05-02.md)~~ | **Done.** AC-M2 green, both kits read their material table | 7 |
> | [05-03](execute-goal-05-03.md) | Real materials from the catalog — **largest by far, and blocked**: no catalog entry carries a download descriptor | 6, intake |
> | [05-04](execute-goal-05-04.md) | The VFX pass — **item 8 done, AC-V4 satisfied**; items 2 and the rest of 9 remain | 2, rest of 9 |
>
> The sections below are the original goal, kept intact because the four steps reference it. The
> **Progress so far** section at the end is the current state, and it corrects three of this
> document's own premises — read it before trusting a baseline number here.


## Prerequisites

Complete [execute goal 01](_completed/execute-goal-01.md) first. Every acceptance criterion below except the
static-source ones is measured from a captured frame with `npm run demos:shoot`, the frame
statistics library and the named probe rectangles goal 01 delivers.

Complete [execute goal 04](_completed/execute-goal-04.md) as well. It restores the UVs and normal maps this
goal consumes, and item 7 below extends the material-ID work its scripts do. Work on surfaces that
never had usable UVs — most of `traversal-study`, all of `combat-arena`'s Kenney arena — may begin
while goal 04 is still in flight, provided the two never hold the same file.

**This goal is parallel-safe against goals 02, 06 and 07** — the BroMetal patches and the per-demo
HDR render pipeline. Items 1–9 of `../03-ART-DIRECTION-AND-VFX.md:939-962` need neither the HDR
buffer nor a patched BroMetal, which is roughly 12 engineer-days of independently verifiable work
available today. Do not serialise it behind the render work.

## `/goal` objective

Deliver items 1 through 9 of `../03-ART-DIRECTION-AND-VFX.md` — real material assignment on the
assets already owned, via triplanar world-space projection, plus the lighting and VFX items that
need nothing BroMetal lacks.

This is the single largest untapped visual gain in the project. Triplanar projection derives texture
coordinates from world position and surface normal and never reads `TEXCOORD_0`, so a 168-vertex
Kenney block with five unique UVs can carry a full 2K PBR material set with zero mesh work, zero
re-UV work and zero new assets. The catalog holds roughly 1,450 CC0 assets including 332 unused
HDRIs and the Poly Haven PBR material sets named in `../03-ART-DIRECTION-AND-VFX.md:364-412`.

### Correct the record while doing this

`../subagent-reports/03-asset-pipeline-audit.md:334` put ~40% of the visual gap down to a genuine
asset ceiling, reasoning that a Kenney block with five unique UVs cannot carry detail. That
reasoning holds only if surface detail must arrive through the mesh's own UVs. It does not, and the
figure steered the plan toward buying assets that are not needed. The revised split is **~35%
rendering, ~25% self-inflicted pipeline damage, ~30% simply-absent material assignment (fixable on
assets already owned), and ~10% genuine ceiling** — and that last 10% is silhouette and bevel
quality, which no texture fixes. Kenney blocks have no chamfers and will never catch an edge
highlight the way modelled geometry does. That is real, and it is worth about a tenth of the gap.

**No new asset purchases or kit evaluations — KayKit, Poly Haven kits, Synty — until this goal
completes.** There is no evidence yet that they are needed, and this goal is the measurement that
would produce that evidence.

### `antiky-town` is a fourth demo, and triplanar applies unevenly there

`antiky-town` is in scope on the owner's instruction. It is the repository's only **2.3D** artifact
and the largest Antiky demo — ~12,484 lines under `src/`, 13 shader pairs — and its art is
atlas-and-sprite based rather than GLB-and-material based. Do not assume uniformity with the other
three; §"Where triplanar fits in `antiky-town`" below draws the line surface by surface.

It also already has what goals 06 and 07 are building elsewhere: offscreen render targets, five real
depth-from-light shadow passes, a sky/ground ambient split (`uSkyColor`/`uGroundColor`,
`src/town/index.ts:457-460`) and a single post-pass tone-map. That changes what this goal owes it —
several items here are upgrades to terms that already exist rather than additions.

**Effort.** Roughly 12 engineer-days for the original three demos, plus roughly 3 further days for
`antiky-town`: items 1, 3, 4 and 6 carry real work across 13 shader pairs, items 2, 5, 7 and much of
8–9 do not apply. Report it separately.

## Required outcome

When the work is complete, the repository must have:

1. a tiling detail normal map, triplanar-projected at a high tile rate, blended over whatever base
   normal exists, applied to every material shader that draws GLB geometry (item 1) — and in
   `antiky-town`, to the voxel, prop, awning and water-feature shaders, which draw world-space
   geometry and are the best triplanar case in the repository;
2. contact shadows and ring decals that are textured, soft-edged billboards rather than hard
   primitives (item 2, building on the unlit fix in [execute goal 03](_completed/execute-goal-03.md)).
   `antiky-town` is exempt: it casts real shadows through five depth-from-light passes and has no
   decal blobs to replace;
3. an always-on rim/Fresnel term, cloth sheen on `traversal-study` fabric surfaces, and wrapped
   diffuse on clouds and foliage — `fresnel()` ships at
   `node_modules/brometal/dist/shader-functions/index.d.ts:42` and **zero demos call it** today
   (item 3);
4. SH-9 diffuse irradiance baked offline from one catalog HDRI per demo into nine `vec3` uniforms,
   replacing the flat ambient constants (item 4). In `antiky-town` this replaces an existing
   two-term sky/ground split (`src/town/index.ts:457-460`), not a flat constant — a smaller delta
   than elsewhere, and the one demo where the before/after comparison is a fair test of whether
   SH-9 is worth its bake step at all;
5. a hue-shifting ramp LUT driving `traversal-study`'s lighting through `sampler3D` (item 5) — its
   current three-step toon ramp spans 0.54→0.98, a 1.81:1 contrast ratio with no view-dependent
   term at all, and is by itself a complete explanation for why the platformer looks flat;
6. a triplanar PBR material path — albedo, normal, ARM — bound to real Poly Haven material sets on
   the surfaces named in `../03-ART-DIRECTION-AND-VFX.md:356-362` (item 6);
7. material-ID routing into the UV-V channel with a LUT lookup for the palette kits (item 7) —
   `antiky-town` is exempt, its atlas already carries per-face material identity by design;
8. textured soft billboards for every VFX program (item 8);
9. VFX timing rebuilt on curves, snap, secondary elements and per-instance de-synchronisation
   (item 9); and
10. for `antiky-town`, a written surface-by-surface record of where triplanar was applied, where it
    was rejected, and why — the section below is the starting position, and any departure from it
    must be argued from the source.

## In scope

- **The per-demo material route from `../03-ART-DIRECTION-AND-VFX.md:356-362`, as written.**
  `point-light-expo` keeps UVs on the hero Poly Haven scans and gains a triplanar normal basis;
  `combat-arena` splits — the Quaternius ships keep their 1,521 authored UVs and gain a detail
  normal and a Fresnel-weighted specular lobe, while the Kenney arena goes fully triplanar;
  `traversal-study` goes fully triplanar onto fabric and cardboard materials, which is where the
  technique pays most and where there is no authored UV information to destroy.
- **Where triplanar fits in `antiky-town`, and where it does not.** This demo needs the line drawn
  per surface, because the answer genuinely differs:

  | Surface | Shader | Triplanar? | Why |
  |---|---|---|---|
  | Voxel town surfaces | `town-voxel` | **Detail normal yes, albedo no** | Axis-aligned box faces are the ideal triplanar case for a *tiling* detail normal. Albedo must keep its atlas UVs. |
  | Props, awnings | `town-prop`, `town-awning` | Detail normal yes, albedo no | Same reasoning; the prop atlas carries authored placement. |
  | Water, water features | `town-water`, `town-water-features` | Yes, for the flow/detail normal | World-space projection is the natural parameterisation for water anyway. |
  | Foliage cards | `town-foliage` | **No** | Alpha-cut billboards with `uCutoff` 0.35. Triplanar on a card that always faces the camera swims. Wrapped diffuse (item 3) is the right treatment. |
  | Actor sprites | `town-sprite` | **No** | Pixel-art sprite atlas at `filter: 'nearest'` (`src/town/index.ts:482`). Triplanar would destroy it outright. |

  **The hard rule: never triplanar-project an atlas.** Triplanar ignores UVs, so projecting the
  material, prop or vegetation atlas across world space would sample straight across tile
  boundaries and composite unrelated tiles into every surface. Detail normals must come from a
  separate tiling texture that is *not* an atlas. This is the single most likely way to get
  `antiky-town` wrong, and it will look like noise rather than like a bug.
- **Items that apply to `antiky-town` cleanly:** item 1 (detail normals, on the four world-geometry
  shaders), item 3 (rim/Fresnel and wrapped diffuse — `fresnel()` is uncalled here too, and the
  foliage cards are exactly what wrapped diffuse is for), item 4 (SH-9 upgrading the existing
  sky/ground split), and item 6's normal and roughness halves where a tiling material can sit
  alongside the atlas albedo.
- **Items that do not apply to `antiky-town`:** item 2 (real shadows already), item 5 (the ramp LUT
  is scoped to `traversal-study`), item 7 (atlas already encodes material identity). For items 8
  and 9, assess what VFX the demo actually has before committing — none of the audit documents
  examined it, so there is no verified VFX inventory to work from, and the honest first step is to
  produce one.
  **`antiky-town` is the fourth demo and the exception that must be reasoned about, not assumed.**
  Its art is atlas-and-sprite based (`assets/textures/town-*-atlas-*.png` plus JSON) rather than
  per-model GLB, and it is the repository's only 2.3D artifact. Blanket triplanar would fight its
  authored atlas UVs, which are real information and must not be destroyed the way
  `normalize-quaternius.mjs` destroyed Quaternius's. The likely route is a tiling **detail normal
  and roughness** in world space over the existing atlas albedo — surface relief without touching
  UV assignment — plus material response on its voxel surfaces. Establish this by inspection and
  state where triplanar applies and where it does not, rather than forcing uniformity across four
  demos with three different art pipelines.
- **Detail normals first.** One 512² tiling detail normal at a ~4-unit tile rate on everything is
  10% of the effort for a large fraction of the "these are flat" read. Land it before any
  per-material PBR assignment.
- **Procedural world-space trim** for `combat-arena` in place of a textbook trim sheet: bands
  derived from `vWorld.y` multiplied into roughness and AO. A real trim sheet needs a second UV
  channel the loader does not read (`models/glb.js:153-181`) and days of Blender re-UV work.
- **Catalog material intake**, pulled forward from item 12 only as far as items 6 and 7 require:
  install the material slugs named in `../03-ART-DIRECTION-AND-VFX.md:364-412`, all four maps,
  hash-verified through the installer's existing MD5 path
  (`packages/asset-catalog/src/node/install.ts:45-63`), and record the receipts in each demo's
  `assets/antiky-assets.json`.
- **One HDRI per demo** for the SH bake — `dikhololo-night` or `moonless-golf` for
  `point-light-expo`, `blue-photo-studio` or `neon-photostudio` for `combat-arena`,
  `kloofendal-48d-partly-cloudy-puresky` for `traversal-study`. The bake is an offline Node script
  emitting a TypeScript constant of 27 floats; the runtime cost is nine multiply-adds and no texture
  fetch.
- Regenerating every touched `*.shader.gen.ts`.

## Required tests and evidence

Use the acceptance criteria already authored in `../03-ART-DIRECTION-AND-VFX.md`. They split into
three kinds, which is what makes this goal parallelisable internally.

**Every "today it measures X" figure below comes from the audit, which examined three demos and not
`antiky-town`.** Before applying any criterion to that demo, measure its baseline and record it.
Where a criterion turns out to be inapplicable there — AC-M2 and AC-L1 are the obvious candidates —
record that with the reason instead of forcing a number. Do not carry a three-demo baseline onto a
fourth demo it was never measured against.

**Static-source tests, no rendering:**

- **AC-M3** (`:347`) — every material shader that draws `parseGlb` geometry declares a `sampler2D`
  whose name matches `/[Nn]ormal/` and references it in the fragment body. Today this passes for
  zero shaders in all three demos.
- **AC-M2** (`:310`) — for every Kenney GLB the asset script processes, the emitted `TEXCOORD_0`
  contains at least two distinct V values, and every V maps to a declared material ID in the LUT.
- **AC-L1** (`:443`) — the authored ramp texture measured as data: brightest-to-darkest column
  luminance ratio at least 6:1 (today 1.81:1), and hue shifting at least 20° between them.
- **AC-V3** (`:797`) — no `*.shader.ts` applies a `sin`/`cos` of `uTime` to an output alpha without
  a per-instance frequency term. `arena-glow.shader.ts:51` and `traversal-glow.shader.ts:49` both
  fail today: they phase-offset per instance but share one frequency, which is the beat problem.
- **AC-V4** (`:802`) — every VFX program declares and samples at least one `sampler2D`. Today zero
  of the three glow shaders do.

**Presentation-layer test, no rendering:**

- **AC-V2** (`:790`) — drive one impact event through the projection code and record emitted
  instance values per frame. Peak scale within 3 frames; alpha at frame 10 at most 25% of peak;
  Pearson correlation between the scale and alpha curves under 0.9; at least two distinct elements
  with lifetimes differing by at least 1.5×. `combat-arena/tests/presentation.test.ts:62` is the
  existing precedent for this style of test.

**Frame-capture tests, using named probe rectangles stored in the test files:**

- **AC-M1** (`:263`) — three authored ROIs on large flat surfaces per demo; per-pixel luminance
  standard deviation at least 0.020 on a 0–1 scale. All three measure below 0.004 today, meaning
  those surfaces are literally constant.
- **AC-M4** (`:406`) — each demo's `assets/antiky-assets.json` lists at least one Poly Haven texture
  receipt with all four maps present and hash-verified.
- **AC-L4** (`:533`) — on a convex prop, the hue difference between the most sky-facing and most
  ground-facing lit face is at least 15° and their luminance ratio at least 1.8:1.
  `point-light-expo` measures 1.8:1 and 0° today.
- **AC-L6** (`:591`) — the 3-pixel band just inside the player silhouette is at least 1.6× the mean
  luminance of the character's interior. It is ≈1.0 in all three demos today.
- **AC-V1** (`:785`) — in a VFX-only capture, the per-pixel luminance gradient along every effect's
  outer boundary is at most 0.10 per pixel, meaning every effect falls off over at least 10 pixels.
  The ring VFX transition in 1–2 pixels today.

Plus one `npm run demos:shoot` run per demo at the end with a committed `visual-metrics.json`
sidecar, an explicit statement that the frames were looked at, and `npm test` green.

### Blocked techniques — do not spend time discovering these

- **Specular anti-aliasing is impossible in-shader.** It needs `dpdx`/`dpdy`/`fwidth`, absent from
  `node_modules/brometal/dist/dsl/builtins.d.ts`. Adding normal maps and gloss is exactly what
  creates the need for it, so plan for the substitute: bake normal-variance into roughness offline.
- **Full IBL prefiltering is impossible.** There are no cubemaps (`dsl/types.d.ts:1` lists
  `sampler2D` and `sampler3D` only), no explicit-LOD sampling (`compiler/emit-wgsl.js:266-270`
  never takes LOD as a parameter), and no mips on render targets (`runtime/webgpu.js:748-757`). The
  viable path is the diffuse half: SH-9 irradiance baked offline into nine `vec3` uniforms. The only
  specular-IBL option is a `sampler3D` with roughness on W, which is `rgba8unorm` and therefore
  **LDR** — acceptable for a stylised look, useless for a true HDR sun reflection.
- **`texture()` inside a DSL helper silently samples LOD 0** (`emit-wgsl.js:125` sets
  `stage:'helper'`, `:266-270` then picks `textureSampleLevel(…, 0.0)`). A triplanar helper would
  crawl at distance. Inline every material `texture()` call in the `fragment()` body. This is the
  highest-risk footgun in the whole material plan.
- **Vec3 has no reordered swizzles** (`dsl/types.d.ts:13-24` exposes only `.xy`, `.xz`, `.yz`).
  Build triplanar normal reorientations with explicit constructors.

## Explicit non-goals

- Do not buy, evaluate or download new asset kits. The revised split puts the genuine ceiling at
  ~10% and this goal is what measures whether that holds.
- Do not re-UV any kit in Blender.
- Do not take items 10 through 18 of `../03-ART-DIRECTION-AND-VFX.md:939-958`. Items 10, 11, 13, 15
  and 17 are chained to the HDR target and belong after the render-pipeline goals; items 12, 14, 16
  and 18 are deliberately deferred beyond the catalog intake this goal pulls forward.
- Do not add an HDR render target, a shadow map, bloom, tone-mapping changes or a colour grade, and
  do not apply the BroMetal patches. Nothing in items 1–9 needs them.
- Do not chase specular IBL through a `sampler3D` before the diffuse SH and planar reflection work.
- Do not delete the scar-tissue knobs — they are gated on the colour fix, which this goal does not
  own.
- Do not change simulation, input or encounter code.
- Do not triplanar-project any texture atlas, and do not apply triplanar to `antiky-town`'s foliage
  cards or actor sprites. Do not raise the actor atlas off `filter: 'nearest'`.
- Do not rebuild `antiky-town`'s shadow, ambient or post passes to look like the ones goals 06 and
  07 are writing for the other demos. Its versions predate them and work.

## Engineering constraints

- `packages/demos/antiky/antiky-town` is **in scope**, like every other demo, on the owner's
  instruction — and it is the one where uniformity is the trap. It is 2.3D, atlas-based, and already
  holds render targets, five shadow passes and a single post tone-map. Treat "this item does not
  apply here" as a legitimate and expected outcome, backed by a citation.
- Demos hand-roll rendering per demo until the `BroMetalRenderDriver` exists. **Do not extract a
  shared render package.** The triplanar sampling block will be written up to four times, and that
  is correct — converging implementations are the evidence a future framework slice needs, not a
  reason to abstract now. The pipeline-invariant tests keep the copies honest.
- Tests are required for every code change. When fixing a reported bug, write the regression test
  first, watch it fail, then fix.
- Commit incrementally with short one-line messages. No coauthor tags. Installed material sets are
  large — commit assets separately from source so the source diff stays reviewable.
- Capture PNGs are **not** committed. `.antiky/` is gitignored and `*.png` is LFS here. The
  committed artifact is the metrics sidecar.
- Preserve unrelated dirty worktree changes; several `traversal-study` and `packages/website` files
  are already modified.
- Every visual change ends with a fresh capture that is actually looked at.
- Watch the cost honestly: albedo + normal + ARM triplanar is nine `texture()` calls per fragment.
  That is comfortable at 1600×900 with these scene complexities. Measure it with
  `antiky tool get_render_stats` rather than assuming.

## Completion definition

The goal is complete when all ten required outcomes are landed, every acceptance criterion named
above passes on the demos it applies to, the material and HDRI receipts are hash-verified in each
demo's `assets/antiky-assets.json`, `npm test` is green, and one post-change `visual-metrics.json`
sidecar per demo — four demos now — is committed.

The goal also produces one honest measurement for the owner: with materials assigned, how much of
the visual gap remains, and is any part of it genuinely silhouette and topology. Report that number
with the captures behind it. If it lands near the predicted ~10%, the no-new-assets decision holds;
if it does not, that is the evidence a kit evaluation would need — and it is the owner's call, not
the agent's.

---

## Progress so far

Written mid-goal so the next session starts from measurements rather than assumptions. Every commit
below left `npm test` green and `npm run demos:verify` at its six known targets.

### Landed

| Item | State |
|---|---|
| **1** — tiling detail normal, triplanar | **Done, four demos.** `packages/demos/scripts/build-detail-normal.mjs` generates one 512² map into each demo. Projected by ten shaders: four model shaders, the reliquary floor and props, and the town voxel/prop/awning/water surfaces. |
| **3** — rim/Fresnel, wrapped diffuse | **Done bar cloth sheen.** Rim added to the four model shaders that lacked one; wrapped diffuse for traversal's clouds behind an explicit per-batch `uWrap`. Cloth sheen needs fabric materials, so it waits on item 6. |
| **4** — SH-9 irradiance | **Script done; point-light-expo fully wired.** `bake-sh9-irradiance.mjs` fetches an HDRI, decodes Radiance RGBE by hand, projects onto nine harmonics, emits 27 floats. Coefficients baked for all three named HDRIs. |
| **10** — antiky-town surface record | **Done.** `packages/demos/antiky/antiky-town/MATERIALS.md`, colocated with the demo it describes. Records all thirteen shaders including the four rejections, and corrects the goal's table on `town-water`. |
| **9** — VFX timing (part) | **AC-V3 closed.** `arena-glow` and `traversal-glow` pulsed their alpha on one shared frequency with only a per-instance phase, so instances drifted into unison. Both now vary the rate per instance, with a test that catches a regression. The rest of item 9 — curves, snap, secondary elements — is not done. |
| AC-V3 | **Green**, scoped to values reaching an alpha. A global rate is correct for a *field*: wind crosses the town at one speed and water waves travel at one speed. An earlier version flagged both and would have pushed someone into breaking them. |
| **5** — hue-shifting ramp LUT | **Done.** `traversal-study` lit through a 64-step ramp uploaded as a `sampler3D`. Measured **14.8:1** brightest-to-darkest against a 6:1 floor, and **185 degrees** of hue shift against a 20-degree floor. |
| AC-L1 | **Green**, measured from the ramp as data rather than from a capture — a frame could pass by accident through fog or exposure. |
| AC-M3 | **Green**, and it discovers GLB-drawing shaders from source rather than a list. |

### Measured, before → after

| demo | localContrast median |
|---|---|
| point-light-expo | 3.156 → **4.45** |
| antiky-town | 7.997 → 8.06 |
| combat-arena | 5.990 → 6.00 |
| traversal-study | 0.00 → 0.00 |

`traversal-study` reads zero because more than half its frame is flat sky, so the median tile has no
variation. That is the metric's shape, not a defect — and it means `localContrastMedian` is the wrong
instrument for that demo. Use AC-M1's probe rectangles there.

### The finding that should shape the rest of this goal

**A detail normal does nothing without directional light to modulate.** Measured with the term in and
out: 40.6% of `antiky-town`'s frame changed, because that demo already has a sun, a sky/ground split
and shadows. In `point-light-expo` the floor probes were *identical* either way — 0.0271 both times —
because its ambient was a flat colour that never consulted the normal. Wiring SH-9 there nearly
doubled the worst floor probe (0.0072 → 0.0126) and moved the demo's local contrast 3.57 → 4.45.

Items 1 and 4 are coupled. Anywhere light is ambient-dominated, item 1 is inert until item 4 lands.

### SH-9 is not automatically better than a hand-tuned ambient — measured

`combat-arena` was wired for SH-9 and then **reverted**, because it measured worse both ways round:

| ambient | localContrast | p95 |
|---|---|---|
| existing hand-tuned (`0.16 + normal.y * 0.1`) | **5.99** | 0.081 |
| SH-9 from `blue-photo-studio` | 5.87 | 0.072 |
| SH-9 from `neon-photostudio` | 5.68 | 0.071 |

The reason is not a bug in the bake. A studio HDRI is *designed* to be even, so its directional
variation is genuinely lower than the crude `normal.y` lean it would replace. This goal assumed
SH-9 beats a flat constant everywhere; against a studio environment on a demo whose ambient was
already hand-leaned, it does not.

Both HDRIs the goal names for this demo are studio captures, so changing the slug does not fix it.
What would: an environment with real directional structure, which is an art decision about what the
arena is lit *by*, not an implementation choice. Left for the owner rather than guessed at.

The first attempt also normalised against the old ambient's constant term instead of its hemisphere
average, which quietly removed a quarter of the fill — worth knowing, since the same mistake is
available in the two demos still to be wired.

### Corrections to this goal's premises

- **"`fresnel()` ships and zero demos call it"** — the BroMetal *helper* is uncalled, but 13 of 29
  shaders already hand-roll a rim or Fresnel term, and `town-foliage` already has wrapped diffuse
  *and* transmission. The real gap was four model shaders, now closed.
- **AC-M3's "passes for zero shaders in all three demos"** — stale. `point-light-expo` already had a
  live normal map, restored by goal 04.
- **AC-M1's "all three measure below 0.004"** — not so. Measured 0.0072–0.0272 across three floor
  probes in `point-light-expo`. Those surfaces are not constant.

### Two things the owner may want to weigh in on

- HDRIs download to a gitignored `.hdri-cache/`; only the baked floats and a receipt are committed.
- `brometal/town-study` is now diverged from its `antiky-town` twin (12 shaders were byte-identical).
  Mirroring would mean editing a fifth demo this goal does not name. Left diverged deliberately.

### Next, in order of value

1. **Item 4 for `traversal-study`.** Item 5 landed first and the ramp now supplies the light colour,
   so the remaining question is narrower than it was: whether the `kloofendal` coefficients should
   tint the ramp's shadow end, or replace the flat term the ramp multiplies. Coefficients are
   already baked. Original note, still true in shape: That demo has no
   ambient term to replace — its lighting is a three-band toon ramp whose `0.54` base *is* the
   ambient. Wiring SH-9 into it before item 5 means writing lighting that item 5 immediately
   rewrites, so do them together: the ramp reads light amount, SH-9 supplies the colour it is
   tinted by. Coefficients are already baked from `kloofendal`, which unlike the arena's studio
   captures has real directional structure, so expect it to behave like `point-light-expo`. `antiky-town` should upgrade its existing
   `uSkyColor`/`uGroundColor` split. **`combat-arena` is done and deliberately not wired** — see
   the measurement above; it needs an owner decision about what the arena is lit by.
2. **Item 5** — the ramp LUT. `traversal-study` is the flattest demo in the set and its ramp is three
   `smoothstep` bands spanning 0.54→0.98 with no view-dependent term at all.
3. **Item 7**, then **item 6** (largest — needs the Poly Haven intake), then items 2, 8, 9, 10.

### Instrument added

`npm run demos:shoot -- --keep <dir>` copies the captured frame somewhere durable. Evidence is
session-scoped and the store clears it on teardown, so before-and-after comparison was impossible
without it — and "the frames were actually looked at" was a claim nobody could act on.
