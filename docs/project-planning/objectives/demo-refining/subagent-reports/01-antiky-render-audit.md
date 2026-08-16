# Antiky render audit — point-light-expo, combat-arena, traversal-study

Audit date: 2026-08-10. Branch `feat/marketing-stuff2`. Renderer: `brometal` 0.15.0 (`node_modules/brometal`, patched by `scripts/patch-brometal.mjs`).

`antiky-town` was not inspected, per instruction.

Every claim below cites `file:line`. Graphics terms are defined in one plain sentence at first use.

---

## 0. What the engine actually gives you (shared substrate)

These facts constrain all three demos, so they are stated once.

**Swapchain format.** `node_modules/brometal/dist/runtime/webgpu.js:79-80`:
```js
const format = gpu.getPreferredCanvasFormat();
context.configure({ device, format, alphaMode: 'opaque' });
```
`getPreferredCanvasFormat()` returns `bgra8unorm` on Chrome/macOS — **not** `bgra8unorm-srgb`. *("sRGB" is the non-linear curve monitors expect; a `-srgb` format makes the GPU apply that curve for you on write.)* Because the plain format is used, **no gamma encode happens on output**. Whatever float the fragment shader returns is written to the screen bytes as-is.

**Texture format.** `webgpu.js:839-850` — `createWebgpuTexture` always creates `format: 'rgba8unorm'` (line 848). Never `rgba8unorm-srgb`. So **no sRGB decode happens on read** either. A JPEG/PNG albedo pixel authored at byte 128 is delivered to the shader as 0.502, not the 0.216 its linear brightness actually is.

**Antialiasing.** `webgpu.js:87` — `sampleCount: options.antialias === false ? 1 : 4`. No demo passes `antialias`, so all three get **4× MSAA for free** (`point-light-expo/src/game.ts:35-38`, `combat-arena/src/renderer.ts:45-48`, `traversal-study/src/renderer.ts:297`). *(MSAA = smooths the jagged staircase on polygon edges. It does not smooth anything inside a triangle.)*

**Offscreen buffers.** `webgpu.js:11` `const TARGET_FORMAT = 'rgba16float'`; `webgpu.js:761` render-target sampler is `nearest`/`nearest`. **No demo ever calls `createRenderTarget`** (verified by grep across all three `src/` trees). Therefore there is **no HDR scene buffer and no post-processing pass of any kind** in any demo.

**Blending.** `webgpu.js:346-374`. `blend: 'additive'` → `src-alpha, one`; `blend: 'alpha'` → `src-alpha, one-minus-src-alpha`; either way `depthWriteEnabled: blend === 'none'` (line 373) so transparent passes do not write depth. `depthCompare: 'less'`, `depth24plus`, no reverse-Z.

**BRDF library.** *(BRDF = the formula that decides how bright a surface is given light direction, view direction and material.)* `brometal/dist/shaders/toon.shader.gen.js:19-29`:
```wgsl
fn specGGX(normal, lightDir, viewDir, roughness) -> f32 {
  let a2 = pow(roughness*roughness, 2);
  let ndf = a2 / (3.14159265 * denom * denom);
  return ndf * ndotl * 0.25;
}
```
This is **only the D (microfacet distribution) term** of a Cook-Torrance GGX BRDF. There is **no Fresnel term F** *(the effect where every surface becomes mirror-like at grazing angles — the single biggest cue that something is a real material)*, **no geometry/shadowing term G**, and the correct `1/(4·NdotL·NdotV)` denominator is replaced with a flat `0.25`. It is not energy-conserving and it spikes toward infinity as roughness → 0, which is why every call site has to clamp it (`point-light-expo/src/shaders/reliquary-model.shader.ts:60` `min(..., 1.5)`, `foundry.shader.ts:36` `min(..., 2.4)`).

`brometal/dist/shaders/tonemap.shader.gen.js:41-45` `tonemapACES` is the Narkowicz ACES fit, clamped to `[0,1]`. *(Tonemapping = squeezing very bright values back into the 0–1 range a screen can show, the way a camera does.)*

**GLB loader.** `brometal/dist/models/glb.js:153-181` reads **only** `POSITION`, `NORMAL`, `TEXCOORD_0`, and indices. `glb.js:141` reads **only** `pbrMetallicRoughness.baseColorTexture`. Consequences: `TANGENT` is silently dropped (every Kenney asset ships one), `COLOR_0` vertex colors are dropped, `normalTexture` / `metallicRoughnessTexture` / `occlusionTexture` / `emissiveTexture` / `baseColorFactor` / `KHR_texture_transform` are all ignored, and node transforms are unsupported (`glb.js:6-8` says so explicitly).

---

## 1. Color management (all three demos)

### 1.1 The core problem: lighting math is done in sRGB space

Textures are read without sRGB→linear decode (`webgpu.js:848`) and the frame is written without linear→sRGB encode (`webgpu.js:79-80`). For a shader that just does `return texture(...)` the two errors cancel exactly and the image looks right. **They do not cancel the moment you multiply by a light.**

Concretely, in `point-light-expo/src/shaders/reliquary-model.shader.ts:177`:
```ts
const lit = base.mul(ambient.add(relay)).scale(occlusion);
```
`base` here is an sRGB-encoded number pretending to be linear. Multiplying two sRGB-encoded numbers is not the same operation as multiplying two linear numbers and re-encoding. The visible symptom is exactly what you are seeing: **midtones are lifted, shadow-to-light transitions are soft and mushy instead of crisp, and colored lights desaturate the surfaces they hit instead of tinting them.** Halving the light gives you roughly 50% brightness on screen instead of the ~73% a correct pipeline would give — so the falloff *ramps* look wrong even when the light positions are right.

This is the single highest-impact defect in the codebase and it affects all three demos identically.

**Not all maps are wrong.** Roughness and ambient-occlusion maps are authored as *non-color data* (the byte IS the linear value), so reading them raw is **correct**. `point-light-expo/src/shaders/reliquary-floor.shader.ts:114-115` (`uAo`, `uRoughness`) and `reliquary-model.shader.ts:160-162` (the ARM map) are fine. Only the **albedo/base-color** textures need the decode.

### 1.2 Tonemapping is applied per-material, many times per frame

`tonemapACES` is called inside the fragment shader of:
- `point-light-expo`: `reliquary-model.shader.ts:181`, `reliquary-floor.shader.ts:129`, `foundry.shader.ts:191` — but **not** `foundry-glow.shader.ts` (additive glow, line 50) and **not** `onboarding.shader.ts:30`.
- `combat-arena`: `ship-model.shader.ts:78`, `arena-model.shader.ts:73`, `arena-surface.shader.ts:73`, `space-backdrop.shader.ts:59` — but **not** `arena-glow.shader.ts:60`.
- `traversal-study`: `traversal-surface.shader.ts:72` only. **`traversal-model.shader.ts:56` does not tonemap at all**, and neither does `traversal-glow.shader.ts:57`.

Two consequences:

1. **Additive glow stacks on top of already-tonemapped, already-clamped material color.** `tonemapACES` clamps to `[0,1]` (`tonemap.shader.gen.js:44`). So a glow added on top of a bright surface can only push toward pure white — there is no headroom left. This is why the energy effects read as flat white smears rather than as hot cores with colored halos. A real bloom pipeline needs the opposite: keep values above 1.0 in a float buffer, then bloom, then tonemap once.

2. **In `traversal-study` the two paths disagree.** Everything drawn by `traversal-model.shader.ts` (all 13 catalog GLBs — platforms, courier, clouds, cliffs, trees, tower) is **not** tonemapped, while `traversal-surface.shader.ts` (contact shadow, HUD blocks) **is**. Those two families of objects therefore sit on different response curves in the same frame. Any future exposure or grading change will move them apart.

### 1.3 Literal colors are authored by eye in display space

Every palette constant is a hand-picked sRGB-looking triple used directly as a linear value: `point-light-expo/src/presentation.ts:66-79`, `combat-arena/src/combat-visuals.ts:4-13`, `traversal-study/src/renderer.ts:78-85`. This is *self-consistent* with the missing decode above — so it is not an additional bug, but it does mean that fixing 1.1 requires re-authoring these constants (or running them through `pow(c, 2.2)` at upload) or everything will go dark at once.

`clearColor` values (`point-light-expo/src/presentation.ts:8`, `combat-arena/src/renderer.ts:46`, `traversal-study/src/renderer.ts:297`) are written straight to the swapchain with no tonemap and no encode, so they are the one place where the authored number *is* literally the screen pixel.

### 1.4 Verdict on color

- Double gamma: **no**.
- Missing gamma: **yes, in both directions, and they only cancel for unlit passthrough**.
- Tonemap applied once: **no — once per material, and not at all for glows and for all of traversal-study's models**.
- Exposure: a single `uExposure` scalar exists only in `point-light-expo` (`presentation.ts:9`, value `1.24`). `combat-arena` and `traversal-study` have no exposure control at all.

---

## 2. point-light-expo (target: League of Legends)

### 2.1 Lighting model

Three point lights, hand-passed as 12 individual uniforms per program (`src/renderer.ts:180-196`). Light definitions in `src/lights.ts:19-53`: amber `[1,0.38,0.1]` r=3.55 p=2.5, ion `[0.16,0.58,0.92]` r=3.45 p=2.7, violet `[0.63,0.2,0.5]` r=3.5 p=2.35.

**Falloff is not inverse-square and has no hot core.** `src/shaders/reliquary-model.shader.ts:54-61` (and identically `reliquary-floor.shader.ts:29-35`, `foundry.shader.ts:30-38`):
```ts
const range = clamp(1 - distanceSq / (lightRadius * lightRadius), 0, 1);
const attenuation = range * range;
```
*(Inverse-square = real lights get 4× dimmer when you double the distance. This formula instead starts at 1.0 at the light and falls smoothly to exactly 0 at the radius.)* The correct modern form is `(1/d²) · clamp(1-(d/r)⁴,0,1)²`. Without the `1/d²` core, **the light has no bright center** — it is a soft blob. That is a large part of why nothing feels "lit."

**Coverage is tiny relative to the set.** Light radii are ~3.5 world units. The scene bounds are `[-8.2, 8.2]` × `[-5.95, 5.1]` (`src/presentation.ts:41-44`), i.e. ~16 × 11 units. Three spheres of radius 3.5 cover roughly a third of the floor area at most, and the coverage is non-overlapping. **Everything outside those three bubbles is rendered by the ambient term alone.**

**The ambient term is a two-term fake hemisphere, not IBL.** `reliquary-model.shader.ts:176`:
```ts
const ambient = uAmbientColor.scale(uAmbientStrength * (0.72 + normal.y * 0.2));
```
(`foundry.shader.ts:179-180` uses `0.78 + normal.y * 0.2`; `reliquary-floor.shader.ts:123` uses a *flat constant* × AO with no directionality at all.) *(IBL = image-based lighting, where ambient light comes from a captured environment so different surface orientations pick up different colors. There is none here.)* With `uAmbientColor = (0.34,0.4,0.36)` × `strength 0.96` (`presentation.ts:11-14`), the up-facing ambient is `0.30` and the down-facing ambient is `0.17` — a range of only 1.8×. Most of the frame is therefore **a nearly flat grey-green multiply on the albedo**, which is precisely the "washed" look.

**Specular is a decorative sliver.** `reliquary-model.shader.ts:60`: `min(specGGX(...), 1.5) * 0.12`. Even at full strength that is 12% of the specular energy, added to diffuse instead of being energy-balanced against it. `foundry.shader.ts:36-37` scales by `(0.16 + metalness*0.84)`. **There is no Fresnel anywhere**, so nothing gets the grazing-angle sheen that reads as "surface." Metalness exists as an instance attribute but only tints the specular scale and adds `radiance.scale(metalness * 0.2)` (`foundry.shader.ts:182`) — it does **not** tint the specular by base color, and it does **not** remove diffuse, which is what makes metal look like metal.

### 2.2 The explicit wash-out knobs

`src/shaders/reliquary-model.shader.ts:164-168`, driven by `src/presentation.ts:21-26` (`diffuseLift: 0.14`, `textureContrast: 0.78`, `saturation: 0.9`):
```ts
const saturated = mix(vec3(L,L,L), sourceBase, uSaturation);        // 10% desaturation
const lifted = mix(vec3(0.48,0.48,0.48), saturated, uTextureContrast)
  .add(vec3(uDiffuseLift, ...));
```
Algebraically this is `albedo_out = 0.78·albedo + 0.2456`. **A black texel becomes 0.246 and a white texel saturates at 1.0.** That is a 25% black-point lift with contrast cut to 78% — a literal "flatten and fog" filter baked into the albedo, before lighting.

The floor is worse. `reliquary-floor.shader.ts:113` with `floorTextureContrast: 0.56` (`presentation.ts:20`):
```ts
mix(vec3(0.38,0.36,0.31), sourceDiffuse, 0.56)   // = 0.56·tex + 0.166
```
**Only 56% of the Poly Haven forest-floor texture's contrast survives**, and it is then multiplied again by `floorDiffuseTint (0.78,0.82,0.74)` (line 122). The README (`README.md:63-64`) states this is intentional ("keep the real surface response below the gameplay silhouettes") — but the net effect is that the most detailed asset in the scene is deliberately erased.

### 2.3 Shadows and occlusion

- **Shadow maps: none.** No depth-from-light pass exists anywhere.
- **SSAO: none.**
- **Baked AO: partial.** The floor samples a real AO map (`reliquary-floor.shader.ts:114`, remapped to `[0.64,1]`); models sample the ARM map's red channel (`reliquary-model.shader.ts:162`), but only when `uMaterialLayout == 0`; for `materialLayout: 1` (rock-moss, `src/reliquary-models.ts:66`) `occlusion` is forced to `1` — **the rocks, which are 27 of the primary instances, have no occlusion at all**.
- **Blob shadows: present but inverted in behaviour.** `src/relay-visuals.ts:112-130` places squashed spheres at `y = -0.375` using `palette.contactShadow = (0.055,0.07,0.06)` (`presentation.ts:76`). These are drawn through `foundry.shader.ts` as **ordinary lit surfaces**. Line 181: `lit = vBaseColor.mul(ambient.add(radiance))`. A blob directly under a relay light receives `radiance ≈ 1.65`, so **the "shadow" gets ~6× brighter the closer it is to a light**. It stays darker than the floor only because its base color is very dark, but the direction of the effect is backwards from reality. It is also a hard-edged ellipse with no soft falloff.

### 2.4 Geometry and materials

Source assets are genuinely high quality; the pipeline throws most of it away.

| Asset | Tris | Textures shipped in runtime GLB | Textures available but dropped |
|---|---|---|---|
| `dead_tree_trunk` | 101,802 | diff 1k, arm 1k | **`nor_gl_1k.jpg`** |
| `tree_stump_01` | 41,046 | diff 1k, arm 1k | **`nor_gl_1k.jpg`** |
| `rock_moss_set_01` (mesh 4) | 16,548 | diff 1k, rough 1k | **`nor_gl_1k.jpg`** |
| `forest_floor` | (plane) | diff/ao/rough 1k | **`nor_gl_1k.jpg`** |

`scripts/pack-catalog-models.mjs:24-28,44-48,63-67` lists the normal maps in `imageUris` (so they are validated as present) but only `diffusePath` and `materialPath` are packed into the runtime GLB. `README.md:64-65,90-93` documents this as deliberate: no tangent basis exists. **That is a real constraint, not laziness — but it is the reason all the bark, rock and moss read as smooth painted plastic.** No source mesh has a `TANGENT` attribute either (verified: all three glTFs expose only `POSITION`/`NORMAL`/`TEXCOORD_0`), so tangents would have to be generated from UVs.

- **Normal mapping: none.** *(A normal map fakes fine bumps and grain lighting without extra polygons. Its absence is why 100k-triangle bark looks flat.)*
- **Vertex colors: none** (loader drops `COLOR_0`).
- **Normals: smooth, from source.** Rotated correctly in the vertex shader (`reliquary-model.shader.ts:121`; `foundry.shader.ts:100-111` correctly applies inverse-scale for non-uniform instance scale).
- Floor plane is `18 × 12.8` with `24 × 18` segments (`src/renderer.ts:75-80`) — a flat plane, no height variation, no displacement.

### 2.5 Camera and composition

`src/presentation.ts:33-40` + `src/renderer.ts:174-179`: position `[0, 18, 10.5]`, target `[0, 1.2, 0.6]`, `fovY = 35°`, `near = 0.1`, `far = 45`.

- 35° vertical FOV is a reasonable near-orthographic MOBA framing. Good choice.
- **`near = 0.1` with the nearest geometry ~15 units away wastes almost all depth precision.** *(The depth buffer stores distances non-linearly; a tiny near plane crams most of the precision into empty space in front of the camera.)* Raising `near` to ~5 costs nothing and reclaims precision.
- **The floor plane is finite (18 × 12.8) and fog cannot hide its edge.** `fog.end = 21`, `fog.maximumMix = 0.34` (`presentation.ts:27-32`) — fog never exceeds a 34% blend, so the plane boundary and the flat `clearColor` beyond it stay visible wherever the plane edge falls in frame. There is no skybox, no backdrop plane, no horizon.
- Fog is per-fragment `smoothstep(start, end, distance)` — linear-ish distance fog, no height falloff, no sun-scatter tint.
- Camera is **static** except for trauma shake: `src/renderer.ts:226-235`, `sin(time*24) * shake`, max `0.1` units, gated above `dangerPulse > 0.5`.

---

## 3. combat-arena (target: Rocket League)

### 3.1 Lighting model

**There is no light data structure at all.** Directions are hardcoded literals inside each fragment shader:
- `src/shaders/ship-model.shader.ts:65-66`: key `(-0.44, 0.86, 0.42)`, fill `(0.72, 0.3, -0.52)`.
- `src/shaders/arena-model.shader.ts:62`: `(0.38, 0.9, 0.28)` — one light only.
- `src/shaders/arena-surface.shader.ts:62`: `(0.46, 0.88, 0.3)` — one light, **a different direction from the model shader**.

So the ships, the station geometry, and the procedural blocks are lit by three mutually inconsistent light rigs in the same frame.

**The ship BRDF is `constant + N·L`, with no specular term whatsoever.** `ship-model.shader.ts:72-73`:
```ts
const lit = authored.scale(0.25 + keyLight * 1.02 + fillLight * 0.28)
  .add(vec3(0.025, 0.045, 0.075).scale(0.4 + max(normal.y, 0) * 0.34));
```
- No Fresnel, no GGX, no roughness, no metallic — **`specGGX` is not imported by any combat-arena shader**.
- The ambient add maxes out at `(0.0185, 0.033, 0.055)` — effectively zero. Surfaces facing away from the key light collapse to `albedo × 0.25` and go nearly black.
- **For a "glossy vehicle" look this is the critical gap.** Rocket League's read comes almost entirely from a sharp specular lobe plus an environment reflection sliding across curved car paint. Neither exists here. The only view-dependent term is `rim` (line 69) and it is gated behind `vParams.x` (emissive), so it only appears on dashing/marked ships (line 74).

`iTint` is uploaded per instance (`src/ship-assets.ts:125-127`) but **never touches base color** — `ship-model.shader.ts:74` uses it only for the energy rim. Team colors come purely from the five different 2048² ship textures.

### 3.2 Shadows and occlusion

- **Shadow maps: none. SSAO: none. Baked AO: none** (the loader cannot read `occlusionTexture`).
- **Blob shadows: hard-edged rectangles.** `src/combat-projection.ts:240,245` writes shadow instances into the **cube** batch (`combat-projection.ts:227` `createCube()`), scaled to e.g. `(0.72, 0.025, 0.92)`, colored `COMBAT_PALETTE.shadow = (0.003,0.005,0.009)` (`combat-visuals.ts:12`). These are opaque axis-scaled boxes lying on the deck. They are correctly darker than the floor, but they are **rectangles with hard edges under organically-shaped ships**, they do not soften with altitude, and they get the same bluish ambient add as everything else (`arena-surface.shader.ts:67`), so they are never truly black.

### 3.3 Post-processing

None. No bloom, no DOF, no motion blur, no vignette, no color grade, no exposure control. 4× MSAA only (inherited default). Everything that reads as "glow" is additive geometry: `arena-glow.shader.ts` on spheres and tori (`combat-projection.ts:228-229`) with `blend: 'additive'` (`src/render-batches.ts:101`).

Because glow is additive **on top of already-tonemapped opaque color** (§1.2), stacked projectile trails and beacons saturate to pure white rather than blooming with color.

### 3.4 Geometry and materials

| Asset | Tris | Base-color texture | Notes |
|---|---|---|---|
| `spitfire-blue.glb` (player) | 3,512 | 2048² PNG | smooth normals |
| `striker-red.glb` (rusher) | 4,530 | 2048² PNG | |
| `omen-orange.glb` (gunner) | 1,426 | 2048² PNG | |
| `imperial-red.glb` (anchor) | 2,642 | 2048² PNG | |
| `executioner-red.glb` (warden) | 3,388 | 2048² PNG | |
| `room-small.glb` | 4,876 | 512² `colormap` | ships a `TANGENT` the loader drops |
| `template-floor-layer.glb` | 548 | 512² `colormap` | |
| `cables.glb` | 400 | 512² `colormap` | |
| `target-detail.glb` | 164 | 512² `colormap` | |
| `grenade-a.glb` | 200 | 512² `colormap` | |

- All ten materials declare `metallicFactor: 0` and no `metallicRoughnessTexture`, `normalTexture`, or `emissiveTexture`. Even a compliant loader would find no PBR maps here. The 2048² ship PNGs are **base color only**.
- The five Kenney assets use `KHR_texture_transform` on their base-color texture. `glb.js:141` ignores extensions — **harmless here** because all five transforms are identity (`{"texCoord": 0}` with no offset/scale), but it is a latent trap if any future asset uses a real transform.
- `cull: 'none'` (`src/renderer.ts:47`) is correct and justified: the Quaternius materials are `doubleSided: true`.
- **Normal transform is correct for ships and wrong for everything else.** `src/ship-assets.ts:122-124` uploads a reciprocal scale and `ship-model.shader.ts:47` applies it — that is the proper inverse-scale normal transform. But `arena-model.shader.ts:46`, `arena-surface.shader.ts:44` and `arena-glow.shader.ts:42` all rotate the raw normal with **no inverse scale**. For the cubes in the surface batch this is harmless (axis-aligned normals), but the glow batch scales spheres to e.g. `(0.035, 0.025, 0.78)` for projectile trails (`combat-projection.ts:118`), so those trails get badly wrong facing/rim values.

### 3.5 Camera and composition

`src/renderer.ts:105`: `position [0, 13.4, 14.8]`, `fovY = π/3.85 ≈ 46.8°`, `near 0.1`, `far 60`.

- 46.8° is wide for a top-down arena; combined with a 13.4-unit height it produces a fairly flat, diagram-like read. Rocket League sits much lower and much longer-lensed.
- `near = 0.1` / `far = 60` = 600:1. Same wasted-precision issue as §2.5; nearest geometry is ~13 units away.
- `src/presentation.ts:31-76` is the best-composed camera of the three: pointer drift, velocity lead, aim lead, threat-priority lead, dash pushdown, terminal-state reframing, and a portrait/mobile branch (`aspect < 0.9`). **But there is zero smoothing** — every value is assigned directly to the output frame each call, so the camera snaps rather than eases. Compare `traversal-study/src/presentation.ts:73` which does it correctly.
- Camera shake `src/presentation.ts:34-35`: `sin(time*47) * impact * 0.11`. Driven by simulation time, which only advances at 60 Hz (see §5.1).
- Fog: three different hardcoded ranges in three shaders — `(17,34)×0.55` for ships (`ship-model.shader.ts:77-78`), `(15,28)×0.72` for models (`arena-model.shader.ts:72`), `(13,26)×0.8` for surfaces (`arena-surface.shader.ts:72`). **Objects at the same distance fade to different amounts depending on which shader drew them**, and all three fade toward slightly different near-black colors.
- Backdrop: one procedural plane at `y = -1.45`, 56×56 units (`src/space-backdrop.ts:22`, `space-backdrop.shader.ts:31`) with hash stars, a sine-lattice nebula, and one planet disc. It is drawn *first* with depth write, and it is a flat plane, not a skydome — so it will show a visible finite edge if the camera ever frames past 28 units.

---

## 4. traversal-study (target: LittleBigPlanet)

### 4.1 Lighting model — the thinnest of the three

`src/shaders/traversal-model.shader.ts:49-54`, which draws **all thirteen catalog GLBs**:
```ts
const light = normalize(vec3(-0.38, 0.84, 0.48));
const diffuse = max(dot(normal, light), 0);
const band = 0.54 + smoothstep(0.18, 0.25, diffuse) * 0.2
  + smoothstep(0.62, 0.7, diffuse) * 0.24;
const base = graded.mul(uTint).scale(band * vWash);
```
- **A three-step toon ramp with a total range of 0.54 → 0.98.** *(A toon ramp quantises lighting into flat bands instead of a smooth gradient.)* The brightest lit face is only **1.81× brighter than the darkest** face. Nothing in the scene has real contrast.
- **No specular, no rim, no Fresnel, no ambient occlusion, no view dependence at all.** The only view-dependent code is `distanceFog` (line 55).
- `vWash` (line 42) is a world-space sine that modulates brightness by ±4% — invisible.
- **No tonemapping** on this shader (line 56 returns the mix directly).
- LittleBigPlanet's entire identity is materiality: fabric weave, cardboard fibre, stitching, sub-surface warmth, sharp specular on plastic, soft on felt. **None of the machinery for any of that exists in this shader.**

`src/shaders/traversal-surface.shader.ts:61-72` (contact shadow, HUD) is slightly richer — two-band ramp plus a `rim` and a fake sky ambient — and it *does* tonemap. Two different response curves in one frame (§1.2).

### 4.2 The `uGradeMix` flattening

`src/renderer.ts:307-314` constructs each catalog batch with a grade color and mix, applied at `traversal-model.shader.ts:53`: `mix(texel, uGradeColor, uGradeMix)`.

| Batch | Grade color | Mix | Effect |
|---|---|---|---|
| `cloud-small`, `cloud-large` | `(0.96,0.98,1)` | **0.90** | 90% of the texture replaced by flat near-white |
| `coastal-cliff` | `(0.3,0.45,0.55)` | **0.78** | 78% replaced by flat blue-grey |
| `spikes` | `(0.92,0.22,0.09)` | 0.62 | |
| `relay-tower` | `(0.64,0.71,0.74)` | 0.38 | |
| `coastal-tree` | `(0.18,0.38,0.24)` | 0.28 | |

### 4.3 The assets have almost no texture data to begin with

This is the most concrete finding in the whole audit. Measured directly from the shipped GLBs:

| Asset | Tris | Embedded texture | UV range |
|---|---|---|---|
| `coastal-cliff.glb` | 464 | **1×1 px** | every UV is exactly `(0.5, 0.5)` |
| `cloud-small.glb` | 574 | **1×1 px** | — |
| `cloud-large.glb` | 508 | **1×1 px** | — |
| `coastal-tree.glb` | 2,688 | **2×1 px** | — |
| `courier.glb` (player) | 2,908 | **6×1 px** | `u ∈ [0.0833, 0.9167]`, `v ≡ 0.5` |
| `relay-tower.glb` | 2,732 | **7×1 px** | — |
| Kenney platformer kit (7 files) | 92–408 | 512² `colormap` | small sub-rects |

The Quaternius Ultimate Platformer models are **palette-strip models**: a 6-pixel-wide texture where each pixel is one material color, and every triangle's UVs point at one texel center.

**Two defects follow:**

1. **The cliffs and clouds are single flat colors.** `coastal-cliff` has a 1×1 texture *and* all UVs at `(0.5,0.5)` — the entire 464-triangle rock is one uniform color, then 78% replaced by a flat blue-grey (§4.2), then shaded by a 1.81:1 toon ramp. There are ~16 cliff instances plus 12 clouds (`src/environment.ts:38-81`). **The entire background is flat-colored silhouettes.**

2. **The palette textures are mipmapped and linearly filtered, which averages the palette entries.** `src/renderer.ts:216` calls `createTexture(renderer, bitmap, { flipY: false, anisotropy: 4 })` — `filter` is not specified, so `webgpu.js:843` takes the `smooth` branch, `webgpu.js:844` builds a mip chain (`7×1 → 3×1 → 1×1`), and `webgpu.js:860-865` uses `linear` min/mag/mip with 4× anisotropy. Because UVs are constant per triangle, the screen-space UV derivative is ~0 inside a triangle but spikes at every triangle boundary, which selects the coarsest mip — **a 1×1 texel that is the average of the whole palette**. The visible symptom is muddy averaged-color fringing along every material boundary on the courier and the tower, worsening with distance.
   **Fix: pass `filter: 'nearest'`.** `webgpu.js:844` then sets `mipLevels = 1` and disables anisotropy. This is a one-line change per call site with a large, immediate payoff.

Also: `traversal-study` (unlike `combat-arena`) never uploads an inverse instance scale. `traversal-surface.shader.ts:43` and `traversal-glow.shader.ts:40` rotate the raw normal only. The contact shadow is a sphere scaled to `(0.75, 0.035, 0.42)` (`src/renderer.ts:425`) — **its normals are still spherical**, so a flat disc gets a full spherical shading gradient across it.

### 4.4 Shadows and occlusion

- Shadow maps: none. SSAO: none. Baked AO: none.
- **One blob shadow, for the player only** (`src/renderer.ts:422-426`). It is a squashed opaque sphere in `INK = (0.055,0.075,0.085)` that shrinks with altitude (`0.75 - min(0.42, shadowDistance*0.18)`). Nothing else in the scene — no platform, tree, cliff, flag, spike, tower — casts or receives anything.
- **Contact shadow uses `cull: 'none'`** (`src/renderer.ts:297`) and is drawn opaque with depth write, at `+0.025` above the platform top. That is a small enough gap that a `near=0.1 / far=240` depth buffer *may* z-fight at distance; worth watching.

### 4.5 Camera and composition — the best of the three

`src/presentation.ts:26-84`, `src/renderer.ts:337`: `fovY = π/3.6 = 50°`, `near 0.1`, `far 240`.

- **Camera easing is correct and framerate-independent** (`presentation.ts:73`): `easing = 1 - Math.exp(-deltaSeconds * 8.4)`. This is the one piece of motion code in the repo done properly. It also snaps on reset via `resetSerial` (line 72) — good.
- Speed lead, vertical anticipation, speed pullback, pointer lift, and a portrait branch all present (lines 36-51). Genuinely thoughtful.
- **`near = 0.1` / `far = 240` is a 2400:1 ratio — the worst of the three.** The camera sits 11–16 units back; there is no geometry closer than ~10 units. Raising `near` to 2.0 would cut the ratio by 20× at zero cost.
- Background depth layering is real (`src/environment.ts:28-33`: four layers at z = −4.8, −10, −17, −24) but **there is no parallax** — `backgroundCompositionAt()` (`environment.ts:105-110`) ignores its `_cameraX` argument and returns one frozen constant. Depth separation comes purely from perspective, which at 50° FOV over a 20-unit z-range is weak.
- No skybox. The sky is `clearColor [0.38, 0.57, 0.68, 1]` (`src/renderer.ts:297`) — a flat untonemapped blue. Fog fades toward `(0.55,0.65,0.66)` at 42% max (`traversal-model.shader.ts:56`), which **does not match the clear color**, so distant geometry fades toward a grey that is visibly different from the sky behind it.

### 4.6 Motion and feel

- Squash/stretch **exists**: `src/simulation.ts:262,340,410,439` maintains a `squash` value with `dt`-correct decay (`squash - dt * 5.5`), consumed at `src/renderer.ts:416-417` as `scaleX = 0.305 + squash*0.018`, `scaleY = 0.305 - squash*0.022`. The magnitude is **±6-7% at most** — well below the threshold where squash reads as personality. LBP-class feel wants 20-40% on landing.
- Gait is a pure sine on a baked pose: `src/renderer.ts:415,419` — `sin(time * (7 + |vx|))` fed into a ±0.018 rad yaw wobble. The courier's `Run` animation is **baked as a single static pose** (`README.md:112-114`) because `parseGlb` has no skinning support. The character never actually animates.
- Particles: `trail` batch, 102 slots (`src/render-plan.ts:38`) — simulation trail particles plus 30 hardcoded wind specks (`src/renderer.ts:437-442`). Alpha-blended spheres, no sorting, no soft particles, no texture.
- `effects` batch: 8 alpha-blended tori for checkpoint/land/jump/collect/damage pulses (`src/renderer.ts:445-463`). Reasonable event coverage; visually they are thin wire rings.
- **Alpha-blended batches are never depth-sorted.** `blend: 'alpha'` (`src/renderer.ts:150`) disables depth write (`webgpu.js:373`) but alpha blending is order-dependent, so overlapping trail particles composite in instance-buffer order, not back-to-front. `combat-arena` and `point-light-expo` use `additive`, which is order-independent, so they are unaffected.

---

## 5. Cross-cutting findings

### 5.1 No render interpolation — visible judder on any display that is not 60 Hz

`packages/framework/src/sessions/engine-session/contract.ts:4`: `FIXED_STEP_SECONDS = 1/60`. All three demos render `simulation.view()` directly with no interpolation alpha:
- `point-light-expo/src/game.ts:148`
- `combat-arena/src/game.ts` (same pattern)
- `traversal-study/src/game.ts:103-105`

On a 120 Hz or 144 Hz display, `session.advance()` completes 0 or 1 fixed steps per frame in an irregular pattern, and object positions are re-presented unchanged on the "0-step" frames. **The result is a visible stutter in all continuous motion** — camera pans, ship travel, the courier's run. Fixing this requires the session to expose the fractional leftover time and the renderer to lerp between previous and current state. This is a structural change, not a shader tweak, but it affects *perceived* quality more than most of the shading work.

### 5.2 Summary matrix

| Feature | point-light-expo | combat-arena | traversal-study |
|---|---|---|---|
| sRGB texture decode | ✗ | ✗ | ✗ |
| sRGB output encode | ✗ | ✗ | ✗ |
| Tonemap count / frame | per-material (3 of 5 shaders) | per-material (4 of 5) | per-material (**1 of 3**) |
| Exposure control | `uExposure = 1.24` | none | none |
| Fresnel | ✗ | ✗ | ✗ |
| Specular | GGX-D only, ×0.12 | **none** | **none** |
| Metallic | tints spec scale only | ✗ | ✗ |
| Energy conservation | ✗ | ✗ | ✗ |
| Ambient | fake hemisphere ×0.96 | ~0.02 constant | none (ramp floor 0.54) |
| Light falloff | windowed, **no 1/d²** | directional only | directional only |
| Shadow maps | ✗ | ✗ | ✗ |
| SSAO | ✗ | ✗ | ✗ |
| Baked AO | floor + non-rock models | ✗ | ✗ |
| Blob shadows | yes, brighten near lights | yes, hard rectangles | player only |
| Bloom / DOF / motion blur / vignette / grade | ✗ | ✗ | ✗ |
| MSAA | 4× (default) | 4× | 4× |
| Normal maps | shipped-but-dropped | not in assets | not in assets |
| Tangents | absent in source | dropped by loader | dropped by loader |
| Vertex colors | dropped by loader | dropped by loader | dropped by loader |
| near/far ratio | 450:1 | 600:1 | **2400:1** |
| Camera easing | none (static + shake) | **none** | ✓ correct exp easing |
| Render interpolation | ✗ | ✗ | ✗ |

### 5.3 README claims vs. reality

The READMEs are unusually honest. Specific checks:

- ✅ `point-light-expo/README.md:64-65,90-93` — correctly states the normal maps are deliberately not sampled and why. Accurate.
- ✅ `point-light-expo/README.md:51-52` — "212 instances in 11 draw calls, 7,380 bytes/frame" matches `src/render-profile.ts` capacities.
- ✅ `combat-arena/README.md:78-82` — the reciprocal-normal-scale claim is true and verified at `src/ship-assets.ts:122-124` / `ship-model.shader.ts:47`. It does **not** disclose that the other three combat shaders lack the same fix.
- ✅ `combat-arena/README.md:119-125` — the 15,375,156-byte / 2048² / ~106.7 MiB estimate is accurate.
- ⚠️ `combat-arena/README.md:64` — "BroMetal is presentation only… loads the textured station GLBs" is true, but the phrase "authored color texture" throughout obscures that **base color is the only PBR channel present or used**.
- ⚠️ `traversal-study/README.md:73-77` — "cool-graded Quaternius clouds, rock headlands" understates it: `uGradeMix` of 0.90 and 0.78 means those assets are **almost entirely replaced by flat color** (§4.2), on top of 1×1-pixel source textures (§4.3).
- ⚠️ `traversal-study/README.md:112-114` — "bakes the source rig's `Run` animation at 0.18 seconds; the source's 18 animations are provenance, not runtime animation clips" is technically accurate but reads as a feature. In practice **the character is a frozen statue**.
- ❌ Nothing in any README claims shadows, PBR, or post-processing that does not exist. No overclaiming found.

---

## 6. Ranked defect list — visual impact per unit of effort

Ordered by (impact ÷ effort). "Effort" assumes a competent pass by one engineer.

### Tier A — hours of work, transforms the image

**A1. Sample albedo textures as sRGB.** *Effort: ~1 hour. Impact: enormous, all three demos.*
`brometal/dist/runtime/webgpu.js:848` hardcodes `rgba8unorm`. Add an `srgb?: boolean` option that selects `'rgba8unorm-srgb'` (this is what `scripts/patch-brometal.mjs` already exists to do — it patches `dist/` in `postinstall`). Set it on every **base-color** texture and leave roughness/AO/ARM maps as-is. Then pair with A2 or everything goes dark.

**A2. Encode the frame once at the end.** *Effort: ~1 hour. Impact: enormous.*
Either configure the canvas with the `-srgb` variant of the preferred format (`webgpu.js:79-80`), or add `gammaCorrect(color, 2.2)` after each `tonemapACES` call. Doing A1+A2 together is what turns "washed and mushy" into "punchy" without touching a single light value. **These two are the single highest-leverage change in the repo.**

**A3. `filter: 'nearest'` on traversal-study's palette textures.** *Effort: 5 minutes. Impact: large, traversal-study.*
`traversal-study/src/renderer.ts:216`. Kills the mip-averaging color bleed on the courier and tower (§4.3). Verify no visible aliasing regression on the 512² Kenney colormap; if there is, split into two texture-creation paths.

**A4. Delete or drastically reduce the wash-out knobs.** *Effort: minutes + retune. Impact: large, point-light-expo.*
`presentation.ts:20-26` — `floorTextureContrast: 0.56`, `textureContrast: 0.78`, `diffuseLift: 0.14`. These exist to suppress texture noise under a broken lighting model. Once A1/A2 land, most of the reason for them disappears. Target `textureContrast ≥ 0.95`, `diffuseLift ≤ 0.03`.

**A5. Raise `near` on all three cameras.** *Effort: 3 minutes. Impact: moderate, free.*
`point-light-expo/src/renderer.ts:177` (0.1 → 5), `combat-arena/src/renderer.ts:105` (0.1 → 5), `traversal-study/src/renderer.ts:337` (0.1 → 2). Reclaims 20–50× depth precision for nothing.

### Tier B — a day each, closes the biggest look gaps

**B1. Add a Fresnel-weighted specular lobe to combat-arena's ship shader.** *Effort: ~half a day. Impact: very large for the Rocket League target.*
`ship-model.shader.ts` currently has **zero** specular. Add `specGGX` (already available) plus a Schlick Fresnel and a per-hull roughness constant. Even a fake environment term (a hemisphere color reflected around the view vector) would go most of the way. This is the difference between "flat plastic toys" and "glossy vehicles."

**B2. Fix light falloff in point-light-expo.** *Effort: ~1 hour. Impact: large for the LoL target.*
`reliquary-model.shader.ts:56-57` and the two identical copies. Replace with windowed inverse-square: `atten = clamp(1 - pow(d/r, 4), 0, 1)²  /  max(d², 0.01)`, then retune `power`. Restores a bright core and a real falloff ramp. Consider raising the three radii from ~3.5 toward 6-7 so the lights actually reach the set.

**B3. One shared directional light + real ambient in combat-arena.** *Effort: ~2 hours. Impact: large.*
Three shaders currently disagree on light direction (`ship-model.shader.ts:65`, `arena-model.shader.ts:62`, `arena-surface.shader.ts:62`) and on fog range (§3.5). Hoist both to uniforms set once per frame in `src/renderer.ts:131-134`. Also unify the three fog ranges.

**B4. Give traversal-study a real material response.** *Effort: ~1 day. Impact: very large for the LBP target.*
`traversal-model.shader.ts:51-54`'s 0.54→0.98 ramp is the demo's ceiling. Add: a wider ramp, a specular lobe with per-batch roughness, a rim/Fresnel term, a warm-sky/cool-ground hemisphere ambient (`hemisphereLight` is already in `brometal/shader-functions`), and tonemapping so it matches the surface shader. Then consider a cheap procedural detail — a triplanar noise or fabric-weave overlay driven by world position — since the source assets carry no texture detail to work with (§4.3).

**B5. Fix the inverted blob shadows.** *Effort: ~2 hours. Impact: moderate, point-light-expo.*
`relay-visuals.ts:112-130` draws blobs through the lit `foundry.shader.ts` path, so they brighten near lights (§2.3). Give them a dedicated unlit alpha-blended shader with a radial soft edge (`1 - smoothstep(0.6, 1.0, r)`). Same treatment for combat-arena's rectangular boxes (`combat-projection.ts:240,245`) and traversal-study's spherical-normal disc (`renderer.ts:425`).

**B6. Camera easing for combat-arena.** *Effort: ~30 minutes. Impact: moderate.*
`combat-arena/src/presentation.ts:70-75` assigns directly. Copy the exponential smoothing from `traversal-study/src/presentation.ts:73` — it is already written and framerate-correct.

**B7. Upload inverse instance scale where it is missing.** *Effort: ~1 hour. Impact: moderate.*
`traversal-surface.shader.ts:43`, `traversal-glow.shader.ts:40`, `arena-surface.shader.ts:44`, `arena-glow.shader.ts:42`. `combat-arena/src/ship-assets.ts:122-124` already shows the exact pattern to copy.

### Tier C — multi-day, structural

**C1. HDR scene buffer + single tonemap + bloom.** *Effort: 2-3 days.*
Render opaque + additive into an `rgba16float` `createRenderTarget` (already supported, `webgpu.js:750`), then a fullscreen pass: bright-pass → blur → composite → tonemap → gamma. Removes per-material tonemapping (§1.2) and gives every glow in all three demos a real halo instead of a white clip. **Caveat:** `webgpu.js:761` forces a `nearest` sampler on render targets and `webgpu.js:234` drops MSAA for target passes — both will need patching in `scripts/patch-brometal.mjs` before a blur chain is usable.

**C2. One shadow-mapped directional light.** *Effort: 3-4 days.*
A single 2048² depth render target from the key light's point of view, plus PCF sampling in each material shader. This is the largest single missing cue in all three demos — nothing in any scene is grounded by a real cast shadow. Requires `createRenderTarget(..., depth: true)` plus a depth-only program path; `webgpu.js:765-770` creates the depth texture but never exposes a sampleable view of it, so this needs a `brometal` patch first.

**C3. Render interpolation between fixed steps.** *Effort: 2-3 days.* See §5.1. Affects perceived smoothness more than any shading change on high-refresh displays.

**C4. Tangent generation + normal maps for point-light-expo.** *Effort: 2-3 days.*
The normal maps are already downloaded and hash-verified (`assets/poly-haven/*/textures/*_nor_gl_1k.jpg`); `scripts/pack-catalog-models.mjs:26,45,64` lists them and then does not pack them. Generate per-vertex tangents from UVs at pack time, extend the loader/shader, and 160k triangles of bark and rock stop looking like painted plastic.
