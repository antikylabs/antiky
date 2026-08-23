/**
 * Read one resolved render-target pixel through the public target handle.
 *
 * Clean BroMetal 0.18.0 creates its rgba16float target with COPY_SRC but exposes no operation that
 * uses it. This adds a bounded asynchronous `readPixel(x, y)` primitive. Coordinates are integer
 * texels from the top-left, the four half-float channels are decoded to numbers, and every call
 * owns a 256-byte row-aligned staging buffer that is destroyed on success or failure. The API has
 * no Antiky identity, selection, Studio, or policy concepts.
 *
 * **Upstream: not submitted.** The owner deferred upstream submission for this pass.
 * Retire only after a future focused pull request is merged, Antiky installs a published BroMetal
 * release containing equivalent bounded readback, and the clean-package behavior tests pass
 * without this patch. Then remove this module, drop it from PATCHES in ../patch-brometal.mjs and
 * the scripts allowlist in ../tests/repository-policy.test.mjs, clean-install, and rerun the
 * behavior, real-GPU, and full tests.
 */
export const name = 'target-readback';

export async function apply({ replace }) {
  await replace(
    'dist/runtime/webgpu.js',
    'const INTERNALS = new WeakMap();',
    `const INTERNALS = new WeakMap();
// The active target is tracked separately from the pass because reading another completed target
// while a canvas or target pass is open is valid. Only copying the texture currently attached to a
// render pass is forbidden.
const ACTIVE_TARGETS = new WeakMap();`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `            const outerSamples = internals.passSamples;
            const outerDepth = internals.passDepth;
            internals.pass = encoder.beginRenderPass({`,
    `            const outerSamples = internals.passSamples;
            const outerDepth = internals.passDepth;
            const outerTarget = ACTIVE_TARGETS.get(renderer);
            internals.pass = encoder.beginRenderPass({`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `            internals.passFormat = TARGET_FORMAT;
            internals.passSamples = binding.samples ?? 1;`,
    `            ACTIVE_TARGETS.set(renderer, binding);
            internals.passFormat = TARGET_FORMAT;
            internals.passSamples = binding.samples ?? 1;`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `                internals.passSamples = outerSamples;
                internals.passDepth = outerDepth;
                device.queue.submit([encoder.finish()]);`,
    `                internals.passSamples = outerSamples;
                internals.passDepth = outerDepth;
                if (outerTarget === undefined) {
                    ACTIVE_TARGETS.delete(renderer);
                }
                else {
                    ACTIVE_TARGETS.set(renderer, outerTarget);
                }
                device.queue.submit([encoder.finish()]);`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `export function createWebgpuRenderTarget(renderer, width, height, depth = false, filter = 'nearest', samples = 1) {`,
    `/** Decode one little-endian IEEE-754 binary16 channel without relying on a platform float16 view. */
function decodeFloat16(bits) {
    const sign = (bits & 0x8000) === 0 ? 1 : -1;
    const exponent = (bits >>> 10) & 0x1f;
    const fraction = bits & 0x03ff;
    if (exponent === 0) {
        return sign * fraction * 2 ** -24;
    }
    if (exponent === 0x1f) {
        return fraction === 0 ? sign * Infinity : NaN;
    }
    return sign * (1 + fraction / 0x400) * 2 ** (exponent - 15);
}
export function createWebgpuRenderTarget(renderer, width, height, depth = false, filter = 'nearest', samples = 1) {`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `        : null;
    const target = {
        width,`,
    `        : null;
    let disposed = false;
    const target = {
        width,`,
  );

  await replace(
    'dist/runtime/webgpu.js',
    `        depth,
        texture: { __wgpu: binding, dispose() { } },
        dispose() {
            texture.destroy();`,
    `        depth,
        texture: { __wgpu: binding, dispose() { } },
        async readPixel(x, y) {
            if (disposed) {
                throw new Error('BroMetal: cannot read a disposed render target');
            }
            if (!Number.isInteger(x) || !Number.isInteger(y)
                || x < 0 || x >= width || y < 0 || y >= height) {
                throw new Error('BroMetal: readPixel needs integer coordinates inside the target (0..'
                    + (width - 1) + ', 0..' + (height - 1) + ')');
            }
            if (ACTIVE_TARGETS.get(renderer)?.texture === texture) {
                throw new Error('BroMetal: cannot read a target while it is the active render attachment');
            }
            const staging = device.createBuffer({
                size: 256,
                usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
            });
            let mapped = false;
            try {
                const encoder = device.createCommandEncoder();
                encoder.copyTextureToBuffer(
                    { texture, origin: { x, y, z: 0 } },
                    { buffer: staging, bytesPerRow: 256, rowsPerImage: 1 },
                    { width: 1, height: 1, depthOrArrayLayers: 1 },
                );
                device.queue.submit([encoder.finish()]);
                await staging.mapAsync(GPUMapMode.READ, 0, 8);
                mapped = true;
                const view = new DataView(staging.getMappedRange(0, 8));
                return Object.freeze([
                    decodeFloat16(view.getUint16(0, true)),
                    decodeFloat16(view.getUint16(2, true)),
                    decodeFloat16(view.getUint16(4, true)),
                    decodeFloat16(view.getUint16(6, true)),
                ]);
            }
            finally {
                try {
                    if (mapped) staging.unmap();
                }
                finally {
                    staging.destroy();
                }
            }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            texture.destroy();`,
  );

  await replace(
    'dist/runtime/render-target.d.ts',
    `    /** Whether drawing into this target is depth-tested. */
    readonly depth: boolean;
    dispose(): void;`,
    `    /** Whether drawing into this target is depth-tested. */
    readonly depth: boolean;
    /** Read one top-left-origin rgba16float texel after earlier submitted GPU work completes. */
    readPixel(x: number, y: number): Promise<readonly [number, number, number, number]>;
    dispose(): void;`,
  );
}
