# Issue and BroMetal surface

**Snapshot:** Checked 2026-08-14 America/Chicago (2026-08-15 UTC where GitHub timestamps crossed midnight). No files were changed.

## Findings

### Request and minimum implied contract

- **Established - issue author:** The requester is building a 16-bit canal visualization with clickable ships and a follow camera. They want:

  - lightweight position/transform tracking for a few dozen objects;
  - pointer-event-to-entity picking;
  - a 2D pan/zoom/follow camera;
  - an optional standalone package that does not touch BroMetal’s render path;
  - a low-maintenance, fork-friendly helper demonstrated by the canal project.

  Source: [issue #8](https://github.com/ericdrowell/brometal/issues/8), created `2026-08-13T22:56:46Z`.

- **Established:** The author is asking whether such a companion belongs in the ecosystem. They say they intend to build and share it; they are not asking the BroMetal or Antiky teams to implement it.

- **Inferred - minimum contract:** The smallest useful layer needs:

  1. an application-supplied entity key associated with a mutable 2D transform;
  2. add/update/remove or equivalent tracking;
  3. 2D camera position and zoom, plus optional follow-target behavior;
  4. canvas/screen-to-world conversion;
  5. hit testing that returns the same registered entity key.

  “Stable entity” here only implies stability during registration. The issue does not require durable UUIDs, an ECS, hierarchy, events, selection state, inspection, physics, or GPU picking.

- **Established omissions in the request:** Pan gestures, zoom anchoring, follow damping, rotated/scaled hit bounds, overlap priority, spatial indexing, serialization, and package/API shape are unspecified.

### What the project has answered

- **Established:** The issue remains open and has exactly one comment. The comment is by `shadowcodex`, whose GitHub `author_association` is `CONTRIBUTOR`, not `OWNER`, `MEMBER`, or `COLLABORATOR`. npm lists `ericdrowell` as the package maintainer. Therefore there is no answer from the listed BroMetal maintainer as of this snapshot.

  Sources: [issue API](https://api.github.com/repos/ericdrowell/brometal/issues/8), [comments API](https://api.github.com/repos/ericdrowell/brometal/issues/8/comments), [comment](https://github.com/ericdrowell/brometal/issues/8#issuecomment-5299608314). Comment created `2026-08-15T00:49:03Z`, updated `2026-08-15T00:49:51Z`.

- **Claimed - contributor, not maintainer direction:** The commenter says Antiky Framework and Studio are building something similar, provide “bits like” the requested features, include CLI/MCP inspection, are open source, and were planned for release “this weekend.” The issue comment supplies no API, release, demo, or test evidence for those claims.

- **Partially established:** The repository’s five current open PRs, [#3](https://github.com/ericdrowell/brometal/pull/3) through [#7](https://github.com/ericdrowell/brometal/pull/7), were all opened by `shadowcodex` on `2026-08-12` and correspond to Antiky’s patch modules. That verifies who opened the PRs and their technical subjects, but not the claim that they all originated from Antiky development.

### BroMetal 0.17.2 capability surface

npm’s `latest` tag was `0.17.2`, published `2026-08-11T07:47:21.926Z`, when checked. The installed package is also `0.17.2`. The current upstream README and installed README had the identical SHA-256 `03bc0f92…c1fec60`.

| Need | Evidence-backed BroMetal surface | Assessment |
| --- | --- | --- |
| Entity/transform tracking | The exhaustive public root export list contains no entity, scene, transform registry, hierarchy, or query API. BroMetal supplies matrices, typed uniforms, and per-instance attributes. Its GLB loader explicitly does not support node transforms. | **Established:** Rendering ingredients exist; entity ownership and transform tracking are application concerns. |
| Pointer input | `Renderer` exposes its canvas and aspect. Shipped examples attach DOM pointer listeners directly. | **Established:** Input can be implemented beside BroMetal, but BroMetal supplies no pointer contract. |
| Click-to-entity picking | No public `pick`, hit-test, ray, inverse-matrix, unproject, render-target readback, or entity-mapping API exists. Star Bro hand-writes pointer-to-plane projection for its fixed perspective setup. | **Established:** No reusable picking path exists. **Inferred:** CPU hit testing can remain outside the renderer; GPU object-ID picking needs an additional readback boundary. |
| Camera | `createCamera` supports position, rotation, `lookAt`, lens values, a cached view matrix, and perspective view-projection. | **Established:** It is a reusable perspective camera, not a 2D camera. |
| Orthographic/follow camera | The shipped Legend of Bro example explicitly says there is no `mat4.orthographic`, writes the 16-float matrix locally, and implements follow/clamping in demo code. Star Bro also implements follow behavior locally around `createCamera`. | **Established:** BroMetal proves 2D/follow rendering is possible, but those behaviors are examples rather than public helpers. |
| Render-target picking ingredients | Render targets can be drawn into and sampled by shaders. The WebGPU texture is internally created with `COPY_SRC`, with a comment saying it enables readback, but neither `Renderer` nor `RenderTarget` exposes a read operation. | **Established:** GPU-side ID rendering is expressible; supported CPU retrieval is absent. |
| Ecosystem boundary | The README defines BroMetal as a TypeScript shader compiler plus a small WebGPU runtime. | **Established:** This is the current surface. **Gap:** No maintainer has said whether a separate entity/picking/camera companion is welcomed or deliberately out of scope. |

### General upstream candidates

- **Inferred - strongest small candidate:** `mat4.orthographic`. BroMetal’s own shipped 2D example hand-rolls it and explicitly names its absence. This is renderer-general and does not introduce scene or game policy.

- **Inferred - conditional candidate:** Public render-target pixel/region readback. The internal texture already has `COPY_SRC`, but no supported public operation uses it. Readback would help diagnostics and GPU picking generally. It should only enter scope if research selects a GPU path; a few dozen 2D objects may not justify GPU picking.

- **Inferred - possible but less settled:** General inverse-matrix/unprojection support. Star Bro’s local math proves the need can arise, but the requested 2D helper can also own its simpler screen/world conversion without changing BroMetal.

No source establishes maintainer approval for any of these.

### Antiky patch state

- **Established:** [`scripts/patch-brometal.mjs`](../../../../scripts/patch-brometal.mjs) pins patch application to exactly `0.17.2` and applies five modules:

  - render-target filtering → PR #3;
  - off-screen multisampling → PR #4;
  - shader `discard()` → PR #5;
  - explicit `renderer.present()` → PR #6;
  - per-frame attribute-buffer fixes → PR #7.

- **Established:** All five PRs were open and unmerged when checked.

- **Established:** None adds entity tracking, pointer picking, orthographic projection, pan/zoom/follow behavior, unprojection, or render-target readback.

- **Planning caution:** The installed package is locally patched. Its `discard`, `present`, render-target `filter`/`samples`, and repeated-upload behavior must not be described as pristine npm `0.17.2` behavior. A companion intended for external users should not depend on them unless the corresponding PR is released.

## Evidence

Primary local sources:

- `node_modules/brometal/package.json` - version, package purpose, public export map.
- `node_modules/brometal/README.md:5-7` - compiler/runtime scope and pre-1.0 warning.
- `node_modules/brometal/README.md:168-182` - documented camera.
- `node_modules/brometal/README.md:251` - GLB node transforms unsupported.
- `node_modules/brometal/README.md:308-319` - per-instance attributes.
- `node_modules/brometal/dist/index.d.ts:1-23` - exhaustive root public exports.
- `node_modules/brometal/dist/camera/camera.d.ts:2-29` and `camera.js:2-91` - perspective camera contract and implementation.
- `node_modules/brometal/dist/math/mat4.d.ts:11-35` - no orthographic, inverse, or unprojection operation.
- `node_modules/brometal/dist/runtime/context.d.ts:32-46` - renderer public surface.
- `node_modules/brometal/dist/runtime/render-target.d.ts:3-50` - render-target public surface.
- `node_modules/brometal/dist/runtime/webgpu.js:774-831` - fixed `rgba16float` target, `COPY_SRC`, and private WebGPU binding.
- `node_modules/brometal/examples/demos/LegendOfBroDemo.tsx:92-112,324-340` - local orthographic projection and follow/clamp.
- `node_modules/brometal/examples/demos/StarBroDemo.tsx:319-340,405-428,538-545` - local unprojection, DOM pointer handling, and follow.
- `scripts/patch-brometal.mjs:14-39,105-120` and `scripts/patch-brometal/*.mjs` - exact patch set and upstream links.

Primary external sources:

- [Issue #8](https://github.com/ericdrowell/brometal/issues/8)
- [Issue API](https://api.github.com/repos/ericdrowell/brometal/issues/8)
- [Comments API](https://api.github.com/repos/ericdrowell/brometal/issues/8/comments)
- [npm latest metadata](https://registry.npmjs.org/brometal/latest)
- [npm full metadata](https://registry.npmjs.org/brometal)
- [Current upstream README](https://raw.githubusercontent.com/ericdrowell/brometal/main/packages/brometal/README.md)

## Gaps

- BroMetal’s maintainer has not answered the ecosystem/ownership question.
- The issue does not establish whether the requester wants Antiky to deliver anything or would adopt it.
- “Antiky already provides bits like this” remains a contributor claim until the Antiky research lines verify public, reusable behavior.
- The exact picking semantics and camera feel remain unspecified.
- No pristine npm tarball was installed because research was read-only. Stock differences were reconstructed from the explicit before/after patch modules.
- The installed package omits TypeScript `src/`; its source maps lack embedded `sourcesContent`. Executable `dist/*.js`, declarations, examples, registry metadata, and the current upstream README were inspected.

## Planning implications

- Scope the need as a thin companion contract, not a scene graph or general ECS.
- Do not tell the requester that Antiky already meets the need until entity, picking, camera, and external-consumption research verifies it.
- Keep BroMetal changes limited to renderer-general primitives. Entity identity, transforms, hit policy, and follow policy belong outside BroMetal unless its maintainer says otherwise.
- Compare bounded CPU hit testing with GPU ID picking before selecting an approach; the issue’s “few dozen 2D objects” makes a CPU design a credible minimal option, but that remains an inference.
- Any external delivery must work against unpatched npm BroMetal.
- Planning still needs an owner decision on whether Antiky should offer a reusable package/example, merely answer the issue with current capabilities, or wait for maintainer direction.
