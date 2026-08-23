# Research line B - Current BroMetal shader and Antiky render path

## Decisive findings

1. BroMetal already supplies two reusable code layers:

   - `brometal/shader-functions`: typed, documented shader helpers with transitive dependency resolution and tree-shaking.
   - `brometal/shaders`: 30 precompiled complete shaders exported as typed `CompiledShader` objects.

   Evidence: `node_modules/brometal/README.md:184-220`, `node_modules/brometal/dist/shader-functions/index.d.ts:7-44`, and `node_modules/brometal/dist/shaders/index.d.ts:1-30`.

2. The complete-shader package has weak semantic discovery. Its export index exposes shader objects by name, while human-readable metadata such as title, intended use, and texture requirements is hardcoded separately in the demo. The demo also coerces heterogeneous shaders through `as unknown as QuadProgram`.

   Evidence: `node_modules/brometal/examples/demos/ShaderLibraryDemo.tsx:51-62`, `:64-262`, `:266-270`, and `:308-321`.

3. Town shaders are not independently reusable shader snippets. They are parts of a coordinated renderer recipe containing geometry layouts, exact asset roles, render targets, pass order, uniform defaults, light-slot conventions, and disposal responsibilities. Reusing a complex Town effect therefore requires more than copying `.shader.ts`.

4. The accepted ownership direction is that Antiky should own semantic render data and a `BroMetalRenderDriver`, while only that driver directly owns BroMetal programs and GPU resources. That driver is not yet implemented. Current Antiky Town directly owns BroMetal and fits the ADR’s temporary exception path.

   Evidence: `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:31-58`; repository searches found no current `BroMetalRenderDriver`, `RenderWorld`, `ProgramSlot`, or `PipelineKey` implementation.

5. **Inference:** The cleanest eventual library boundary is layered:

   - General shader mathematics and rendering mechanics belong upstream in BroMetal helpers.
   - Fully generic, stable ready-to-draw effects can belong in BroMetal’s complete-shader package.
   - Antiky should own semantic metadata and render/material recipes.
   - Town-tuned passes should remain project-local until a genuinely independent second consumer reveals a stable abstraction.

## Source-to-program pipeline

BroMetal `0.17.2` is installed (`node_modules/brometal/package.json:2-5`).

```text
name.shader.ts
  │
  │ brometal dev / brometal prod
  ▼
parse → analyze/import closure → optimize → assign layout → emit WGSL
  │
  ▼
name.shader.gen.ts
  CompiledShader<Attributes, Instances, Uniforms>
  ├─ wgslSrc
  ├─ attributeTypes / instanceTypes / uniformTypes
  └─ compiled layout: locations, offsets, texture units, bindings
  │
  │ createProgram(renderer, compiledShader)
  ▼
BroMetalProgram
  ├─ typed attribute handles
  ├─ typed uniform/texture handles
  ├─ render-pipeline creation/cache
  ├─ bind-group creation
  └─ draw / dispose
```

Concrete evidence:

- The CLI scans for `.shader.ts`, excludes generated/build directories, compiles each source, and writes a sibling `.shader.gen.ts`: `node_modules/brometal/dist/cli/run.js:32-79`.
- Compilation runs parse, semantic analysis, optimization, layout assignment, and WGSL emission: `node_modules/brometal/dist/compiler/compile.js:7-31`.
- Imports from the built-in helper library are resolved transitively: `node_modules/brometal/dist/compiler/analyze.js:154-185`.
- The generated module exports a typed `CompiledShader` containing WGSL and interface/layout metadata: `node_modules/brometal/dist/compiler/emit-module.js:1-18`.
- Layout generation assigns attribute locations, uniform offsets/alignment, sampler units, and bind-group bindings: `node_modules/brometal/dist/compiler/layout.js:21-78`.
- `createProgram` preserves the generated attribute, instance, and uniform generic types: `node_modules/brometal/dist/runtime/program.d.ts:18-42`.
- Runtime code validates WGSL, creates shader modules and bind-group layouts, caches render pipelines, builds typed handles, validates bindings, and draws: `node_modules/brometal/dist/runtime/webgpu.js:275-324`, `:327-430`, `:467-578`, and `:643-700`.

The Aurora study provides a compact end-to-end example:

- Authored typed shader: `packages/demos/brometal/shader-study/src/shaders/aurora.shader.ts:1-70`.
- Generated typed WGSL artifact: `packages/demos/brometal/shader-study/src/shaders/aurora.shader.gen.ts:1-18`, `:169-177`.
- Program creation, buffer binding, uniform updates, and drawing: `packages/demos/brometal/shader-study/src/game.ts:9-29`.

## How Town binds the generated programs

Town currently owns its renderer directly:

- `src/game.ts` creates the BroMetal renderer and later disposes it: `packages/demos/antiky/antiky-town/src/game.ts:1-38`.
- Composition passes that renderer into the private Town runtime: `packages/demos/antiky/antiky-town/src/composition.ts:85-119`.
- The runtime imports 13 generated shader modules: `packages/demos/antiky/antiky-town/src/town/index.ts:65-77`.
- It loads fixed Town asset paths and creates the scene and shadow targets: `:79-110`, `:254-283`.
- It creates programs and binds world-specific mesh streams and uniforms: `:286-336`.
- It separately constructs water, props, awnings, foliage, actors, shadows, and post-processing: `:338-741`.
- It renders ordered shadow, scene, and post passes: `:983-1107`.
- It explicitly disposes every owned GPU resource: `:1114-1137`.

Shader generation is part of the project lifecycle:

- Production build runs `shaders:prod` before Vite; shader watch is a separate command: `packages/demos/antiky/antiky-town/package.json:6-13`.
- The `.antiky` manifest declares the separate shader watcher: `packages/demos/antiky/antiky-town/antiky-town.antiky:1-22`.
- The CLI starts shader watch, game host, build watch, and readiness tracking: `packages/cli/src/host/session.ts:304-315`, `:682-695`.
- Readiness requires a generated sibling and then a newer runtime build: `packages/cli/src/host/build-tracker.ts:176-240`; tested at `packages/cli/tests/build-tracker.test.ts:33-82`.

**Inference:** The current readiness protocol proves build convergence, not shader correctness. It observes generated-file and runtime timestamps; it does not provide structured compiler semantics, binding compatibility, or visual proof.

## Town’s project-local assumptions

A Town shader depends on contracts outside its typed program interface:

- `town-voxel` declares that output alpha stores camera distance and that shadow maps contain packed depth produced by a companion pass: `packages/demos/antiky/antiky-town/src/town/town-voxel.shader.ts:45-60`.
- Its color treatment and helper duplication are explicitly Town-specific: `:62-78`.
- Its interface includes Town material-atlas semantics, fog, shadowing, and eight fixed practical-light slots: `:91-162`.
- The runtime duplicates those light slots across several programs and assumes exactly eight: `packages/demos/antiky/antiky-town/src/town/index.ts:614-697`.
- Texture color/data roles are maintained through a project-specific semantic map and exceptions because the runtime format alone does not express those meanings: `packages/demos/tests/pipeline-invariants.test.mjs:40-91`, `:626-688`.
- Post-processing owns bloom, exposure, grading, sky, fog, and output encoding choices: `packages/demos/antiky/antiky-town/src/town/index.ts:699-741`.

The private Town renderer is deliberately duplicated between the pure BroMetal and Antiky demonstrations so each can build independently: `packages/demos/antiky/antiky-town/src/town/README.md:1-10`. Eight of thirteen shader sources are identical, while five have already diverged (`town-awning`, `town-prop`, `town-sprite`, `town-voxel`, and `town-water-features`). The broader Town directory diff is 16 changed files, with 519 insertions and 65 deletions. An invariant test notes that this Framework-free twin previously escaped coverage: `packages/demos/tests/pipeline-invariants.test.mjs:111-118`.

**Inference:** This duplication is evidence of a reusable family, but not yet proof that the whole renderer has a stable library contract. Both copies share the same authored Town assumptions.

## Artifact and dependency map

```text
BroMetal-owned
├─ DSL/types
├─ compiler and generated-module format
├─ shader-functions
├─ generic complete shaders
└─ WebGPU renderer/program/target lifecycle
          │
          ▼
Antiky project build
├─ .shader.ts authored source
├─ .shader.gen.ts committed/generated program
├─ package scripts + .antiky shaderCommand
└─ parity/readiness checks
          │
          ▼
Town-owned renderer recipe
├─ geometry and vertex-layout contracts
├─ texture assets and semantic color/data roles
├─ material/default uniform values
├─ shadow → scene → post pass graph
├─ fixed light-slot mapping
├─ draw order and render targets
└─ GPU resource disposal
          │
          ▼
Antiky semantic bridge
└─ PointLightAdapter
   stable entity ID → temporary Town render slot 0
```

The current narrow Antiky-to-render bridge is `PointLightAdapter`: it maps one stable entity to numeric slot `0`, forwards dirty power, acknowledges only after render, and rejects other bindings (`packages/demos/antiky/antiky-town/src/render/point-light-adapter.ts:14-57`). Tests cover this mapping and acknowledgement behavior (`packages/demos/antiky/antiky-town/tests/point-light-adapter.test.ts:61-120`).

## Candidate library boundaries

| Boundary | Artifact and owner | Strengths | Costs and constraints |
|---|---|---|---|
| BroMetal-native helper/effect library | BroMetal owns typed helper functions or generic `CompiledShader` exports | Exists now; typed; direct runtime fit; helper dependency resolution and tree-shaking | Must be renderer-general. Complete-shader catalog lacks strong semantic metadata. Upstream dependency is pre-1.0. |
| Antiky semantic shader/material recipe catalog | Antiky owns stable IDs, parameter meanings/defaults, texture roles, dependencies, evidence, and pass recipe; driver owns BroMetal objects | Matches Antiky’s semantic and agent-facing goals; can describe multi-pass effects and asset dependencies | Intended driver, render graph, compatibility rules, and asset schema are not implemented or finalized. A package that directly exposes BroMetal objects would cut across accepted ownership. |
| Project-local renderer/material pack | Game owns shader source, generated artifacts, assets, pass wiring, and lifecycle | Works today; preserves tuned artistic assumptions; independently buildable | Weak cross-project discovery; duplicated family can drift; reuse tends to copy the whole renderer rather than compose stable artifacts. |

**Inference:** The smallest reusable artifact differs by layer. For generic code it can be a typed helper. For a complete fullscreen effect it can be a `CompiledShader` plus a small binding contract. For Town-grade material/effect reuse, the minimum honest artifact is approximately:

```text
stable ID + authored source + generated program
+ parameter/default semantics
+ geometry/texture/material contracts
+ pass and target dependencies
+ compatibility/version data
+ validation evidence
```

A shader object alone omits too much operational meaning.

## Ownership constraints

Accepted ADR 0021 says:

- Antiky should own a `BroMetalRenderDriver`.
- Only that driver should directly use BroMetal and own programs, textures, targets, buffers, and disposal.
- Other modules should send Antiky IDs, pipeline keys, assets, and typed updates rather than BroMetal objects.
- Direct game-owned BroMetal is an exception when the driver lacks required capability; the game then owns all resource lifecycle.
- General renderer improvements belong upstream; local patches require focused upstream PRs and retirement.

Evidence: `docs/adr/framework/0021-brometal-render-driver-ownership_H.md:31-66`.

The Framework currently enforces the negative half of that boundary by forbidding BroMetal and demo imports: `packages/framework/tests/import-boundary.test.mjs:6-13`, `:27-49`.

The intended rendering architecture describes authoring → runtime → render world → driver → BroMetal and proposes asset revisions, hashes, schemas, dependencies, diagnostics, and last-good program replacement (`docs/architecture/framework/rendering-and-assets_A.md:34-100`, `:140-230`). However, that document is explicitly “In Progress” (`:1-4`) and lists the driver, graph, compatibility, manifest/compiler coordination, and package split as open decisions (`:288-295`). It should be treated as design intent, not current API evidence.

The shader-authoring skill reinforces current operational ownership: inspect installed BroMetal types, start from a nearby working shader, keep GPU resources in the renderer, retain last-good output on failure, and verify compiler/tests/browser diagnostics (`docs/objectives/skill-research/skills/write-brometal-shaders/SKILL.md:8-31`). It provides authoring guidance, not catalog metadata or an installation interface.

## Evidence and validation already present

- Repository-wide parity tests discover generated shaders, require source siblings, recompile in development and production modes, and byte-compare committed output: `packages/demos/tests/shader/output-parity.test.mjs:11-36`, `:127-202`.
- They also validate relative shader imports because stale or ignored imports can otherwise compile: `:83-125`.
- Pipeline tests inspect compiled WGSL and enforce texture-role classification, decode/encode policy, lighting, and fog agreement: `packages/demos/tests/pipeline-invariants.test.mjs:17-35`, `:626-840`.
- Material tests distinguish source wiring from actual visual effect and state that capture evidence is needed for the latter: `packages/demos/tests/material-invariants.test.mjs:84-128`.

**Inference:** A library record should link both structural evidence and visual evidence. Compilation/parity proves reproducibility; it does not prove that the shader looks correct on supported browsers and GPUs.

## Main risks

- Duplicating capabilities already present in `brometal/shader-functions` or `brometal/shaders`.
- Choosing a shader-only unit when the reusable behavior is a material or multi-pass renderer recipe.
- Establishing an Antiky API around direct BroMetal objects before the accepted driver boundary exists.
- Semantic metadata drifting independently from source, as it already can in BroMetal’s demo-only catalog.
- Texture color-space, asset-role, and output-encoding assumptions remaining encoded in names and test exception maps.
- Copy-based Town reuse continuing to diverge.
- Treating build success or generated-byte parity as visual correctness.
- BroMetal’s pre-1.0 evolution and the project’s pinned, locally patched dependency. Five postinstall patches currently target `0.17.2`: `scripts/patch-brometal.mjs:14-39`. The patch runner checks every installed copy and fails on unexpected versions/targets (`:41-120`).
- General renderer additions becoming permanent local patches instead of upstream contributions, contrary to ADR 0021 and the patch workflow.

## Explicit unknowns

- The final `BroMetalRenderDriver`, render graph, program-slot, layout-compatibility, and material schemas.
- Whether shader records extend the general Antiky asset catalog or form a separate semantic catalog.
- The stable version/hash/compatibility contract for generated `CompiledShader` modules.
- Which parameter ranges, defaults, capability requirements, and shader permutations must be portable.
- Whether any Town shader has a truly independent second consumer; the present twin is intentionally copied from the same Town design.
- The eventual Studio/CLI/MCP discovery and installation surface for agents.
- BroMetal upstream plans for semantic shader metadata or material/pass recipes.
- Current upstream status of the five local patch PRs.
- Distribution and provenance requirements for authored source versus generated WGSL.
- Required cross-browser/GPU performance and visual baselines.

This was a read-only source review; no files were changed and no test suite was executed.
