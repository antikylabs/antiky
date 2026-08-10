# Asset Pipeline Audit — antiky demos

Scope: `packages/asset-catalog`, the per-demo intake/derivation scripts, the shipped `.glb` payloads,
and how the four antiky demos consume them. All line references are file:line at audit time.

**Headline:** the catalog is a *metadata registry with a verified downloader*. It does no mesh or
texture processing whatsoever. All actual asset processing lives in three hand-rolled per-demo
scripts, and two of the three actively **reduce** fidelity — one of them collapses whole models to a
1–7 pixel color strip. Combined with a renderer that has no shadows, no ambient occlusion, no
normal mapping, no IBL and no post-processing, the "blocky and gross" impression is roughly
**40% asset ceiling, 60% pipeline + rendering**. The pipeline half is fixable without buying a
single new asset.

---

## 1. `packages/asset-catalog` — what it actually is

### 1.1 It is a catalog, not a pipeline

`packages/asset-catalog/README.md:1-15` states the package "owns the catalog schema, committed source
metadata, build-time crawlers, and the static JSON API." That is literally all it does. `npm run
build` (`package.json:13`) runs `scripts/build-static-api.mjs`, which writes JSON documents. There is
**no** decimation, **no** texture format conversion, **no** atlasing, **no** GLB optimization,
**no** LOD generation, **no** normal-map or tangent generation, and **no** material authoring
anywhere in the package.

The only image processing in the entire package is thumbnail resizing for the catalog website:
`scripts/generate-previews.mjs:18` — `sharp(...).resize(256,256).webp({quality:72})`. That touches
preview thumbnails only, never a shipped runtime asset.

### 1.2 Sources and volume

| Snapshot | Count | Providers | Kinds | Verification |
| --- | --- | --- | --- | --- |
| `data/poly-haven.generated.json` | 995 | poly-haven | 332 hdri / 332 texture / 331 model | `source-verified` |
| `data/curated-sources.generated.json` | 294 | kenney, quaternius | 143 sprite / 132 model / 10 audio / 8 texture / 1 font | `source-verified` |
| `data/community-sources.generated.json` | 161 | kaykit, open-duelyst, screaming-brain-studios | 114 sprite / 28 texture / 17 model / 2 audio | `source-verified` |
| Hand-written starters (`src/catalog-data.ts:15-64`) | 3 | poly-haven | 1 model / 1 texture / 1 hdri | `install-verified` |

Crawlers: `src/providers/kenney-client.ts` (scrapes `kenney.nl/assets`, hard-refuses anything not
explicitly CC0 at `kenney-client.ts:38`), `src/providers/quaternius-client.ts` (same CC0 gate at
`quaternius-client.ts:31`), `src/providers/poly-haven-client.ts` (uses the real
`api.polyhaven.com` JSON API).

### 1.3 Licensing

Uniformly clean. Every asset in every snapshot is `cc0-1.0` with `permitsModification: true` and
`permitsRedistribution: true` (`src/providers/poly-haven.ts:81-88`, `src/providers/curated.ts`).
Poly Haven carries a soft attribution notice for API use only (`poly-haven.ts:9-10`). Licensing is
**not** a constraint on anything proposed below.

### 1.4 The only real "processing": the installer

`src/node/install.ts` is a careful, security-conscious downloader: path-traversal guards
(`install.ts:16-31`), a project-root manifest check (`install.ts:33-39`), a 64 MB cap, size check and
upstream MD5 verification (`install.ts:45-63`), atomic temp-dir-then-rename
(`install.ts:80,109-111`), and a receipt appended to `assets/antiky-assets.json` (`install.ts:113-144`).

It writes provider bytes to disk **verbatim**. That is the correct boundary — but it means every
quality decision is downstream, in per-demo scripts, and nothing enforces consistency between them.

**Notable gap:** only `install-verified` assets can be installed (`install.ts:71-73`), and only the
3 hand-written starters carry that status. The 1,450 crawled assets are all `source-verified` with
`downloads: []` (`src/generated-catalog.ts:21`). So *nothing in the crawled catalog is actually
installable through the catalog's own installer.* Every demo asset was brought in by a bespoke
script instead.

---

## 2. The "derived assets" step — three different, inconsistent scripts

There is no shared derivation layer. Each demo grew its own.

### 2.1 `point-light-expo/scripts/pack-catalog-models.mjs` + `gltf-pack-lib.mjs` — the good one

Reads a Poly Haven external `.gltf` + `.bin` + JPEG textures, verifies an exact URI allowlist
(`gltf-pack-lib.mjs:17-42`), picks one mesh, and repacks into a self-contained GLB with the diffuse
and ARM (occlusion/roughness/metal) JPEGs embedded as buffer views
(`gltf-pack-lib.mjs:78-110`). Geometry, normals, UVs and indices are copied byte-for-byte
(`pack-catalog-models.mjs:123`).

**It strips one thing — the normal map:**

```js
// gltf-pack-lib.mjs:89
delete material.normalTexture;
```

Rationalized at `pack-catalog-models.mjs:126`: *"Omit the tangent-space normal binding because the
runtime shader has no tangent basis."* The `*_nor_gl_1k.jpg` files are downloaded, hashed, committed
to the repo, listed in the allowlist (`pack-catalog-models.mjs:23,43,63`) — and then never bound.
This is a **renderer limitation leaking backwards into the asset pipeline**, and it costs the highest
fidelity assets in the repo all of their surface micro-detail. Same for the forest floor: only
diff/ao/rough are wired into the build (`point-light-expo/vite.config.ts:6-8`); the downloaded
`forest_floor_nor_gl_1k.jpg` is dead weight.

### 2.2 `combat-arena/scripts/intake-quaternius-ships.mjs` — neutral

SHA-256 verifies each source file (`:83-87`), converts an embedded base64 data-URI buffer into a
proper GLB BIN chunk, and substitutes the chosen official color variant PNG
(`:111-145`). Geometry, materials and UVs are untouched. It also derives ship footprints via
brometal's parser for the simulation (`:147-175`). This is the least destructive script and it
produces the best-looking assets in the repo.

### 2.3 `traversal-study/scripts/normalize-quaternius.mjs` — **the fidelity destroyer**

This script bakes node transforms and skinning (`:204-279`), which is genuinely necessary because
brometal's parser ignores `json.nodes` entirely (see §3.1). But it also does this:

```js
// normalize-quaternius.mjs:218-220
const colors = (json.materials ?? [{ pbrMetallicRoughness: { baseColorFactor: [1,1,1,1] } }])
  .map((material) => material.pbrMetallicRoughness?.baseColorFactor ?? [1,1,1,1]);
```

```js
// normalize-quaternius.mjs:238, 267
const paletteU = (materialIndex + 0.5) / colors.length;
...
uvs.push(paletteU, 0.5);
```

It **discards every source UV coordinate** and replaces them with a lookup into an `N × 1` pixel PNG
built from `baseColorFactor` alone (`createPalettePng`, `:32-52`). `json.images` and `json.textures`
are never read. Every material becomes exactly one pixel. The entire model's surface information is
compressed to at most 7 colors.

Measured output (decoded from the shipped GLBs):

| Model | Palette | Colors |
| --- | --- | --- |
| `cloud-large.glb`, `cloud-small.glb` | 1×1 | `#909781` |
| `coastal-cliff.glb` | 1×1 | `#62351c` |
| `coastal-tree.glb` | 2×1 | `#60340f`, `#122710` |
| `courier.glb` | 6×1 | `#004eff #cc792b #386e75 #020202 #909781 #02070d` |
| `relay-tower.glb` | 7×1 | `#1c1817 #60340f #895016 #0f0d0f #020202 #2e2e2e #510302` |

Note the clouds are **olive-drab**, not white. The renderer then compensates by blending them 90%
toward white — see §3.3. That is a hack papering over a broken extraction.

**Two concrete bugs in this path:**

1. **Palette bleeding.** The generated GLB declares `magFilter/minFilter: 9728` (nearest) and
   `wrapS/wrapT: 33071` (`normalize-quaternius.mjs:325`), but brometal ignores glTF samplers
   completely and creates its own with `filter = 'linear'` plus a full mip chain
   (`node_modules/brometal/dist/runtime/webgpu.js:844-856`; the demo passes only
   `{flipY:false, anisotropy:4}`, `traversal-study/src/renderer.ts:216`). For the 6-pixel courier
   palette, `mipLevels = floor(log2(6)) + 1 = 3` — mip 1 averages adjacent palette entries, mip 2
   averages all six into one mud color. Adjacent palette swatches bleed into each other at
   *every* mip level and at texel edges. The courier's blue, orange and teal literally smear together
   at distance.
2. **Silent texture loss if the source ever has one.** Because `json.images`/`json.textures` are
   never consulted, any Quaternius pack shipped with an atlas would come out pure white with no
   error. The Ultimate Platformer pack happens to be material-color-based
   (`traversal-study/README.md:107-108` calls them "color-material primitives"), so this is latent
   rather than active — but it is a landmine.

---

## 3. What is actually shipped — measured GLB inventory

Parsed directly from the JSON chunks of every `.glb` under `packages/demos/antiky/*/assets/`.
(`dist/` copies are byte-identical and omitted.)

| File | Verts | Tris | Prims | Attributes | Mats | Textures shipped | Image |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **point-light-expo (Poly Haven, derived)** |
| `derived/dead-tree-trunk-runtime.glb` | 52,593 | 101,802 | 1 | POS+NRM+UV | 1 | baseColor + metalRough | 2× 1024² JPEG |
| `derived/tree-stump-01-runtime.glb` | 22,472 | 41,046 | 1 | POS+NRM+UV | 1 | baseColor + metalRough | 2× 1024² JPEG |
| `derived/rock-moss-set-01-runtime.glb` | 8,538 | 16,548 | 1 | POS+NRM+UV | 1 | baseColor + metalRough | 2× 1024² JPEG |
| **combat-arena (Quaternius ships)** |
| `spitfire-blue.glb` | 4,107 | 3,512 | 1 | POS+NRM+UV | 1 | baseColor only | 2048² PNG |
| `striker-red.glb` | 4,911 | 4,530 | 1 | POS+NRM+UV | 1 | baseColor only | 2048² PNG |
| `executioner-red.glb` | 3,819 | 3,388 | 1 | POS+NRM+UV | 1 | baseColor only | 2048² PNG |
| `imperial-red.glb` | 3,673 | 2,642 | 1 | POS+NRM+UV | 1 | baseColor only | 2048² PNG |
| `omen-orange.glb` | 1,781 | 1,426 | 1 | POS+NRM+UV | 1 | baseColor only | 2048² PNG |
| **combat-arena (Kenney kits)** |
| `modular-space-kit/room-small.glb` | 8,184 | 4,876 | 1 | POS+NRM+**TAN**+UV | 1 | baseColor only | 512² palette PNG |
| `modular-space-kit/template-floor-layer.glb` | 856 | 548 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `modular-space-kit/cables.glb` | 800 | 400 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `blaster-kit/grenade-a.glb` | 340 | 200 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `blaster-kit/target-detail.glb` | 260 | 164 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| **traversal-study (Kenney platformer kit)** |
| `tree.glb` | 800 | 408 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `trap-spikes.glb` | 272 | 168 | **2** | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `block-grass-overhang-long.glb` | 236 | 132 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `block-moving.glb` | 216 | 136 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `flag.glb` | 194 | 110 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `coin-gold.glb` | 176 | 124 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| `block-grass-large.glb` | 168 | 92 | 1 | POS+NRM+TAN+UV | 1 | baseColor only | 512² palette PNG |
| **traversal-study (Quaternius, palette-normalized)** |
| `relay-tower.glb` | 3,658 | 2,732 | 1 | POS+NRM+UV | 1 | baseColor only | **7×1 PNG** |
| `coastal-tree.glb` | 1,915 | 2,688 | 1 | POS+NRM+UV | 1 | baseColor only | **2×1 PNG** |
| `courier.glb` | 1,895 | 2,908 | 1 | POS+NRM+UV | 1 | baseColor only | **6×1 PNG** |
| `cloud-small.glb` | 393 | 574 | 1 | POS+NRM+UV | 1 | baseColor only | **1×1 PNG** |
| `cloud-large.glb` | 339 | 508 | 1 | POS+NRM+UV | 1 | baseColor only | **1×1 PNG** |
| `coastal-cliff.glb` | 306 | 464 | 1 | POS+NRM+UV | 1 | baseColor only | **1×1 PNG** |

Cross-cutting facts:

- **Zero vertex colors** (`COLOR_0`) anywhere. Zero `TEXCOORD_1` (no lightmap/AO channel).
- **Zero normal maps, zero metallic-roughness maps outside point-light-expo.** Zero emissive maps.
  Zero occlusion maps.
- Every file has exactly **one material**. There is no per-material assignment to lose, because the
  Kenney/Quaternius kits are single-material to begin with (Kenney via a shared palette atlas,
  Quaternius ships via a single 2K albedo, Quaternius platformer via the palette collapse).
- The Kenney kits **do** ship `TANGENT` attributes — which the demos ignore entirely, and which the
  point-light-expo path claims not to have (§2.1).
- `trap-spikes.glb` also carries 3 animations; nothing consumes them.

### 3.1 How much texture information is really there?

Counting distinct UV coordinates per mesh tells the whole story:

| Model | Verts | **Unique UVs** | Interpretation |
| --- | --- | --- | --- |
| `block-grass-large.glb` (Kenney) | 168 | **5** | 5 flat swatches |
| `tree.glb` (Kenney) | 800 | **18** | 18 flat swatches |
| `room-small.glb` (Kenney) | 8,184 | **40** | 40 flat swatches |
| `spitfire-blue.glb` (Quaternius ship) | 4,107 | **1,521** | genuine unwrapped albedo |

The Kenney "512×512 colormap.png" is a palette grid, not a texture. An 8,184-vertex Kenney room has
exactly **40 colors** of surface information. Sampling a 512² image to fetch 40 constants is pure
overhead — and it means those models are, in information-theoretic terms, flat-shaded regardless of
what the renderer does.

---

## 4. How the demos consume the assets

### 4.1 They do use the GLB's own base-color texture — they do not throw it away

All three consumers load the embedded image and bind it:

- `combat-arena/src/ship-assets.ts:77-96` — requires `mesh.imageIndex !== null`, uploads it, binds
  `uTex`.
- `combat-arena/src/arena-assets.ts:80-99` — same.
- `traversal-study/src/renderer.ts:205-232` — uploads every embedded image, binds per mesh.
- `point-light-expo/src/reliquary-models.ts:117-134` — binds *two* textures (`uDiffuse`, `uArm`).

So the premise "they discard the GLB materials and apply a flat tint" is **half true**. The base
color texture survives. What does not survive:

**a) Everything except base color is dropped by the parser.** brometal's `Model` type
(`node_modules/brometal/dist/models/glb.d.ts:10-32`) has fields for positions, normals, uvs, indices
and a single `imageIndex`. `materialImage()` (`glb.js:138-146`) reads only
`pbrMetallicRoughness.baseColorTexture`. Normal maps, MR maps, occlusion, emissive, `baseColorFactor`,
`metallicFactor`, `roughnessFactor`, alpha mode, double-sidedness — none of it reaches the runtime.
point-light-expo works around this by binding the second texture *by name* from `model.images`
(`reliquary-models.ts:77-81, 125-126`) rather than through any material.

**b) Node transforms are silently ignored.** `parseGlb` never reads `json.nodes`
(`glb.js:147-184` iterates `json.meshes` directly). Any GLB with non-identity node TRS assembles
wrong. This is exactly why `normalize-quaternius.mjs` exists — and why it then went on to destroy
the UVs.

**c) Per-primitive material assignment is preserved but unused in practice.** `parseGlb` emits one
`ModelMesh` per primitive with its own `imageIndex`, and `traversal-study/src/renderer.ts:242-246`
correctly makes one draw call per primitive. But `arena-assets.ts:76` and `ship-assets.ts:73` take
`model.meshes[0]` only. Since every shipped file has exactly one material this loses nothing today —
but `trap-spikes.glb` has 2 primitives, and only traversal-study handles it.

**d) Everything is multiplied by a flat per-instance tint.**

- `ship-model.shader.ts:70-74`: `texture(uTex, vUv)` is lit, then an emissive `vTint` term is added.
  Reasonable.
- `arena-model.shader.ts:66`: `texture(uTex, vUv).xyz.mul(vTint)` — direct multiply.
- `reliquary-model.shader.ts:168`: `clamp(lifted,0,1).mul(vTint)`.
- `traversal-model.shader.ts:53-54`: `mix(texel, uGradeColor, uGradeMix).mul(uTint).scale(band)`.

### 4.2 The traversal-study grade uniforms are compensating for the palette collapse

`traversal-study/src/renderer.ts:307-314`:

| Batch | `gradeColor` | `gradeMix` | Effect |
| --- | --- | --- | --- |
| `cloud-small`, `cloud-large` | `[0.96, 0.98, 1]` | **0.90** | 90% replaced by white — the palette color is ignored |
| `coastal-cliff` | `[0.30, 0.45, 0.55]` | **0.78** | brown palette overridden with blue-grey |
| `spikes` | `[0.92, 0.22, 0.09] ` | 0.62 | overridden orange-red |
| `relay-tower` | `[0.64, 0.71, 0.74]` | 0.38 | pushed grey |
| `coastal-tree` | `[0.18, 0.38, 0.24]` | 0.28 | pushed green |

For the clouds and the cliffs, the shipped asset color is essentially discarded at runtime and
replaced with a hardcoded constant. The asset pipeline produced the wrong color, and the renderer
was tuned to hide it. Six of thirteen traversal-study models are, at draw time, **a single flat
constant color with a three-band posterized directional light**:

```js
// traversal-model.shader.ts:50-52
const diffuse = max(dot(normal, light), 0);
const band = 0.54 + smoothstep(0.18,0.25,diffuse)*0.2 + smoothstep(0.62,0.7,diffuse)*0.24;
```

That is the visual definition of "blocky and gross." It is not the asset's fault — Quaternius clouds
have perfectly fine authored colors — it is the palette normalizer plus a deliberately posterized
shader.

### 4.3 point-light-expo actively flattens its own best albedo

`reliquary-model.shader.ts:164-168` with `presentation.ts:21-26`
(`textureContrast: 0.78`, `diffuseLift: 0.14`, `saturation: 0.9`):

```js
const saturated = mix(luminance, sourceBase, 0.9);          // -10% saturation
const lifted    = mix(vec3(0.48), saturated, 0.78)          // -22% contrast toward mid-grey
                    .add(vec3(0.14));                        // +0.14 black lift
```

The only genuine 1K PBR albedo in the repo is desaturated 10%, contrast-reduced 22% and black-lifted
before it is ever lit. Combined with the deleted normal map (§2.1), the highest-fidelity assets in
the project are being run through a wash-out filter.

---

## 5. The mismatch question — how much is asset fidelity?

### 5.1 The honest ceiling of these kits

| Source | Ceiling | Why |
| --- | --- | --- |
| **Kenney kits** (platformer, blaster, modular-space) | **Low.** Chunky stylized props at ~200–8k tris, whose entire surface signal is 5–40 flat palette swatches. No amount of lighting makes a 5-color cube read as LoL-tier. | Palette-atlas authoring by design |
| **Quaternius Ultimate Platformer** | **Low as shipped, medium if repaired.** Source materials are flat colors — but they are *authored* flat colors with an artist's palette. The palette collapse + posterized shader throws away the authoring. | Material-color kit |
| **Quaternius Ultimate Spaceships** | **Medium-high.** 1.8k–4.9k tris with genuine 2048² unwrapped albedo and 1,500+ unique UVs. This is the one kit in the repo that *can* look like Rocket League with better lighting. | Textured kit |
| **Poly Haven scans** | **High.** 8.5k–52.6k tris, 1K PBR diffuse + ARM, and a normal map sitting unused on disk. | Photogrammetry |
| **antiky-town atlases** | **Medium-high.** 1254², 1672×940 and 1536×1024 hand-built albedo atlases with real per-tile materials (`antiky-town/assets/textures/town-material-atlas-v1.json`), plus the only post-processing pass in the repo (`antiky-town/src/town/shaders/town-post.shader.ts`). | The one demo that took a different route |

**LittleBigPlanet is achievable with the current assets. League of Legends and Rocket League are
not — not because of poly count, but because both rely on material response** (LoL: painted albedo
with strong hand-placed AO and rim; Rocket League: glossy PBR with reflections and dynamic
shadows). Kenney flat-palette geometry cannot produce either signal.

### 5.2 Split of blame — concrete

**Asset fidelity: ~40%.** Kenney kits are a genuine hard ceiling. If the target is LoL/Rocket League,
`kenney/platformer-kit` and `kenney/blaster-kit` need to be replaced regardless of what the renderer
does.

**Pipeline: ~25%.** All self-inflicted, all fixable with no new assets:
1. `normalize-quaternius.mjs:238,267` — UV destruction, 6 of 13 traversal models reduced to flat
   constants. **Worst single defect in the pipeline.**
2. `gltf-pack-lib.mjs:89` — normal maps deleted from the only PBR assets in the repo.
3. Palette mip bleeding — `webgpu.js:844-856` builds mips for a 6-pixel texture that declares
   `nearest` in its own sampler.
4. `presentation.ts:21-26` — deliberate wash-out of the best albedo.
5. Kenney `TANGENT` attributes shipped and ignored.

**Rendering / lighting / post: ~35%.** Verified absent across combat-arena, point-light-expo and
traversal-study (grep for `shadowMap|depthTexture|bloom|postProcess|renderTarget` returns only
`antiky-town/src/town/shaders/town-post.shader.*`):
- **No shadow maps at all.** Objects float. This alone accounts for a large share of "flat."
- **No ambient occlusion**, screen-space or baked. `reliquary-model.shader.ts:162` derives a fake AO
  from the ARM texture's red channel — that is the only occlusion signal anywhere.
- **No image-based lighting / environment reflections.** The catalog holds **332 CC0 HDRIs** and not
  one of them is used at runtime.
- **Hardcoded 1–2 directional lights** with no falloff model: `ship-model.shader.ts:65-66`,
  `arena-model.shader.ts:61`, `traversal-model.shader.ts:49`. Only point-light-expo has real point
  lights with GGX (`reliquary-model.shader.ts:44-62`).
- **No bloom / no post chain** outside antiky-town. ACES is applied per-fragment
  (`ship-model.shader.ts:78`) rather than as a resolve pass, so there is no place to add bloom,
  vignette, chromatic aberration or color grading.
- **Color space is unmanaged.** Textures upload as `rgba8unorm` — not `-srgb`
  (`webgpu.js:836-842`) — while the swapchain uses `getPreferredCanvasFormat()`
  (`webgpu.js:79-80`), which is spec-restricted to `bgra8unorm`/`rgba8unorm`. So sRGB-encoded PNGs
  and JPEGs are lit as if they were linear, with no decode and no encode. Diffuse falloff comes out
  too steep, shadow terminators crush, midtones read plastic. The `uDiffuseLift`/`uTextureContrast`
  knobs in point-light-expo are almost certainly manual compensation for exactly this.

---

## 6. What would raise the ceiling

### 6.1 Free wins that need no new assets (do these first — highest ratio by far)

1. **Fix `normalize-quaternius.mjs` to preserve source UVs and bake a real atlas**, or at minimum
   emit an N×N palette with padded texel blocks and force `filter: 'nearest'` at
   `traversal-study/src/renderer.ts:216`. Then delete the `gradeMix` hacks at `renderer.ts:307-314`
   and let the authored colors show.
2. **Add sRGB handling.** Either upload base-color textures as `rgba8unorm-srgb` or decode in-shader.
   This is a one-line change per texture creation and it changes the look of all four demos.
3. **Add a single cascaded shadow map.** Highest visual return per line of code in the whole project.
   No shadows is the single largest "not AAA" tell.
4. **Restore the normal maps.** Kenney models already ship `TANGENT`; for Poly Haven, either generate
   tangents at intake or use a screen-space derivative tangent basis (`dFdx`/`dFdy`) — the latter
   needs no asset change at all and would let `gltf-pack-lib.mjs:89` be deleted.
5. **Use the HDRIs already in the catalog.** 332 CC0 HDRIs are cataloged. Prefilter one into a small
   irradiance SH set + a specular mip chain. Environment reflections are the single biggest
   difference between "Rocket League" and "student WebGL demo."
6. **Add a resolve pass with bloom + grade.** Move ACES out of the per-object fragment shaders into
   a full-screen pass. antiky-town already proves the pattern
   (`antiky-town/src/town/shaders/town-post.shader.ts`).
7. **Add contact shadows / baked AO.** Even a cheap per-object ground-plane blob is a large upgrade
   over nothing.
8. **Stop washing out point-light-expo's albedo** (`presentation.ts:21-26`) once color space and
   shadows are fixed; those knobs exist to compensate for problems that would no longer exist.

### 6.2 If asset fidelity really is the binding constraint

- **KayKit (Kay Lousberg) — already in this repo's catalog** (`data/community-sources.generated.json`,
  17 models under provider `kaykit`, CC0). Materially better silhouettes and consistent art
  direction versus Kenney, same license, zero cost. **This is the cheapest asset upgrade available.**
- **Poly Haven PBR *materials* for all surfaces** (332 texture sets, CC0, already cataloged). Even
  keeping the Kenney geometry, replacing the flat palette on floors/walls with a real tiling PBR
  material + trim detail transforms the read. This is exactly what the catalog was built for and is
  currently used only for one floor plane in point-light-expo.
- **Quaternius *textured* packs** rather than the material-color packs. Ultimate Spaceships proves
  the difference (1,521 unique UVs vs 6 palette pixels).
- **Trim sheets.** A single 2K trim sheet with panel lines, bolts, edge wear and emissive strips,
  applied via a second UV channel, would give the Kenney modular-space kit a Rocket-League-adjacent
  read for one texture's cost. This is the standard industry answer to exactly this problem.
- **Procedural detail in-shader.** Triplanar noise for grime/moss, curvature-based edge wear from
  `length(fwidth(normal))`, and screen-space micro-detail all add material response with zero new
  assets. Very well suited to a codebase that already writes shaders in a TS DSL.
- **Paid tiers, if budget exists.** Synty POLYGON kits (~$20–60/pack, extension license) are the
  standard answer for "stylized but cohesive and shippable." Quaternius' Patreon tiers and KayKit's
  paid packs are cheaper intermediate steps. But **do not buy assets before fixing §6.1** — Synty
  kits rendered with no shadows, no AO, no IBL and unmanaged color would still look gross.

### 6.3 Pipeline capabilities worth building into `asset-catalog`

The package currently has no processing stage at all. If the goal is a repeatable quality bar, a
single shared `packages/asset-catalog/src/node/derive.ts` should replace the three divergent scripts
and own: tangent generation, KTX2/Basis texture compression, mip-chain policy (nearest for palettes,
trilinear+aniso for albedo), atlas packing, LOD generation via meshoptimizer simplification, and
`EXT_meshopt_compression`. Today all six of those are absent, and the derivation logic is duplicated
three ways with three different fidelity policies.

---

## 7. Summary of file:line findings

| Finding | Location | Severity |
| --- | --- | --- |
| Model UVs destroyed; every material collapsed to one pixel | `traversal-study/scripts/normalize-quaternius.mjs:218-220,238,267` | **Critical** |
| Palette texture mip-bleeds because brometal ignores the glTF sampler | `webgpu.js:844-856` vs `normalize-quaternius.mjs:325`; call site `traversal-study/src/renderer.ts:216` | **High** |
| Normal maps deleted from the only PBR assets | `point-light-expo/scripts/gltf-pack-lib.mjs:89` | **High** |
| Textures uploaded as non-sRGB; no color management anywhere | `webgpu.js:836-842`, `webgpu.js:79-80` | **High** |
| No shadow maps, no AO, no IBL, no post in 3 of 4 demos | grep across `*/src/` | **High** |
| Renderer grade uniforms overwrite shipped asset colors up to 90% | `traversal-study/src/renderer.ts:307-314` | Medium |
| Best albedo in repo deliberately desaturated + contrast-reduced + lifted | `point-light-expo/src/presentation.ts:21-26`, `reliquary-model.shader.ts:164-168` | Medium |
| Node transforms silently ignored by the GLB parser | `node_modules/brometal/dist/models/glb.js:147-184` | Medium |
| Only base-color reaches the runtime; all other material data dropped | `glb.js:138-146`, `glb.d.ts:10-32` | Medium |
| Kenney `TANGENT` attributes shipped and unused | all Kenney GLBs | Low |
| 332 cataloged CC0 HDRIs, zero used at runtime | `data/poly-haven.generated.json` | Medium (opportunity) |
| Catalog installer cannot install any crawled asset | `src/node/install.ts:71-73` vs `src/generated-catalog.ts:21` | Low |
| No decimation / LOD / texture compression / atlasing anywhere | `packages/asset-catalog/**` | Medium (gap) |
