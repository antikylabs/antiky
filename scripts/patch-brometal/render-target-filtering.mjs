/**
 * W A.1 — a per-target filter option on render targets.
 *
 * The sampler is hard-coded to nearest. The comment above it blames rgba32float, which is not
 * filterable without an opt-in device feature — but TARGET_FORMAT is rgba16float, which IS
 * filterable in core WebGPU, and no rgba32float target is ever created. That half of the comment
 * is stale. The other half is real and preserved: a target holding simulation state must not
 * interpolate, because averaging two particles' positions is meaningless. So filtering becomes a
 * per-target choice that still defaults to nearest, and only an image target such as a bloom
 * downsample chain opts into linear.

 * Upstream draft: docs/objectives/scratch/demo-refining/upstream/pr-1-render-target-filtering.md
 */
export const name = 'render-target-filtering';

export async function apply({ replace, replaceSection }) {
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
}
