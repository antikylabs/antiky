import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const packageCandidates = [
  // Test-only override. The patch is exercised against fixture packages with a wrong version or a
  // moved patch target, which cannot be done by editing the installed package.
  ...(process.env.ANTIKY_BROMETAL_ROOT === undefined ? [] : [process.env.ANTIKY_BROMETAL_ROOT]),
  path.resolve(import.meta.dirname, '../node_modules/brometal'),
  path.resolve(import.meta.dirname, '../packages/demos/node_modules/brometal'),
];
let packageRoot;
for (const candidate of packageCandidates) {
  try {
    await access(path.join(candidate, 'package.json'));
    packageRoot = candidate;
    break;
  } catch {
    // Try the next npm workspace installation location.
  }
}
if (packageRoot === undefined) {
  throw new Error('BroMetal is not installed. Run npm install before applying the repository patch.');
}
const metadata = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));

if (metadata.version !== '0.15.0') {
  throw new Error(`Expected BroMetal 0.15.0, found ${metadata.version}. Review the cut-out patch before upgrading.`);
}

async function replace(relativePath, before, after) {
  const file = path.join(packageRoot, relativePath);
  const source = await readFile(file, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`BroMetal patch target changed: ${relativePath}`);
  await writeFile(file, source.replace(before, after));
}

async function replaceSection(relativePath, beforeStart, beforeEnd, after) {
  const file = path.join(packageRoot, relativePath);
  const source = await readFile(file, 'utf8');
  if (source.includes(after)) return;
  const start = source.indexOf(beforeStart);
  const end = source.indexOf(beforeEnd, start);
  if (start < 0 || end < 0) throw new Error(`BroMetal patch target changed: ${relativePath}`);
  await writeFile(file, `${source.slice(0, start)}${after}${source.slice(end)}`);
}

await replace(
  'dist/dsl/builtins.js',
  "export function texture() {\n    return gpuOnly('texture');\n}\n",
  "export function texture() {\n    return gpuOnly('texture');\n}\nexport function discard() {\n    return gpuOnly('discard');\n}\n",
);
await replace(
  'dist/dsl/builtins.d.ts',
  'export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;\n',
  'export declare function texture(sampler: Sampler3D, uvw: Vec3): Vec4;\nexport declare function discard(): void;\n',
);
await replace(
  'dist/index.js',
  'distance, dot, exp,',
  'distance, discard, dot, exp,',
);
await replace(
  'dist/index.d.ts',
  'distance, dot, exp,',
  'distance, discard, dot, exp,',
);
await replace(
  'dist/compiler/analyze.js',
  'function lowerMutation(ctx, scope, expr, options) {\n',
  "function lowerMutation(ctx, scope, expr, options) {\n    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'discard') {\n        if (ctx.stage !== 'fragment') {\n            throw errorAt(ctx.sourceFile, expr, 'discard() is only valid in fragment()');\n        }\n        if (expr.arguments.length > 0) {\n            throw errorAt(ctx.sourceFile, expr, 'discard() takes no arguments');\n        }\n        return { kind: 'discard' };\n    }\n",
);
await replace(
  'dist/compiler/analyze.js',
  "    const callee = node.expression.text;\n    if (scope.lookup(callee) !== undefined) {\n",
  "    const callee = node.expression.text;\n    if (callee === 'discard') {\n        throw errorAt(ctx.sourceFile, node, 'discard() produces no value — call it as its own statement');\n    }\n    if (scope.lookup(callee) !== undefined) {\n",
);
await replace(
  'dist/compiler/emit-wgsl.js',
  "            case 'storageWrite':\n                lines.push(`${indent}${statement.buffer}[u32(${emitExpr(statement.index, ctx, 0)})] = ${emitExpr(statement.value, ctx, 0)};`);\n                break;\n",
  "            case 'storageWrite':\n                lines.push(`${indent}${statement.buffer}[u32(${emitExpr(statement.index, ctx, 0)})] = ${emitExpr(statement.value, ctx, 0)};`);\n                break;\n            case 'discard':\n                lines.push(`${indent}discard;`);\n                break;\n",
);
await replace(
  'dist/compiler/optimize.js',
  "        case 'storageWrite':\n            return { ...statement, index: foldExpr(statement.index), value: foldExpr(statement.value) };\n",
  "        case 'storageWrite':\n            return { ...statement, index: foldExpr(statement.index), value: foldExpr(statement.value) };\n        case 'discard':\n            return statement;\n",
);
await replace(
  'dist/runtime/context.js',
  'BroMetal requires it — shaders are compiled to WGSL and compute passes have no WebGL equivalent.',
  'BroMetal requires it — shaders and compute passes run on WebGPU.',
);
await replace(
  'dist/runtime/context.d.ts',
  '    loop(callback: (elapsedSeconds: number) => void): () => void;\n',
  '    present(callback: () => void): void;\n    loop(callback: (elapsedSeconds: number) => void): () => void;\n',
);
await replaceSection(
  'dist/runtime/webgpu.js',
  '        loop(callback) {\n',
  '        drawTo(target, draw, options = {}) {\n',
  `        present(callback) {
            if (needsResize || observer === null) {
                needsResize = false;
                resizeToDisplaySize(canvas, window.devicePixelRatio || 1);
                if (depthTexture === null || depthTexture.width !== canvas.width || depthTexture.height !== canvas.height) {
                    depthTexture?.destroy();
                    depthTexture = device.createTexture({
                        size: [canvas.width, canvas.height],
                        format: 'depth24plus',
                        sampleCount: internals.sampleCount,
                        usage: GPUTextureUsage.RENDER_ATTACHMENT,
                    });
                    depthView = depthTexture.createView();
                    if (internals.sampleCount > 1) {
                        msaaTexture?.destroy();
                        msaaTexture = device.createTexture({
                            size: [canvas.width, canvas.height],
                            format,
                            sampleCount: internals.sampleCount,
                            usage: GPUTextureUsage.RENDER_ATTACHMENT,
                        });
                        msaaView = msaaTexture.createView();
                    }
                }
            }
            internals.frame++;
            const [r, g, b, a] = internals.clearColor;
            const encoder = device.createCommandEncoder();
            const swapchainView = context.getCurrentTexture().createView();
            internals.pass = encoder.beginRenderPass({
                colorAttachments: [
                    msaaView !== null
                        ? {
                            view: msaaView,
                            resolveTarget: swapchainView,
                            clearValue: { r, g, b, a },
                            loadOp: 'clear',
                            storeOp: 'discard',
                        }
                        : {
                            view: swapchainView,
                            clearValue: { r, g, b, a },
                            loadOp: 'clear',
                            storeOp: 'store',
                        },
                ],
                depthStencilAttachment: {
                    view: depthView,
                    depthClearValue: 1,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'store',
                },
            });
            internals.passFormat = format;
            internals.passSamples = internals.sampleCount;
            internals.passDepth = true;
            try {
                callback();
            }
            finally {
                internals.pass.end();
                internals.pass = null;
                device.queue.submit([encoder.finish()]);
            }
        },
        loop(callback) {
            let frameId = 0;
            let running = true;
            const startedAt = performance.now();
            const frame = (now) => {
                if (!running)
                    return;
                renderer.present(() => callback((now - startedAt) / 1000));
                frameId = requestAnimationFrame(frame);
            };
            frameId = requestAnimationFrame(frame);
            const stop = () => {
                running = false;
                cancelAnimationFrame(frameId);
            };
            activeStops.add(stop);
            return () => {
                stop();
                activeStops.delete(stop);
            };
        },
`,
);

// W A.1 — a per-target filter option on render targets.
//
// The sampler is hard-coded to nearest. The comment above it blames rgba32float, which is not
// filterable without an opt-in device feature — but TARGET_FORMAT is rgba16float, which IS
// filterable in core WebGPU, and no rgba32float target is ever created. That half of the comment
// is stale. The other half is real and preserved: a target holding simulation state must not
// interpolate, because averaging two particles' positions is meaningless. So filtering becomes a
// per-target choice that still defaults to nearest, and only an image target such as a bloom
// downsample chain opts into linear.
await replace(
  'dist/runtime/webgpu.js',
  'export function createWebgpuRenderTarget(renderer, width, height, depth = false) {',
  "export function createWebgpuRenderTarget(renderer, width, height, depth = false, filter = 'nearest', samples = 1) {",
);
await replace(
  'dist/runtime/webgpu.js',
  "    const sampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });",
  "    const sampleFilter = filter === 'linear' ? 'linear' : 'nearest';\n    const sampler = device.createSampler({ magFilter: sampleFilter, minFilter: sampleFilter });",
);
await replace(
  'dist/runtime/render-target.js',
  'return createWebgpuRenderTarget(renderer, Math.max(1, Math.floor(options.width)), Math.max(1, Math.floor(options.height)), options.depth ?? false);',
  "return createWebgpuRenderTarget(renderer, Math.max(1, Math.floor(options.width)), Math.max(1, Math.floor(options.height)), options.depth ?? false, options.filter ?? 'nearest', options.samples ?? 1);",
);
await replace(
  'dist/runtime/render-target.d.ts',
  '    depth?: boolean;',
  "    depth?: boolean;\n    /**\n     * How the target is sampled. Defaults to 'nearest', which is required for a target holding\n     * simulation state — interpolating two particles' positions is meaningless. Use 'linear' for\n     * an image target such as a bloom downsample chain, where point sampling produces blocky glow.\n     */\n    filter?: 'nearest' | 'linear';\n    /**\n     * Multisample count for drawing into this target. Defaults to 1. Use 4 to keep the same\n     * anti-aliasing an on-screen pass gets; the target texture stays single-sampled and receives\n     * the resolve.\n     */\n    samples?: number;",
);

// W A.2 — keep multisampling when drawing into a render target.
//
// drawTo sets passSamples = 1 unconditionally, so a pass that renders off-screen silently drops
// from 4x MSAA to none. That line is not wrong on its own: the target texture is single-sampled,
// and the pipeline must match its attachment. The missing piece is the multisampled attachment.
//
// This mirrors exactly what the on-screen pass already does — draw into a multisampled colour
// texture, resolve into the single-sampled one, and give the depth attachment the same sample
// count. The target texture stays single-sampled, so sampling it afterwards is unchanged.
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
