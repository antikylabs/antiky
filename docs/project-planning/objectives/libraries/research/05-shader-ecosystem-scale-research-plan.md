# Shader ecosystem scale: supplemental research plan

Research date: 2026-08-12

## Why this supplement exists

The original research interpreted “shader library” primarily as a small set of reusable shader
functions, complete programs, and semantic integration recipes. The owner clarified that the
intended comparison is an expansive catalog with hundreds or thousands of shaders, similar to the
body of ready-made effects, materials, examples, and community content available around mature game
platforms.

This supplement corrects the unit of comparison before planning.

## Questions

1. What shader, material, post-effect, and related rendering content ships out of the box with
   Three.js, Unreal Engine, Unity, Godot, and Phaser?
2. What additional content is maintained as official examples, samples, starter content, or
   packages rather than engine built-ins?
3. How large is each current community or marketplace discovery surface, where an authoritative
   count or reproducible lower bound is available?
4. What does each ecosystem call a reusable unit: shader, material, material function, graph,
   render feature, pipeline, effect, template, or complete sample?
5. Does ecosystem value come from the number of independent source shaders, the number of parameter
   combinations, the size of the examples corpus, community distribution, or some combination?
6. What would “hundreds or thousands of BroMetal shaders” need to contain and expose to offer a
   comparable practical advantage?

## Why each question matters

1. It establishes the honest out-of-box baseline rather than assuming mature engines ship
   thousands of independent shaders.
2. It distinguishes product capability from an educational/reference corpus.
3. It measures the ecosystem network effect the owner wants to reproduce.
4. It prevents unlike counts - for example material instances, graph nodes, and complete effects - from
   being presented as comparable shaders.
5. It identifies the actual source of agent training context and developer leverage.
6. It turns ecosystem scale into a useful Antiky/BroMetal direction rather than a vanity count.

## Lines of inquiry

### Three.js

Count or enumerate current core material/shader surfaces, ShaderLib/ShaderChunk/TSL primitives,
official shader/material examples, and community distribution patterns. Use current official docs
and the official repository. Return exact counts only when reproducible and label lower bounds.

### Unreal Engine

Separate built-in shading models, material domains, material expressions/functions, engine/starter
content, official samples, and Fab community products. Use Epic documentation, source manifests
where publicly accessible, and Fab only for reproducible category counts. Do not equate nodes,
instances, and independent shaders.

### Unity

Separate Built-in Render Pipeline, URP, HDRP, Shader Graph nodes/samples, official sample packages,
and Asset Store content. Use Unity manuals, package documentation/repositories, and current store
facets when countable. State pipeline/version scope.

### Godot

Separate built-in material/resource types, standard shaders, official demos, the official Asset
Library, and community shader sites. Use Godot docs and repositories plus direct current catalog
counts where reproducible. State engine-version compatibility.

### Phaser

Separate default WebGL pipelines, built-in FX, official examples, Phaser templates/examples, and
community plugins. Use Phaser API docs and official repositories. Explain how a 2D framework changes
the comparison.

Each inquiry must distinguish established counts, publisher claims, reproducible lower bounds,
inferences, and gaps. Popularity is not quality evidence.

## Counting model

Every result should be assigned to one of these rows before comparison:

| Layer | What counts |
| --- | --- |
| Built-in visual models | Named materials, shading models, or ready effects exposed as supported product features |
| Low-level building blocks | Shader chunks, graph nodes, material expressions/functions, or typed shader functions |
| Official reusable content | Samples, examples, starter assets, templates, or packages maintained by the platform owner |
| Community catalog | Discoverable third-party shaders, materials, effects, plugins, or packs |
| Parameterized variants | Material instances, presets, or combinations generated from a smaller implementation set |

Counts from different rows are not added into one “number of shaders” without retaining the row.

## Out of scope

- Judging visual quality from marketplace quantity, screenshots, or popularity.
- Mirroring or licensing any external shader corpus.
- Designing the final BroMetal schema or implementation plan.
- Counting every internal engine shader permutation as a user-facing shader.
- Treating graph nodes or parameter presets as independent complete effects.

## Known constraints

- BroMetal is Antiky's rendering foundation and renderer-general work should be contributed there.
- Antiky keeps semantic game/material meaning, project identity, inspection, and evidence.
- BroMetal already ships 30 complete shaders and a typed function library, but that baseline is much
  smaller than the owner's intended ecosystem-scale catalog.
- Shader source, example assets, previews, engine compatibility, and dependencies require separate
  rights and provenance records.
- Counts and platform surfaces are fast-moving. Every result needs a research date, source, and
  explicit scope.
