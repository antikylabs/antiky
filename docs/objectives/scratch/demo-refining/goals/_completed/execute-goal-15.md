# Execute goal 15: give BroMetal the texture capabilities WebGPU already has

## Prerequisites

- **Goal 14** — **complete.** Its slicer's `--layers` mode is what feeds an array texture, and it
  emits one image per tile with no gutter and no cross-tile pixels, which is exactly an array
  layer set. Building the array binding with nothing to put in it would leave the capability untested
  against real art.
- **Use the `team-brometal` skill.** It owns this workflow and supersedes the old
  `docs/objectives/ideas/skill-text.md` note, which no longer exists. Run
  `patch <name>` then `pr <patch>`; a later `update` retires each patch when its pull request lands.
  The skill carries the runner's guarantees, the patch-module shape, the required tests and the
  pull-request body format, so this goal states only what is specific to these two capabilities.

  **Do not skip `pr`.** ADR 0021 requires a focused upstream pull request per patch; a local patch
  with no PR becomes permanent by default.

## Before you write anything

From the skill's `patch` reference, in order. The first step is not a formality — the skill records
that this repository has been four releases behind while writing a patch for something already fixed.

1. **Confirm both gaps still exist in the latest published version.** `npm view brometal version`,
   then read that version's source. *As of 2026-08-15 the pinned `EXPECTED_VERSION`, the installed
   copy and the latest published release were all `0.17.2`, so the verification below was against the
   current release — but re-check, because that will not stay true.*
2. **Write the failing test first** and watch it fail against unpatched BroMetal.
3. **Read the code you are about to change, including its comments**, and treat each one as load
   bearing until you know otherwise.
4. **Confirm it is upstreamable** — ADR 0021 admits only contributions that help renderers in general
   or correct an error. Both items here are exposure of a standard WebGPU capability, which is the
   clearest possible case, but say so explicitly in the PR.

Note the split the skill draws: a **patch** is written against the installed `dist/`, but a **pull
request is written against the fork's source**, branched from current `upstream/main`. The `dist/`
paths cited below locate the gaps in the shipped artifact; do not send a PR that edits `dist/`.

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
   `TextureOptions` and passing them to `createSampler`. Module shape, the version guard, the
   "moved target throws" behaviour and the retirement instructions are the skill's `patch`
   reference — follow it rather than copying one of the existing five by eye.
2. **`scripts/patch-brometal/texture-array-sampler.mjs`** adding a `sampler2DArray` DSL type end to
   end: parsed, carried through the IR, emitted as `texture_2d_array<f32>` in WGSL, bound with
   `viewDimension: '2d-array'`, uploaded with layers, and mipped per layer.
3. **A demo that actually uses it.** Wire `antiky-town`'s material atlas through goal 14's
   `--layers` output and an array sampler, so the capability is proven against real art rather than
   a fixture.
4. **The tile-boundary measurement at zero** for that demo — not "under 2%", but no cross-tile
   colour at all, because with layers there is no adjacent tile to average into. If it is not zero,
   the binding is wrong.
5. **Two upstream pull requests**, opened through the skill's `pr` command against the fork at
   `https://github.com/shadowcodex-forks/brometal`. The body follows
   `.agents/skills/team-brometal/reference/pr-template.md` — nine sections, including leading with
   the current behaviour quoted from their code, taking their existing comments seriously in public,
   saying plainly if their code was not wrong, and closing by asking the author whether the approach
   is right. Branch each from current `upstream/main`, prove it in **their** harness, and tag the
   local patch module with the PR once open.
6. **`scripts/tests/patch-brometal.test.mjs` covering both.** The skill's `patch` reference lists the tests
   the mechanism itself requires — including that a second run reports no change *for the right
   reason* rather than because it crashed, and that a wrong version throws when exercised against a
   fixture package rather than by editing the installed copy. That failure mode has bitten this
   repository before.

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
- **Do not send Antiky preferences upstream.** ADR 0021 bounds a contribution to something that helps
  renderers in general or corrects an error. Both items here qualify because WebGPU already specifies
  them; anything else discovered along the way does not automatically.
- **Do not bump the BroMetal version as part of this.** The skill's `update` command owns that, it is
  a separately reviewed change, and the last upgrade silently moved dependency placement across eight
  workspaces.
- **Do not bundle the two changes into one PR.** PR #2 was 8,059 lines and had to be replaced by five
  focused ones.

## Engineering constraints

- Tests are required for code changes (`AGENTS.md`).
- Short one-line commit messages. No coauthor tags.
- Preserve unrelated dirty worktree changes.

## Completion definition

Complete when both patch modules apply idempotently with tests, one demo renders its atlas through an
array sampler with a tile-boundary measurement of zero, both pull requests are open against the fork
in the `pr-template.md` format and each patch module is tagged with its PR, and `npm test` is green.

Goal 14's measurement is the one to reuse: mip a tile inside the atlas, mip the same tile in
isolation, compare their borders over a band that reaches one texel **past** the tile rectangle. A
band that only looks inside scores zero on an atlas that is merely well-aligned, which is how the
first version of the atlas measurement went wrong. With true array layers the number is zero because
there is no adjacent tile in the same image at all — that is the assertion, not a budget.

## What this closes

Goal 14 builds padding because BroMetal cannot do better today. When this lands, padding becomes the
fallback rather than the plan, and the tile-boundary measurement stops being a budget to stay under
and becomes an assertion that the number is zero.

That is the difference between managing a defect and removing it.
