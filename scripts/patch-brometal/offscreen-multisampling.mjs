/**
 * W A.2 — keep multisampling when drawing into a render target.
 *
 * drawTo sets passSamples = 1 unconditionally, so a pass that renders off-screen silently drops
 * from 4x MSAA to none. That line is not wrong on its own: the target texture is single-sampled,
 * and the pipeline must match its attachment. The missing piece is the multisampled attachment.

 * This mirrors what the on-screen pass already does — draw into a multisampled colour texture,
 * resolve into the single-sampled one, and give the depth attachment the same sample count. The
 * target texture stays single-sampled, so sampling it afterwards is unchanged.
 *
 * **Upstream: https://github.com/ericdrowell/brometal/pull/4**
 * render target: allow an off-screen pass to keep multisampling
 *
 * Retire this file when #4 is merged or released. Nothing else needs changing —
 * remove the module, drop it from PATCHES in ../patch-brometal.mjs, and from the
 * scripts/ allowlist in ../repository-policy.test.mjs.
 */
export const name = 'offscreen-multisampling';

export async function apply({ replace, replaceSection }) {
  await replace(
    'dist/runtime/webgpu.js',
    "    // Never sampled — it exists only so the pass can sort its own triangles.\n    const depthTexture = depth\n        ? device.createTexture({\n            size: [width, height],\n            format: 'depth24plus',\n            usage: GPUTextureUsage.RENDER_ATTACHMENT,\n        })\n        : null;",
    "    // Never sampled — it exists only so the pass can sort its own triangles.\n    const passSampleCount = Math.max(1, Math.floor(samples));\n    const depthTexture = depth\n        ? device.createTexture({\n            size: [width, height],\n            format: 'depth24plus',\n            sampleCount: passSampleCount,\n            usage: GPUTextureUsage.RENDER_ATTACHMENT,\n        })\n        : null;\n    // A multisampled colour attachment that resolves into the single-sampled target texture.\n    // Without it the pipeline has to run at one sample, which is why an off-screen pass used to\n    // lose the anti-aliasing an on-screen pass keeps.\n    const msaaTexture = passSampleCount > 1\n        ? device.createTexture({\n            size: [width, height],\n            format: TARGET_FORMAT,\n            sampleCount: passSampleCount,\n            usage: GPUTextureUsage.RENDER_ATTACHMENT,\n        })\n        : null;",
  );
  await replace(
    'dist/runtime/webgpu.js',
    '    target.__wgpu = { texture, view, depthView: depthTexture?.createView() ?? null };',
    '    target.__wgpu = {\n        texture,\n        view,\n        depthView: depthTexture?.createView() ?? null,\n        msaaView: msaaTexture?.createView() ?? null,\n        samples: passSampleCount,\n    };',
  );
  await replace(
    'dist/runtime/webgpu.js',
    '        dispose() {\n            texture.destroy();\n            depthTexture?.destroy();\n        },',
    '        dispose() {\n            texture.destroy();\n            depthTexture?.destroy();\n            msaaTexture?.destroy();\n        },',
  );
  await replace(
    'dist/runtime/webgpu.js',
    "                colorAttachments: [\n                    {\n                        view: binding.view,\n                        clearValue: { r: cr, g: cg, b: cb, a: ca },\n                        loadOp: 'clear',\n                        storeOp: 'store',\n                    },\n                ],",
    "                colorAttachments: [\n                    binding.msaaView !== null && binding.msaaView !== undefined\n                        ? {\n                            view: binding.msaaView,\n                            resolveTarget: binding.view,\n                            clearValue: { r: cr, g: cg, b: cb, a: ca },\n                            loadOp: 'clear',\n                            storeOp: 'discard',\n                        }\n                        : {\n                            view: binding.view,\n                            clearValue: { r: cr, g: cg, b: cb, a: ca },\n                            loadOp: 'clear',\n                            storeOp: 'store',\n                        },\n                ],",
  );
  await replace(
    'dist/runtime/webgpu.js',
    '            internals.passFormat = TARGET_FORMAT;\n            internals.passSamples = 1;',
    '            internals.passFormat = TARGET_FORMAT;\n            internals.passSamples = binding.samples ?? 1;',
  );
}
