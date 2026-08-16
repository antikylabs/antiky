# Shader ecosystem scale and the corrected BroMetal direction

Research date: 2026-08-13

## Plain-English answer

The large shader libraries around mature platforms are real, but they do not usually arrive as
thousands of polished shaders inside a blank project.

The common pattern is:

1. The engine ships a small set of broad, well-supported material and effect models.
2. It supplies hundreds of functions, graph nodes, examples, or internal/reference assets that
   users can compose.
3. A separate sample, package, marketplace, or community catalog grows into the hundreds or
   thousands.

Godot is the clearest direct example. Godot 4.7.1 has nine configurable built-in material
implementations. Its official Asset Library has 164 shader-category packages across versions. The
separate GodotShaders community site has 2,297 shader posts. Unity follows the same pattern: URP
exposes 13 canonical shader IDs, while the Asset Store has 2,323 shader products.

The owner's intended BroMetal library is therefore not comparable only to an engine's built-in
material classes. It is closer to the combined official-example and community discovery surface.
BroMetal's current 30 complete shaders are a seed, not the target scale.

## The counts, without mixing unlike units

| Platform | Broad built-in models or effects | Building blocks and installed implementation assets | Official examples or samples | Community or marketplace surface |
| --- | --- | --- | --- | --- |
| Three.js r184 | 15 ready classic material/output models after excluding custom-authoring shells | 142 ShaderChunk keys; 631 public TSL exports; 52 legacy shader, 30 WebGL post-processing, and 43 TSL display modules, with overlap and infrastructure | 577 gallery examples; 115 have rendering terms in their identifiers | No authoritative total |
| Unreal Engine 5.8 | 12 concrete legacy shading models; Substrate has 7 BSDF and 5 operator node types | At least 516 installed material functions and 353 base materials; many are internal or support assets | 49 Content Examples levels, including 4 material-focused levels, plus separate sample projects | Fab claims 60,000+ Unreal assets overall; no reproducible material-only total |
| Unity 6.3 | URP has 13 canonical shader IDs; HDRP documents 10 main surface families; Built-in has 3 recommended families and more than 80 legacy shaders | Up to 209 URP or 239 HDRP source-defined Shader Graph node types | 259 graphs and 212 subgraphs in 8 declared Shader Graph sample bundles; separate URP/HDRP samples add more | 2,323 Asset Store shader products, including 273 free products |
| Godot 4.7.1 | 9 configurable built-in materials and about 11 grouped environment/camera effect families | 108 built-in function names; 111 documented VisualShader node classes | 49 shader source files across 20 official demo projects | 164 official Asset Library packages; 2,297 community GodotShaders posts |
| Phaser 4.2.1 | 21 shader-backed filters, 2 composite effect recipes, and 7 procedural shader-backed Game Object families | 56 raw GLSL modules and 18 shader-addition builders | 2,472 official examples overall; 102 conservatively categorized as filter or Shader Game Object examples | No authoritative total |

These rows are deliberately not totaled. A graph node is not a finished shader. A marketplace
product can contain one shader, one hundred shaders, or a rendering system. An example can be a
tutorial, a parameter variation, or a complete reusable effect. A material instance is a configured
use of a shader, not a new implementation.

## What each platform gives people

### Three.js

Three.js gives developers a compact default material vocabulary, low-level GLSL chunks, a large TSL
composition API, optional effect modules, and a very large official teaching corpus. Its 577
official examples are especially important because they show imports, geometry, textures, render
targets, pass order, renderer selection, resize behavior, and frame updates—not only shader source.

Its practical strength is composability and example coverage. It does not have an official shader
marketplace or a countable thousand-shader catalog.

### Unreal Engine

Unreal gives artists a deep material-authoring platform. Its installed engine has hundreds of
material functions and base material assets, but many are default, debug, editor, preview, or
renderer-support content rather than a curated shelf of artistic looks. Its graph, material
instances, Substrate composition, Starter Content, sample projects, and Fab ecosystem create the
large practical surface.

Unreal is the strongest example of hundreds-scale implementation content in the engine install. It
is not evidence that a blank project contains thousands of production-ready artistic shaders.

### Unity

Unity gives developers a few broad modern material families, hundreds of Shader Graph building
blocks and official graph samples, and a shader marketplace measured in thousands of products. The
eight official Shader Graph sample bundles contain 259 complete graph assets, but 140 are node
reference demonstrations. The more directly reusable Production Ready bundle contains 29 graphs.

Unity's 2,323 Asset Store shader products are the clearest marketplace-scale comparison, but they
are product listings rather than deduplicated shader implementations.

### Godot

Godot gives developers a small set of broad built-in materials, a shader language, VisualShader,
environment effects, official demos, and an official package catalog. The independent GodotShaders
site supplies the direct thousand-scale discovery experience: 2,297 shader posts at the research
date.

Godot is the closest precedent for the owner's idea because its catalog entries are commonly
individual shader demonstrations rather than only large commercial packs.

### Phaser

Phaser gives 2D developers a few dozen stackable filters, procedural shader-backed objects, custom
shader escape hatches, and more than 2,000 official examples. It does not need the 3D material
families found in Unreal, Unity, or Godot.

Phaser shows that a compact built-in effect vocabulary plus excellent examples can be highly useful.
It is not a thousand-shader precedent.

## What “1,000 BroMetal shaders” should mean

One number is not enough. The catalog should publish separate counts for:

- **complete implementations:** runnable surface, fullscreen, procedural, compute, or multipass
  effects with a stable host contract;
- **recipes:** complete implementations plus required passes, assets, render state, and semantic
  parameter defaults;
- **presets:** useful configured looks that share an implementation;
- **functions:** reusable typed shader logic;
- **examples:** runnable teaching and verification scenes; and
- **packs:** distribution units that can contain any combination of the above.

The main public count can be “discoverable catalog entries,” but every entry must retain its class.
Otherwise one implementation with 100 presets can make the library look larger without giving an
agent or developer 100 independently useful techniques.

A genuinely useful thousand-entry catalog would still be a major differentiator. It would be larger
than the clearly curated built-in finished-effect surface of these platforms. It would be comparable
to a focused community discovery site, not to the engine core.

## Corrected BroMetal and Antiky direction

The earlier research was right about ownership but too conservative about scale.

- Do not copy BroMetal's current shaders into a second Antiky code library.
- Do grow BroMetal into a large renderer-general shader ecosystem.
- Keep a smaller supported core separate from the large catalog so installing BroMetal does not
  force every project to carry every source file, preview, texture, and example.
- Let Antiky expose bounded discovery, semantic game integration, dependency inspection, project
  adaptation, and proof over that catalog.
- Keep project-specific art direction local until the renderer-general part is clear enough to
  contribute back.

A useful layering is:

```text
BroMetal core
  small, stable, tested shader functions and complete programs

BroMetal catalog
  hundreds or thousands of renderer-general implementations, recipes,
  presets, packs, previews, source, examples, compatibility, and rights

Antiky integration
  semantic search, install/adapt planning, game material meaning,
  driver capabilities, dependencies, project identity, and evidence

Game project
  selected adaptations, art-directed values, project assets, and captures
```

The catalog can remain static-first. Search metadata, thumbnails, and compact records can be cheap to
browse, while source, large media, and runnable examples are retrieved only when selected.

## What makes the catalog useful to agents

Quantity helps only when the examples are understandable. The Three.js corpus is instructive here:
its runnable scenes supply integration context that a raw fragment shader cannot.

Each complete BroMetal catalog entry should include:

- plain-language visual purpose, synonyms, and negative-fit notes;
- artifact class, stage, geometry, pass, lighting, and transparency expectations;
- semantic inputs with types, units, ranges, defaults, spaces, and update cadence;
- source plus the exact BroMetal/compiler compatibility range;
- textures, lookup tables, meshes, render targets, and pass dependencies;
- a minimal runnable scene and a small integration example;
- preview media tied to the exact source and scene revision;
- supported targets, known limits, performance evidence, and fallback behavior; and
- per-component license, attribution, provenance, and modification history.

An agent can then search for “stylized water for a low-poly 2.3D scene,” inspect a few compact
records, select one exact recipe, fetch its source and example, adapt it through the Antiky driver,
and verify the result. Loading a thousand raw shader files into context would not provide that
capability.

## How the catalog reaches ecosystem scale

Hand-authoring every item inside one team is not the only growth mechanism used by mature
platforms. Their scale comes from contributions, examples, packages, and remixing. A BroMetal
catalog needs the same loop:

1. Ship a useful, carefully tested core and a larger first-party seed catalog.
2. Make contribution inexpensive with a template, local preview harness, compiler checks, metadata
   validation, and capture generation.
3. Accept complete implementations, recipes, functions, and presets without pretending they are
   the same unit.
4. Keep maturity lanes such as core, verified catalog, community, experimental, and
   discovery-only.
5. Record derivation and rights before redistributing source or media.
6. Promote widely useful and well-proven entries toward the supported core without requiring every
   catalog item to meet core maintenance guarantees.

Generated variations can help create presets and training examples, but they should not inflate the
implementation count. Community quantity also does not prove quality. Search relevance, successful
integration, compatibility, evidence, and reuse are better product measures than a headline total
alone.

## Research consequence

The next planning decision is no longer “existing BroMetal shaders or a semantic recipe layer.” The
clarified decision is how to build both a stable core and a large catalog while preserving the
BroMetal/Antiky ownership boundary.

Before planning, the owner should choose:

1. Which catalog entry classes count toward the public scale goal.
2. Whether the first milestone proves the catalog system, a large first-party content seed, or both.
3. Which maturity and rights lanes can be publicly discoverable or installable.
4. Whether catalog source lives in the BroMetal repository, separate shader-pack repositories, or a
   registry that points to immutable package sources.
5. Which categories must have meaningful initial breadth: surfaces, sprites, procedural patterns,
   post-processing, transitions, simulations, lighting, environment, or debug/technical effects.

## Raw evidence and primary sources

- [`subagent_outputs/06-threejs-shader-ecosystem-scale.md`](subagent_outputs/06-threejs-shader-ecosystem-scale.md)
- [`subagent_outputs/07-unreal-shader-ecosystem-scale.md`](subagent_outputs/07-unreal-shader-ecosystem-scale.md)
- [`subagent_outputs/08-godot-shader-ecosystem-scale.md`](subagent_outputs/08-godot-shader-ecosystem-scale.md)
- [`subagent_outputs/09-unity-shader-ecosystem-scale.md`](subagent_outputs/09-unity-shader-ecosystem-scale.md)
- [`subagent_outputs/10-phaser-shader-ecosystem-scale.md`](subagent_outputs/10-phaser-shader-ecosystem-scale.md)
- [Three.js r184 release](https://github.com/mrdoob/three.js/releases/tag/r184)
- [Unreal Engine 5.8 material properties](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-material-properties?application_version=5.8)
- [Unity prebuilt shaders](https://docs.unity3d.com/current/Manual/built-in-materials-and-shaders.html)
- [Unity Asset Store shader category](https://assetstore.unity.com/vfx/shaders)
- [Godot Asset Library shader category](https://godotengine.org/asset-library/asset?category=3&max_results=500&page=0&sort=updated)
- [GodotShaders catalog](https://godotshaders.com/shader/)
- [Phaser 4.2.1 source](https://github.com/phaserjs/phaser/tree/v4.2.1)
