## Three.js shader-ecosystem scale

**Research baseline:** 2026-08-12. **Pinned release:** Three.js **r184 / npm 0.184.0**, released 2026-04-16, tag commit `d3b629c0c2097cec664ad16369bb6eae3b10e335`. The [r184 release](https://github.com/mrdoob/three.js/releases/tag/r184), [tagged package manifest](https://github.com/mrdoob/three.js/blob/r184/package.json), and [untruncated tagged Git tree](https://api.github.com/repos/mrdoob/three.js/git/trees/d3b629c0c2097cec664ad16369bb6eae3b10e335?recursive=1) make the counts reproducible. Live docs were checked on the research date; source counts use the immutable tag.

### Plain-English result

Three.js does **not** give users hundreds or thousands of independent, ready-made shaders in core. It gives them a small supported set of general-purpose material models, a much larger shader-composition vocabulary, roughly a hundred separately importable rendering-effect modules across the old WebGL and newer TSL stacks, and a **577-example official teaching corpus**. Its practical scale comes from composition, parameters, examples, and decentralized third-party packages—not from thousands of bundled named looks.

### Counts by layer

| Layer | Reproducible r184 result | What the count means |
| --- | ---: | --- |
| Classic core material classes | **18 exports**: abstract `Material` + **17 subclasses** | From [`src/materials/Materials.js`](https://github.com/mrdoob/three.js/blob/r184/src/materials/Materials.js). Two subclasses, `ShaderMaterial` and `RawShaderMaterial`, are authoring shells for custom GLSL. Excluding those and the base leaves **15 named ready material/output models**. |
| Concrete node-material classes | **16**, plus base `NodeMaterial` and `NodeMaterialObserver` | From [`src/materials/nodes/NodeMaterials.js`](https://github.com/mrdoob/three.js/blob/r184/src/materials/nodes/NodeMaterials.js). Do not add 16 to 15 as distinct looks: **13 parallel classic roles**; `Line2`, `MeshSSS`, and `Volume` are node-only, while classic depth/distance have no same-named node class. |
| Internal `ShaderLib` programs | **18 object entries** | From [`ShaderLib.js`](https://github.com/mrdoob/three.js/blob/r184/src/renderers/shaders/ShaderLib.js): basic, Lambert, Phong, standard, physical, toon, matcap, points, dashed, depth, normal, sprite, backgrounds, cube/equirect, distance, shadow. These are renderer internals/backing programs, not 18 downloadable artistic looks. `standard` and `physical` share the mesh-physical stage source. |
| GLSL `ShaderChunk` surface | **142 exposed keys** | [`ShaderChunk.js`](https://github.com/mrdoob/three.js/blob/r184/src/renderers/shaders/ShaderChunk.js) exposes **108 reusable include chunks** plus **34 complete vertex/fragment stage strings** for 17 imported ShaderLib sources. The directory has 110 chunk files; `default_vertex` and `default_fragment` are not exposed in the map. |
| Public TSL namespace | **631 named exports** | Counted from the single export list in the tagged generated [`build/three.tsl.js`](https://github.com/mrdoob/three.js/blob/r184/build/three.tsl.js), which is the `three/tsl` package export. This includes constants, types, operators, accessors, color utilities, BRDF functions, noise, packing, passes, compute/storage operations, and material helpers. It is emphatically **not 631 complete shaders**. |
| Official gallery | **577 examples** | Exact sum of arrays in tagged [`examples/files.json`](https://github.com/mrdoob/three.js/blob/r184/examples/files.json): 219 WebGL, 26 WebGL postprocessing, 48 WebGL advanced, 4 WebGL/TSL, 203 WebGPU/WIP, and 77 other examples. There are 578 top-level HTML files because `index.html` is not a gallery example. |
| Rendering-labeled gallery lower bound | **115 entries** | Exact identifier match against `(^|_)(shader|materials?|postprocessing|effects?)(_|$)` in `files.json`. This is a reproducible lower bound on explicitly rendering-themed demonstrations, **not 115 independent reusable shaders**; several demonstrate the same material or effect in different setups. |
| Legacy addon shader modules | **52 `.js` files** | Count of tagged [`examples/jsm/shaders/`](https://github.com/mrdoob/three.js/tree/r184/examples/jsm/shaders), including FXAA, SMAA, GTAO, SSAO, SSR, glitch, film, halftone, toon, volume, water refraction, color transforms, and blur kernels. File count is not effect count: some modules export multiple shader objects or supporting stages. |
| WebGL postprocessing modules | **30 `.js` files** | Count of tagged [`examples/jsm/postprocessing/`](https://github.com/mrdoob/three.js/tree/r184/examples/jsm/postprocessing). This mixes actual effects with infrastructure such as `EffectComposer`, base `Pass`, `RenderPass`, masks, save/output, and shader adapters. |
| TSL display/effect modules | **43 `.js` files** | Count of tagged [`examples/jsm/tsl/display/`](https://github.com/mrdoob/three.js/tree/r184/examples/jsm/tsl/display), including bloom, DoF, AO, SSR, SSGI, SSS, motion blur, outline, TRAA/TAAU, CRT, god rays, lens flare, chromatic aberration, and blur utilities. It also mixes effects, pass nodes, stereo utilities, and helper functions. |

The live [TSL specification](https://threejs.org/docs/TSL.html) separately lists **26 named post-processing utilities** on the research date. That list overlaps the 43 display modules and includes small color operations and pipeline/output utilities, so it must not be added to the module count.

### What “out of the box” means in Three.js

There are three different delivery scopes:

1. `import * as THREE from 'three'` exposes the classic core, including the small built-in material family.
2. The official npm package physically includes `build`, `src`, and `examples/jsm`; its exports expose `three/webgpu`, `three/tsl`, and `three/addons/*`. The [installation guide](https://threejs.org/manual/en/installation.html#addons) says addons require no separate installation but do require separate imports. Thus the 52 legacy shader modules, 30 WebGL postprocessing modules, and 43 TSL display modules ship in the same package, but are not automatically in the top-level namespace.
3. The 577 runnable gallery HTML files are maintained in the official repository/site but are excluded from the published npm `files` list. They are official sample/reference content, not installed application assets.

`ShaderMaterial` provides the escape hatch for arbitrary GLSL, while TSL provides JavaScript/TypeScript node composition that can target GLSL or WGSL. The official [ShaderMaterial docs](https://threejs.org/docs/pages/ShaderMaterial.html) explicitly position custom shaders as the route for effects absent from built-ins. The [TSL specification](https://threejs.org/docs/TSL.html) positions native modules, reuse, tree-shaking, material-node overrides, render passes, postprocessing, and compute as its scale mechanism.

### Parameterized variants

Three.js can produce far more visual outcomes than its named-class count. For example, one physical material combines metalness/roughness with optional clearcoat, sheen, iridescence, anisotropy, transmission, and dispersion, along with maps, lights, fog, shadows, skinning, morphing, instancing, tone mapping, and renderer state. The [physical-node docs](https://threejs.org/docs/pages/MeshPhysicalNodeMaterial.html) expose those features as node overrides/toggles.

**Established:** those features and define/node composition generate specialized GPU programs. **Not established and not counted:** a finite number of meaningful variants. Multiplying boolean switches would overcount impossible or visually redundant combinations; uniform values are continuous; geometry, texture, light, backend, and hardware state also affect compilation. Runtime shader-program permutations are implementation/cache entries, not curated user-facing shaders.

### What agents can learn from

**Inference from the official corpus structure:**

- Core material docs teach supported parameter semantics and stable entry points.
- Addon modules provide reusable implementation source.
- Full examples provide the most valuable integration evidence: exact imports, required geometry/textures, render targets, pass order, renderer choice, resize handling, and per-frame updates. A module alone cannot teach all of that.
- ShaderChunk and the 631-name TSL namespace teach compositional vocabulary and engine conventions, but neither is a catalog of finished looks.
- Multiple examples around the same primitive teach variants and constraints. They should remain linked to one reusable capability instead of being counted as separate shaders.

The official [WebGPU renderer guide](https://threejs.org/manual/en/webgpurenderer) says the renderer/TSL path is still experimental and recommends the official examples for supported effects. Therefore an agent also needs backend/version metadata and should not assume a WebGL addon and a TSL/WebGPU node are interchangeable.

### Community and distribution surface

Three.js has no official shader marketplace or authoritative community-shader total. The official [Libraries and Plugins](https://threejs.org/manual/en/libraries-and-plugins.html) page is a curated, community-maintained link list that warns it may be out of date; its postprocessing section names an external framework rather than enumerating shader assets. Community material/effect code is distributed through ordinary npm packages, GitHub repositories, forum posts, framework ecosystems, and application source.

Therefore **community count: gap / not reproducible from the allowed official sources**. Search-result totals, npm keyword totals, forum topics, GitHub code hits, stars, and downloads would mix libraries, demos, abandoned code, wrappers, and duplicates. Popularity would not establish visual quality, compatibility, rights, or reuse readiness.

### Reproduction notes

Using the r184 recursive tree JSON:

```sh
jq -r '.tree[].path' tree.json | rg '^examples/jsm/shaders/[^/]+\.js$' | wc -l        # 52
jq -r '.tree[].path' tree.json | rg '^examples/jsm/postprocessing/[^/]+\.js$' | wc -l # 30
jq -r '.tree[].path' tree.json | rg '^examples/jsm/tsl/display/[^/]+\.js$' | wc -l     # 43
jq '[.[] | length] | add' examples/files.json                                         # 577
jq -r '.[] | .[]' examples/files.json | rg '(^|_)(shader|materials?|postprocessing|effects?)(_|$)' | wc -l # 115
```

`ShaderChunk.js` was counted structurally: 108 imports from `ShaderChunk/`, 17 namespace imports from `ShaderLib/`, and 142 object keys (`108 + 17 × 2`). The TSL count parses comma-separated identifiers in the tagged build's final `export { ... }` statement.

### Gaps and cautions

- Directory counts omit effects implemented under other addon folders, such as water, sky, lens flare, reflectors, and refractors; this is why the module rows are scoped directory counts, not a total effect count.
- Example count measures runnable demonstrations, not reusable units or quality.
- Module count does not reveal how many exports are complete shaders versus helpers/stages.
- Node and classic implementations frequently express the same visual model and must not be summed as distinct looks.
- No authoritative official count exists for third-party shaders or parameter variants.
- Nothing in these quantity counts establishes quality.
