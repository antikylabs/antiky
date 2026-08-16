# BroMetal 0.15 Capability Audit

Audit target: `node_modules/brometal` @ `0.15.0` (`package.json:3`), plus the
repo's local patch at `scripts/patch-brometal.mjs`.

All line references below are into `node_modules/brometal/dist/...` unless a
full path is given. The runtime is effectively one file: `runtime/webgpu.js`
(875 lines). Every other `runtime/*.js` is a two-line forwarder into it
(`runtime/program.js:10`, `runtime/render-target.js:2`, `runtime/texture.js:13`,
`runtime/storage.js:2`).

Bottom line up front: BroMetal 0.15 is a **single-color-attachment,
LDR-swapchain, fixed-format forward renderer**. It ships genuinely good shadow
and PBR *math* helpers, real compute + storage buffers, and correct mipmap /
anisotropy handling on image textures. What it does not have is any control over
**pixel formats, blend/depth state, MSAA-vs-offscreen interaction, or explicit
LOD sampling** — and those four gaps are precisely the ones that stand between
this repo and a LoL/Rocket-League-tier frame.

---

## 1. Texture formats

### What exists

`createTexture(renderer, source, options)` → `runtime/webgpu.js:839-875`.

| Capability | Status | Evidence |
|---|---|---|
| sRGB-format texture | **No** | Format hardcoded `'rgba8unorm'` — `webgpu.js:848`. No `format` option in `TextureOptions` (`runtime/texture.d.ts:2-16`). |
| Mipmap generation | **Yes** | `mipLevels = floor(log2(max(w,h))) + 1` when `filter !== 'nearest'` — `webgpu.js:844`; chain built by a real render-pass blit loop, `generateWebgpuMipmaps` at `webgpu.js:720-745`. |
| Trilinear filtering | **Yes** | `magFilter/minFilter/mipmapFilter` all set from one `filter` value — `webgpu.js:857-860`. |
| Anisotropy | **Yes, 1–16** | `maxAnisotropy: smooth ? max(1, floor(options.anisotropy ?? 1)) : 1` — `webgpu.js:865`. Silently forced to 1 with `filter: 'nearest'`. |
| Wrap modes | repeat / clamp only | `webgpu.js:856`. No mirror, no per-axis control on 2D. |
| Depth texture readable as `sampler2D` | **No** | The render target's depth texture is created `usage: RENDER_ATTACHMENT` only — `webgpu.js:766-769`, and the source comment at `webgpu.js:763` says outright *"Never sampled — it exists only so the pass can sort its own triangles."* The depth view is stashed on the private `__wgpu` handle (`webgpu.js:781`) and never surfaced as a `BroMetalTexture`. |
| Raw pixel data → 2D texture | **Only via `TexImageSource`** | `createTexture` takes `TexImageSource` (`runtime/texture.d.ts:38`) and uploads with `copyExternalImageToTexture` (`webgpu.js:851`). A `Float32Array` LUT cannot be uploaded; `ImageData` (8-bit) is the escape hatch. |
| 3D / volume textures | **Yes, rgba8unorm, no mips** | `createWebgpuTexture3D` — `webgpu.js:807-838`. Format hardcoded `webgpu.js:813`; no `mipLevelCount`, so no mip chain. Wraps on all three axes. |
| Cubemaps | **No** | `GPU_TYPES` is `float vec2 vec3 vec4 mat4 sampler2D sampler3D storage` (`dsl/types.d.ts:1`). No cube sampler, no `viewDimension: 'cube'` anywhere. |
| Texture arrays | **No** | Same reason. |
| BC / ASTC compressed textures | **No** | `adapter.requestDevice()` is called bare with no `requiredFeatures` — `webgpu.js:57`. Zero hits for `requiredFeatures` across `runtime/`. |
| `flipY` | Yes, defaults **true** | `webgpu.js:851`. GLB UVs need `{ flipY: false }`. |

### Consequences

- **No sRGB texture format is a color-management landmine.** Every albedo/basecolor
  map binds as `rgba8unorm`, so `texture(uAlbedo, uv).xyz` returns
  *gamma-encoded* values that shader code then treats as linear. The fix is
  in-repo and cheap (`pow(c, 2.2)` on sample, or a `srgbToLinear` helper) but it
  must be applied deliberately and **not** to normal/roughness/metallic maps.
  There is no way to let the hardware do it.
- **Mipmaps are generated in a `rgba8unorm` pass with no sRGB awareness**
  (`webgpu.js:710`), so mip levels are averaged in gamma space. Slightly
  over-bright minification. Acceptable; not fixable without a patch.
- **No sampled depth ⇒ no depth-buffer-based effects.** SSAO, depth-of-field,
  soft particles, depth fog, and screen-space contact shadows all need to read
  scene depth. Workaround is a **linear-depth color pass**: write depth into
  the RGBA16F target's unused channels from the main pass, or run a dedicated
  depth-prepass program into a second target. Costs an extra full-scene draw.
  This is exactly the pattern `shadowDepth` already establishes
  (`shader-functions/library-source.js:712`) — it deliberately writes *linear
  distance* to a color target rather than using a depth buffer.

---

## 2. Render targets

`createRenderTarget(renderer, { width, height, depth })` →
`runtime/render-target.js:2` → `createWebgpuRenderTarget` at `webgpu.js:746-783`.

| Question | Answer | Evidence |
|---|---|---|
| Format | **RGBA16F only, hardcoded** | `const TARGET_FORMAT = 'rgba16float'` — `webgpu.js:11`, used at `webgpu.js:750`. No format option in `RenderTargetOptions` (`runtime/render-target.d.ts:3-16`). |
| Filtering when sampled | **NEAREST. Confirmed.** | `device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' })` — `webgpu.js:761`. The docs' "sampled unfiltered" is literal. No `mipmapFilter`, no `maxAnisotropy`, no address-mode control (defaults to `clamp-to-edge`). |
| Mipmaps on targets | **No** | No `mipLevelCount` on the target texture (`webgpu.js:748-757`); `generateWebgpuMipmaps` is never called for targets. |
| Sample a depth attachment | **No** | See §1. |
| Multiple color attachments (MRT) | **No** | Both render passes hardcode a single-element `colorAttachments` array — `webgpu.js:142-157` (swapchain) and `webgpu.js:213-220` (`drawTo`). The pipeline declares one target, `webgpu.js:343-363`. The DSL `fragment()` returns exactly one `Vec4` (`dsl/types.d.ts:95`). |
| Load/preserve contents | **No — always cleared** | `drawTo` hardcodes `loadOp: 'clear'` for color (`webgpu.js:218`) and depth (`webgpu.js:229`). Every `drawTo` call wipes the target. |
| Resize | **No** | Size fixed at creation (`render-target.js:3`). Must `dispose()` + recreate. |
| Readback to CPU | **No API** | Texture is created with `COPY_SRC` (`webgpu.js:756`) but nothing exposes a copy/map path. |
| Viewport / scissor | **No** | Never called. Cannot pack a shadow-cascade atlas into one target. |
| MSAA on targets | **No — always 1x** | `internals.passSamples = 1` inside `drawTo` (`webgpu.js:235`), and the target texture has no `sampleCount`. |
| Per-`drawTo` cost | One full `createCommandEncoder` + `queue.submit` | `webgpu.js:207` and `webgpu.js:246`. |

### Consequences — this is the biggest section

- **Nearest sampling breaks the standard bloom downsample chain.** A
  Kawase/dual-filter blur assumes bilinear taps so a 13-tap or 4-tap kernel does
  the work of many more. With nearest, every tap is a point sample: you must
  hand-roll bilinear (4 taps + `fract`-weighted `mix`, ×4 for a box = 16 taps
  per texel) or accept a blocky, aliasing bloom that will crawl under camera
  motion. This is a *hard* quality ceiling on bloom, DOF, SSAO blur, and any
  temporal/upsampling filter.
- **Always-clear means you cannot accumulate across `drawTo` calls.** Everything
  writing into one target must be drawn inside a single `drawTo` callback. Fine
  for a multi-program scene pass, fatal for progressive/temporal accumulation
  without explicit ping-pong (two targets, alternate each frame — workable).
- **No MRT ⇒ deferred shading is off the table.** Forward+ is also off (needs a
  depth prepass you can sample). Plan on **forward rendering with a modest light
  count**, with light data in a storage buffer.
- **RGBA16F everywhere is fine for HDR** — this is the one format decision that
  works in our favor. An HDR scene buffer is available today.
- **A bloom chain of 6 down + 6 up = 12 separate command-buffer submissions per
  frame** (`webgpu.js:207`/`246`). Each submit has non-trivial driver cost. Budget
  for it; keep the chain shallow (4–5 levels).

---

## 3. Blending, depth, culling

`createProgram(renderer, shader, { blend })` — `runtime/program.d.ts:4-11`,
implemented in `pipelineFor` at `webgpu.js:321-381`.

| Knob | Available | Evidence |
|---|---|---|
| Blend modes | `'none' \| 'alpha' \| 'additive'` **only** | `BlendMode` — `program.d.ts:4`. Factors hardcoded at `webgpu.js:346-361`. |
| Additive formula | `src·srcAlpha + dst·1` | `webgpu.js:351-353`. **Not** premultiplied-additive (`one, one`). A glow shader must pre-multiply into alpha or output `a = 1`. |
| Premultiplied alpha | **No** | No `('one', 'one-minus-src-alpha')` option. |
| Depth write control | **Coupled to blend, not independent** | `depthWriteEnabled: blend === 'none'` — `webgpu.js:373`. You cannot have an opaque program that skips depth write, nor a blended program that writes depth. |
| Depth compare function | **Hardcoded `'less'`** | `webgpu.js:374`. No `less-equal` ⇒ **no depth-prepass + equal-test optimization**; no `greater` ⇒ **no reverse-Z** (so far-plane precision is whatever `depth24plus` gives at your near plane). No `always`/`never` for sky or debug overlays. |
| Depth test on/off | **No** | Depth is on whenever the pass has a depth attachment (`webgpu.js:369`). Skipping the test requires drawing into a `{ depth: false }` target. |
| Depth format | `depth24plus`, fixed | `webgpu.js:120`, `webgpu.js:371`, `webgpu.js:767`. No `depth32float`. |
| Stencil | **No** | Never configured. |
| Face culling | **Renderer-global only** | `cullMode: internals.cull` — `webgpu.js:365`, sourced once from `RendererOptions.cull` at `webgpu.js:86`. There is no per-program override. `frontFace` is hardcoded `'ccw'` (`webgpu.js:365`). |
| Topology | `triangle-list` only | `webgpu.js:365`. No lines, no strips, no points. |
| Polygon offset / depth bias | **No** | Never set. Shadow acne must be handled entirely by `shadowFactor`'s slope-scaled world-space bias. |

### Consequences

- **Global-only culling is a real constraint for a AAA look.** Two-sided
  foliage/cloth and single-sided closed meshes cannot coexist in one scene
  unless you run with `cull: 'none'` and pay double fragment cost everywhere,
  or use `discard()` (available thanks to the repo patch, see §8) plus
  front-facing tricks — and there is no `front_facing` builtin in the DSL either
  (grep of `compiler/emit-wgsl.js` for `front_facing`: no hits).
- **`depthCompare: 'less'` + `depthWriteEnabled` tied to blend** means the
  standard opaque→depth-sorted-transparent pipeline works, but nothing fancier.
  Skyboxes must be drawn *first* at max depth, or as a fullscreen quad in a
  separate no-depth pass.

---

## 4. Anti-aliasing

- `antialias` defaults **on** and means **exactly 4× MSAA**:
  `sampleCount: options.antialias === false ? 1 : 4` — `webgpu.js:87` and `:90`.
  There is no way to request 2× or 8×.
- MSAA is implemented as a real multisampled color texture resolving into the
  swapchain: `msaaTexture` at `webgpu.js:127-133`, and the attachment with
  `resolveTarget: swapchainView, storeOp: 'discard'` at `webgpu.js:143-150`. The
  depth texture is created at the same `sampleCount` (`webgpu.js:121`).
- Pipelines are keyed and rebuilt per `(format, sampleCount, hasDepth)` triple
  (`webgpu.js:321-326`), so a program can be used in both a 4×-MSAA swapchain
  pass and a 1× target pass — two pipelines are compiled lazily and cached.

### The critical interaction

**MSAA applies to the swapchain pass only. `drawTo` is always 1×**
(`webgpu.js:235`).

This is the single most important finding for the stated goal. The moment you
render the scene into an HDR RGBA16F target — which you must, for bloom and
tonemapping — **you lose all anti-aliasing**. The final fullscreen composite
blit into the swapchain is MSAA'd, but a fullscreen quad has no interior edges,
so 4× MSAA on it buys nothing.

Options, all in-repo:
1. **Render at 1.5–2× resolution into the HDR target and downsample** (SSAA).
   Expensive but simple, and quality is excellent. Note the nearest-sampler
   problem from §2 — the downsample must hand-roll its own weighted taps.
2. **FXAA/SMAA as a post pass** on the tonemapped LDR result. FXAA is a
   ~200-line shader and is entirely expressible in the DSL. This is the
   pragmatic choice.
3. **TAA** — needs velocity buffers (no MRT) and history reprojection with
   bilinear history sampling (nearest sampler). Very painful here. Skip.

---

## 5. Swapchain format and color space

```js
const format = gpu.getPreferredCanvasFormat();          // webgpu.js:79
context.configure({ device, format, alphaMode: 'opaque' }); // webgpu.js:80
```

- Format is whatever `getPreferredCanvasFormat()` returns — **`bgra8unorm` on
  macOS/Windows Chrome; `rgba8unorm` on some Android**. Never a `-srgb` variant:
  `getPreferredCanvasFormat()` is specified to return only `bgra8unorm` or
  `rgba8unorm`.
- **No `viewFormats`** is passed, so you cannot even create an `-srgb` view of
  the swapchain texture. Zero hits for `viewFormats` in `runtime/`.
- **No `colorSpace`** (`'srgb'` / `'display-p3'`) and **no `toneMapping`**
  (`'extended'` for HDR canvases). Zero hits.
- **`alphaMode: 'opaque'`** is fixed — the canvas can never be composited
  transparently over page content.

### Consequences

**The app must encode sRGB manually.** `gammaCorrect(color, 2.2)`
(`shader-functions/library-source.js:199`) is the intended tool, and the shipped
`shadow-scene.shader.ts` example does exactly `tonemapACES` → `gammaCorrect` as
its last two operations. There is no hardware sRGB write.

Two second-order effects worth knowing:
- Because the swapchain is UNORM and you write gamma-encoded values, the **4×
  MSAA resolve averages gamma-encoded samples**. This is the "wrong" way round
  (resolve should be linear) and shows as slightly dark edges on high-contrast
  boundaries. Universally tolerated; not fixable without a patch.
- `gammaCorrect(c, 2.2)` is the pure-power approximation, not the piecewise sRGB
  transfer function. Visible as a slight lift/crush in the darkest ~1% . An
  in-repo `srgbEncode` helper is a trivial improvement.

**No HDR / P3 output.** On an HDR display the demo renders in sRGB like
everything else. Accept it.

---

## 6. Compute shaders and storage buffers

This is BroMetal's strongest area and is genuinely capable.

- **Compute stage**: `shader({ compute(uniforms, id) {...}, workgroupSize })` —
  `dsl/types.d.ts:103-105`, default workgroup `[64, 1, 1]`. Compiled to a
  `cs_main` entry point; run with `program.dispatch(x, y, z)` where counts are
  **workgroups, not threads** (`program.d.ts:31`, impl `webgpu.js:593-620`).
- **`dispatch()` opens its own encoder and submits immediately**
  (`webgpu.js:610-619`), so it works inside or outside the render loop. Called
  inside `loop()`, it submits *before* the frame's render pass encoder finishes,
  so the ordering (simulate → draw) is correct.
- **Storage buffers**: `createStorageBuffer(renderer, Float32Array)` —
  `webgpu.js:789-806`. Declared by *element* type in the shader
  (`storage: { light: 'vec4' }` is `array<vec4<f32>>`, `dsl/types.d.ts:88-92`),
  read with `storageRead(buf, i)`, sized with `storageLength(buf)`, written from
  compute with `storageWrite(buf, i, v)` (`dsl/builtins.d.ts:13-17`).
- **Read-only storage is visible in the vertex stage**
  (`webgpu.js:311-313`) — so **GPU-driven instancing works**: a compute program
  writes a transform/visibility buffer, and a *separate* render program declares
  the same buffer read-only and reads it per-vertex. (Within a *single* shader
  module, a buffer the compute stage writes loses vertex visibility — the
  comment at `webgpu.js:307-310` explains why. So the ping-pong must cross two
  `createProgram` calls.)

### Limits

- **No CPU readback.** Storage buffers are created `STORAGE | COPY_DST` only
  (`webgpu.js:793`) — no `COPY_SRC`, no map path. GPU→CPU is impossible. So no
  GPU-side culling result feeding a CPU draw list, no GPU picking, no readback
  of a compute-computed count.
- **`write(next)` cannot resize** (`storage.d.ts:11`).
- **`Float32Array` only** (`storage.d.ts:12`). No integer or packed data.
- **Indirect draw/dispatch: not supported.** `dispatchWorkgroups` counts come
  from JS (`webgpu.js:617`); `draw`/`drawIndexed` counts come from JS
  (`webgpu.js:653`, `:656`). No `drawIndirect`. Combined with no readback, this
  caps "GPU-driven" at *GPU-computed per-instance data with a CPU-fixed instance
  count* — which is still plenty for particles.
- **No atomics, no workgroup shared memory, no barriers.** The DSL has no
  `atomicAdd`/`workgroupBarrier` (grep `dsl/builtins.d.ts` — absent). So no
  prefix sums, no GPU sorting, no compaction.
- **No storage textures.** A compute shader cannot write to a texture; only to
  buffers.

**Verdict for particles:** fully viable. Compute integrates positions into a
storage buffer; a render program reads it per-instance. `integrateVelocity`,
`integratePosition`, `verletStep`, `applyDrag`, `bounceVelocity`,
`collisionImpulse` are all shipped helpers
(`shader-functions/index.d.ts:128-218`).

---

## 7. Per-frame CPU overhead traps

These are the ones that will bite at scene complexity.

### 7a. Bind-group churn on every texture rebind — the worst one

```js
uniforms[entry.name] = { set(value) { textureBindings.set(...); bindGroup = null; } }
//                                                             ^^^^^^^^^^^^^^^^^^ webgpu.js:542
```
Same for storage buffers, `webgpu.js:529`. The next `draw()` sees
`bindGroup === null` and calls `buildBindGroup()` → `device.createBindGroup()`
(`webgpu.js:642-644`, `:461-482`).

**So swapping a texture per draw allocates a fresh `GPUBindGroup` per draw,
every frame, forever.** A 40-material scene sharing one PBR program = 40
bind-group allocations/frame. This is the standard "one program per material" or
"texture atlas" tax. Design around it: **bind textures once at setup, not per
draw.**

Note the asymmetry: numeric uniforms are *cheap* to change per draw (they go
through the dynamic-offset ring below), textures are *expensive*.

### 7b. Uniform ring buffer — one `writeBuffer` of the whole block per draw

`flushUniforms` (`webgpu.js:405-425`) advances a 256-byte-aligned slot and calls
`device.queue.writeBuffer(uniformBuffer, offset, uniformData)` — **the entire
uniform block, every time any uniform changed** (`webgpu.js:423`). Slot stride is
`ceil(size/256)*256` (`webgpu.js:385`); capacity starts at 64 and doubles
(`webgpu.js:414`), and **the old buffer is intentionally not destroyed** on grow
(`webgpu.js:411-413`) — it is left to GC.

At frame start the ring resets and forces a write (`webgpu.js:634-639`). So:
*N draws with changed uniforms = N `writeBuffer` calls + N × 256B of VRAM
traffic.* At a few hundred draws this is measurable but survivable; at a few
thousand it is not.

### 7c. Each attribute is its own vertex buffer — **8-attribute hard cap**

`buffers: compiled.layout.attributes.map(entry => ({ arrayStride: entry.size*4, ... }))`
— `webgpu.js:332-338`. One `GPUVertexBufferLayout` per declared attribute, never
interleaved.

WebGPU's default `maxVertexBuffers` is **8**, and `requestDevice()` asks for no
raised limits (`webgpu.js:57`). **A shader may declare at most 8 attributes total,
vertex + instance combined.**

The shipped `shadow-scene.shader.ts` already uses 7 (`aPosition, aNormal` +
`iOffset, iScale, iSpin, iColor, iGround`). An instanced PBR shader wanting
`aPosition, aNormal, aUv, aTangent` (4) has only **4 instance slots left** — and
a per-instance transform needs 3–4 of them on its own. This is tight.

Non-interleaved buffers are also cache-hostile: position, normal, and uv for one
vertex live in three separate allocations.

### 7d. No per-instance `mat4` — and no way to build one in the shader

Attributes cannot be `mat4` (`AGENTS.md`: *"Attributes and varyings cannot be
`mat4` or `sampler2D`"*), and vertex formats top out at `float32x4`
(`webgpu.js:263-268`). The obvious workaround — pass 4 × `vec4` and assemble a
matrix in the shader — **is impossible**: the DSL has no `mat4()` constructor
(`dsl/builtins.d.ts` exports `vec2/vec3/vec4` only), and `Mat4` exposes only
`.mul()` (`dsl/types.d.ts:39-42`).

Per-instance transforms must therefore be **decomposed**: `iOffset: 'vec3'`,
`iScale: 'vec3'`, plus rotation via the `rotate3(p, axis, angle)` helper
(`shader-functions/index.d.ts:125`) or hand-written quaternion math. That is what
the shipped example does. It works, but it costs attribute slots (see 7c) and
rules out arbitrary non-uniform-scaled/sheared instance transforms.

### 7e. Geometry cannot be shared between programs

Vertex buffers are owned by the program (`vertexStates`/`instanceStates` Maps,
`webgpu.js:483-484`) and there is no API to bind an external buffer. **Drawing
the same mesh in a shadow-depth pass and a lit pass uploads the vertex data
twice** and stores it twice in VRAM. For a shadow map + main pass + (any depth
pass) that is 2–3× geometry memory.

### 7f. `draw()` has no range parameters

`draw()` takes nothing (`program.d.ts:29`) and always draws the whole buffer
(`webgpu.js:651-657`). No `first`/`count`/`baseVertex`/`baseInstance`. So:
- One program ≈ one mesh (or one instanced batch of one mesh).
- A GLB with multiple primitives (`models/glb.js:149`) needs **one program per
  primitive**, or CPU-side merging.
- No LOD selection by index-range, no sub-batching.

### 7g. Per-draw JS work

`resolveCount()` iterates every attribute state and throws on mismatch
(`webgpu.js:558-572`), then `draw()` loops the attributes *again* to validate
presence (`webgpu.js:628-633`), then a third `forEach` with a `Map.get` per
attribute to bind buffers (`webgpu.js:647-650`). Three passes over the attribute
list per draw call. Small, but it is pure overhead at high draw counts.

### 7h. Attribute `set()` is a full re-upload

`uploadAttribute` (`webgpu.js:488-508`) calls `queue.writeBuffer` with the whole
array and reallocates whenever the data grows. Fine at setup; a trap if instance
data is rebuilt per frame — which for a particle system it will be, unless you go
the compute+storage route (§6).

### 7i. `renderer.destroy()` and `program.dispose()` leaks

`dispose()` destroys vertex/index/uniform buffers and `placeholderTexture` but
**not** `placeholderVolume` or `placeholderStorage` (`webgpu.js:659-672` vs
`:441`, `:454`). Minor, but relevant in a React/StrictMode page that mounts and
unmounts demos repeatedly.

---

## 8. What the repo already patched, and why

`/Users/josephduncan/github/emberwyrd/antikySite/scripts/patch-brometal.mjs`
(186 lines) pins `0.15.0` exactly (line 23) and applies two independent features:

1. **`discard()` in the DSL** — lines 45-97. Adds the builtin
   (`dsl/builtins.js`), the export (`index.js`/`index.d.ts`), an analyzer rule
   that only permits it as a statement inside `fragment()` (`compiler/analyze.js`),
   a WGSL emitter case (`compiler/emit-wgsl.js`), and an optimizer passthrough
   (`compiler/optimize.js`). This is a well-formed, upstream-quality patch —
   it should be filed as a PR.

2. **`renderer.present(callback)`** — lines 108-186. Extracts the body of
   `loop()` into a standalone `present()` and reimplements `loop()` on top of it.
   Gives the app ownership of the `requestAnimationFrame` loop (needed for
   fixed-timestep simulation, pausing, visibility handling, and driving the
   frame from React). Also upstream-quality; also should be filed.

Both patches are textual `String.replace` against `dist/*.js` with a hard version
guard, so a BroMetal bump will throw loudly rather than silently misapply.
**This establishes the precedent that patching `dist/` is an accepted tool in
this repo** — which materially changes the cost/benefit of the blockers below.

---

## What must be built in-repo

Everything here is achievable on top of BroMetal 0.15 as it stands today.

1. **HDR scene buffer + tonemap composite.** `createRenderTarget` is RGBA16F, so
   render the scene inside `drawTo`, then blit with a fullscreen quad program
   that applies `tonemapACES` + `gammaCorrect`. Both helpers ship
   (`library-source.js:191`, `:199`). *This is the foundation everything else
   sits on and it works today.*

2. **A linear-sRGB color-management convention.** Since there is no sRGB texture
   format and no sRGB swapchain, write two tiny in-repo shader helpers —
   `srgbToLinear(c)` applied to every albedo/basecolor sample, and `srgbEncode(c)`
   (the piecewise transfer function, better than `gammaCorrect(c, 2.2)`) as the
   final operation. Document loudly that normal/ORM maps must **not** be
   linearized. This is the single highest-value/lowest-cost item on the list.

3. **Shadow mapping.** Fully supported and first-class. `createRenderTarget({
   depth: true })` + `drawTo(map, draw, { clear: [1,1,1,1] })` + `shadowDepth` /
   `shadowFactor` (3×3 PCF, slope-scaled world-space bias,
   `library-source.js:712-740`). Cascades are possible as *separate targets*
   (no viewport/scissor ⇒ no atlas), with cascade selection as float comparisons
   in the shader. Budget one extra `drawTo` submit per cascade.

4. **Bloom** — with a caveat. Threshold+downsample+upsample chain via a ladder of
   RGBA16F targets. **Must hand-roll bilinear filtering** (4 taps + `fract`
   weights) because target samplers are nearest (`webgpu.js:761`). Keep the chain
   to 4–5 levels to bound the submit count. This is the most expensive in-repo
   item and the quality will be *good*, not *reference*.

5. **Ambient occlusion.** SSAO needs sampled depth, which does not exist — so
   either (a) run a dedicated linear-depth+normal color prepass into an RGBA16F
   target (depth in `.x`, view normal in `.yzw`) and do SSAO from that, or (b)
   bake AO into vertex colors / a texture channel offline. **(b) is strongly
   recommended** for stylized AAA looks — LoL and LBP both lean on baked AO, and
   it sidesteps the nearest-sampler blur problem entirely.

6. **Anti-aliasing: FXAA (or SMAA 1x) as a post pass** on the tonemapped result.
   Necessary because the 4× MSAA at `webgpu.js:87` does nothing once the scene
   goes through an HDR target. Optionally combine with 1.5× supersampled target
   resolution.

7. **Instanced PBR materials.** `specGGX` (`library-source.js:611`) is the *D·NdotL*
   term only — no Smith geometry term, no Fresnel-Schlick in the specular
   numerator, no energy conservation. Write a proper `cookTorrance` helper
   in-repo (it composes from the existing `fresnel` + a hand-written Smith G).
   Per-instance transforms must be decomposed into `vec3` position/scale +
   axis-angle via `rotate3` (§7d). Watch the 8-attribute cap (§7c).

8. **Multi-light support via storage buffers.** The DSL has no arrays and no
   uniform arrays, but `storage: { light: 'vec4' }` + `storageLength` +
   `storageRead` in a `for` loop gives an arbitrary-length light list read
   directly in the fragment stage. This is the right pattern; use it.

9. **Particles / VFX via compute + storage.** Compute program writes state,
   render program reads it per-instance. `blend: 'additive'` for glows —
   remembering the factors are `(src-alpha, one)`, so premultiply
   (`webgpu.js:351`).

10. **Prefiltered environment lighting via `sampler3D`.** Since there are no
    cubemaps and no explicit-LOD sampling, pack a prefiltered equirect
    environment as a **volume texture with roughness on the W axis** —
    `createTexture3D` filters linearly on all three axes (`webgpu.js:823-829`),
    so roughness interpolation comes free. Limited to rgba8unorm (LDR) and no
    mips, but it is a genuine specular-IBL path and it works today.

11. **A thin in-repo render-graph / pass-manager.** Given `drawTo` always clears
    and each call is a separate submit, a small module that owns target
    allocation, ping-pong pairs, and pass ordering will pay for itself
    immediately. Keep it *shallow* — a list of passes, not a framework.

12. **A material/program registry that binds textures once.** Because of the
    bind-group churn at `webgpu.js:542`, the correct architecture is
    **one program instance per material** (or a texture atlas), with textures
    bound at setup. Encode this in the registry so it cannot be got wrong later.

---

## What is blocked by BroMetal

Ordered by impact on the stated goal.

### B1. MSAA is unavailable on render targets — AA is lost the moment you go HDR

*Impact: severe. This is the gap between "good" and "AAA".*

- **Evidence:** `webgpu.js:235` forces `internals.passSamples = 1` in `drawTo`;
  target textures are created without `sampleCount` (`webgpu.js:748-757`).
- **Minimal upstream API:** `createRenderTarget(renderer, { ..., samples?: 1 | 4 })`
  — create the color texture (and depth texture) with that `sampleCount`, add a
  non-multisampled resolve texture, set `resolveTarget` on the color attachment,
  and expose the *resolved* texture as `target.texture`. The pipeline cache at
  `webgpu.js:321` already keys on sample count, so no pipeline work is needed.
- **Local patch feasible?** **Yes, moderately.** ~40 lines touching
  `createWebgpuRenderTarget` and the `drawTo` attachment. The riskiest part is
  keeping `target.texture`'s `__wgpu.view` pointing at the resolve texture.
  This is the highest-value patch available and I recommend it.
- **In-repo fallback if not patched:** FXAA + supersampling (see item 6 above).

### B2. Render targets are sampled NEAREST with no mipmaps

*Impact: severe for bloom/DOF/any blur.*

- **Evidence:** `webgpu.js:761` — `magFilter: 'nearest', minFilter: 'nearest'`.
  RGBA16F is filterable on every WebGPU device (the comment at `webgpu.js:5-10`
  says so explicitly and then chooses nearest anyway, for simulation-correctness
  reasons that do not apply to image data).
- **Minimal upstream API:** `createRenderTarget(renderer, { ..., filter?: 'nearest' | 'linear' })`,
  defaulting to `'nearest'` to preserve current behavior. Optionally
  `wrap?: 'clamp' | 'repeat'` alongside.
- **Local patch feasible?** **Yes, trivially — this is a two-line patch.**
  Thread an option into `createWebgpuRenderTarget` and change the
  `createSampler` call at `webgpu.js:761`. **Do this one first.** It removes the
  need for hand-rolled bilinear across the entire post-processing stack.

### B3. Depth attachments cannot be sampled

*Impact: high — blocks SSAO, DOF, soft particles, depth fog, contact shadows.*

- **Evidence:** `webgpu.js:766-769` (usage is `RENDER_ATTACHMENT` only);
  `webgpu.js:763` comment; no depth texture surfaced on the public `RenderTarget`
  (`render-target.d.ts:30-38`).
- **Minimal upstream API:** add `TEXTURE_BINDING` to the depth texture usage and
  expose `readonly depthTexture: BroMetalTexture | null` on `RenderTarget`. The
  bind-group layout would need `sampleType: 'depth'` or `'unfilterable-float'`
  for that binding, which the current code cannot express — it hardcodes
  `sampleType: 'float'` at `webgpu.js:292`. **That is what makes this more than a
  one-liner.**
- **Local patch feasible?** **Partially, and it's fiddly.** Simplest honest patch:
  create the depth texture as `depth32float` with `TEXTURE_BINDING`, expose it,
  and bind it with a `non-filtering` sampler + `sampleType: 'unfilterable-float'`
  — which requires a per-uniform annotation the DSL has no way to express. Not
  recommended.
- **In-repo workaround (recommended):** a linear-depth+normal color prepass into
  an RGBA16F target. Costs one extra scene draw; needs no patch; is what
  `shadowDepth` already teaches.

### B4. No MRT (single color attachment)

*Impact: high — blocks deferred and Forward+; makes the §B3 workaround cost a full extra pass.*

- **Evidence:** `webgpu.js:142-157`, `webgpu.js:213-220`, `webgpu.js:343-363`,
  and `fragment()` returning one `Vec4` (`dsl/types.d.ts:95`).
- **Minimal upstream API:** this is a **compiler + runtime + DSL** change, not a
  runtime one — the DSL needs a way for `fragment()` to return multiple values.
  Realistically: `fragment(): [Vec4, Vec4]` or a declared
  `outputs: { color: 'vec4', normal: 'vec4' }` record.
- **Local patch feasible?** **No.** This reaches into `compiler/analyze.js`,
  `compiler/emit-wgsl.js`, `compiler/layout.js`, and the runtime. Far beyond a
  textual patch.
- **Verdict:** accept it. **Design for forward rendering.** Do not plan any
  deferred path.

### B5. No sRGB texture format

*Impact: medium — correctness, not capability.*

- **Evidence:** `webgpu.js:848` hardcodes `rgba8unorm`.
- **Minimal upstream API:** `createTexture(renderer, src, { colorSpace?: 'srgb' | 'linear' })`
  → select `rgba8unorm-srgb`. Would also fix gamma-space mip generation if the
  mipmap pipeline's target format (`webgpu.js:710`) is threaded through.
- **Local patch feasible?** **Yes, but two coordinated edits** — the texture
  format at `:848` *and* the mipmap pipeline format at `:710` (they must match,
  or mip generation fails validation). ~15 lines. The mipmap kit is cached
  per-device in a `WeakMap` (`webgpu.js:701`) keyed only by device, so it would
  need re-keying by format.
- **In-repo workaround:** `pow(c, 2.2)` on sample. Costs 3 `pow`s per texture
  fetch and gets mip-averaging slightly wrong. **Acceptable — do this first, and
  only patch if the pow cost shows up in a profile.**

### B6. No explicit-LOD texture sampling (`textureLod`)

*Impact: medium — blocks roughness-based specular IBL and any manual mip control.*

- **Evidence:** `compiler/emit-wgsl.js:266-270` — the emitter chooses
  `textureSample` in the fragment stage and `textureSampleLevel(..., 0.0)`
  everywhere else. LOD is never a parameter. `AGENTS.md` confirms: *"Inside a
  helper function the emitter uses `textureSampleLevel` … but it always samples
  LOD 0, so no mipmapping."*
- **Minimal upstream API:** a `textureLod(sampler, uv, lod)` DSL builtin emitting
  `textureSampleLevel(t, s, uv, lod)`.
- **Local patch feasible?** **Yes** — this is structurally identical to the
  `discard()` patch the repo already ships (builtin + analyze + emit + index
  export). Maybe 60 lines in `patch-brometal.mjs`, and it also fixes the
  "helpers can't mipmap" footgun. **Good candidate.**
- **In-repo workaround:** the `sampler3D`-with-roughness-on-W trick (item 10).

### B7. Depth compare function and depth write are not controllable

*Impact: medium.*

- **Evidence:** `webgpu.js:373-374` — `depthWriteEnabled: blend === 'none'`,
  `depthCompare: 'less'`.
- **Minimal upstream API:** `createProgram(renderer, shader, { depthWrite?, depthCompare?, depthTest? })`.
- **Local patch feasible?** **Yes, easily** — thread two options through
  `createProgram` (`runtime/program.js:10`) into `createWebgpuProgram`'s
  `pipelineFor`. ~20 lines, and it must be added to the pipeline cache key at
  `webgpu.js:322` (currently `format|samples|depth`). **Low risk, do it if a
  z-prepass or a `less-equal` skybox is wanted.**

### B8. Face culling is renderer-global, not per-program

*Impact: medium for foliage/cloth/two-sided materials.*

- **Evidence:** `webgpu.js:365` reads `internals.cull`, set once at `webgpu.js:86`.
- **Minimal upstream API:** `createProgram(..., { cull?: 'back' | 'front' | 'none' })`
  defaulting to the renderer setting.
- **Local patch feasible?** **Yes, easily** — same shape as B7, same cache-key
  caveat. Also worth exposing `frontFace` while in there.

### B9. Blend modes are a closed set of three

*Impact: medium.*

- **Evidence:** `program.d.ts:4`, factors at `webgpu.js:346-361`. No
  premultiplied alpha, no multiply/screen hardware blend, no separate RGB/alpha
  factor control, no `blendConstant`.
- **Minimal upstream API:** allow `blend` to accept a `GPUBlendState` directly
  alongside the three named presets.
- **Local patch feasible?** **Yes, easily** — pass the object straight into the
  `targets[0].blend` slot. Note that `depthWriteEnabled` is currently *derived*
  from `blend === 'none'` (`webgpu.js:373`), so this should land together with B7.

### B10. No `drawTo` load-op / accumulation, no viewport, no scissor

*Impact: low-medium. Blocks shadow atlases and single-target accumulation.*

- **Minimal upstream API:** `DrawToOptions.load?: 'clear' | 'preserve'` and an
  optional `viewport?: [x, y, w, h]` (WebGPU has `pass.setViewport`).
- **Local patch feasible?** **Yes** — `loadOp` is a one-word change at
  `webgpu.js:218`/`:229`; viewport is one extra call after `beginRenderPass`.
  Low priority; ping-pong targets and per-cascade targets cover the need.

### B11. No CPU readback of storage buffers or render targets

*Impact: low for rendering, high if GPU culling or picking is ever wanted.*

- **Evidence:** storage usage lacks `COPY_SRC` (`webgpu.js:793`); targets have
  `COPY_SRC` (`webgpu.js:756`) but no exposed copy path.
- **Minimal upstream API:** `storageBuffer.read(): Promise<Float32Array>` and
  `renderTarget.read(): Promise<Float16Array | Float32Array>`.
- **Local patch feasible?** **Yes for targets** (the usage flag is already there;
  needs a staging buffer + `mapAsync`). **Yes for storage** with one usage-flag
  edit plus the same staging code. ~40 lines. Only worth it if GPU picking is on
  the roadmap.

### B12. 8-attribute cap (non-interleaved vertex buffers)

*Impact: low today, will bite an instanced PBR shader.*

- **Evidence:** one `GPUVertexBufferLayout` per attribute at `webgpu.js:332-338`;
  bare `requestDevice()` at `webgpu.js:57` ⇒ default `maxVertexBuffers: 8`.
- **Minimal upstream API:** interleave attributes into a single buffer, or at
  minimum request `maxVertexBuffers: adapter.limits.maxVertexBuffers`.
- **Local patch feasible?** **The limit raise: yes, trivially** — change
  `requestDevice()` to `requestDevice({ requiredLimits: { maxVertexBuffers: adapter.limits.maxVertexBuffers } })`.
  Most desktop adapters report 8 anyway, so **this probably buys nothing**;
  proper interleaving is an upstream change.
- **In-repo workaround:** pack data tighter — put roughness/metallic/AO into one
  `vec3` instance attribute rather than three floats; derive tangents in-shader
  from screen-space derivatives (not available — no `dpdx`/`dpdy` in the DSL,
  confirmed by grep of `compiler/emit-wgsl.js`), or bake tangents into an
  existing slot's spare components.

### B13. No `mat4` construction in the DSL

*Impact: low-medium — constrains instanced transforms.*

- **Evidence:** `dsl/builtins.d.ts` exports `vec2/vec3/vec4` only; `Mat4` has
  only `.mul()` (`dsl/types.d.ts:39-42`); attributes cannot be `mat4`.
- **Minimal upstream API:** `mat4(c0: Vec4, c1: Vec4, c2: Vec4, c3: Vec4): Mat4`,
  plus `mat3` as a type.
- **Local patch feasible?** **Yes, in the `discard()` mold** — it is a builtin +
  analyze + emit + type change. Moderate effort (~100 lines) because it also
  needs the type-checker to accept a new value type.
- **In-repo workaround:** decompose to position/scale/axis-angle and use
  `rotate3`. This is what the shipped example does and it is fine.

### B14. Device requests no optional features

*Impact: low today.*

- **Evidence:** `webgpu.js:57` — `await adapter.requestDevice()` with no args.
  Zero hits for `requiredFeatures` in `runtime/`.
- **Blocked by this:** BC/ASTC **texture compression** (VRAM and load-time — a
  real cost for a texture-heavy AAA demo), `timestamp-query` (**no GPU profiling
  at all**, which will make optimization guesswork), `float32-filterable`,
  `dual-source-blending`, `shader-f16`.
- **Local patch feasible?** **Yes, trivially for the feature request itself**
  (`requestDevice({ requiredFeatures: [...available] })`). But *using* compressed
  textures needs a whole upload path (`createTexture` only accepts
  `TexImageSource`), and *using* timestamp queries needs runtime API surface.
  So: easy to enable, not easy to exploit.

---

## Recommended sequencing

**Patch these locally (cheap, high leverage), in this order:**
1. B2 — render-target `filter: 'linear'` (2 lines). Unblocks the entire
   post-processing stack.
2. B1 — render-target MSAA (~40 lines). Restores anti-aliasing to the HDR path.
3. B6 — `textureLod()` builtin (~60 lines, mirrors the existing `discard()`
   patch). Unblocks real specular IBL.
4. B7 + B9 together — depth/blend state on `createProgram` (~30 lines).
5. B8 — per-program cull (~15 lines).

**File upstream (all of the above, plus the two patches already written):**
`discard()` and `present()` are already implemented in
`scripts/patch-brometal.mjs` and are upstream-quality — send them.

**Accept and design around:**
- No MRT (B4) → forward rendering only.
- No sampled depth (B3) → linear-depth color prepass, or bake AO offline.
- No mat4 in the DSL (B13) → decomposed instance transforms.
- No readback / no indirect (B11, §6) → CPU keeps the draw list.

**Do in-repo regardless of any patch:**
The sRGB convention (item 2) and the material/program registry that binds
textures once (item 12). Both are pure discipline, both are cheap now and
expensive to retrofit.
