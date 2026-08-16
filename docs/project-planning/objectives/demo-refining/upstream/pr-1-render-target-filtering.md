# Upstream PR 1 — render targets cannot be sampled with linear filtering

**Target:** `github.com/ericdrowell/brometal`, `packages/brometal`
**Local patch it retires:** `scripts/patch-brometal.mjs`, W A.1 section
**Status: DRAFT — not opened. Awaiting owner approval to publish.**

---

## Title

`createRenderTarget`: allow linear filtering, keep nearest as the default

## Body

`createRenderTarget` hard-codes its sampler to nearest:

```js
// dist/runtime/webgpu.js:761
const sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
```

The comment above it explains the choice:

> `rgba32float` is not filterable without an opt-in feature, and averaging two particles' positions
> would be meaningless anyway — nearest, always.

The second half of that reasoning is right and worth keeping. The first half no longer matches the
code: `TARGET_FORMAT` is `rgba16float` (`webgpu.js:11`), which **is** filterable in core WebGPU
without any optional feature. No `rgba32float` target is created anywhere in the runtime, so the
hardware constraint the comment cites does not apply to any target that exists.

This matters for any target that holds an *image* rather than *state*. The common case is a bloom
downsample chain: each level samples the previous one at half resolution, and with point sampling
the result is blocky and crawls under motion. Today the only way to get a smooth downsample is to
take many taps per texel to emulate the bilinear filter the hardware would do for free.

### Proposed change

Make filtering a per-target choice that still defaults to `nearest`, so no existing caller changes
behaviour:

```ts
export interface RenderTargetOptions {
  width: number;
  height: number;
  depth?: boolean;
  /**
   * How the target is sampled. Defaults to 'nearest', which is what a target holding simulation
   * state needs — interpolating two particles' positions is meaningless. Use 'linear' for an image
   * target such as a bloom downsample chain.
   */
  filter?: 'nearest' | 'linear';
}
```

and in the WebGPU backend:

```ts
const sampleFilter = filter === 'linear' ? 'linear' : 'nearest';
const sampler = device.createSampler({ magFilter: sampleFilter, minFilter: sampleFilter });
```

### Why this is a general fix

It is not an Antiky preference. Any consumer building a post-processing chain hits it, and the
current behaviour silently produces a worse image rather than failing, so it is easy to attribute
to one's own shader. Keeping `nearest` as the default means the state-holding use the comment
describes is unaffected.

### Verification

Against a patched build, with the descriptors WebGPU actually receives recorded:

| Call | `magFilter` / `minFilter` |
|---|---|
| `createRenderTarget(r, { width: 8, height: 8 })` | `nearest` / `nearest` |
| `createRenderTarget(r, { width: 8, height: 8, filter: 'linear' })` | `linear` / `linear` |

No WebGPU validation errors. The default path is byte-identical in behaviour to 0.15.0.

### Notes for the maintainer

- The diff above is written against the published `dist/`, because that is what a consumer can
  patch. The equivalent source change is in the runtime's render-target creation and its
  `RenderTargetOptions` type.
- Happy to add a docs line to the README's render-target section if wanted.
- This is one of two independent fixes found while building an HDR pipeline on 0.15.0. The other is
  submitted separately so each can be judged on its own.
