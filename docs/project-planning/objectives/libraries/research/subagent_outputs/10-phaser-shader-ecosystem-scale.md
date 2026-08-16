## Phaser shader-ecosystem scale

Research cutoff: **2026-08-12**
Current stable version: **Phaser 4.2.1 “Giedi,” released 2026-07-09**. The official API site was still labeled 4.1.0, so exact current counts below come from the immutable `v4.2.1` source tag. [Release archive](https://phaser.io/download/archive), [v4.2.1 package manifest](https://github.com/phaserjs/phaser/blob/v4.2.1/package.json)

### Bottom line

Phaser does **not** ship hundreds or thousands of ready-made shaders. A defensible current summary is:

| Layer | Current Phaser 4.2.1 count | Meaning |
| --- | ---: | --- |
| Addable filter controller types | **23** | Includes 21 shader-backed filters plus `ParallelFilters` and non-rendering `Sampler`; excludes the abstract base controller |
| Shader-backed filter types | **21** | Named filter families, not presets or parameter combinations |
| High-level effect recipes | **2** | Bloom and Shine actions assembled from filters, gradients, textures, and tweens |
| Shader-backed procedural Game Object families | **7** | Gradient plus six Noise families |
| Raw GLSL source modules | **56** | 37 fragment stages, 7 vertex stages, and 12 reusable chunks; not 56 complete effects |
| Exported shader-addition builders | **18** | Low-level features injected into generated shader variants |
| Official browsable code examples | **2,472** | All Phaser topics, not shader-only |
| Directly categorized filter/shader examples | **102** | 78 filter examples plus 24 Shader Game Object examples |
| Official community shader/plugin catalog | **Unknown** | No authoritative Phaser-4 shader marketplace count was found |

The clearest comparison point is therefore **roughly a few dozen built-in visual families backed by a very large examples corpus**, not a built-in catalog of thousands.

### What users get out of the box in Phaser 4.2.1

The tagged [`Phaser.Filters` index](https://github.com/phaserjs/phaser/blob/v4.2.1/src/filters/index.js) exports 24 classes. One is the abstract `Controller`; the other **23 are addable controllers**:

Barrel, Blend, Blocky, Blur, Bokeh, ColorMatrix, CombineColorMatrix, Displacement, Glow, GradientMap, ImageLight, Key, Mask, NormalTools, PanoramaBlur, ParallelFilters, Pixelate, Quantize, Sampler, Shadow, Threshold, Vignette, and Wipe.

Of these:

- **21 are shader-backed filters**.
- `ParallelFilters` is a compositor for running and combining filter branches.
- `Sampler` reads rendered pixels and explicitly does not alter the image.
- All Game Objects and cameras can use filters, and filters can be stacked as internal or external passes. [Filter API](https://docs.phaser.io/api-documentation/namespace/filters), [official filter explanation](https://phaser.io/news/2026/05/phaser-4-filter-system)

Phaser also provides **two named, ready-made composite effects** outside the filter-controller list:

- [`AddEffectBloom`](https://github.com/phaserjs/phaser/blob/v4.2.1/src/actions/AddEffectBloom.js) combines ParallelFilters, Threshold, Blur, and blending.
- [`AddEffectShine`](https://github.com/phaserjs/phaser/blob/v4.2.1/src/actions/AddEffectShine.js) combines a Gradient, DynamicTexture, Tween, Blend filter, and optionally Displacement and ParallelFilters.

These are better counted as **recipes**, not additional independent fragment shaders.

There are also **seven shader-backed procedural Game Object families**:

- Gradient
- Noise
- NoiseCell2D
- NoiseCell3D
- NoiseCell4D
- NoiseSimplex2D
- NoiseSimplex3D

The official repository describes these as GPU-generated gradients, random noise, cellular noise, and simplex noise, with normal-map output where applicable. [Phaser repository overview](https://github.com/phaserjs/phaser/tree/v4.2.1), [Gradient API](https://docs.phaser.io/api-documentation/class/gameobjects-gradient)

Lighting, normal maps, tinting, point/cone lights, TileSprite sampling, GPU sprite/tilemap layers, and the generic custom `Shader` Game Object also ship in core. They are rendering capabilities, not a shelf of selectable artistic shaders.

### Pipelines versus render nodes

Phaser 4 has **zero current “built-in pipelines” in the Phaser 3 architectural sense**. Version 4 removed the pipeline system and replaced it with lazily constructed render nodes. [Phaser 4 changelog](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/CHANGELOG-v4.0.0.md), [renderer explanation](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games)

The `v4.2.1` [`RenderNodeManager`](https://github.com/phaserjs/phaser/blob/v4.2.1/src/renderer/webgl/renderNodes/RenderNodeManager.js) registers **58 built-in constructible node classes**. These include batching, geometry submission, texturing, transforms, context management, compositing, and filter execution. This is an exact implementation count, but it must **not** be presented as 58 visual effects or shaders.

For historical comparison, Phaser 3.90 installed **9 default pipelines**:

1. Multi
2. Rope
3. Light
4. Point Light
5. Single
6. Bitmap Mask
7. Utility
8. Mobile
9. FX

It also registered **14 built-in FX families**: Barrel, Bloom, Blur, Bokeh/TiltShift, Circle, ColorMatrix, Displacement, Glow, Gradient, Pixelate, Shadow, Shine, Vignette, and Wipe. [Phaser 3.90 PipelineManager documentation](https://docs.phaser.io/api-documentation/3.90.0/class/renderer-webgl-pipelinemanager)

Those nine pipelines were renderer architecture, not nine artistic shaders. Phaser 4’s 23 filter controllers are the closer current user-facing comparison.

### Shader and pipeline building blocks

A recursive count of the raw source directory at `v4.2.1` gives **56 unique GLSL modules**:

| Module kind | Count |
| --- | ---: |
| Fragment-stage sources | 37 |
| Vertex-stage sources | 7 |
| Reusable `.glsl` chunks | 12 |
| Total | **56** |

The 37 fragment modules break down into:

- **23 filter fragments**, because Blur has low, medium, and high implementations for one public Blur controller.
- **7 procedural fragments** for Gradient and the six Noise families.
- **7 renderer/internal fragments** for core rendering duties.

This count deliberately ignores the generated JavaScript copies of the same GLSL. [Raw shader source directory](https://github.com/phaserjs/phaser/tree/v4.2.1/src/renderer/webgl/shaders/src)

Phaser additionally exports **18 shader-addition maker functions**. These inject lighting, tint, normal-map sampling, multi-texture selection, coordinate clamping/wrapping, smooth pixel-art sampling, and similar pieces into shader templates. [Shader addition index](https://github.com/phaserjs/phaser/blob/v4.2.1/src/renderer/webgl/shaders/additionMakers/index.js), [ShaderAddition API](https://docs.phaser.io/api-documentation/4.0.0/namespace/renderer-webgl-shaderadditionmakers)

The generic Shader Game Object accepts custom fragment/vertex GLSL, textures, uniforms, and additions. Custom filters normally provide only a fragment shader because Phaser supplies the compositing geometry. [Official Phaser 4 Shader Guide](https://phaser.io/tutorials/phaser-4-shader-guide)

### Parameter variants are not independent shaders

Several apparently larger counts collapse to a small implementation set:

- Blur offers **3 quality implementations**, but remains one public effect family.
- Bokeh and Tilt Shift are two modes of the same Bokeh implementation.
- `ColorMatrix` exposes **23 named transformation methods**, including grayscale, sepia, negative, night, kodachrome, technicolor, and polaroid, but these all use the same color-matrix shader. [ColorMatrix source](https://github.com/phaserjs/phaser/blob/v4.2.1/src/display/ColorMatrix.js)
- Gradient provides **5 shape modes × 4 repeat modes = 20 discrete mode combinations** before colors, offsets, ramps, animation, and sizing are considered. These are parameter combinations of one shader family.
- Wipe has axis, direction, reveal/fade, width, progress, and texture choices.
- Filters can be stacked in arbitrary order with continuous parameters.

Thus Phaser can produce an effectively unbounded number of looks from a few dozen implementations. Counting every configuration as another shader would inflate the comparison.

### Official examples and templates

At official examples commit [`6d23cdeb`](https://github.com/phaserjs/examples/commit/6d23cdeb99c956ce72993904ad0f869c06fc6b3b), dated 2026-07-01, the published [`public/examples.json`](https://github.com/phaserjs/examples/blob/6d23cdeb99c956ce72993904ad0f869c06fc6b3b/public/examples.json) contains **2,472 JavaScript example entries**. This reproduces Phaser’s publisher claim of “over 2,000 examples.” [Official examples repository](https://github.com/phaserjs/examples)

Prefix counts within that published manifest are:

| Official category | Examples |
| --- | ---: |
| `filters` | **78** |
| `game objects/shader` and `game objects/shaders` | **24** |
| `game objects/gradient` | **14** |
| `game objects/noise` | **33** |
| Renderer filenames explicitly containing `shader` or `filter` | **10** |

The most conservative shader-focused lower bound is therefore **102 examples**: 78 filter examples plus 24 Shader Game Object examples. Including the clearly shader-backed Gradient and Noise categories raises it to **149**.

These are demonstrations, variations, transitions, tests, and tutorials—not 102 or 149 reusable production shaders. The repository licenses source code under MIT but explicitly warns that many example assets are not available for commercial reuse.

The official create-game tool supplies project/framework templates and **three demo games**, but no shader-pack or shader-library starter was identified. [Create Phaser Game](https://github.com/phaserjs/create-game) Phaser Editor 5 can visually configure built-in filters, but that is another authoring surface over the same built-ins, not a separate shader catalog.

### Community plugins and catalog gap

No authoritative, owner-maintained Phaser 4 catalog with a reproducible count of shader, filter, or rendering plugins was found.

Phaser provides plugin APIs, examples, and an official Phaser Editor plugin template, but the template is a scaffold rather than a marketplace. [Official Phaser Editor plugin template announcement](https://phaser.io/news/2026/06/phaser-editor-v5-plugin-template)

Therefore:

- Community shader/plugin count: **unknown, not zero**.
- NPM searches and the explicitly unofficial Phaser plugin directory were excluded.
- Large third-party collections such as Rex plugins may materially expand the ecosystem, but they are not an official, normalized, version-scoped shader catalog and should not be mixed into the out-of-box count.

### How Phaser’s 2D scope changes the comparison

Phaser is a browser-focused **2D framework**. Its reusable shader units are primarily:

- sprite and quad filters;
- screen/camera post-effects;
- transitions, masks, distortion, glow, blur, and color processing;
- procedural 2D gradients and noise;
- 2D normal-map lighting;
- custom full-quad Shader Game Objects.

It does not need the broad 3D material surface found in Unreal, Unity, or Godot: PBR material families, terrain materials, skeletal skin shading, subsurface scattering, volumetrics, atmospheric models, decals, hair, water, or material graphs for arbitrary 3D meshes.

The fair inference is that Phaser’s leverage comes from **a compact set of stackable 2D primitives plus more than 2,000 official examples**, not from shipping hundreds of independent artistic shaders. Phaser therefore shows that a mature ecosystem can be useful without a thousand built-ins—but it is not itself evidence that a built-in thousand-shader catalog is normal.
