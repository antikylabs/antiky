# Execute goal 15: give BroMetal the texture capabilities WebGPU already has

## Prerequisites

- **Goal 14** — its slicer's `--layers` mode is what feeds an array texture. Building the array
  binding with nothing to put in it would leave the capability untested against real art.
- Read `docs/objectives/ideas/skill-text.md` before starting. It records the local-patch and
  fork-and-upstream workflow used for BroMetal PRs [#3](https://github.com/ericdrowell/brometal/pull/3)–[#7](https://github.com/ericdrowell/brometal/pull/7),
  including the retirement instructions each patch module carries.

## `/goal` objective

BroMetal describes itself as a thin WebGPU runtime. Two texture capabilities that WebGPU has as
standard are unreachable through it, and their absence is the entire reason the atlas work in goal
14 has to compensate with padding.

Add them, locally as patches, and offer them upstream.

## Why these belong to BroMetal and not to Antiky

The rule the owner settled on:

> If WebGPU can do it and BroMetal does not expose it, it is a BroMetal gap.
> If it is about how assets are authored, packed, verified or shipped, it is Antiky.

Both items below are the first case. A wrapper that hides a core capability of the thing it wraps is
not thin, it is lossy — and the cost lands on every consumer, not just this repository.

## The two gaps, verified

**1. No array textures.** The DSL's sampler types are `sampler2D` and `sampler3D` only
(`dist/dsl/types.d.ts`), and the runtime creates textures as `size: [width, height]` with no
`depthOrArrayLayers` (`dist/runtime/webgpu.js`). The bind group layout hard-codes
`viewDimension: entry.type === 'sampler3D' ? '3d' : '2d'` at `webgpu.js:298`.

WGSL has `texture_2d_array<f32>` and `textureSample(t, s, uv, layer)`. WebGPU has array layers on
`GPUTextureDescriptor` and `'2d-array'` on `GPUTextureBindingLayout`. Nothing here needs inventing.

**Why it matters:** each atlas tile becomes its own layer, and mip chains are built per layer, so
averaging across a tile boundary **cannot happen**. That deletes the defect rather than mitigating
it — the same reasoning that chose triplanar projection over a tangent basis in goal 04.

**`sampler3D` is not a substitute.** A 3D texture's mips blend along Z as well, so slices would
average into each other: the same defect by a different route.

**2. No mip-level clamping.** `TextureOptions` exposes `wrap`, `filter` and `anisotropy` and nothing
else (`dist/runtime/texture.d.ts`), and the sampler is built with `magFilter`, `minFilter`,
`mipmapFilter`, `addressModeU/V` and `maxAnisotropy` — no `lodMinClamp` or `lodMaxClamp`, both of
which are standard `GPUSamplerDescriptor` fields.

**Why it matters:** capping the mip chain is the cheap partial fix for atlas bleeding, and it is also
what a caller needs when a texture must never resolve below a known level. Today it cannot be asked
for at all.

## Honest sizing

These two are not the same size, and the goal should not pretend otherwise.

- **Mip clamping is small.** Two optional fields on `TextureOptions`, two lines in the sampler
  descriptor, and validation that the range is sane.
- **Array textures are a real change.** `sampler3D` — the closest precedent — appears at 29 sites
  across 11 files: `dsl/types`, `compiler/parse`, `compiler/ir`, `compiler/analyze`,
  `compiler/layout`, `compiler/emit-wgsl`, `compiler/emit-glsl`, `runtime/uniforms` and
  `runtime/webgpu`. A `sampler2DArray` touches the same surface, plus per-layer mip generation,
  which `generateWebgpuMipmaps` currently does for a single 2D texture only.

Land them as **two separate patch modules and two separate pull requests**. They are independent, and
bundling them would repeat the mistake of PR #2.

## Required outcome

1. **`scripts/patch-brometal/sampler-lod-clamp.mjs`** adding `lodMinClamp` and `lodMaxClamp` to
   `TextureOptions` and passing them to `createSampler`, with the patch module naming its upstream PR
   and carrying retirement instructions like the existing five.
2. **`scripts/patch-brometal/texture-array-sampler.mjs`** adding a `sampler2DArray` DSL type end to
   end: parsed, carried through the IR, emitted as `texture_2d_array<f32>` in WGSL, bound with
   `viewDimension: '2d-array'`, uploaded with layers, and mipped per layer.
3. **A demo that actually uses it.** Wire `antiky-town`'s material atlas through goal 14's
   `--layers` output and an array sampler, so the capability is proven against real art rather than
   a fixture.
4. **The tile-boundary measurement at zero** for that demo — not "under 2%", but no cross-tile
   colour at all, because with layers there is no adjacent tile to average into. If it is not zero,
   the binding is wrong.
5. **Two upstream pull requests** against the fork at
   `https://github.com/shadowcodex-forks/brometal`, each following the established format: what the
   patch is, why it exists, what it blocks without it, and an explicit request for the author to say
   whether the approach is right and whether a better one exists.
6. **`scripts/patch-brometal.test.mjs` covering both**, including that the patch runner is idempotent
   and that a second run reports no change for the right reason rather than because it crashed —
   that failure mode has bitten this repository before.

## In scope

- The two patch modules, their tests, the version guard, and the two PRs.
- One demo converted to array sampling as proof.
- A short note in each patch module on what the WebGPU spec already provides, so a reader can tell
  this is exposure of an existing capability rather than an invention.

## Required tests and evidence

- **A shader-compilation test**: a fixture shader declaring `sampler2DArray` compiles to WGSL
  containing `texture_2d_array<f32>` and a three-argument `textureSample`.
- **A runtime test** that an array texture binds without WebGPU validation errors, and that a layer
  index selects the layer it names — a two-layer texture of distinct colours, sampled at each index.
- **Per-layer mips**: build an array whose layers are deliberately different, sample at a coarse mip,
  and assert no layer takes colour from another. This is the whole point of the change.
- **The clamp does something measurable**: with `lodMaxClamp` set to 0, a minified texture must
  return its base level rather than a mip average.
- The patch runner stays idempotent, and `npm test` is green with the patches applied.
- `packages/demos/tests/shader-output-parity.test.mjs` still passes — it now compares committed
  generated shaders against compiler output across eight packages, so a compiler change that alters
  emission will show up there and every affected `.gen.ts` must be regenerated and committed.

## Explicit non-goals

- **Do not convert every demo to array textures.** One demo proves the capability. Broad adoption is
  an art and performance decision that belongs with the demos that would carry it.
- **Do not add cube maps, 3D array textures, or storage textures.** They are the same family and the
  same temptation; each deserves its own justification.
- **Do not wait for upstream to merge before using the patches.** ADR direction is local patches
  first, upstream PRs after — that is why `scripts/patch-brometal/` exists.
- **Do not bundle the two changes into one PR.** PR #2 was 8,059 lines and had to be replaced by five
  focused ones.

## Engineering constraints

- Tests are required for code changes (`AGENTS.md`).
- Short one-line commit messages. No coauthor tags.
- The BroMetal version guard is pinned; a version bump is a separate reviewed change, and the last
  upgrade silently changed dependency placement across eight workspaces.
- Preserve unrelated dirty worktree changes.

## Completion definition

Complete when both patch modules apply idempotently with tests, one demo renders its atlas through an
array sampler with a tile-boundary measurement of zero, both pull requests are open against the fork
with the agreed format, and `npm test` is green.

## What this closes

Goal 14 builds padding because BroMetal cannot do better today. When this lands, padding becomes the
fallback rather than the plan, and the tile-boundary measurement stops being a budget to stay under
and becomes an assertion that the number is zero.

That is the difference between managing a defect and removing it.
