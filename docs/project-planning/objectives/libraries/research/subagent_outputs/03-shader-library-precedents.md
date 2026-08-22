# Shader-library precedents and portable semantics

Research date: **2026-08-12**

## Method and evidence boundary

This review uses current official specifications, documentation, repositories, and the locally installed BroMetal package. Popularity was used only to discover candidates, never as quality evidence. Official examples prove that a project can run its own artifact; they do not independently prove portability, production suitability, or visual equivalence. No cross-renderer compilation or image comparison was performed.

## Comparison

| System | Cataloged artifact | Metadata and parameters | Dependencies | Portability | Preview / validation evidence | License treatment |
|---|---|---|---|---|---|---|
| [WGSL](https://www.w3.org/TR/WGSL/) / [WebGPU](https://gpuweb.github.io/gpuweb/) | A shader module with typed entry points; it is a language contract, not a library catalog. | Typed stage IO, `@location`, `@group`/`@binding`, resources, and pipeline-time `override` constants. It does not define descriptions, units, ranges, color semantics, previews, or provenance. | WGSL is a single module and has no import facility. Host pipeline state, bind groups, resources, adapter features, and limits remain external. | Standardized WebGPU target, but portable execution remains conditional on requested features and limits. Valid WGSL alone does not prove equivalent rendering. | Formal validation, compilation diagnostics through `getCompilationInfo()`, and the [WebGPU CTS](https://github.com/gpuweb/cts). No visual catalog evidence. | The specification’s W3C license covers the specification, not arbitrary shader source. |
| [MaterialX](https://materialx.org/Specification.html) | Versioned `.mtlx` documents containing node definitions, reusable node graphs, materials, and looks. | The strongest semantic precedent: typed inputs/outputs, defaults, versions, target restrictions, UI names/groups, ranges, steps, units, color spaces, and geometry properties through [`NodeDef`](https://materialx.org/docs/api/class_node_def.html). | Explicit node graphs, standard libraries, namespaces, XIncludes, color management, and target-specific implementations. | A portable semantic graph can have either a portable graph implementation or an explicit target-specific implementation. Its current API includes a [WGSL generator](https://materialx.org/docs/api/class_wgsl_shader_generator.html), but fidelity was not tested here. | Document/tree validation, shader generation tests, the [MaterialX Viewer](https://materialx.org/Tools.html), and reference assets. Viewer renders remain project-owned evidence. | Repository code is [Apache-2.0](https://github.com/AcademySoftwareFoundation/MaterialX/blob/main/LICENSE); referenced assets and third-party content still require individual checks. |
| [Three.js TSL](https://threejs.org/docs/TSL.html) | JavaScript/TypeScript shader-node modules, material node assignments, compute nodes, and runnable examples. | Typed uniform nodes and well-defined material slots such as color, position, and roughness. Most catalog semantics remain JavaScript/API convention rather than durable descriptive metadata. | ES imports, Three objects, geometry attributes, textures, renderer state, update callbacks, and sometimes imperative setup. | TSL can emit WGSL/WebGPU and GLSL/WebGL2 through Three’s backends, but that is portability within Three’s execution model, not renderer-independent shader portability. | Extensive [live examples](https://threejs.org/examples/#webgpu_tsl_editor) and visible source. On 2026-08-12, the official [WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer) still described it as experimental and documented unsupported legacy shader extension paths. | Core repository is [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE); example textures and models need separate provenance. |
| [Bevy](https://bevy.org/examples/shaders/shader-material/) | A paired Rust `Material` asset/type plus WGSL shader asset, with pass-specific shader selectors. | Strong typed CPU/GPU contract through [`AsBindGroup`](https://docs.rs/bevy/latest/bevy/render/render_resource/trait.AsBindGroup.html): uniform, texture, sampler, and storage fields with binding indices mirrored in WGSL. | Bevy asset paths, custom `#import`, PBR includes, bind-group substitutions, mesh conventions, and pipeline specialization. | The source resembles ordinary WGSL, but preprocessing and engine ABI make it a Bevy artifact unless adapted. | Official runnable examples and typed pipeline construction. These are self-validation, not cross-engine evidence. The `latest` docs exposed Bevy 0.19.0 on 2026-08-12, so exact versions must be pinned. | Bevy is dual MIT/Apache-2.0, while its repository explicitly treats example assets through separate credits and licenses. |
| [Godot](https://docs.godotengine.org/en/stable/classes/class_shader.html) | `.gdshader` Shader resources, `ShaderMaterial`, reusable `.gdshaderinc` includes, demo projects, and Asset Library packages. | Rich user-facing uniform metadata: types, defaults, range/enumeration/color/texture hints, and inspector groups. The Asset Library also records version, engine compatibility, category, support level, author, license, media, and links. | `res://` includes, shader mode, engine built-ins, render modes, renderer choice, material state, and scene context. | Godot’s shading language is GLSL-like but Godot-specific. Its own [GLSL/ShaderToy conversion guide](https://docs.godotengine.org/en/stable/tutorials/shaders/converting_glsl_to_godot_shaders.html) documents coordinate, built-in, and host-contract translation. | Editor compilation, generated-native-code inspection, browser demos, and official demo projects. | Godot and its demo repository are MIT, but user-submitted Asset Library items have per-asset licenses; third-party notices remain necessary. |
| [ShaderToy](https://www.shadertoy.com/view/4sVfWt) | A runnable fragment/sound program under a fixed host ABI, with up to four input channels and public page metadata. | Fixed built-ins such as time, resolution, mouse, date, channel textures, and `mainImage`; weak support for custom typed parameter semantics. | WebGL2 GLSL, implicit screen-space behavior, channel configuration, sampler state, and ShaderToy host inputs. | Excellent as a portable *demo convention*, poor as production portability evidence. Ports must translate language, coordinates, texture behavior, inputs, and often pass structure. | Immediate live compile/render and sharing/embed experience - the clearest precedent for a minimal preview harness, but only within ShaderToy. | The current [terms page](https://www.shadertoy.com/terms) was blocked by a browser challenge during research, so the default source license was not verified. Do not ingest ShaderToy code without explicit item-level license or author permission. |
| [BroMetal](https://github.com/ericdrowell/brometal) | Typed `*.shader.ts` definitions compiled ahead of time to WGSL descriptors; reusable function modules; prebuilt full shaders; runnable recipes/examples. | Generated descriptors expose deterministic attributes, uniforms, binding/layout offsets, storage use, and compute state. Function-library entries are principally source plus dependency closure; they lack rich semantic, catalog, provenance, and preview metadata. | Compiler-resolved helper dependencies are explicit and tree-shaken. Runtime geometry, textures, render targets, multipass setup, and demo assets may remain outside the shader descriptor. | WebGPU-only. Generated WGSL is the lowest-level portable surface, while DSL source and compiled TypeScript descriptors retain BroMetal compiler/runtime assumptions. | Project examples, website builds, compile-time checks, and export-parity checks are useful first-party evidence. There is no independent conformance or visual-regression evidence in this review. | Official package/repository is [MIT](https://github.com/ericdrowell/brometal/blob/main/LICENSE); copied assets or adapted third-party shaders still need separate records. The locally installed baseline was **0.17.2** on 2026-08-12. |

MaterialX was at the 1.39 specification line, with 1.39.5 listed in [official releases](https://github.com/AcademySoftwareFoundation/MaterialX/releases) on 2026-08-12. The current WGSL document was a Candidate Recommendation Draft dated 2026-08-06. These and the Three, Bevy, Godot, and BroMetal version observations are fast-moving claims and should be rechecked when implementation begins.

## Established reusable practices

- Treat the reusable thing as more than source text. A useful entry combines a primary artifact with its host interface, dependencies, execution context, and evidence.
- Make the CPU/GPU interface machine-readable. BroMetal, WGSL, and Bevy demonstrate the value of typed resources, binding locations, layout facts, and stage interfaces.
- Add semantic parameter information that types cannot express: role, default, unit, color space, range, step, update cadence, ownership, required/optional state, and whether a value is runtime or pipeline-specialized. MaterialX and Godot are the clearest precedents.
- Record dependencies by class: source helpers/includes, attributes and varyings, textures/samplers, render targets/passes, host-provided values, renderer capabilities, and external assets.
- State target and execution scope precisely. “WGSL,” “WebGPU,” “BroMetal,” “Bevy WGSL,” and “visually equivalent on tested adapters” are different claims.
- Pair each artifact with a minimal runnable recipe. ShaderToy, Three, and Bevy show that previewability depends on the scene, geometry, bindings, and host behavior - not merely the shader body.
- Preserve deterministic generated reflection from BroMetal rather than duplicating it in prose.
- Treat ports and adaptations as derived artifacts with provenance links, documented modifications, and their own evidence.

## Inferred minimal portable catalog contract

A practical Antiky entry should probably contain:

- Identity: stable ID, version, artifact kind, owner, status.
- Source: authoring format, generated target, compiler/tool versions, entry points.
- Interface: typed inputs/resources plus semantic metadata.
- Context: geometry/pass/material assumptions and render state.
- Dependencies: helper closure, assets, host values, features, limits.
- Compatibility: BroMetal version range, WebGPU requirements, known platform constraints.
- Evidence: validation level, diagnostics, reference scene, preview, environment, and date.
- Provenance: source URL and revision, SPDX expression, author/copyright, modifications, attribution, and licenses for preview assets.

This should remain smaller than a universal material graph. MaterialX is a useful semantic reference, not a mandate to reproduce its entire exchange model.

## Practices to avoid

- Do not treat a screenshot, live demo, view count, tag, or project showcase as validation.
- Do not catalog source-only snippets whose attributes, bindings, textures, render state, or scene setup are implicit.
- Do not use one undifferentiated “shader” kind for helper functions, full programs, materials, multipass effects, and runnable recipes.
- Do not call transpilation semantic equivalence; backend differences can preserve syntax while changing coordinates, color, precision, blending, or texture behavior.
- Do not depend on unpinned `latest` documentation or unstable pre-1.0 package behavior.
- Do not infer an example’s license from the engine or repository license.
- Do not import ShaderToy material until its exact license and attribution requirements are directly established.
- Do not let popularity or training-data prevalence substitute for provenance, maintainability, or reproducible validation.

## Portability and licensing cautions

The highest-risk semantic boundaries are clip/depth conventions, UV orientation, coordinate spaces, color spaces and transfer functions, premultiplication and blend state, culling/depth state, texture formats and sampler behavior, derivatives and precision, optional WebGPU features/limits, mesh input conventions, and multipass feedback. A module can be valid WGSL and still be wrong for the intended host contract.

Licensing must be recorded per artifact and dependency. At minimum, retain the SPDX expression or exact terms, source URL and revision, author/copyright, modifications, attribution text, redistribution constraints, and licenses for textures, models, fonts, and preview images. Ecosystem-level MIT or Apache licensing does not automatically cover every example or asset.

## Gaps requiring follow-up

1. The objective still needs an owner decision on catalog granularity: helper function, compiled program, material binding, runnable recipe, or explicit related artifact classes.
2. ShaderToy’s current default licensing could not be verified from its protected terms page.
3. No representative corpus was compiled and rendered across pinned BroMetal/WebGPU environments; therefore portability and visual equivalence remain untested.
4. MaterialX WGSL generation coverage and fidelity against the BroMetal shader subset remain unmeasured.
5. Three TSL’s current backend equivalence, and Bevy/Godot adaptation costs, remain project claims until tested independently.
6. BroMetal’s semantic catalog gaps, compiler subset, and prebuilt shader host assumptions need confirmation against the chosen local package version.
7. No item-by-item license audit was performed for external example assets.
8. The reference-scene format, acceptable visual tolerance, adapter/browser matrix, and evidence-retention policy remain undecided.

No files were edited.
