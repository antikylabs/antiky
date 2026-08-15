import assert from 'node:assert/strict';
import test from 'node:test';

import { withGpuPage } from './support/gpu-page.mjs';

/**
 * What a real device proves that a recording stub cannot.
 *
 * The `sampler2DArray` patch is covered elsewhere by tests that drive the shipped code against a
 * fake `GPUDevice` and assert on the calls it makes — that the upload names `depthOrArrayLayers: 2`,
 * that every mip view pins one layer. Those are sound, but they check the *plan*. They pass whether
 * or not the GPU agrees, and they cannot answer the question the capability actually exists to
 * answer: does sampling layer 1 return layer 1's colour?
 *
 * These tests answer it. They build the array through BroMetal's own
 * `buildWebgpuTextureArray` — the patched code that ships — then sample it with minimal WGSL written
 * here rather than through BroMetal's shader compiler, which has no public entry point from Node.
 * That split is deliberate: the patch's runtime half (upload, view dimension, per-layer mips) is
 * what is under test, and the WGSL is only the instrument reading it.
 */

/** Sample one layer of a BroMetal array texture at a chosen mip and read the pixel back. */
const SAMPLE_LAYER = `
async (layerIndex, mipLevel, colours) => {
  const { buildWebgpuTextureArray } = await import('/node_modules/brometal/dist/runtime/webgpu.js');
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  // Each layer is one flat colour, so any cross-layer average shows up as a colour that belongs to
  // neither layer — the same logic as the atlas border measurement, one dimension down.
  const sources = colours.map(([r, g, b]) => {
    const canvas = new OffscreenCanvas(64, 64);
    const context = canvas.getContext('2d');
    context.fillStyle = \`rgb(\${r} \${g} \${b})\`;
    context.fillRect(0, 0, 64, 64);
    return canvas;
  });

  device.pushErrorScope('validation');
  const array = buildWebgpuTextureArray(device, sources, {});
  const { view, sampler } = array.__wgpu;

  const module = device.createShaderModule({
    code: \`
      @group(0) @binding(0) var t : texture_2d_array<f32>;
      @group(0) @binding(1) var s : sampler;
      struct P { layer : f32, mip : f32 };
      @group(0) @binding(2) var<uniform> p : P;
      @vertex fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4f {
        var xy = array(vec2f(-1,-1), vec2f(3,-1), vec2f(-1,3));
        return vec4f(xy[i], 0, 1);
      }
      @fragment fn fs() -> @location(0) vec4f {
        return textureSampleLevel(t, s, vec2f(0.5, 0.5), i32(p.layer), p.mip);
      }
    \`,
  });

  const uniform = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(uniform, 0, new Float32Array([layerIndex, mipLevel]));

  const target = device.createTexture({
    size: [1, 1],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] },
  });
  const bind = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: view },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: uniform } },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{ view: target.createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(3);
  pass.end();

  // 256-byte row alignment is a copy requirement, not a choice.
  const readback = device.createBuffer({ size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  encoder.copyTextureToBuffer({ texture: target }, { buffer: readback, bytesPerRow: 256 }, [1, 1]);
  device.queue.submit([encoder.finish()]);

  await readback.mapAsync(GPUMapMode.READ);
  const pixel = Array.from(new Uint8Array(readback.getMappedRange().slice(0, 4)));
  readback.unmap();

  const validationError = await device.popErrorScope();
  return { pixel, layers: array.layers, error: validationError ? validationError.message : null };
}
`;

const RED = [220, 30, 30];
const CYAN = [30, 200, 220];

/** Channel-wise closeness; the GPU is allowed rounding, not a different colour. */
function near(actual, expected, tolerance = 6) {
  return expected.every((channel, index) => Math.abs(actual[index] - channel) <= tolerance);
}

test('a BroMetal array texture binds on a real device with no validation error', async () => {
  const result = await withGpuPage((page) =>
    page.evaluate(`(${SAMPLE_LAYER})(0, 0, ${JSON.stringify([RED, CYAN])})`));

  assert.equal(result.error, null, `WebGPU rejected the array texture: ${result.error}`);
  assert.equal(result.layers, 2);
});

test('a layer index selects the layer it names', async () => {
  const [zero, one] = await withGpuPage(async (page) => [
    await page.evaluate(`(${SAMPLE_LAYER})(0, 0, ${JSON.stringify([RED, CYAN])})`),
    await page.evaluate(`(${SAMPLE_LAYER})(1, 0, ${JSON.stringify([RED, CYAN])})`),
  ]);

  // The failure this catches and the stub cannot: an off-by-one or a view built as plain '2d' would
  // return the same colour for both indices, or the wrong one for each.
  assert.ok(near(zero.pixel, RED), `layer 0 returned ${zero.pixel}, expected ~${RED}`);
  assert.ok(near(one.pixel, CYAN), `layer 1 returned ${one.pixel}, expected ~${CYAN}`);
});

test('a coarse mip takes no colour from the layer beside it', async () => {
  // The whole point of per-layer mipping. At mip 6 a 64px layer is one texel, so if the chain were
  // built across a multi-layer view that texel would hold red and cyan averaged together — a muddy
  // grey belonging to neither. Each layer is flat, so a correct chain keeps its own colour exactly.
  const [zero, one] = await withGpuPage(async (page) => [
    await page.evaluate(`(${SAMPLE_LAYER})(0, 6, ${JSON.stringify([RED, CYAN])})`),
    await page.evaluate(`(${SAMPLE_LAYER})(1, 6, ${JSON.stringify([RED, CYAN])})`),
  ]);

  assert.ok(near(zero.pixel, RED, 10), `layer 0 at mip 6 returned ${zero.pixel}, expected ~${RED}`);
  assert.ok(near(one.pixel, CYAN, 10), `layer 1 at mip 6 returned ${one.pixel}, expected ~${CYAN}`);

  const averaged = [(RED[0] + CYAN[0]) / 2, (RED[1] + CYAN[1]) / 2, (RED[2] + CYAN[2]) / 2];
  assert.ok(!near(zero.pixel, averaged, 20), 'layer 0 at mip 6 read as an average of both layers');
});
