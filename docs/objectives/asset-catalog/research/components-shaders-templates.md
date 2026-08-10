# Components, shaders, templates, and procedural tools

Research snapshot: 2026-08-09

## Recommendation

Create a second catalog direction for **reusable game-building software** rather than folding code into the CC0 media catalog. The same search experience may surface both, but the records, badges, downloads, and agent instructions must keep them distinct:

- `asset`: art, audio, fonts, textures, models, sprites, and other game content. The preferred license is CC0.
- `component`: source code, shaders, templates, generators, prefabs, plugins, and sample projects. These may be CC0, MIT, BSD, Apache-2.0, zlib, or copyleft software.

CC0 is a public-domain dedication intended to waive copyright and related rights as far as law permits. It does not clear patents, trademarks, privacy, publicity, or third-party rights. MIT, Apache, and GPL are software licenses with continuing conditions rather than “no rights reserved.” MIT requires preservation of its copyright and permission notice; Apache-2.0 adds express patent terms and redistribution/NOTICE duties; GPL can require corresponding source when covered software is conveyed. See the canonical [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/), [MIT text](https://opensource.org/license/mit), [Apache guidance](https://www.apache.org/legal/apply-license), and [GPL FAQ](https://www.gnu.org/licenses/gpl-faq.en.html).

This is a product and ingestion policy, not legal advice. Its practical benefit is important: an agent can safely copy a CC0 texture without inventing an attribution workflow, while an MIT shader must travel with its notice and a GPL plugin must not silently become part of a closed-source game.

## Source shortlist

| Priority | Source | What is useful | License evidence and boundary | Ecosystems / formats | Ingestion feasibility and caveats |
| --- | --- | --- | --- | --- | --- |
| P0 | [Godot Shaders — CC0 archive](https://godotshaders.com/shader-license/cc0/) | 2D canvas, spatial, sky, post-process, water, outline, palette, dissolve, and VFX shaders | Each post selects CC0, MIT, or GPLv3. The site's [license policy](https://godotshaders.com/license/) expressly says the selection covers shader code and snippets, **not** featured images, screenshots, videos, or depicted assets. | Godot shader language; GLES2/GLES3 and Godot-version tags appear on posts | Strongest true-CC0 code lead. Crawl only the CC0 archive; retain post URL, author, displayed license, engine/version tags, and code license comment. Use screenshots only as remote previews unless separately cleared. Community submissions still need provenance review. |
| P0 | [Godot Asset Library](https://godotengine.org/asset-library/asset?category=3&filter=CC0&sort=updated) | Plugins, scripts, shaders, templates, demos, tools, and projects | License is recorded per entry; the official library can be filtered to CC0. Godot's demo-contribution guidance permits CC0 for included assets, but repository contents still need per-file inspection. | Godot addons, `.gd`, `.gdshader`, `.tscn`, `project.godot`, ZIP/Git repositories | Excellent structured discovery feed. Index metadata first; import only a pinned release after checking the repository license, submodules, bundled media, engine compatibility, and whether download URLs remain stable. Do not infer that every Godot Asset Library item is CC0. |
| P0 | [Godot demo projects](https://github.com/godotengine/godot-demo-projects) | Runnable 2D/3D, audio, GUI, networking, physics, compute, shader, XR, and platform examples | Repository states that demos are MIT licensed. Its branches map to engine versions. | Complete Godot projects; mostly GDScript, with C#, GDShader, GLSL, and JavaScript | High-value agent reference corpus. Split at folders containing `project.godot`; pin a stable engine branch/tag. Inspect each demo for third-party media and preserve `LICENSE.md`. Catalog as sample projects, not CC0 assets. |
| P0 | [Three.js examples and addons](https://github.com/mrdoob/three.js/) | Materials, post-processing, particles, loaders, controls, WebGPU/TSL shaders, procedural geometry, XR, and complete browser examples | The repository [license](https://github.com/mrdoob/three.js/blob/dev/LICENSE) is MIT. Examples frequently load third-party models, textures, fonts, and services whose rights are not proven by that top-level license. | JavaScript/ES modules, HTML, GLSL, WGSL/TSL, WebGL, WebGPU | Index source examples by category and imports; link/pin rather than repackage initially. Extracting a “component” requires dependency analysis and the MIT notice. Do not redistribute example media until each file has separate evidence. Version drift is material for shader internals and addons. |
| P0 | [Phaser examples](https://github.com/phaserjs/examples) | Thousands of focused 2D examples covering sprites, tilemaps, cameras, animation, particles, physics, input, and shaders | The project explicitly says example **source code is MIT but assets are not** and warns that much of the bundled art cannot be used in commercial/ad-supported games. | JavaScript, HTML, Phaser 3/4 examples and JSON index | Very useful code-only catalog. Ingest source metadata and screenshots made by our renderer; exclude all bundled media and examples that cannot run after substituting cleared fixtures. Version Phaser 3 and 4 separately. This is a model test case for code/media license separation. |
| P0 | [PlayCanvas Engine examples](https://github.com/playcanvas/engine) | Reusable render scripts, shaders, post effects, procedural sky/water, particles, WebGPU/WebGL/WebXR, glTF and Gaussian splat examples | Repository is MIT. The [example authoring documentation](https://github.com/playcanvas/engine/blob/main/examples/README.md) shows source modules can reference local files, CDN scripts, and external dependencies, so top-level licensing alone is insufficient for everything an example loads. | JavaScript modules, GLSL/WGSL, WebGL/WebGPU/WebXR, glTF, GSplat | Examples have a regular directory convention and generated thumbnails, making metadata extraction feasible. Pin a release; record external imports and test examples offline before calling them portable. Consider the MIT [create-playcanvas](https://github.com/playcanvas/create-playcanvas) scaffolder as a separate template/tool record. |
| P1 | [Babylon.js](https://github.com/BabylonJS/Babylon.js) and official samples | Materials, node/shader examples, particles, physics, GUI, loaders, procedural textures, WebGPU/WebGL/WebXR | The engine repository carries [Apache-2.0](https://github.com/BabylonJS/Babylon.js/blob/master/license.md), including notice preservation, modified-file notices, and patent terms. Sample repositories and assets must be checked independently. | TypeScript/JavaScript, GLSL/WGSL, Node Material graphs, WebGL/WebGPU/WebXR | High usefulness but more complex ingestion because examples are distributed across engine, docs, Playground snippets, and asset hosts. Start with official repository examples that have a resolvable commit and dependency graph; link Playground snippets rather than mirroring opaque external resources. |
| P1 | [gl-transitions](https://github.com/gl-transitions/gl-transitions) | Portable transition shaders with uniform conventions and previews | Top-level license is MIT, but its [license file](https://raw.githubusercontent.com/gl-transitions/gl-transitions/master/LICENSE) says an individual transition may declare a different license in its header; otherwise MIT applies. | GLSL fragment shaders; adapters exist for WebGL/video ecosystems | Highly ingestible: one transition per file with predictable metadata. Parse every header, reject unclear or non-approved overrides, preserve author/license, and validate compile/render against a pinned harness. Do not collapse the collection to a single repository-level license. |
| P1 | [FastNoiseLite](https://github.com/Auburn/FastNoiseLite) | Portable cellular, value, Perlin/OpenSimplex-style noise for terrain, textures, clouds, maps, and shader effects | Repository is MIT. | C++, C#, C, Java, HLSL, GLSL, JavaScript/TypeScript, Rust, Go, Zig, and more | Excellent procedural building block. Catalog language ports as variants of one component and pin upstream releases. Generate our own deterministic previews from recorded seeds rather than treating outputs as upstream media assets. Test known seeds and language/version compatibility. |
| P1 | [WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) | Reference implementation and patterns for procedural tilemap, bitmap, and level generation | Code is MIT, but the [license file](https://raw.githubusercontent.com/mxgmn/WaveFunctionCollapse/master/LICENSE) expressly excludes provided image samples and tiles from the software license. The README credits many samples from unrelated works. | C# reference implementation; community ports exist for many engines/languages | Index the algorithm/reference code and vetted ports separately. Never ingest the repository's sample images or tiles as cleared assets. Demonstrations should use catalog-owned CC0 inputs and record seed, model, and constraints. |
| P1 | [raylib](https://github.com/raysan5/raylib) examples and [project creator](https://github.com/raysan5/raylib-project-creator) | More than 140 focused C examples, shader/post-processing examples, procedural image tools, and a complete project scaffolder | raylib uses the permissive zlib/libpng license. Its README also points to bundled dependencies with their own licenses. Generated project source defaults to MIT according to the project creator documentation. | C/C99, GLSL, native platforms and HTML5/WASM; many third-party language bindings | Straightforward to index by example file and release. Preserve zlib notice, inventory `src/external`, and do not inherit license claims across unofficial bindings. Use the creator as a tool/template rather than shipping generated projects as independently authored catalog assets. |
| P1 | [Bevy examples](https://github.com/bevyengine/bevy/tree/main/examples) | ECS patterns, 2D/3D rendering, UI, audio, shaders, animation, picking, scenes, states, and procedural examples | Bevy code is dual MIT/Apache-2.0 at the user's option, but the project warns that example assets use different open licenses documented in `CREDITS.md`, and some source files/crates have additional notices. | Rust, WGSL, Bevy scenes/assets | Valuable for Rust agents. Split code from media; retain the chosen license path and additional notices; pin to a Bevy release because APIs change quickly. Treat each example's asset closure as a dependency manifest, not as a blanket-cleared pack. |
| P1 | [Effekseer](https://github.com/effekseer/Effekseer) | Cross-engine particle/VFX authoring tool, runtime, sample effects, and integrations | Core repository is MIT but contains separate tool/runtime license files and submodules. Resource/sample data needs its own verification. | Native tool/project formats; Unity, Unreal, Godot, Cocos2d-x and custom engine runtimes; DirectX/OpenGL/Vulkan | Catalog the authoring tool and runtimes first. Effects should be separate records only after their textures/models and exact license are verified. Binary mirroring is low priority due size/platform churn; link pinned releases. |
| P2 | [libGDX](https://github.com/libgdx/libgdx) and [gdx-liftoff](https://github.com/libgdx/gdx-liftoff) | Cross-platform Java game framework examples plus a modern project generator | libGDX and gdx-liftoff are Apache-2.0. Dependencies, generated project dependencies, and test assets remain separate review targets. | Java/Kotlin, Gradle, desktop/mobile/web/iOS | Useful ecosystem direction, especially templates. Prefer structured generator metadata and official tests/examples. Preserve LICENSE/NOTICE and record dependency coordinates; avoid mirroring Maven artifacts. |

## Sources to index cautiously or exclude

- **GPL-only plugins and shaders:** searchable as a clearly labeled opt-in software class, but excluded from the default “drop into any game” results. Godot Shaders allows GPLv3 alongside CC0 and MIT, so a source-wide “free” label is unsafe. The [GNU guidance](https://www.gnu.org/licenses/quick-guide-gplv3.html) explains the corresponding-source obligation on distribution.
- **Unity and Unreal samples/templates:** do not assume “free” means reusable outside the vendor ecosystem. Their marketplace/sample terms can be account-, engine-, or product-specific rather than CC0 or an OSI license. They should enter only after a separate terms review and should never receive a CC0 badge.
- **Shadertoy and arbitrary shader galleries:** treat as inspiration links unless the individual author supplies an explicit compatible license and provenance. Publicly viewable source is not public domain.
- **GitHub repositories without a license:** exclude from downloadable/catalog-ready results. GitHub's own [licensing documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) recommends an explicit license file and exposes machine-readable license qualifiers, but automated detection is evidence to review, not a grant of rights.
- **Examples with famous-game art, copied screenshots, trademarked characters, or unknown samples:** code may be permissive while the presentation media is not. Phaser examples and WaveFunctionCollapse demonstrate this explicitly.
- **Generated output:** a permissively licensed generator does not automatically confer rights in its inputs, model weights, reference images, or generated result. Record all inputs and their licenses.

## Proposed component record

Keep component metadata beside, but not inside, the current media schema:

```text
kind: component | shader | template | prefab | sample-project | generator | tool
ecosystem: godot | threejs | phaser | playcanvas | babylon | bevy | raylib | generic
languages: [gdscript, glsl, javascript]
runtimeTargets: [webgl2, webgpu, godot-4.5]
licenseExpression: CC0-1.0 | MIT | Apache-2.0 | MIT OR Apache-2.0 | GPL-3.0-only
licenseEvidenceUrl: exact immutable or archived license evidence
licenseScope: code-only | whole-package | per-file | mixed
noticeFiles: [LICENSE, NOTICE, CREDITS.md]
sourceRepository, sourceCommit, sourceSubpath, upstreamVersion
dependencies: package/runtime/external-file records with versions and licenses
bundledMedia: none | excluded | separately-cleared
preview: generated-by-us | upstream-remote-and-not-redistributed
validation: parsed | builds | tests | renders | human-reviewed
```

Do not expose a single `license: CC0` field for mixed packages. Use an SPDX-style expression for software and a `licenseScope` that says exactly what the evidence covers.

## Validation and ingestion pipeline

1. **Discover metadata without redistributing.** Store canonical source URL, owner, repository/subpath, release/tag or commit, claimed license, engine/runtime versions, and upstream modification date.
2. **Resolve the smallest reusable unit.** A shader file, demo directory, prefab, or generator is better than an entire monorepo. Record every file in its dependency closure.
3. **Capture immutable license evidence.** Save the exact license URL at the pinned commit and the relevant per-file header. Repository license detection alone is insufficient.
4. **Classify scope.** Distinguish source code, bundled media, documentation, screenshots, fonts, submodules, examples, and generated output. Exclude anything not affirmatively covered.
5. **Enforce policy.** Default results: CC0, MIT, BSD-2/3-Clause, 0BSD, ISC, zlib, and Apache-2.0. GPL/LGPL/MPL appear behind an explicit copyleft filter with agent-facing obligations. Unknown, custom, noncommercial, no-derivatives, vendor-restricted, or source-available licenses are discovery-only or rejected.
6. **Scan dependencies and secrets.** Parse package manifests/imports, flag remote scripts and network calls, scan archives for executables and credentials, and never execute community submissions during ingestion.
7. **Build in a disposable sandbox.** Pin the engine/toolchain, disable outbound network after dependency preparation, cap CPU/memory/time, and record logs. Shader validation should compile for declared targets; templates should build; sample projects should boot.
8. **Render our own preview.** Use cleared fixtures and deterministic seeds. A passing render does not prove license, but it proves the record is materially usable and prevents dead snippets from dominating search.
9. **Human-review high-risk records.** Mixed-license repositories, ports, vendor ecosystems, copied algorithms, bundled media, and trademark-adjacent examples require review before a “verified” badge.
10. **Revalidate on update.** A new upstream commit is a new artifact. Preserve old pinned records and rerun license, dependency, build, and render checks before advancing the catalog version.

Suggested states: `discovered` → `license-scoped` → `build-verified` → `render-verified` → `human-reviewed`. “Verified” must name the dimension; it should never imply a legal guarantee.

## Delivery direction

The first useful release should be metadata-forward and bandwidth-light:

1. **CC0 Godot shaders:** index the CC0 archive with source, author, engine tags, code, and a locally rendered preview. This is the cleanest bridge from assets to executable building blocks.
2. **Official web examples:** index code-only units from Three.js, Phaser, and PlayCanvas, with all bundled media excluded until separately cleared. These directly support browser games and agent workflows.
3. **Procedural primitives:** publish FastNoiseLite and WaveFunctionCollapse as components plus runnable recipes that consume existing CC0 catalog assets.
4. **Godot official demos:** catalog complete, version-pinned sample projects with dependency/media manifests.
5. **Broader engines and VFX:** add Babylon.js, Bevy, raylib, Effekseer, and libGDX once the common build/notice pipeline exists.

For downloads, initially point to pinned upstream source/release archives and provide an agent-readable install recipe plus required notices. Mirror a component only when reproducibility or upstream availability justifies the storage and when all files in the mirrored closure have passed scope review. This avoids turning the catalog into a package registry before its licensing and build contracts are ready.

## Concrete pilot

A 100-record pilot can prove the direction without pretending the ecosystems are homogeneous:

- 35 CC0 Godot Shaders records across canvas, spatial, sky, and particles/VFX.
- 15 Three.js code-only examples, emphasizing TSL/WebGPU, post-processing, procedural geometry, and controls.
- 15 Phaser code-only examples spanning sprites, tilemaps, animation, physics, and particles, rendered with replacement CC0 fixtures.
- 10 PlayCanvas examples with no unresolved CDN or media dependencies.
- 10 official Godot demo projects on one stable engine branch.
- 5 gl-transitions shaders with verified per-file headers.
- 5 procedural recipes using FastNoiseLite.
- 5 procedural tile/level recipes using WaveFunctionCollapse with catalog-owned CC0 inputs.

Pilot acceptance requires an immutable license-evidence link, explicit license scope, zero unknown bundled files, a reproducible build/compile result, an original preview, and an install/use recipe for every record. Measure successful agent installs and first-run renders—not raw item count.
