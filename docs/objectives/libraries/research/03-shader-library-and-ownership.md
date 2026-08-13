# Shader library, recipe, and ownership directions

Research date: 2026-08-12

## Recommended direction

Do not start a second BroMetal shader collection inside Antiky. Treat the shader “library” as a
layered promotion and discovery system:

```text
game-proven art implementation
  stays project-local while its assumptions are still local
        |
        +-> renderer-general math or mechanism
        |     upstream BroMetal shader-function or generic shader
        |
        +-> repeated Antiky render capability
        |     BroMetalRenderDriver feature behind semantic Antiky data
        |
        `-> semantic material/effect recipe
              Antiky record: meaning, inputs, defaults, assets, passes,
              compatibility, provenance, and evidence
```

This direction answers the question in [`idea.md`](../idea.md): the shader code is BroMetal code,
but the meaning of using it in an Antiky game is not. BroMetal should own reusable rendering
mechanics. Antiky should own game-facing semantics, dependency inspection, integration policy,
project identity, and evidence. A game should keep tuned implementations until reuse is actually
proven.

## Design alternatives

### A. Copy a large external shader corpus

Port or mirror ShaderToy, Three, Godot, and other examples into BroMetal.

**Strength:** Lots of visible examples can increase discovery and training familiarity.

**Weakness:** Source often depends on an implicit host ABI, assets, coordinate/color conventions,
passes, and mixed rights. A large corpus creates review and maintenance cost before Antiky knows
which effects its games need. It also duplicates a BroMetal library that already exists.

### B. Build an Antiky universal material graph

Design a renderer-neutral graph inspired by MaterialX, then compile it to BroMetal.

**Strength:** A declarative semantic format could eventually support Studio authoring and portable
material inspection.

**Weakness:** The current driver, graph, material, and compatibility interfaces remain open. This
would be a broad abstraction before real Antiky slices establish stable cut points. MaterialX is a
strong semantic reference, but reproducing it is not an 80/20 solution.

### C. Layer BroMetal primitives, Antiky recipes, and project examples

Use existing BroMetal functions and programs; add semantic catalog records and small runnable
recipes; promote only mechanics proven by real game work.

**Strength:** Aligns with accepted ownership, avoids duplication, and lets natural interfaces
emerge. It gives agents context without pretending code alone is reusable.

**Cost:** Some project code remains duplicated temporarily, and the semantic recipe needs a future
driver/material contract before it becomes directly installable.

**Inference:** C is the appropriate near direction. B remains a possible future authoring decision
if repeated recipes reveal a stable graph. A is useful for inspiration and focused ports only after
item-level rights and host assumptions are established.

## Artifact classes must stay explicit

### Shader function

A typed GPU function such as noise, a color transform, shadow sampling, or a wave operation. It has
typed parameters, no implicit game meaning, and can be compiler-inlined. This is already a strong
BroMetal surface.

### Complete program

One compiled vertex/fragment or compute program with attributes, resources, and pipeline-facing
state. A generic fullscreen effect can sometimes be reusable at this level. It still needs a
binding contract and reference geometry.

### Material recipe

A semantic use of one or more programs: parameter meanings and defaults, texture/color roles,
geometry expectations, render state, update cadence, and supported variations. This is where “wet
stone,” “windy cutout foliage,” or “2.3D sprite receiving world light” begins to make sense.

### Multipass effect recipe

Programs plus pass order, target formats, clear values, resource edges, camera/light inputs,
history/feedback behavior, and composition rules. Shadows, water reflection/refraction, bloom, and
many post effects live here.

### Renderer capability

A repeatable Antiky feature that owns allocation, replacement, diagnostics, and disposal through
the BroMetal driver. When several games hand-roll the same multipass mechanism, that is a signal to
grow the driver, as ADR 0021 requires.

### Runnable example

A minimal reference scene that supplies real geometry, assets, bindings, camera, lighting, and
capture evidence. It teaches use and supplies a verification fixture. It is not automatically a
runtime dependency.

## What the semantic record needs

The record should reuse reflection produced by the BroMetal compiler rather than duplicate types
and bindings in prose. It should add the meaning reflection cannot express:

### Identity and classification

- stable catalog ID, record version, artifact class, owner, maturity, and source revision;
- relation to other artifacts, such as “recipe uses program” or “function extracted from effect”;
- whether the record is generic BroMetal, Antiky driver-backed, or project-local reference.

### Interface semantics

- role, type, default, allowed range, step, unit, coordinate space, and color space;
- whether an input is required, optional, host-supplied, material-authored, frame-updated, or
  pipeline-specialized;
- texture semantic, sampler expectations, premultiplication, and fallback behavior; and
- geometry attributes and topology, instance layout, outputs, and alpha/depth meaning.

### Context and dependencies

- shader-function/include closure;
- source and generated artifacts with hashes and compiler versions;
- textures, models, atlases, lookup tables, and preview-scene assets;
- render state, targets, pass ordering, inputs/outputs, and clear rules;
- Antiky render feature or project service dependencies; and
- required WebGPU features, limits, formats, and known target constraints.

### Compatibility

- BroMetal version or range and generated-layout/compatibility hash;
- Antiky schema/driver capability revision when applicable;
- `verified`, `declared`, `unknown`, or `incompatible` state for each claimed target; and
- migration notes and the last valid tested revision.

### Evidence

- compiler and generated-output parity results;
- structured diagnostics and interface reflection;
- exact runnable reference scene and inputs;
- captured environment, target profile, browser/runtime, resolution, and date;
- performance measures with qualified scope; and
- human visual verdict when the claim is aesthetic rather than mechanical.

### Rights and provenance

- source URL/path and immutable revision;
- declared and concluded license or `NOASSERTION`;
- copyright, attribution, notices, modifications, and derivation chain; and
- separate rights for code, textures, models, fonts, preview media, and generated descriptions.

## External precedents worth borrowing

### WGSL and WebGPU

They provide the normative target, typed stages/resources, formal validation, compilation
diagnostics, and a conformance suite. They do not define library descriptions, units, parameter
roles, previews, or host integration. Valid WGSL is a necessary low-level gate, not a complete
library record.

### MaterialX

MaterialX is the strongest semantic precedent. Node definitions can carry typed ports, defaults,
versions, target restrictions, UI labels/groups, ranges, steps, units, color spaces, and
target-specific implementations. Its separation of semantic graph from implementation is useful.
Its full graph and exchange model is much larger than Antiky should adopt before repeated recipes
justify it.

### Three TSL

TSL demonstrates typed composition inside JavaScript/TypeScript, shared functions/uniforms, defined
material slots, and runnable examples. It can target WGSL and GLSL within Three's execution model.
That is portability within one host, not proof that a TSL example ports semantically to BroMetal.

### Bevy

Bevy pairs a CPU material type with WGSL, making bindings and engine integration explicit. Its
examples distinguish ordinary materials, post-processing, render phases, compute, prepasses, and
advanced pipelines. This supports Antiky's need for explicit artifact classes.

### Godot

Godot exposes strong user-facing uniform hints—ranges, enums, colors, texture hints, and inspector
groups—and catalog-level version/compatibility/license/media fields. Its source language and host
built-ins remain Godot-specific. Its conversion guidance is evidence that GLSL-like syntax does not
remove coordinate, input, and engine-contract translation work.

### ShaderToy

ShaderToy is the clearest precedent for a tiny runnable preview harness. Its fixed time, resolution,
mouse, and channel ABI make examples immediately visible. Those same implicit inputs make it a poor
production portability contract. Current official default rights could not be verified during this
research, so it is discovery-only until each item's rights are established.

## Promotion rules

Promotion is not “copy the file into a library.” It is a design and evidence decision.

### Project-local to BroMetal function

Promote when the logic is renderer-general, the interface is narrow, it has no Antiky/game meaning,
and at least one real use exposes a stable typed signature. Add compiler tests and upstream it.

### Project-local to BroMetal complete program

Promote when the full program has a generic host contract and no hidden project assets/pass state.
Supply a runnable BroMetal example and record all inputs. A purely art-directed Town material will
usually fail this test.

### Project-local to Antiky recipe

Record when the effect's meaning is reusable even though bindings or assets remain Antiky-specific.
The record can initially be reference-only. It should not expose raw BroMetal GPU objects outside
the driver boundary.

### Repeated game mechanism to RenderDriver

Promote after multiple games need the same resource/pass mechanism and their differences reveal a
small semantic input. The driver owns programs and GPU lifecycle. Games own presentation meaning
and tuned values.

### Do not promote

Keep work local when its identity is the game's art direction, its interface is still entangled,
or a second use is only a copied twin of the same design. Duplication can be cheaper than a shallow
premature abstraction.

## How agents use and learn from the library

An agent should not “learn all shaders” by loading the catalog. It needs a task flow:

1. Translate the visual request into semantic and hard constraints: surface/effect role, geometry,
   pass, transparency, texture inputs, performance target, BroMetal version, and rights lane.
2. Search bounded compact records across explicit artifact classes.
3. Inspect one exact record, its interface, dependencies, compatibility, and evidence.
4. Prefer an existing driver capability or BroMetal primitive before copying a whole example.
5. Create a project-owned adaptation with `derivedFrom`, source hashes, modifications, and version
   mapping.
6. Compile and validate typed bindings before replacement.
7. Inspect the accepted runtime's material/program/pass/dependency state.
8. Capture the exact runtime/reference scene and apply a stated visual rubric.
9. Record gaps discovered during use. If the missing mechanism is general, route it to BroMetal or
   the driver rather than hiding it in another local copy.

A skill can teach this order and the current BroMetal idioms. It must point to installed package
types and real query/diagnostic services. The skill is not the catalog, compiler, renderer, or
evidence authority.

## Validation ladder

| Level | What it establishes | What it does not establish |
| --- | --- | --- |
| Rights/provenance | Antiky knows the source and intended permitted action | Code quality or compatibility |
| Compiler/parity | Source compiles reproducibly to the expected typed artifact | Runtime bindings or appearance |
| Static integration | Required resources, layouts, and dependencies resolve | Correct live state or pixels |
| Runtime inspection | The intended program/material/pass is active in a fenced build | Aesthetic correctness |
| Visual evidence | Named pixels were captured under named scene/state/environment | General visual quality across all cases |
| Human/rubric approval | The specific evidence meets a stated visual goal | Untested targets and future revisions |

Reference recipes should cover representative geometry, lighting, camera distance, textures,
blend/depth state, and pass dependencies. A pretty thumbnail is discovery material; it is not the
same artifact as a reproducible validation capture.

## Portability hazards to name, not hide

- clip and depth conventions;
- UV orientation and coordinate spaces;
- linear versus encoded color, tone mapping, and transfer functions;
- premultiplied alpha and blend state;
- culling, winding, depth state, and target formats;
- sampler behavior, texture orientation, and derivatives;
- numeric precision and optional WebGPU features/limits;
- engine-specific mesh, camera, lighting, and material ABIs; and
- multipass history, feedback, and resource lifetime.

Transpiled or syntactically valid source can still be semantically wrong at any of these seams.

## Rights caution

The root license of an engine or repository does not prove the rights for each example, media file,
or imported fragment. The installed BroMetal examples include Water Pro-derived shader files marked
“used with permission”; the scope of that private permission was not available in this research.
Those examples should be quarantined from redistribution or adaptation until the grant is reviewed.

Three, Bevy, Godot, and MaterialX all separate at least some code, example assets, or third-party
notices. Record component-level rights and derivation. Do not infer rights from popularity, public
GitHub visibility, or training-data availability.

## Decisions needed before planning

- Should the first outcome enrich BroMetal's existing generic library, create Antiky semantic
  recipe records, or deliberately do both as separate deliverables?
- Which artifact classes must be searchable in the first version?
- Is the first Antiky recipe reference-only, installable source, or a driver-backed material?
- Which Town effect is the best independent proving case, and what second consumer would count as
  genuine reuse?
- What BroMetal compatibility and target matrix is required?
- Which visual claims require human approval and evidence retention?
- Which licenses and contribution terms are admissible for distributable code?
- Does recording a new driver/material asset contract need an ADR before implementation planning?

## Raw evidence and primary sources

- [`subagent_outputs/01-current-brometal-shader-path.md`](subagent_outputs/01-current-brometal-shader-path.md)
- [`subagent_outputs/03-shader-library-precedents.md`](subagent_outputs/03-shader-library-precedents.md)
- [`subagent_outputs/05-rights-provenance-lifecycle.md`](subagent_outputs/05-rights-provenance-lifecycle.md)
- [WGSL](https://www.w3.org/TR/WGSL/)
- [WebGPU](https://gpuweb.github.io/gpuweb/)
- [MaterialX](https://materialx.org/Specification.html)
- [Three TSL](https://threejs.org/docs/TSL.html)
- [Bevy shader material example](https://bevy.org/examples/shaders/shader-material/)
- [Godot Shader](https://docs.godotengine.org/en/stable/classes/class_shader.html)
