# Upstream PR 2 — drawing into a render target silently drops multisampling

**Target:** `github.com/ericdrowell/brometal`, `packages/brometal`
**Local patch it retires:** `scripts/patch-brometal.mjs`, W A.2 section
**Status: DRAFT — not opened. Awaiting owner approval to publish.**

---

## Title

`drawTo`: allow an off-screen pass to keep multisampling

## Body

`createRenderer(canvas, { antialias: true })` gives a scene 4× MSAA on screen. The moment that same
scene is rendered into a render target, it silently drops to one sample:

```js
// dist/runtime/webgpu.js:234-236
internals.passFormat = TARGET_FORMAT;
internals.passSamples = 1;
internals.passDepth = binding.depthView !== null;
```

That line is not wrong on its own — the target texture is single-sampled, and a pipeline must match
its attachment. The gap is that there is no way to *ask* for a multisampled off-screen pass, so the
only correct value is 1.

The practical effect: adopting any off-screen pass — an HDR buffer before tone mapping, a
post-processing chain, a bloom pass — costs all anti-aliasing, on every silhouette edge, with no
warning. It reads as "my post-processing made everything jaggy", which is a confusing place to end
up when the cause is in the runtime rather than the effect.

The on-screen path already does the right thing (`webgpu.js:126-150`): it allocates a multisampled
colour texture, renders into it, and resolves into the swapchain view. The off-screen path just has
no equivalent.

### Proposed change

Add a `samples` option to `RenderTargetOptions`, defaulting to 1 so nothing changes for existing
callers. When it is greater than 1:

- allocate a multisampled colour texture at `TARGET_FORMAT` with `RENDER_ATTACHMENT` usage;
- give the depth texture the same `sampleCount`, since a pass requires its attachments to agree;
- in `drawTo`, use `{ view: msaaView, resolveTarget: targetView, storeOp: 'discard' }` instead of
  drawing straight into the target view;
- set `internals.passSamples` to the target's sample count rather than to 1.

This mirrors the on-screen pass exactly. The target texture stays single-sampled and receives the
resolve, so sampling it afterwards is unchanged.

### Why this is a general fix

Any consumer who moves from direct-to-screen rendering to a post-processing chain hits it, which is
most non-trivial renderers. The failure is silent and produces a worse image rather than an error,
so it costs debugging time to attribute correctly.

### Verification

Against a patched build, recording the descriptors WebGPU actually receives:

| Call | Textures created | Pass colour attachment |
|---|---|---|
| `createRenderTarget(r, { width: 32, height: 32, depth: true })` | target `rgba16float` @1, depth `depth24plus` @1 | direct view, `storeOp: 'store'` |
| `createRenderTarget(r, { width: 32, height: 32, depth: true, samples: 4 })` | target `rgba16float` @1, depth `depth24plus` @4, colour `rgba16float` @4 | `resolveTarget` set, `storeOp: 'discard'` |

No WebGPU validation errors in either case, which is the check that matters here: the pass, the
pipeline and the attachments have to agree on sample count or the device rejects the pipeline.

### Notes for the maintainer

- The diff is written against the published `dist/` for the same reason as the sibling PR.
- `samples` is left as a number rather than a `1 | 4` union because the supported counts are a
  device capability; validating it against the device would be a reasonable addition.
- Independent of the render-target filtering PR — either can land without the other.
