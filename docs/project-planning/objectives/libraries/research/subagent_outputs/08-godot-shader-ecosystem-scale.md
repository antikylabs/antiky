# Godot shader ecosystem scale

Snapshot requested for 2026-08-12. Live catalog counts were checked on 2026-08-13 CDT. Engine scope is [Godot 4.7.1 stable](https://godotengine.org/download/archive/4.7.1-stable/), released July 14, 2026.

## Short answer

Godot does **not** give a new project hundreds or thousands of named, ready-made shaders.

It gives users:

- 9 concrete configurable built-in material implementations.
- 6 high-level Godot shader types, plus a separate low-level compute-shader API.
- 108 documented built-in shader function names.
- A large VisualShader construction surface.
- About 11 configurable environment/camera effect families, depending on how features are grouped.
- Separate official demos containing 49 shader source files.
- An official Asset Library with 164 shader-category packages across Godot versions.
- A community GodotShaders catalog with 2,297 shader posts.

Thus, Godot’s “thousands of shaders” advantage comes from its external community catalog. It does not come from thousands of independent shaders bundled in the engine.

## Reproducible counts

| Layer | Count | Status | What the count means |
| --- | ---: | --- | --- |
| Built-in material implementations | 9 | Established, derived from class hierarchy | Configurable engine resources, not nine visual presets |
| High-level shader types | 6 | Established | `spatial`, `canvas_item`, `particles`, `sky`, `fog`, and `texture_blit` |
| Built-in shader functions | 108 names; 170 documented signatures | Exact derived count | Math, vector, matrix, texture, derivative, packing, and related primitives |
| VisualShader building blocks | 111 documented `VisualShaderNode*` classes | Exact source-tree count | Includes concrete nodes and base/helper classes |
| VisualShader add-menu surface | 578 registrations; 406 distinct label/category pairs; 98 backing classes | Exact derived count | Includes scalar/vector overloads, mode-specific duplicates, and eight loop-generated constants |
| Internal engine GLSL | 152 `.glsl` files; 136 excluding `tests/` and `thirdparty/` | Exact source-tree count, excluded from user library | Renderer implementation compiled into the engine |
| Official demo projects | 138 projects | Exact at official 4.7 demo release commit | Separately downloaded examples |
| Shader files in official demos | 46 `.gdshader` + 3 `.glsl` files in 20 projects | Exact at official 4.7 demo release commit | File count, not 49 guaranteed-distinct effects |
| Official Asset Library, Shaders category | 164 entries across all versions; 96 with the Godot 4.7 filter | Exact live frontend count | Entries are packages and may contain one shader, many shaders, tools, or demos |
| GodotShaders community catalog | 2,297 posts | Exact live pagination-derived count | Catalog posts, not deduplicated implementations or reviewed quality |

## What ships in the engine

### Built-in materials: 9

The [Godot 4.7 `Material` hierarchy](https://docs.godotengine.org/en/4.7/classes/class_material.html) yields these user-usable concrete built-in implementations:

1. `StandardMaterial3D`
2. `ORMMaterial3D`
3. `CanvasItemMaterial`
4. `ParticleProcessMaterial`
5. `FogMaterial`
6. `PanoramaSkyMaterial`
7. `ProceduralSkyMaterial`
8. `PhysicalSkyMaterial`
9. `BlitMaterial`

This excludes:

- `Material` and `BaseMaterial3D`, which are bases.
- `PlaceholderMaterial`, which is a loading placeholder.
- `ShaderMaterial`, which is a container for a user-authored `Shader`, not a ready-made look.

`StandardMaterial3D` and `ORMMaterial3D` are broad PBR materials rather than catalogs. Godot describes them as default materials intended to provide most features artists need without writing shader code. They expose features such as albedo, metallic, roughness, normal mapping, clearcoat, anisotropy, subsurface scattering, transmission, rim lighting, refraction, detail maps, billboards, transparency, and stencil behavior. [Official material documentation](https://docs.godotengine.org/en/4.7/tutorials/3d/standard_material_3d.html)

`BlitMaterial` and the `texture_blit` shader type are new scope that matters in 4.7. They support GPU-modifiable `DrawableTexture2D` resources. [BlitMaterial](https://docs.godotengine.org/en/4.7/classes/class_blitmaterial.html), [texture-blit shader reference](https://docs.godotengine.org/en/4.7/tutorials/shaders/shader_reference/texture_blit_shader.html)

### Environment and post-effects

The [Godot 4.7 `Environment`](https://docs.godotengine.org/en/4.7/classes/class_environment.html) and camera-attribute resources expose these practical feature families:

- Depth of field
- Auto exposure
- Glow/bloom
- Five tone-mapping operators: Linear, Reinhard, Filmic, ACES, and AgX
- Brightness, contrast, saturation, and LUT color correction
- Depth/exponential fog
- Volumetric fog
- Screen-space reflections
- Screen-space ambient occlusion
- Screen-space indirect lighting
- SDFGI

Calling this “11 effects” is an **analyst grouping**, not an official Godot library count. SDFGI is a lighting system, fog is environmental rendering, and tonemappers are selectable algorithms. These are configurable renderer features, not a gallery of 11 authored looks. Renderer support also differs: several features require Forward+ or Mobile and are unavailable or reduced in Compatibility.

### Shader authoring surface

Godot 4.7 documents exactly six high-level shader types:

- `spatial`
- `canvas_item`
- `particles`
- `sky`
- `fog`
- `texture_blit`

[Official shader introduction](https://docs.godotengine.org/en/4.7/tutorials/shaders/introduction_to_shaders.html)

Compute shaders are separate. They use GLSL 4.50 through `RenderingDevice`, not the normal Godot shader language and `ShaderMaterial` workflow. [Official compute-shader documentation](https://docs.godotengine.org/en/4.7/tutorials/shaders/compute_shaders.html)

The [Godot 4.7 built-in shader-function reference](https://docs.godotengine.org/en/4.7/tutorials/shaders/shader_reference/shader_functions.html) contains:

- 108 unique displayed function names.
- 170 documented method/signature blocks.

These counts were obtained from the official 4.7 documentation source. Type aliases such as `vec_type` represent several scalar/vector overloads, so compiler-level overload counts would be higher and less meaningful.

### VisualShader

The [Godot 4.7.1 VisualShader source](https://github.com/godotengine/godot/tree/4.7.1-stable/modules/visual_shader) contains:

- 111 documented `VisualShaderNode*` classes.
- 578 runtime add-menu registrations.
- 406 distinct visible label/category pairs.
- 98 distinct backing classes used by those menu entries.

The 578 figure is not 578 ready-made effects. For example, the menu registers separate 2D, 3D, and 4D vector versions of many operations, plus mode-specific copies and overloads. It is the graph-language vocabulary.

### Internal shaders are not a user library

The Godot 4.7.1 source tree contains 152 `.glsl` files, or 136 after excluding `tests/` and `thirdparty/`. Godot’s architecture documentation states that core renderer shaders are embedded into editor and export-template binaries at compile time. [Internal rendering architecture](https://docs.godotengine.org/en/4.7/engine_details/architecture/internal_rendering_architecture.html)

These files implement the renderer. Users do not receive them as 136 selectable effects, so they should not be added to a user-facing shader-library total.

## Official reusable content

At the official Godot 4.7 demo release commit [`6ad6167`](https://github.com/godotengine/godot-demo-projects/tree/6ad6167e0577fe3622c18546138f456b107ce93c):

- 138 directories contain a `project.godot`.
- 46 files end in `.gdshader`.
- 3 files end in `.glsl`.
- 20 demo projects contain at least one of those shader files.

Examples include screen-space shaders, sprite shaders, procedural materials, sky shaders, tonemapping/color correction, compute post-processing, HDR output, and XR rendering examples.

These demos are official and MIT-licensed, but they are **not bundled into every new project**. Users download them from the demo repository, release assets, or Asset Library.

The file count is a lower-level inventory, not a semantic effect count. One effect can require multiple source files, while one source file can expose many parameterized appearances.

## Official Asset Library

The live [official Asset Library Shaders category](https://godotengine.org/asset-library/asset?category=3&max_results=500&page=0&sort=updated) reported:

- **164 entries** across all engine versions.
- **96 entries** when filtered for Godot 4.7.

The frontend total was read directly from the rendered result footer. The official [Asset Library API documentation](https://github.com/godotengine/godot-asset-library/blob/master/API.md) confirms that its response includes `total_items` and version/category filters.

These are package entries, not individual shader counts. The category includes single shaders, multi-shader packs, VisualShader node packs, preview tools, linkers, compute-shader examples, and complete demos. It also contains old Godot 2.x and 3.x content in the all-version total.

## GodotShaders community catalog

[GodotShaders](https://godotshaders.com/shader/) is a direct community catalog, not an official Godot project. Its stated purpose is to provide a large library where users can post shaders to use, modify, and learn from. It accepts CC0, MIT, and GPLv3 content. [About GodotShaders](https://godotshaders.com/about-godot-shaders/)

The live count is **2,297 shader posts**:

- The catalog currently has 58 pages.
- Pages contain 40 entries.
- [Page 58](https://godotshaders.com/shader/page/58/) contains 17 entries.
- Calculation: `57 × 40 + 17 = 2,297`.

The site visibly separates Canvas Item, Spatial, Particle, and Sky posts. For example, the live category results showed 33 Sky posts and 15 Particle posts.

This is the clearest reproducible source of a genuinely “thousands of Godot shaders” statement. However:

- Posts are not deduplicated.
- Similar effects and revisions can be separate posts.
- Some posts contain multiple passes or supporting scripts.
- Engine-version compatibility varies.
- Licensing must be checked per post.
- Catalog presence is not evidence of quality, performance, or renderer compatibility.

## Material instances and parameter variants

Godot does not have an Unreal-style named `MaterialInstance` asset type. A `ShaderMaterial` resource holds a shader and uniform values. Users can duplicate the resource, make it local to a scene, or reuse one material on many objects.

Godot also supports per-instance uniforms for `spatial` and `canvas_item` shaders. The documentation gives a practical maximum of 16 per-instance uniforms per shader. [Shader-language uniform documentation](https://docs.godotengine.org/en/4.7/tutorials/shaders/shader_reference/shading_language.html)

Consequently:

- One shader can produce effectively unlimited authored material resources.
- One material can vary across objects without creating unique materials.
- `Material.next_pass` can layer additional passes.
- `StandardMaterial3D` generates internal shader code based on enabled features.

These variants must not be counted as independent library shaders. They are combinations of a smaller implementation set.

## What a Godot user actually gets “out of the box”

A fresh Godot 4.7.1 installation gives the user:

- The nine configurable built-in material implementations.
- Environment, camera, lighting, fog, glow, tone-mapping, and screen-space systems.
- Six high-level shader domains.
- The shader language and its built-in functions.
- The VisualShader graph system.
- Low-level RenderingDevice compute-shader support.

It does **not** place 2,297 community shaders or 164 Asset Library packages into the project. Those require discovery and installation. The 49 official demo shader files also live outside the engine’s default project template.

## Gaps and cautions

- Godot publishes no canonical “number of shaders” metric.
- Internal backend shader permutations depend on renderer, platform, feature flags, and material configuration; no useful user-facing count was found.
- Official demo file counts do not equal semantic effect counts.
- Asset Library entries are packages, not shaders.
- GodotShaders posts are community submissions, not a reviewed compatibility set.
- VisualShader nodes, overloads, and menu registrations are construction primitives, not complete effects.
- No quality or visual review was performed.
- No semantic deduplication across the Asset Library, official demos, and GodotShaders was attempted.

## Bottom line for BroMetal

The honest Godot comparison is:

- **Single digits** of broad built-in material implementations.
- **About a dozen** configurable renderer/environment feature families.
- **Hundreds** of low-level graph/function building blocks.
- **Dozens** of official example shader files.
- **Hundreds** of official Asset Library packages.
- **More than two thousand** direct community shader posts.

A BroMetal catalog aiming for Godot-like practical reach should compare itself primarily with the 2,297-post community discovery surface - not with Godot’s nine built-in materials or its internal renderer shader files.
