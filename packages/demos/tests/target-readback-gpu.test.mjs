import assert from 'node:assert/strict';
import test from 'node:test';

import { withGpuPage } from './support/gpu-page.mjs';

const READ_TARGET_PIXEL = `
async () => {
  const brometal = await import('/node_modules/brometal/dist/index.js');
  const { webgpuInternals } = await import('/node_modules/brometal/dist/runtime/webgpu.js');
  const canvas = document.createElement('canvas');
  canvas.style.width = '8px';
  canvas.style.height = '8px';
  document.body.append(canvas);
  const errors = [];
  const renderer = await brometal.createRenderer(canvas, {
    antialias: false,
    onError: (error) => errors.push(error.message),
  });
  const device = webgpuInternals(renderer).device;
  device.pushErrorScope('validation');
  const target = brometal.createRenderTarget(renderer, { width: 2, height: 2 });
  const compiled = {
    hasCompute: false,
    layout: {
      attributes: [{ name: 'aPosition', type: 'vec2', size: 2, location: 0, divisor: 0 }],
      uniforms: [],
      uniformBlockSize: 0,
    },
    storageWritten: [],
    wgslSrc: \`
      @vertex fn vs_main(@location(0) position: vec2f) -> @builtin(position) vec4f {
        return vec4f(position, 0, 1);
      }
      @fragment fn fs_main() -> @location(0) vec4f {
        return vec4f(1, 0.5, 0.25, 1);
      }
    \`,
  };
  const program = brometal.createProgram(renderer, compiled);
  program.attributes.aPosition.set(new Float32Array([-1, -1, 3, -1, -1, 3]));
  renderer.drawTo(target, () => program.draw());
  const pixel = await target.readPixel(0, 0);
  const validation = await device.popErrorScope();
  program.dispose();
  target.dispose();
  renderer.destroy();
  canvas.remove();
  return {
    errors,
    pixel: Array.from(pixel),
    validation: validation?.message ?? null,
  };
}
`;

test('BroMetal reads a known render-target pixel asynchronously on a real GPU', async () => {
  const result = await withGpuPage((page) => page.evaluate(`(${READ_TARGET_PIXEL})()`));

  assert.equal(result.validation, null, `WebGPU rejected target readback: ${result.validation}`);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.pixel, [1, 0.5, 0.25, 1]);
});
