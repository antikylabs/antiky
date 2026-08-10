# Art Direction, Material Upgrade, and VFX

**Date:** 2026-08-10
**Scope:** `point-light-expo`, `combat-arena`, `traversal-study`. `antiky-town` is out of scope.
**Reads with:** `00-VISUAL-DIAGNOSIS.md`, `02-REMEDIATION-PLAN.md`,
`subagent-reports/01-antiky-render-audit.md`, `subagent-reports/02-brometal-capability-audit.md`,
`subagent-reports/03-asset-pipeline-audit.md`.

This document exists because the owner made a call the existing docs under-serve:

> "We have assets of materials etc, we can upgrade Kenney's and other assets with PBR and other
> textures added onto things. Custom lighting and effects, and quality VFX."

He is right, and docs 00/02/03 are wrong about the ceiling. This document says why, and then gives
the concrete pipeline, technique list, and per-demo direction to act on it.

Every recommendation below carries a **bounded acceptance criterion** so the work can be split
across parallel agents and each piece independently verified. Every claim about existing code
carries a `file:line`. Where a technique is blocked by BroMetal 0.15 it says so and gives the
workaround.

**Constraint honoured throughout:** rendering stays hand-rolled per demo. Nothing here proposes a
shared render package. Where two demos want the same helper, they each get a copy.

---

## 1. What the existing docs get wrong or under-serve

Fold these corrections back into 00/01/02/03.

### 1.1 The "40% asset ceiling" figure is wrong, and it is the most consequential error

`subagent-reports/03-asset-pipeline-audit.md:334` states *"Asset fidelity: ~40%. Kenney kits are a
genuine hard ceiling."* `:330` goes further: *"League of Legends and Rocket League are not [achievable]
… Kenney flat-palette geometry cannot produce either signal."* `00-VISUAL-DIAGNOSIS.md:191-199`
repeats it, and `02-REMEDIATION-PLAN.md:358` builds the whole "what I would not do" section on it.

The reasoning behind the number is this, from `03-asset-pipeline-audit.md:215-221`:

| Model | Verts | Unique UVs |
|---|---|---|
| `block-grass-large.glb` | 168 | **5** |
| `tree.glb` | 800 | **18** |
| `room-small.glb` | 8,184 | **40** |

The conclusion drawn was: 5 unique UVs means 5 flat swatches of surface information, therefore
flat-shaded regardless of renderer.

**That conclusion holds only if surface detail must arrive through the mesh's UVs.** It does not.
World-space triplanar projection derives texture coordinates from `vWorld` and `vNormal` in the
fragment shader and never touches `TEXCOORD_0` at all. A 168-vertex Kenney block with 5 unique UVs
can carry a full 2K Poly Haven albedo + normal + ARM set at any tiling density, with zero mesh
changes, zero re-UV work, and zero new assets. The UV count is simply not the binding constraint the
audit takes it to be.

The word "triplanar" appears twice in the entire doc set — `03-asset-pipeline-audit.md:410` and
`01-antiky-render-audit.md:401` — and both times only as *"triplanar noise"*, a procedural-detail
afterthought. Triplanar as the **primary material delivery mechanism for un-unwrapped kit geometry**
is absent from every document. It is the single largest missed idea in the current plan.

The honest revised split, for the same three demos:

| Cause | Old figure | Revised | Why |
|---|---|---|---|
| Rendering / lighting / post | ~35% | ~35% | Unchanged. 00/02 are right about this. |
| Self-inflicted pipeline damage | ~25% | ~25% | Unchanged. |
| **Material assignment absent** | (folded into "asset ceiling") | **~30%** | Not a ceiling. Fixable in-shader with catalog assets we already hold. |
| **Genuine asset ceiling** | ~40% | **~10%** | Silhouette and topology only: Kenney's chunky forms, no bevels, no wear geometry. Real, but small. |

The residual 10% is real. Kenney blocks have no chamfers, so they will never catch an edge highlight
the way modelled geometry does. That is a silhouette limit, not a surface limit, and it is worth
about a tenth of the gap — not four tenths.

### 1.2 Two documents recommend a technique the DSL cannot express

`02-REMEDIATION-PLAN.md:246-248` (Phase 2, item 2):

> "Keep them, and derive a tangent basis in-shader with screen-space derivatives so no `TANGENT`
> attribute is required."

`subagent-reports/03-asset-pipeline-audit.md:411` :

> "curvature-based edge wear from `length(fwidth(normal))`"

**Both are impossible.** The BroMetal DSL has no derivative builtins. The complete builtin list is
`node_modules/brometal/dist/dsl/builtins.d.ts` — there is no `dpdx`, `dpdy`, or `fwidth`, and a grep
for those tokens across all of `node_modules/brometal/dist/` returns only source comments in
`compiler/emit-glsl.js:51` and `compiler/emit-wgsl.js:266` explaining why *texture sampling* needs
implicit derivatives. There is no way to expose them from shader code.

`subagent-reports/02-brometal-capability-audit.md:666` already got this right — *"derive tangents
in-shader from screen-space derivatives (not available — no `dpdx`/`dpdy` in the DSL, confirmed by
grep)"*. Docs 02 and 03 contradict the capability audit and should be corrected to match it.

This also silently blocks **specular anti-aliasing** (Toksvig / normal-variance methods all need
`fwidth(normal)`), which matters because the plan is about to introduce normal maps and glossy
floors — the two things that produce specular shimmer. See §4.7 for the workaround.

The replacement for the whole tangent question is in §3.1: **triplanar normal mapping requires no
tangent basis of any kind.** It builds the basis from the world axes. That deletes the problem
rather than solving it.

### 1.3 "Use the 332 HDRIs" is stated as a plan but is not actionable as written

`02-REMEDIATION-PLAN.md:250-252` and `03-asset-pipeline-audit.md:387-389` both say to prefilter an
HDRI into *"a small irradiance SH set + a specular mip chain."*

The irradiance half is excellent and cheap. The specular half cannot be built:

- **No cubemaps.** `GPU_TYPES` is `float vec2 vec3 vec4 mat4 sampler2D sampler3D storage`
  (`node_modules/brometal/dist/dsl/types.d.ts:1`). No cube sampler exists.
- **No explicit-LOD sampling.** `compiler/emit-wgsl.js:266-270` picks `textureSample` in the fragment
  stage and `textureSampleLevel(..., 0.0)` everywhere else. LOD is never a parameter, so
  roughness cannot select a mip.
- **No mips on render targets** (`runtime/webgpu.js:748-757`), so you cannot even build the chain
  at runtime.

The only working specular-IBL path is the `sampler3D`-with-roughness-on-W trick from
`02-brometal-capability-audit.md:464-469`: `createTexture3D` is `rgba8unorm` only
(`webgpu.js:813`) with linear filtering on all three axes (`webgpu.js:823-829`) and no mips. That
gives you an **LDR** prefiltered environment, which is fine for a stylised look and useless for a
true HDR sun reflection. Say so; do not let an agent burn a week discovering it.

The irradiance half needs no texture at all — see §4.4. Nine `vec3` uniforms, baked offline.

### 1.4 The docs never name a value target, only "widen the range"

`00-VISUAL-DIAGNOSIS.md:100-101` correctly observes combat-arena sits in a 15–35% luminance band.
`02-REMEDIATION-PLAN.md:332-334` proposes a luminance-histogram assertion but leaves the range as
*"an authored range"* with no numbers, which makes it unimplementable and unparallelisable.

§7.1 gives the numbers, per demo.

### 1.5 VFX gets one line of remediation for a whole discipline

The diagnosis is sharp — `00-VISUAL-DIAGNOSIS.md:111-113`, *"the VFX read as flat decals… hard-edged
constant-width circles with no glow."* The remediation is
`02-REMEDIATION-PLAN.md:269`: *"Replace the flat ring decals with soft-edged blooming VFX."*

Nothing in any document covers texture-sheet animation, soft particles, ribbon/trail meshes,
distortion, decal projection, or — most importantly — **timing and animation curves**, which is what
"AAA VFX" actually means. §5 covers all of it.

Ironically, `02-REMEDIATION-PLAN.md:119-164` contains the best writing in the doc set on exactly this
subject — the camera-shake analysis, which correctly identifies that *"pure periodic motion reads to
the eye as malfunction; an impact needs to read as an irregular, decaying burst."* That insight is
never generalised to the VFX, even though the VFX have the identical defect in the identical shape:
`combat-arena/src/shaders/arena-glow.shader.ts:51` modulates **every** glow's alpha by
`sin(uTime * 5 + iPhase * 2.3) * 0.18`, and
`traversal-study/src/shaders/traversal-glow.shader.ts:49` does the same with `sin(uTime * 4.8)`.
Every effect in both demos is continuously breathing on a shared metronome. That is the VFX
equivalent of the camera-shake finding and it belongs in the same section.

### 1.6 Additional corrections, smaller

| Doc | Claim | Correction |
|---|---|---|
| `02-REMEDIATION-PLAN.md:196` | *"Sampleable depth — needed for … soft particles … Defer."* | Correct that it is blocked, but there is a cheap in-scope workaround the doc omits: **analytic depth fade** against known geometry (§5.2). These scenes are a flat arena deck and flat platform tops; a plane-distance fade covers nearly every visible intersection at zero GPU cost. |
| `02-REMEDIATION-PLAN.md:188-190` | Shadow maps are unblocked because `shadowDepth` writes distance to a colour target. | True, but `shadowFactor` is a **radial point-light** formulation — `distance(worldPos, lightPos) / range` (`shader-functions/library-source.js:711`). Using it for a directional sun means placing a virtual light far away, and RGBA16F half-float quantisation then scales with `range`. See §4.2 for the bound. |
| `03-asset-pipeline-audit.md:201` | *"Zero vertex colors (`COLOR_0`) anywhere."* | Accurate, and the loader drops `COLOR_0` regardless (`models/glb.js:153-181`). So vertex-colour material masks are **not** the route here. §3.2 gives the route that is: bake a material ID into the UV's V channel at pack time. Zero attribute cost, zero loader change. |
| `03-asset-pipeline-audit.md:407-409` | Trim sheets *"applied via a second UV channel"*. | The loader reads only `TEXCOORD_0` (`glb.js:153-181`) — there is no second UV channel, and adding one costs an attribute slot against an 8-slot cap. A genuine trim sheet also requires the mesh to be re-UV'd onto the strip, which is Blender work on every asset. §3.3 gives the 80/20 substitute. |
| `01-antiky-render-audit.md:311` | Notes traversal's alpha VFX are unsorted. | Correct, and there is a second consequence unstated: `traversal-study/src/renderer.ts:150` creates the glow program with `blend: 'alpha'` while `combat-arena/src/render-batches.ts:101` and `point-light-expo/src/render-batches.ts:153` use `'additive'`. **Alpha-blended VFX cannot bloom** — they cannot push a pixel above 1.0. Traversal's effects will stay flat after the HDR/bloom work lands unless split into an additive batch. |

---

## 2. Capability ledger for this work

Verified against `node_modules/brometal@0.15.0` today. This is the subset that governs everything
below; the full picture is in `subagent-reports/02-brometal-capability-audit.md`.

**Available and load-bearing:**

| Capability | Evidence | Used for |
|---|---|---|
| `texture()` in `fragment()` gets mips + anisotropy | `compiler/emit-wgsl.js:266-270` | Triplanar sampling without shimmer |
| `sampler3D`, linear on all three axes, no mips | `runtime/webgpu.js:807-838`, filter at `:823-829` | Ramp LUTs, prefiltered LDR environment |
| `fresnel(normal, viewDir, power)` | `shader-functions/index.d.ts:42` | Rim light, grazing sheen. **Zero demos call it.** |
| `hemisphereLight(normal, sky, ground)` | `shader-functions/index.d.ts:44` | Sky/ground ambient |
| `shadowDepth` / `shadowFactor` (3×3 PCF) | `shader-functions/index.d.ts:170,194`; body at `library-source.js:709-739` | Shadow maps |
| 3D noise: `hash31`, `vnoise3`, `fbm3` | `shader-functions/index.d.ts:80-84` | Procedural surface detail, grime, cloud density |
| Easing: `easeOutExpo`, `easeOutBack`, `easeOutElastic`, `easeOutBounce` | `index.d.ts:100,101,25,26` | VFX timing curves |
| Grading: `luminance`, `rgb2hsv`, `adjustSaturation`, `brightnessContrast`, `blendOverlay`, `blendScreen`, `filmGrain`, `cosinePalette` | `index.d.ts:28-32,86-98,123` | Post grade |
| `for` loops (float counter), `if`/`else if`/`else` | `node_modules/brometal/AGENTS.md:52-53` | Multi-light loops over storage buffers |
| Storage buffers readable in vertex *and* fragment | `runtime/webgpu.js:311-313` | Arbitrary light counts, GPU particles |
| Helper fns may take `Sampler2D` params | `node_modules/brometal/AGENTS.md:56-58` | Reusable material functions |

**Blocked, with the workaround we will actually use:**

| Blocked | Evidence | Workaround |
|---|---|---|
| `dpdx` / `dpdy` / `fwidth` | absent from `dsl/builtins.d.ts`; grep across `dist/` finds only comments | Triplanar normal mapping (no tangents needed); bake normal-variance→roughness offline (§4.7) |
| Sampling a depth attachment | `runtime/webgpu.js:763,766-769` | Analytic depth fade for particles (§5.2); linear-depth colour prepass only if that proves insufficient |
| Cubemaps / texture arrays | `dsl/types.d.ts:1` | `sampler3D` with roughness on W (LDR only) |
| Explicit-LOD sampling | `compiler/emit-wgsl.js:266-270` | Same |
| Mips inside a helper function | `emit-wgsl.js:125` sets `stage:'helper'`; `:266-270` then picks `textureSampleLevel(…, 0.0)`; confirmed by `node_modules/brometal/AGENTS.md:109-110` | **Inline every material `texture()` call in the `fragment()` body.** A triplanar helper would silently sample LOD 0 and crawl at distance. This is the highest-risk footgun in the whole material plan. |
| MSAA on render targets | `runtime/webgpu.js:235` | Patch (`02-brometal-capability-audit.md:487-502`), or FXAA + 1.5× supersample |
| Render targets sampled linearly | `runtime/webgpu.js:761` | Two-line patch. Do it first; it unblocks bloom, planar reflection, everything. |
| Reordered swizzles (`.zy`, `.zyx`) | `dsl/types.d.ts:13-24` — Vec3 exposes only `.xy`, `.xz`, `.yz` | Construct explicitly: `vec3(a.z, a.y, a.x)`. Affects triplanar normal reorientation; costs nothing but is easy to get wrong. |
| Line/point topology | `runtime/webgpu.js:365` — `triangle-list` only | Ribbon trails must be built as triangle lists CPU-side |
| `draw()` sub-ranges | `runtime/program.d.ts:29` | Fixed-capacity batches with zero-scaled unused slots — which is already the established pattern (`traversal-study/src/renderer.ts:414-419`) |
| Premultiplied-alpha blend | `runtime/webgpu.js:346-361`; additive is `(src-alpha, one)` | Additive brightness is **coupled to alpha**. `combat-projection.ts:118` writes `alpha: 0.42` on projectile trails, so their colour is silently scaled by 0.42. Either always write `a = 1` and encode intensity in RGB, or accept the coupling deliberately. |
| Independent depth-write control | `runtime/webgpu.js:373` — `depthWriteEnabled: blend === 'none'` | No opaque-but-non-writing pass, no depth prepass with `less-equal`. Design around it. |

---

## 3. Material upgrade pipeline for the assets we already have

### 3.1 Triplanar world-space projection — the core unlock

**What it is.** Instead of reading `TEXCOORD_0`, derive three sets of UVs from the fragment's world
position — one per cardinal plane — sample the material three times, and blend by the surface normal.
The mesh's own UVs are never consulted.

**Why it is the right call here.** Every objection in the audit to upgrading Kenney and Quaternius
geometry is a UV objection (`03-asset-pipeline-audit.md:213-227`). Triplanar makes UVs irrelevant. It
also *frees an attribute slot* — `aUv` is no longer needed — which matters against the 8-slot cap
(`02-brometal-capability-audit.md:306-320`).

**Shape of it, in this DSL.** Written inline in `fragment()`, never in a helper (§2):

```
// varyings: vWorld (vec3), vNormal (vec3)
const n     = normalize(vNormal);
const wRaw  = vec3(pow(abs(n.x), 4), pow(abs(n.y), 4), pow(abs(n.z), 4));
const wSum  = wRaw.x + wRaw.y + wRaw.z;
const w     = wRaw.scale(1 / wSum);

const uvX = vWorld.yz.scale(uTile);   // .yz exists — dsl/types.d.ts:19
const uvY = vWorld.xz.scale(uTile);   // .xz exists
const uvZ = vWorld.xy.scale(uTile);   // .xy exists

const albedo = texture(uAlbedo, uvX).xyz.scale(w.x)
  .add(texture(uAlbedo, uvY).xyz.scale(w.y))
  .add(texture(uAlbedo, uvZ).xyz.scale(w.z));
```

**Triplanar normal mapping needs no tangent basis.** Reorient each plane's tangent-space sample onto
the world axes and blend — the "whiteout" blend. Because Vec3 has no reordered swizzles, build the
reorientations with explicit constructors:

```
const tX = texture(uNormalMap, uvX).xyz.scale(2).sub(vec3(1));
const nX = normalize(vec3(tX.z * sign(n.x), tX.y + n.y, tX.x + n.z));   // etc. per axis
```

This is what deletes `point-light-expo/scripts/gltf-pack-lib.mjs:89` (`delete material.normalTexture`)
as a problem, and it does so without generating tangents, without a fourth vertex attribute, and
without the `dpdx` that does not exist (§1.2).

**Costs and limits, honestly:**

- 3 `texture()` calls per map. Albedo + normal + ARM = **9 samples per fragment**. At 1600×900 with
  these scene complexities this is comfortable; it would not be at 4K with 30 materials.
- **Rotating instances swim.** If a prop has per-instance yaw (`rotate3`), project in *object* space
  — pass `vObject = aPosition` and sample with that — then rotate the resulting world normal by the
  same yaw. Correct, and free.
- **Non-uniform instance scale stretches the tiling.** Divide `uTile` by the instance scale, or
  accept it on props where the scale is near-uniform.
- Triplanar has no *authored* placement. A logo, a face, a decal cannot be triplanar. Those stay on
  UVs — which is exactly why the Quaternius ships (1,521 unique UVs,
  `03-asset-pipeline-audit.md:220`) should keep their UV path.

**Acceptance criterion (AC-M1).** For each demo, an automated check over a captured frame: pick three
authored ROIs on large flat surfaces (platform top, arena deck tile, floor quad). In each ROI, the
standard deviation of per-pixel luminance must be **≥ 0.020** on a 0–1 scale. Today all three measure
below 0.004 — the surfaces are literally constant. Store the ROI rectangles in the test file so the
measurement is reproducible.

**Effort:** 1.5 days for the first demo (the shader work plus one material bind path), ~0.5 day each
to carry to the other two.

### 3.2 Material-ID routing for palette kits

Kenney kits are single-material with a shared 512² palette atlas
(`03-asset-pipeline-audit.md:178-190`). Every triangle of a grass block points at one of ~5 texels.
That palette index is *real authored information* — it says "this face is grass, that face is dirt" —
and it is currently thrown away into a flat colour.

**Route it into a material ID, at pack time, in the UV's V channel.**

The per-demo asset scripts already rewrite UVs — `traversal-study/scripts/normalize-quaternius.mjs:238`
writes `paletteU = (materialIndex + 0.5) / colors.length` today. Change what it writes rather than
whether it writes:

- `u` = the source palette column (keep it, it still carries the authored tint)
- `v` = `(materialId + 0.5) / MATERIAL_COUNT`, where `materialId` is assigned by clustering the
  unique palette colours into a small named set — grass, dirt, stone, wood, metal, fabric.

At runtime, `aUv.y` selects a row of a small material LUT. Since palette rows must not blur into each
other, the LUT is the one place a `sampler3D` earns its keep: `createTexture3D` filters linearly on
all three axes with **no mip chain at all** (`runtime/webgpu.js:807-838`), so a
`64 × 1 × MATERIAL_COUNT` volume gives smooth interpolation along the ramp and hard separation
between materials. A 2D LUT with `filter: 'linear'` would mip-average adjacent material rows into mud
— the exact failure already documented at `01-antiky-render-audit.md:284`.

Per material ID the LUT carries: base tint, roughness, metallic, detail-normal strength, and
triplanar tile scale. Five numbers per material, authored in one TS constant, previewable.

**Why not vertex colours.** `COLOR_0` is absent from every shipped asset
(`03-asset-pipeline-audit.md:201`) *and* dropped by the loader (`models/glb.js:153-181`). Adding it
would cost an asset-script change, a loader patch, and an attribute slot. The UV-V route costs one
line in a script that is already rewriting UVs.

**Why not per-instance material.** `point-light-expo` already does per-instance material — its
surface batch carries roughness / metallic / emissive
(`point-light-expo/src/relay-visuals.ts:39-49`). That is correct for whole-prop variation and wrong
for within-prop variation, which is what a grass-topped dirt block needs. Use both: instance
attributes for prop-level variation, UV-V for face-level.

**Acceptance criterion (AC-M2).** A unit test on the asset script: for every Kenney GLB it processes,
assert that the emitted `TEXCOORD_0` contains **≥ 2 distinct V values** and that every V value maps to
a declared material ID in the LUT constant. Today every Kenney GLB would fail (single V) and every
Quaternius platformer GLB would fail harder (`normalize-quaternius.mjs:267` writes `v = 0.5`
universally).

**Effort:** 1 day (script + LUT + shader lookup), for both kit-using demos at once since the script
change is shared in shape but duplicated per demo.

### 3.3 Detail normals and the trim-sheet question

**Detail normals are the cheapest single material win in the project.** One 512² tiling detail normal
map, triplanar-projected at a high tile rate (say 4 units), blended over whatever base normal exists,
applied to *everything*. It costs one texture, three samples, and one blend, and it converts every
flat Kenney face from a constant into a surface that catches light. It works on geometry that has no
UVs, no tangents, and no per-material data.

Do this **before** any per-material PBR assignment. It is 10% of the effort for a large fraction of
the "these are flat" read.

**Trim sheets: do not do the textbook version.** `03-asset-pipeline-audit.md:407-409` proposes a 2K
trim sheet on a second UV channel. Two blockers: the loader reads only `TEXCOORD_0`
(`models/glb.js:153-181`), and a real trim sheet requires re-UV'ing every mesh onto the strip in
Blender. That is days of manual art work per kit for a demo.

**The 80/20 substitute — procedural world-space trim.** Panel lines, seams and emissive strips are
almost always *axis-aligned bands at fixed heights*. Generate them from `vWorld.y` directly:

```
const band  = fract(vWorld.y * uTrimFrequency);
const seam  = smoothstep(0.00, 0.02, band) * (1 - smoothstep(0.04, 0.06, band));
```

Multiply into roughness and AO, add an emissive strip at one chosen height. On the Kenney
modular-space kit this reads as panelling because the kit's forms are already box-modular. It cannot
do bolts or hero details — but nothing in these frames is close enough to read a bolt.

**Acceptance criterion (AC-M3).** Every material shader that draws GLB geometry declares and samples
at least one normal-map sampler. Enforce it as a static test over
`packages/demos/antiky/*/src/shaders/*.shader.ts`: for each shader whose program is bound to a
`parseGlb` mesh, assert the uniform record contains a `sampler2D` whose name matches `/[Nn]ormal/`
and that the fragment body references it. Today this passes for **zero** shaders in all three demos.

**Effort:** 0.5 day for detail normals (all three demos). 1 day for procedural trim (combat-arena
only).

### 3.4 Recommended approach per demo, with reasoning

| Demo | Geometry reality | Recommended material route | Why |
|---|---|---|---|
| **point-light-expo** | Poly Haven scans, genuine unwraps, `POS+NRM+UV`, 1K diff + ARM shipped, 1K normal downloaded and deleted at `gltf-pack-lib.mjs:89` | **Keep UVs for the hero rocks; restore the normal map and sample it with a triplanar basis** rather than a tangent basis. Triplanar for the 18×12.8 floor plane (`point-light-expo/src/renderer.ts:75-80`) and for the wooden arches. | The scans' UVs are good and carry authored placement — throwing them away would be a downgrade. But building a tangent basis needs either MikkTSpace tangents at pack time (no source mesh has `TANGENT`, per `01-antiky-render-audit.md:147`) or `dpdx` (does not exist, §1.2). Triplanar-basis normal mapping on UV-sampled albedo is the path that needs neither. Slight mismatch between albedo placement and normal placement is invisible on rock. |
| **combat-arena** | Ships: 2048² unwrapped albedo, 1,521 unique UVs — genuinely good. Arena: Kenney modular-space, 40 unique UVs, 512² palette | **Split the pipeline.** Ships keep UVs and gain a tiling detail normal + a Fresnel-weighted specular lobe. Arena goes fully triplanar with a Poly Haven metal set + procedural trim (§3.3). | The ships are the one kit in the repo that can carry a Rocket League read as-is (`03-asset-pipeline-audit.md:323`). Do not triplanar them — you would destroy the authored panel work. The arena has nothing to destroy. |
| **traversal-study** | Kenney platformer kit (5–18 unique UVs) plus Quaternius palette-strip models reduced to 1×1–7×1 textures by `normalize-quaternius.mjs:238,267` | **Fully triplanar, with material-ID routing (§3.2), onto fabric and cardboard materials.** This is where the technique pays most. | LittleBigPlanet's entire identity is material — felt, cardboard, corrugate, denim, stitching. The catalog holds 13 fabric/leather sets and a cork/plywood family. There is no authored UV information to preserve here, so triplanar costs nothing and delivers the demo's whole thesis. |

### 3.5 Concrete catalog picks

All CC0, all already in `packages/asset-catalog/data/poly-haven.generated.json`, all with
diff + nor + rough + AO available from Poly Haven. Verified present by slug.

**traversal-study — LittleBigPlanet material language.** The kit's colour language (green tops,
orange sides, grey rock) should survive as *tint*; the material carries the surface.

| Surface | Material slug | Role |
|---|---|---|
| Platform top | `leafy-grass` or `forrest-ground-01` | Mossy felt read, high tile rate |
| Platform side | `plywood` or `rough-wood` | Cardboard/corrugate edge, the LBP signature |
| Rock / cliff | `rock-boulder-dry`, `mossy-rock` | Replaces the 1×1-pixel `coastal-cliff` texture entirely |
| Fabric accents, flag | `fabric-pattern-05`, `fabric-pattern-07`, `denim-fabric` | Cloth sheen surfaces (§4.6) |
| Tree bark | `bark-brown-01` | 18 unique UVs today; triplanar makes them irrelevant |
| Soft props | `velour-velvet`, `dirty-carpet` | Contrast material for the "hand-made" read |

**combat-arena — Rocket League material language.**

| Surface | Material slug | Role |
|---|---|---|
| Arena deck tile | `metal-plate` or `metal-plate-02` | Glossy, low roughness, takes a reflection |
| Wall / rim structure | `blue-metal-plate`, `box-profile-metal-sheet` | Panelled, mid roughness |
| Wear / grime pass | `rust-coarse-01`, `green-metal-rust` | Blend by a `fbm3(vWorld)` mask for non-uniform wear |
| Grate details | `metal-grate-rusty`, `rusty-metal-grid` | Alpha-cut with `discard()` — the patch already ships it (`scripts/patch-brometal.mjs:45-97`) |

**point-light-expo — League of Legends material language.**

Already holds the right assets. The work is restoring what the pipeline deletes, plus a ground
material with more variation than the single `forest_floor` plane. Add `forest-ground-04` or
`brown-mud-leaves-01` as a second layer blended by `fbm3` so the ground stops reading as one texture
stretched over 18×12.8 units.

**HDRIs for the ambient bake (§4.4).** From 332 available:

- `point-light-expo` → `dikhololo-night` or `moonless-golf` (night, low ambient, lets the point
  lights own the frame)
- `combat-arena` → `blue-photo-studio` or `neon-photostudio` (artificial, directional, cool)
- `traversal-study` → `kloofendal-48d-partly-cloudy-puresky` (the one already hand-written into
  `packages/asset-catalog/src/catalog-data.ts` as a starter; bright midday, high contrast, exactly
  the LBP key)

**Acceptance criterion (AC-M4).** `assets/antiky-assets.json` in each demo lists at least one
Poly Haven **texture** receipt beyond the existing model receipts, with all four maps
(diff / nor / rough / ao) present and hash-verified by the installer's existing MD5 path
(`packages/asset-catalog/src/node/install.ts:45-63`). Today the count is one, in one demo
(`point-light-expo`'s forest floor).

---

## 4. Custom lighting and stylisation

The techniques below are ordered by how much each closes the gap to its reference. Each names the
demo it serves.

### 4.1 Ramp / LUT lighting, done properly — traversal-study first

**The defect.** `traversal-study/src/shaders/traversal-model.shader.ts:50-52`:

```
const band = 0.54 + smoothstep(0.18, 0.25, diffuse) * 0.2 + smoothstep(0.62, 0.7, diffuse) * 0.24;
```

A three-step ramp spanning 0.54 → 0.98. **Maximum contrast ratio 1.81:1.** This shader draws all
thirteen catalog GLBs. It is, on its own, a complete explanation for the platformer capture: look at
`evidence-captures/traversal-study-canvas.png` and note that the two platform tops at different
depths, at different angles, under the same light, are the same green.

**The fix.** Replace the hand-tuned smoothsteps with a sampled ramp LUT, authored as an image rather
than as three magic constants. `texture(uRamp, vec2(ndotl * 0.5 + 0.5, matRow))` — but as established
in §3.2, a 2D LUT with mips blurs material rows together, and `filter: 'nearest'` kills the ramp's
own interpolation (`runtime/webgpu.js:844`). Use a `sampler3D`: `64 × 1 × MATERIAL_COUNT`, linear on
all axes, no mips (`webgpu.js:807-838`). One volume texture serves every material's ramp.

A ramp done well is not a posterised band. It is a **hue-shifting** curve: shadows shift toward the
sky's complement (cool blue-violet under a warm sun), the terminator carries a saturated warm sliver,
and the highlight desaturates toward white. That hue shift across the terminator is most of what
separates a Pixar-tier stylised look from "flat colour times N·L".

**Acceptance criterion (AC-L1).** The authored ramp texture, measured directly as data: the
luminance ratio between its brightest and darkest column must be **≥ 6:1** (today: 1.81:1), and the
hue angle must shift by **≥ 20°** between the darkest and brightest columns. Both are checkable in a
unit test against the LUT constant without rendering anything.

**Effort:** 1 day. **Serves:** traversal-study primarily; the ramp concept also gives combat-arena's
ship shader a controllable falloff.

### 4.2 One directional key light with a real shadow map

Already the top item in `00-VISUAL-DIAGNOSIS.md:132` and `02-REMEDIATION-PLAN.md:203`. Not repeated
here except for two corrections.

**`shadowFactor` is radial, not directional.** Its body is
`distance(worldPos, lightPos) / range` (`shader-functions/library-source.js:711`). To use it for a
sun, place a virtual light at `sceneCentre - sunDirection * D`. The bias budget then scales with
`range`: RGBA16F stores ~11 bits of mantissa, so near a stored value of 0.9 the quantum is ≈0.00049,
which is `0.00049 × range` in world units.

**Concrete bound:** keep `D ≤ 3 × sceneRadius` so `range ≤ 4 × sceneRadius`. For
`point-light-expo` (scene ≈16×11, `point-light-expo/src/presentation.ts:41-44`) that means
`range ≤ 60`, giving ≈0.03 world units of quantisation — comfortably under a contact-shadow bias.
Push `range` to 400 "to be safe" and contact shadows detach, because the quantum becomes 0.2 units.
This is the exact failure the `shadowFactor` doc comment warns about
(`shader-functions/index.d.ts:181-186`) from the other direction.

**Acceptance criterion (AC-L2).** In a captured frame, for a designated prop resting on a designated
surface, the luminance of the ground pixel immediately adjacent to the contact point must be
**≤ 0.55 ×** the luminance of the same surface 2 metres away, and the shadow's own gradient must
cross that ratio within **≤ 12 pixels** (soft, not hard-edged). This one test catches both "no shadow"
and "shadow detached from the object".

**Effort:** 3 days for the first demo, 1 day each after.

### 4.3 Coloured practical lights that actually paint a gradient — point-light-expo

Look at `evidence-captures/point-light-expo-canvas.png`. The pink rock at right and the green rocks at
lower-left are *filled* with colour, not *lit* by it. The audit gives the mechanism:
`reliquary-model.shader.ts:54-61` uses `range = clamp(1 - d²/r², 0, 1); atten = range²` — no `1/d²`,
so **no bright core** (`01-antiky-render-audit.md:96-101`), and the radii (~3.5) cover about a third
of a 16×11 set (`01-antiky-render-audit.md:103`).

Beyond the falloff fix already in the plan, three things make coloured practicals read:

1. **The core must clip.** A practical light should have a small region that saturates to near-white
   at its centre and only shows its hue in the falloff. Colour-at-the-core reads as a coloured ball;
   white-core-with-coloured-falloff reads as a light. This requires the HDR buffer to exist first.
2. **Bounce colour, not just direct.** One extra term: a hemisphere ambient whose *ground* colour is
   tinted by the nearest practical. Costs one `mix` per fragment. This is what makes the ground under
   the amber orb feel warm rather than merely lit.
3. **Shadows cast *away* from each light.** With three lights and one shadow map budget, shadow only
   the strongest contributor per object and accept the approximation. Nobody will notice; everybody
   notices zero shadows.

**Acceptance criterion (AC-L3).** In a captured frame, sample a horizontal line of pixels across a
lit rock face passing through the point nearest a practical light. The luminance profile must be
**monotonic decreasing away from the light for ≥ 80% of samples**, and its total falloff across the
face must be **≥ 2.5:1**. Today the profile is flat. Additionally: hue at the light's centre must be
**within 12° of neutral** while hue at 60% of the light radius must be **within 15° of the light's
authored hue**.

**Effort:** 1.5 days (falloff + core + bounce), on top of the HDR work.

### 4.4 Fake GI: SH-9 irradiance baked from an HDRI

**This is how to actually use the 332 HDRIs, and it needs no texture, no cubemap, and no patch.**

Spherical harmonics of order 2 (9 coefficients, one `vec3` each) reconstruct diffuse irradiance from
any environment to within a few percent. Bake offline in a Node script — project the equirect HDRI
onto the 9 basis functions, emit a TS constant of 27 floats. At runtime, upload 9 `vec3` uniforms and
evaluate:

```
irradiance = c0
  + c1 * n.y + c2 * n.z + c3 * n.x
  + c4 * (n.x*n.y) + c5 * (n.y*n.z) + c6 * (3*n.z*n.z - 1)
  + c7 * (n.x*n.z) + c8 * (n.x*n.x - n.y*n.y);
```

Nine multiply-adds. No texture fetch. It gives every surface an ambient colour that varies with
orientation — a north-facing wall picks up sky, a south-facing one picks up ground bounce — which is
precisely the cue `hemisphereLight` (`shader-functions/index.d.ts:44`) only crudely approximates and
which the current flat constants (`point-light-expo/src/presentation.ts:11-14`, ambient range only
1.8× per `01-antiky-render-audit.md:109`) do not approximate at all.

**Specular IBL is a separate, weaker story.** Only the `sampler3D` LDR path exists (§1.3). Do the
diffuse SH first; it is 90% of the value at 10% of the cost. Add the LDR specular volume later, or
substitute a planar reflection where the surface is flat (§4.5) — which for combat-arena is strictly
better anyway.

**Acceptance criterion (AC-L4).** In a captured frame, pick a convex prop with faces pointing in
several directions. The hue difference between its most sky-facing and most ground-facing lit face
must be **≥ 15°**, and their luminance ratio **≥ 1.8:1**. Today `point-light-expo` measures 1.8:1 on
luminance and 0° on hue (its ambient is a single colour scaled by `0.72 + n.y * 0.2`).

**Effort:** 1 day (bake script + uniform plumbing + shader term), reusable across all three demos.

### 4.5 Planar reflection — the Rocket League tell

Not mentioned anywhere in the doc set. It should be, because it is the single technique that most
separates the combat-arena capture from its reference.

`evidence-captures/combat-arena-canvas.png` shows a matte deck. Rocket League's arena floor is
polished; the ships, the lights and the goal glow all smear across it. `00-VISUAL-DIAGNOSIS.md:108-110`
identifies this correctly and then proposes only "make the floor glossy", which without an
environment to reflect produces a specular highlight and nothing else.

**The arena deck is a single flat plane at a known Y.** That makes planar reflection trivial:
mirror the camera through the plane, render the scene a second time into an RGBA16F target, and
sample it in the floor shader with `targetUv(clipPosition)` — which BroMetal provides specifically
for this class of lookup (`dsl/builtins.d.ts`, `targetUv`; the doc comment explains the NDC/v flip
that otherwise silently mirrors the result).

Costs one extra scene pass at half resolution. The nearest-sampler limitation
(`runtime/webgpu.js:761`) makes the reflection slightly crunchy; blur it by perturbing the lookup
with the floor's normal map, which you want for a roughness read anyway, and the crunch disappears
into the perturbation. If the two-line linear-filter patch
(`02-brometal-capability-audit.md:504-518`) lands, this gets strictly better for free.

**Acceptance criterion (AC-L5).** In a captured frame, sample a vertical line of pixels on the deck
directly below a bright ship or light. Reflected-signal luminance at 1 metre below the object must
be **≥ 0.25 ×** the object's own luminance, decaying to **≤ 0.05 ×** by 4 metres. Additionally the
reflected pixels' hue must be **within 20°** of the reflecting object's hue — which distinguishes a
real reflection from a generic bloom smear.

**Effort:** 2 days. **Serves:** combat-arena. Optionally point-light-expo's floor.

### 4.6 Rim/Fresnel, cloth sheen, and foliage subsurface

**Rim light.** `fresnel()` ships (`shader-functions/index.d.ts:42`) and **not one demo calls it**.
`combat-arena/src/shaders/ship-model.shader.ts:69` computes a rim term and then gates it behind the
emissive parameter at `:74`, so it only appears on dashing ships. LoL rim-lights every champion,
always, in a colour drawn from the environment — it is what separates a character from its
background at 1080p on a busy screen. One line per material shader.

**Cloth sheen for traversal-study.** Fabric's specular is an inverted lobe — brightest at grazing,
which is the opposite of GGX. One line: `sheen = pow(1 - dot(n, v), 4) * ndotl * sheenColour`. Combined
with a fabric normal map (§3.5) this produces the felt-and-corduroy read that is LittleBigPlanet's
entire visual thesis, and it needs nothing BroMetal lacks.

**Wrapped diffuse for foliage and clouds.** The clouds in
`evidence-captures/traversal-study-canvas.png` are pure-white unshaded blobs
(`00-VISUAL-DIAGNOSIS.md:50`) — and the audit shows why: they are 1×1-pixel olive-drab textures
(`03-asset-pipeline-audit.md:132`) blended 90% toward white at runtime
(`traversal-study/src/renderer.ts:307-314`). Wrapped diffuse `(ndotl + w) / (1 + w)` with `w ≈ 0.6`,
plus a back-scatter term `pow(max(dot(v, -l), 0), 6)` tinted warm, gives a cloud a lit rim and a
translucent underside for two lines of shader. Same treatment serves the tree canopy.

**Acceptance criterion (AC-L6).** Silhouette test: for each demo, isolate the player character's
silhouette in a captured frame (it is a known screen position from the presentation code) and measure
the mean luminance of the 3-pixel band just inside the silhouette against the mean luminance of the
character's interior. The rim band must be **≥ 1.6 ×** the interior. Today it is ≈1.0 in all three.

**Effort:** 0.5 day total across all three demos.

### 4.7 Specular anti-aliasing — blocked, and what to do instead

Once §3 lands, every surface has a normal map, and once §4.5 lands the arena floor is glossy. Both
produce specular shimmer under camera motion, and the standard fixes (Toksvig, LEAN mapping,
normal-variance-to-roughness) all require `fwidth(normal)`, which does not exist (§1.2). MSAA does
not help — it never smooths anything inside a triangle
(`01-antiky-render-audit.md:24`) — and it is lost entirely the moment the scene goes to an HDR target
(`runtime/webgpu.js:235`).

**Three workarounds, in order of preference:**

1. **Bake normal variance into the roughness map's mip chain offline.** At pack time, compute per-mip
   normal-vector variance from the normal map and widen the corresponding roughness texel. This is
   Toksvig done on the CPU, ahead of time, and it is fully within reach of the existing per-demo
   asset scripts. It fixes distance shimmer, which is where shimmer actually lives.
2. **Clamp minimum roughness per material.** A floor at roughness 0.15 shimmers; at 0.28 it still
   reads as polished and does not. Author the floor at 0.28. Cheap, and honest — stylised renderers
   do exactly this.
3. **FXAA on the tonemapped result** (already recommended at
   `02-brometal-capability-audit.md:442`). It catches some specular aliasing as a side effect. It is
   not a substitute for 1 and 2.

**Acceptance criterion (AC-L7).** Capture two frames with the camera translated by 0.5 world units.
Register them by the known camera delta, then compute per-pixel luminance difference over the
glossy-floor ROI. The 99th-percentile difference must be **≤ 0.10**. This catches shimmer directly
and is the only way to catch it — a single still frame cannot show it.

**Effort:** 1 day for the offline roughness bake; minutes for the roughness clamp.

### 4.8 Light cookies / gobos

A cookie is a texture projected from the light's point of view, multiplying its intensity. It is the
same maths as a shadow map lookup — `targetUv(lightViewProj * vec4(worldPos, 1))` — with a hand-drawn
texture instead of a rendered depth map, so it costs one texture sample and reuses machinery §4.2
already builds.

**It is the cheapest way to break up a flat floor.** `point-light-expo`'s ground is an 18×12.8 plane
with 24×18 segments (`point-light-expo/src/renderer.ts:75-80`) lit by three small point lights, and
everything outside those three bubbles is ambient-only (`01-antiky-render-audit.md:103`). A dappled
foliage cookie on a weak overhead light turns that dead ambient region into something that reads as
being under a canopy — which is also thematically right, given the wooden arches already in frame.

For `combat-arena`, a cookie is how you get stadium spill: a rectangular soft-edged pattern from
above, tinted per team side.

**Acceptance criterion (AC-L8).** Over the largest continuous ground ROI in the frame, the luminance
histogram must show **≥ 3 distinguishable modes** (peaks separated by ≥ 0.06 luminance with a valley
at least 20% below the lower peak). Today it is unimodal in all three demos.

**Effort:** 0.5 day per demo, after §4.2.

---

## 5. Quality VFX

### 5.1 What is actually on screen today

Every effect in all three demos is an **untextured analytic primitive with a sine-modulated alpha**:

| Demo | Effect | Geometry | File:line |
|---|---|---|---|
| combat-arena | Projectile core + trail | sphere, 12×8 segments | `combat-arena/src/combat-projection.ts:228`, instances at `:118` |
| combat-arena | Targeting rings | torus, `tube: 0.035`, 10×96 segments | `combat-arena/src/combat-projection.ts:229` |
| combat-arena | Contact shadows | **cubes** | `combat-arena/src/combat-projection.ts:240-246` |
| point-light-expo | Light orbs | sphere, 12×8 segments (additive shell) | `point-light-expo/src/renderer.ts:117` |
| point-light-expo | Relay rings | torus, 8 radial segments | `point-light-expo/src/renderer.ts:107-110` |
| traversal-study | Trail particles + wind | sphere, 8×6 segments | `traversal-study/src/renderer.ts:333` |
| traversal-study | Event pulses | torus, `tube: 0.055`, 8×48 | `traversal-study/src/renderer.ts:334` |

Three structural consequences, all visible in the captures:

1. **No VFX element samples a texture.** `arena-glow.shader.ts` and `traversal-glow.shader.ts`
   declare no `sampler2D` at all. Every effect's shape is its mesh silhouette. A 12×8 sphere shows
   its facets — visible on the pink and orange orbs in
   `evidence-captures/point-light-expo-canvas.png`. A `tube: 0.035` torus is a constant-width circle
   with hard edges — the red and blue rings in `evidence-captures/combat-arena-canvas.png`.
2. **Everything breathes on one metronome.** `arena-glow.shader.ts:51` applies
   `sin(uTime * 5 + iPhase * 2.3) * 0.18` to every instance's alpha;
   `traversal-glow.shader.ts:49` does the same at 4.8 rad/s. This is the same defect the camera-shake
   analysis identified so well (`02-REMEDIATION-PLAN.md:132-139`): continuous periodic motion reads
   as malfunction, not as energy.
3. **Traversal's VFX are alpha-blended** (`traversal-study/src/renderer.ts:150`) while the other two
   are additive. Alpha VFX cannot exceed 1.0 and therefore can never bloom. After the HDR work lands,
   traversal will be the one demo whose effects still look flat.

### 5.2 What a good VFX system needs here, technique by technique

**Soft additive billboards with a texture.** The foundation. Replace the sphere/torus meshes with
camera-facing quads sampling a soft radial or authored VFX texture. A quad billboard needs the camera
right/up vectors as uniforms and two attributes; the DSL handles it directly. This single change
converts "faceted polygon ball" into "glow", and it is the highest-value VFX item by a wide margin.

Watch the additive-blend coupling: BroMetal's additive is `(src-alpha, one)`
(`runtime/webgpu.js:351-353`), not `(one, one)`. `combat-projection.ts:118` writes projectile trails
at `alpha: 0.42`, silently scaling their colour by 0.42. Either always write `a = 1` and put intensity
in RGB, or make the coupling deliberate and documented.

**Soft depth fade — blocked, with a workaround that is good enough.** A soft particle fades where it
intersects geometry, which needs the scene depth. Depth attachments cannot be sampled
(`runtime/webgpu.js:763,766-769`) and there is no MRT to write depth alongside colour
(`webgpu.js:142-157, 213-220`). The textbook fix is a linear-depth colour prepass — one extra full
scene draw.

**Do not pay for that yet.** Look at where particles actually intersect geometry in these scenes:
the arena deck (one plane, known Y), the platform tops (a known height function,
`traversal-study/src/renderer.ts` uses `courseTopAt(x, t)`), and the reliquary floor (one plane).
An **analytic plane-distance fade** — computed per-particle on the CPU when the instance is written,
or in the shader from `vWorld.y` against a uniform plane height — covers essentially every visible
intersection at zero GPU cost and no extra pass. Build the depth prepass only if a case appears that
this cannot handle.

**Texture-sheet (flipbook) animation.** An explosion or a smoke puff is a sequence of authored frames
played over the effect's life: `uv = (baseUv + vec2(col, row)) / gridSize`, with `col`/`row` derived
from `floor(life * frameCount)`. Two `texture()` calls plus a `mix` gives sub-frame blending.

**One trap:** BroMetal generates a full mip chain for any texture not created with
`filter: 'nearest'` (`runtime/webgpu.js:844`), and there is no way to cap `mipLevelCount`. A 4×4
flipbook atlas on a 1024² texture will bleed neighbouring cells into each other at coarse mips.
`filter: 'nearest'` avoids it but kills filtering entirely. **The practical answer is one small
texture per effect type rather than one shared atlas** — the mip chain then stays inside a single
cell. The bind-group churn this normally causes
(`02-brometal-capability-audit.md:273-290`) does not bite here because VFX are few draws.

**Distortion / refraction.** Heat haze and shockwave ripples read as expensive and cost almost
nothing: sample the already-rendered HDR scene target at `targetUv(clip) + offset` where the offset
comes from a normal map or `vnoise3(vWorld)` (`shader-functions/index.d.ts:82`). Requires the HDR
target to exist and the effect to be drawn in a second pass that reads it. Very high perceived value
for combat-arena's dashes and impacts.

**Ribbon / trail meshes.** A dash trail should be a continuous ribbon, not a chain of spheres. There
is no line topology (`runtime/webgpu.js:365` — `triangle-list` only) and `draw()` has no sub-range
(`runtime/program.d.ts:29`), so build a fixed-capacity ribbon: N quads, CPU-updated positions from a
history buffer, unused segments collapsed to zero scale. That is exactly the pattern the demos
already use for batches (`traversal-study/src/renderer.ts:414-419`). A tapering ribbon with a
gradient along its length replaces `combat-projection.ts:118`'s two-sphere trail entirely.

**Mesh-based FX.** Not everything should be a billboard. Shockwaves read best as a flat expanding
ring *mesh* with a soft radial gradient and a hard leading edge; energy shields as a sphere with a
Fresnel-driven alpha and a scrolling hex pattern. Both are cheap here because instanced primitive
batches already exist.

**Decals with proper projection.** The player's shadow in
`evidence-captures/traversal-study-canvas.png` reads as *"a hole punched in the platform"*
(`00-VISUAL-DIAGNOSIS.md:37-39`) because it is an opaque squashed sphere
(`traversal-study/src/renderer.ts:425`) whose normals are still spherical
(`01-antiky-render-audit.md:287`). combat-arena's are opaque cubes
(`combat-projection.ts:240-246`). point-light-expo's run through the *lit* path and get **brighter**
near a light (`01-antiky-render-audit.md:134`).

The correct primitive is an unlit, alpha-blended quad with a radial falloff
(`1 - smoothstep(0.6, 1.0, r)`), softening and fading with altitude. `fillAA` and `sdCircle` ship
(`shader-functions/index.d.ts:64,54`). This is a two-hour fix per demo and it is the single most
visible VFX defect in the set.

**Screen-space effects.** Once the HDR target exists: radial blur on dash, chromatic aberration on
damage, a vignette that tightens under threat, and a brief desaturation on death. All are fullscreen
passes reading the scene target. `filmGrain` (`index.d.ts:123`) and the grading helpers
(`index.d.ts:86-98`) are already available.

### 5.3 "AAA VFX" is timing, not shaders

This is the part the doc set omits entirely, and it matters more than any of §5.2.

An effect that reads as expensive has a **shape in time**, not just in space:

- **Anticipation.** A 60–120 ms tell before the payload — a small inward pull, a dimming, a
  contraction. `combat-arena` has telegraph states in the simulation
  (`combat-projection.ts:126-135` reads `enemy.state === 'telegraph'`) but the visual is a ring at
  constant width. The tell exists in the sim and not in the frame.
- **Snap.** The impact frame should be 1–2 frames of extreme value — over-scaled, over-bright,
  possibly a single white frame — then immediately gone. Currently every effect ramps in linearly.
- **Non-linear decay.** `easeOutExpo` (`shader-functions/index.d.ts:100`) or `easeOutBack`
  (`:101`) instead of linear life. Compare
  `traversal-study/src/renderer.ts:434`: `scale = (0.025 + life * 0.11) * min(1, life * 4)` — a linear
  ramp with a linear fade-in. Nothing in it snaps.
- **Separated curves.** Scale, alpha, colour and rotation must each have their own curve. Scale
  should peak and hold; alpha should decay fast; colour should shift from white-hot through the
  effect hue to a dark smoke tone. Today scale and alpha are both driven directly off `life`
  (`renderer.ts:434-435`), so everything grows and brightens together and reads as one blob
  inflating.
- **Secondary motion.** Sparks that outlive the flash. Smoke that drifts after the fire is gone. Two
  or three elements with staggered lifetimes read as one rich effect; one element with one lifetime
  reads as a decal.
- **De-synchronisation.** Kill the shared metronome (`arena-glow.shader.ts:51`,
  `traversal-glow.shader.ts:49`). If a continuous idle pulse is wanted, drive it from a per-instance
  hash of position and index, not from `uTime` alone, and make the period different per effect type.

**Acceptance criterion (AC-V1) — soft edges.** Render a VFX-only capture (scene geometry suppressed).
Along the outer boundary of every effect, the per-pixel luminance gradient must not exceed **0.10 per
pixel** at the capture's native resolution — that is, every effect must fall off over **at least 10
pixels**. Today the ring VFX transition in 1–2 pixels.

**Acceptance criterion (AC-V2) — timing.** A unit test over the presentation/projection layer, no
rendering required. Drive a single impact event through the projection code and record the emitted
instance values per frame. Assert: (a) peak scale is reached within **≤ 3 frames** of the event;
(b) alpha at frame 10 is **≤ 25%** of peak; (c) the scale curve and the alpha curve are **not
proportional** — their Pearson correlation over the effect's life must be **< 0.9**; (d) the effect
emits **≥ 2 distinct elements** with lifetimes differing by **≥ 1.5×**.

**Acceptance criterion (AC-V3) — no metronome.** A static test: no `*.shader.ts` under
`packages/demos/antiky/*/src/shaders/` may apply a `sin`/`cos` of `uTime` to an output alpha without
a per-instance frequency term. Today `arena-glow.shader.ts:51` and `traversal-glow.shader.ts:49` both
fail — both phase-offset per instance but share one frequency, which is exactly the beat problem.

**Acceptance criterion (AC-V4) — textured VFX.** Every VFX program declares and samples at least one
`sampler2D`. Today: zero of the three glow shaders do.

**Effort:** billboards + textures 1.5 days; timing rework 1 day per demo; ribbons 1 day;
distortion 1 day (after HDR); decal fix 0.5 day per demo.

---

## 6. Art-direction brief, per demo

Short, opinionated, and written against the actual captures in `evidence-captures/`.

### 6.1 `point-light-expo` → League of Legends

*Reference frame: `evidence-captures/point-light-expo-canvas.png`.*

**The problem in one sentence.** A lighting showcase where the lights do not light anything, floating
on a hard-edged trapezoid in a black void.

**Palette strategy.** Near-monochrome environment, saturated practicals. The ground and rock should
occupy a narrow desaturated blue-green band (this is roughly where they are now — keep it) and
**every** saturated colour in frame should belong to a light, a relay, or the player. Right now the
rocks are individually tinted pink, green and amber
(`01-antiky-render-audit.md:134` — the tints are flat multiplies over the whole rock), which spends
the frame's entire colour budget on background props. Take the colour off the rocks and put it in the
falloff.

**Value structure.** Deep. This is a night scene. True black at frame edges, mid-values on the ground,
and small blown-out cores at each practical. Currently `00-VISUAL-DIAGNOSIS.md:86` records "one muddy
mid-value green" with no true blacks and no highlights.

**Key / fill / rim.** No key. The practicals *are* the key — that is the demo's premise and it should
be honoured. Fill is SH ambient (§4.4) baked from a night HDRI, kept very low. Rim on the player and
the shades, coloured by the nearest practical, always on. That rim is what makes LoL characters read
against a busy floor.

**Material language.** Wet, slightly specular stone. The Poly Haven scans plus their restored normal
maps (§3.4) plus a low roughness on the moss-free surfaces. Delete the wash-out knobs
(`point-light-expo/src/presentation.ts:21-26`) — they exist to hide a broken lighting model and will
be actively harmful once §4 lands.

**VFX language.** Soft, volumetric, slow. Light orbs become textured billboards with a white-hot core
and a coloured halo (§5.2) — never a 12×8 sphere (`point-light-expo/src/renderer.ts:117`). Relay
rings become soft-edged expanding shockwave meshes with a taper, not 8-segment tori
(`renderer.ts:107-110`). Add drifting motes lit by the practicals; they cost one small batch and they
are most of what makes a MOBA jungle feel like a place.

**Also, non-negotiable:** kill the void. Add a horizon and fog that eats the ground plane's edge
(`fog.maximumMix` is 0.34 today, per `01-antiky-render-audit.md:160`, so the edge stays visible
whatever the fog does). And re-skin the `PRISM FRACTURED` overlay — a 1px red border with terminal
type reads as debug output.

### 6.2 `combat-arena` → Rocket League

*Reference frame: `evidence-captures/combat-arena-canvas.png`.*

**The problem in one sentence.** A well-built arena rendered entirely inside a 15–35% luminance band
with nothing glossy, nothing casting, and a perimeter of yellow noodles.

**Palette strategy.** Cool neutral stadium, two hot team colours, one accent. The blues currently
doing structural duty should desaturate toward neutral steel so the red and cyan team signals own all
the saturation in frame. The yellow cable loops around the rim
(`00-VISUAL-DIAGNOSIS.md:114-116`) are a third saturated hue competing with both teams — delete them,
as the plan already says (`02-REMEDIATION-PLAN.md:267`).

**Value structure.** Widest of the three. Near-black in the upper structure and off-arena space,
mid-values on the deck, and genuine blown highlights on the ships' specular and the goal glow. The
current 15–35% band is the single most fixable thing about this frame.

**Key / fill / rim.** One committed overhead key with a shadow map (§4.2), warm-neutral. Fill from SH
ambient baked from a studio HDRI, cool. Rim on every ship, team-coloured, always on — ungate
`ship-model.shader.ts:69,74`. Add two coloured practicals at the goal ends for spatial orientation.

**Material language.** Glossy painted metal. The deck is the star: low roughness, planar reflection
(§4.5), and a normal map so the reflection has something to break against. The Kenney rim structure
goes triplanar metal with procedural trim (§3.3) and a `fbm3`-masked rust blend, and — as
`00-VISUAL-DIAGNOSIS.md:114-116` says — needs scale and rotation discipline imposed before any of
that will read as architecture rather than debris.

**VFX language.** Fast, hard, punchy. Short-lived, high-contrast, heavily bloomed. Ribbon trails on
projectiles instead of sphere chains (§5.2). Impact = one over-bright frame, then a distortion ring
(§5.2), then sparks that outlive the flash. Targeting rings become textured decals projected onto the
deck with a soft edge and an animated sweep, not `tube: 0.035` tori
(`combat-projection.ts:229`). Every contact shadow stops being a cube
(`combat-projection.ts:240-246`).

**Camera.** Commit. `00-VISUAL-DIAGNOSIS.md:119-121` is right that the current framing is neither a
readable tactical view nor a cinematic chase. Rocket League sits low and long-lensed; the current
46.8° FOV at 13.4 units (`01-antiky-render-audit.md:221`) is a diagram.

### 6.3 `traversal-study` → LittleBigPlanet

*Reference frame: `evidence-captures/traversal-study-canvas.png`.*

**The problem in one sentence.** Flat-colour geometry on a flat-colour sky, with the material that is
the reference's entire identity completely absent.

**Palette strategy.** Warm, hand-made, tertiary. LBP's palette is craft-materials — kraft brown,
felt green, denim blue, ochre — not the primary green/orange/blue in the capture. Keep the *hue
relationships* (green top, warm side) and push every hue toward a tertiary, lower-chroma version. The
sky becomes a gradient with a warm horizon, not `clearColor: [0.38, 0.57, 0.68]`
(`traversal-study/src/renderer.ts:297`).

**Value structure.** Bright and airy, but with real darks in the material — stitching, seams, the
undersides of platforms, deep AO in every crevice. Currently there is no dark anywhere except the
player's hole-punch shadow.

**Key / fill / rim.** Strong warm sun key at a committed angle with a soft shadow map — this scene
should have the most obvious shadows of the three, because LBP's soft shadows are half its charm.
Cool sky fill from SH (§4.4). Warm bounce from below, off the ground. Rim is subtle here; the sheen
(§4.6) does the silhouette work instead.

**Material language.** **This is the whole demo.** Fabric weave, cardboard corrugation, felt, cork,
plywood — triplanar-projected (§3.1) with material-ID routing (§3.2) onto the catalog materials
listed in §3.5. Cloth sheen (§4.6). Heavy detail normals (§3.3). Delete the `uGradeMix` constants at
`traversal-study/src/renderer.ts:307-314` that currently replace 90% of the cloud texture and 78% of
the cliff texture with flat colour — they exist to hide the palette collapse and become harmful the
moment real materials arrive.

**VFX language.** Soft, physical, papery. Dust puffs on landing, not tori
(`renderer.ts:334`). Fabric-fibre motes in the air. Coin collection = a small burst of paper-confetti
billboards with real gravity and rotation. Everything alpha-blended and soft — but split the
*emissive* effects (checkpoint glow, delivery pulse) into an **additive** batch so they can bloom;
today the single `blend: 'alpha'` program at `renderer.ts:150` makes that impossible.

**Composition and the HUD.** `00-VISUAL-DIAGNOSIS.md:46-48` is right: ~60% dead sky, dead
bottom-right, and a HUD that is a cluster of coloured 3D boxes floating in the sky at upper-left. The
HUD is drawn as world-space cubes (`traversal-study/src/renderer.ts:332`) and reads as broken
geometry. Move it out of the world, or commit to it as diegetic and put it on a physical object.

---

## 7. Ranked work order

Ordered by **visual gain per unit of effort**. Effort is engineer-days for a competent pass. Items
marked ⛓ have a prerequisite.

| # | Item | § | Effort | Serves | AC |
|---|---|---|---|---|---|
| 1 | Tiling detail normal, triplanar, on everything | 3.3 | 0.5 d | all three | AC-M3 |
| 2 | Fix decal/contact shadows: unlit, soft-edged, alpha | 5.2 | 0.5 d/demo | all three | AC-V1 |
| 3 | Rim/Fresnel always-on; cloth sheen; wrapped diffuse | 4.6 | 0.5 d | all three | AC-L6 |
| 4 | SH-9 irradiance baked from a catalog HDRI | 4.4 | 1 d | all three | AC-L4 |
| 5 | Ramp LUT lighting via `sampler3D` | 4.1 | 1 d | traversal | AC-L1 |
| 6 | Triplanar PBR material path | 3.1 | 1.5 d + 0.5 d/demo | all three | AC-M1 |
| 7 | Material-ID routing into UV-V + LUT | 3.2 | 1 d | traversal, arena | AC-M2 |
| 8 | Textured soft billboards for all VFX | 5.2 | 1.5 d | all three | AC-V4, AC-V1 |
| 9 | VFX timing rework (curves, snap, secondary, de-sync) | 5.3 | 1 d/demo | all three | AC-V2, AC-V3 |
| 10 | Directional key + shadow map ⛓(HDR target) | 4.2 | 3 d + 1 d/demo | all three | AC-L2 |
| 11 | Point-light falloff, hot core, coloured bounce ⛓(HDR) | 4.3 | 1.5 d | point-light-expo | AC-L3 |
| 12 | Catalog material intake (4 maps, hash-verified) | 3.5 | 1 d | all three | AC-M4 |
| 13 | Light cookies / gobos ⛓(#10) | 4.8 | 0.5 d/demo | all three | AC-L8 |
| 14 | Procedural world-space trim | 3.3 | 1 d | combat-arena | AC-M1 |
| 15 | Planar reflection on the arena deck ⛓(HDR) | 4.5 | 2 d | combat-arena | AC-L5 |
| 16 | Ribbon trail meshes | 5.2 | 1 d | arena, traversal | AC-V1 |
| 17 | Distortion/refraction pass ⛓(HDR) | 5.2 | 1 d | combat-arena | — |
| 18 | Offline normal-variance → roughness bake | 4.7 | 1 d | all three | AC-L7 |

Items 1–9 need **no** HDR buffer and no BroMetal patch. They can start immediately and in parallel
with the Phase 0/1 work in `02-REMEDIATION-PLAN.md`. That is roughly 12 engineer-days of independently
verifiable work available today.

### 7.1 Frame-level value targets

The numbers `02-REMEDIATION-PLAN.md:332-334` asks for but does not supply. Luminance is Rec.709 luma
of the sRGB-encoded output pixel, normalised 0–1, measured over the whole canvas.

| Demo | P5 ≤ | P50 in | P95 ≥ | P95−P5 ≥ | Clipped (≥0.995) ≤ |
|---|---|---|---|---|---|
| `point-light-expo` | 0.05 | 0.18–0.32 | 0.80 | 0.72 | 2.0% |
| `combat-arena` | 0.04 | 0.20–0.34 | 0.88 | 0.80 | 2.5% |
| `traversal-study` | 0.12 | 0.38–0.52 | 0.90 | 0.72 | 1.5% |

Plus, for all three: **≥ 3 distinguishable hue clusters** in the chroma histogram (peaks separated by
≥ 25° with a valley at least 25% below the lower peak), and **no single hue cluster occupying > 55%**
of the chromatic pixels. The first catches monochrome mud; the second catches the "everything is one
green" failure in the point-light-expo capture.

### 7.2 Harness

All of the above is measurable from a captured canvas frame. The tooling exists — the Studio project
service exposes `capture_frame` (`packages/studio/tauri/target/release/project-service/project-service.mjs:2446`)
and `02-REMEDIATION-PLAN.md:324` already proposes `npm run demos:shoot`. Land that first; every AC
above becomes a test the moment it exists.

The ACs split cleanly into three kinds, which is what makes them parallelisable:

- **Static-source tests** (no rendering): AC-M2, AC-M3, AC-V3, AC-V4, AC-L1. Cheap, fast, run in CI.
- **Presentation-layer tests** (no rendering): AC-V2. Runs against the projection code the demos
  already unit-test (`combat-arena/tests/presentation.test.ts:62` is the existing precedent).
- **Frame-capture tests**: AC-M1, AC-M4, AC-L2 through AC-L8, AC-V1, and §7.1. Need the capture loop.

---

## 8. What I would not do

- **Do not chase specular IBL through a `sampler3D` before doing SH irradiance and planar
  reflection.** It is LDR-only (§1.3), it is fiddly, and the two cheaper techniques cover the cases
  that matter in these three scenes.
- **Do not re-UV any kit in Blender.** Triplanar makes it unnecessary, and hand-UV work does not
  survive an asset refresh.
- **Do not buy assets.** The revised split (§1.1) puts the genuine asset ceiling at ~10%. Re-measure
  after items 1–9 land; the question will look completely different, and it may well be answered.
- **Do not build a shared render or material package.** Three hand-rolled implementations that
  converge on their own is the owner's stated process, and it is the right one here. Copy the
  triplanar block into each demo. It is forty lines.
- **Do not add SSAO, DOF or TAA.** All three need sampled depth or history reprojection; both are
  blocked or painful (`02-brometal-capability-audit.md:520-541`, `:170-174`), and baked AO plus the
  techniques above deliver more for a fraction of the cost.
