import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

async function findInstalledPackage() {
  if (process.env.ANTIKY_BROMETAL_TEST_ROOT !== undefined) {
    return process.env.ANTIKY_BROMETAL_TEST_ROOT;
  }
  const roots = [path.join(repositoryRoot, 'node_modules/brometal')];
  const demosRoot = path.join(repositoryRoot, 'packages/demos');
  for (const category of await readdir(demosRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name === 'node_modules') continue;
    for (const demo of await readdir(path.join(demosRoot, category.name), { withFileTypes: true })) {
      if (!demo.isDirectory()) continue;
      roots.push(path.join(demosRoot, category.name, demo.name, 'node_modules/brometal'));
    }
  }
  for (const root of roots) {
    try {
      await readFile(path.join(root, 'dist/runtime/webgpu.js'));
      return root;
    } catch {
      // Try the next npm placement.
    }
  }
  throw new Error('No installed BroMetal found. Run npm install first.');
}

const packageRoot = await findInstalledPackage();
const runtimeUrl = pathToFileURL(path.join(packageRoot, 'dist/runtime/webgpu.js')).href;
const { createWebgpuRenderer, createWebgpuRenderTarget } = await import(runtimeUrl);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

function encodedHalfChannels(bits) {
  const bytes = new ArrayBuffer(256);
  const view = new DataView(bytes);
  bits.forEach((value, index) => view.setUint16(index * 2, value, true));
  return bytes;
}

function installWebgpuGlobals(gpu) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { gpu },
  });
  globalThis.ResizeObserver = class {
    observe() {}

    disconnect() {}
  };
  globalThis.GPUTextureUsage = Object.freeze({
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    RENDER_ATTACHMENT: 8,
  });
  globalThis.GPUBufferUsage = Object.freeze({ MAP_READ: 1, COPY_DST: 2 });
  globalThis.GPUMapMode = Object.freeze({ READ: 1 });
}

async function recordingRuntime(readPlans = []) {
  const log = {
    buffers: [],
    copies: [],
    events: [],
    passes: [],
    submissions: [],
    textures: [],
  };
  let textureSequence = 0;
  const queue = {
    submit(commands) {
      log.events.push('submit');
      log.submissions.push(commands);
    },
    writeTexture() {},
  };
  const device = {
    addEventListener() {},
    createBuffer(descriptor) {
      const plan = readPlans.shift() ?? { bits: [0, 0, 0, 0] };
      const buffer = {
        descriptor,
        destroyed: false,
        unmapped: false,
        getMappedRange(offset, size) {
          log.events.push('range');
          assert.equal(offset, 0);
          assert.equal(size, 8);
          if (plan.rangeError !== undefined) throw plan.rangeError;
          return encodedHalfChannels(plan.bits ?? [0, 0, 0, 0]);
        },
        async mapAsync(mode, offset, size) {
          log.events.push('map');
          assert.equal(mode, GPUMapMode.READ);
          assert.equal(offset, 0);
          assert.equal(size, 8);
          if (plan.mapGate !== undefined) await plan.mapGate.promise;
          if (plan.mapError !== undefined) throw plan.mapError;
        },
        unmap() {
          log.events.push('unmap');
          buffer.unmapped = true;
        },
        destroy() {
          log.events.push('destroy-buffer');
          buffer.destroyed = true;
        },
      };
      log.buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder() {
      const command = { copies: [], kind: 'encoder' };
      return {
        beginRenderPass(descriptor) {
          const pass = {
            descriptor,
            ended: false,
            end() { pass.ended = true; },
          };
          log.passes.push(pass);
          return pass;
        },
        copyTextureToBuffer(source, destination, size) {
          log.events.push('copy');
          const copy = { destination, size, source };
          command.copies.push(copy);
          log.copies.push(copy);
        },
        finish() { return command; },
      };
    },
    createSampler: (descriptor) => ({ descriptor, kind: 'sampler' }),
    createTexture(descriptor) {
      const texture = {
        descriptor,
        destroyed: false,
        id: ++textureSequence,
        createView: (view = {}) => ({ kind: 'view', texture, view }),
        destroy() { texture.destroyed = true; },
      };
      log.textures.push(texture);
      return texture;
    },
    destroy() {},
    lost: new Promise(() => {}),
    queue,
  };
  const context = {
    configure() {},
    getCurrentTexture: () => device.createTexture({ kind: 'swapchain' }),
  };
  const gpu = {
    getPreferredCanvasFormat: () => 'bgra8unorm',
    requestAdapter: async () => ({ requestDevice: async () => device }),
  };
  installWebgpuGlobals(gpu);
  const canvas = {
    getContext: (kind) => (kind === 'webgpu' ? context : null),
    height: 3,
    width: 4,
  };
  const renderer = await createWebgpuRenderer(canvas, { antialias: false });
  return { device, log, renderer };
}

test('readPixel copies one resolved RGBA16F texel with WebGPU row alignment', async () => {
  const { log, renderer } = await recordingRuntime([{ bits: [0x3c00, 0xc000, 0x3800, 0] }]);
  const target = createWebgpuRenderTarget(renderer, 4, 3, false, 'nearest', 4);

  assert.deepEqual(await target.readPixel(2, 0), [1, -2, 0.5, 0]);
  assert.equal(log.buffers.length, 1);
  assert.deepEqual(log.buffers[0].descriptor, {
    size: 256,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  assert.equal(log.copies.length, 1);
  assert.deepEqual(log.copies[0].source.origin, { x: 2, y: 0, z: 0 });
  assert.deepEqual(log.copies[0].destination.bytesPerRow, 256);
  assert.deepEqual(log.copies[0].destination.rowsPerImage, 1);
  assert.deepEqual(log.copies[0].size, { width: 1, height: 1, depthOrArrayLayers: 1 });
  assert.equal(log.copies[0].source.texture, log.textures[0]);
  assert.equal(log.copies[0].source.texture.descriptor.sampleCount, undefined);
  assert.ok(log.textures.some((texture) => texture.descriptor.sampleCount === 4));
  assert.ok(log.events.indexOf('copy') < log.events.indexOf('submit'));
  assert.ok(log.events.indexOf('submit') < log.events.indexOf('map'));
  assert.equal(log.buffers[0].unmapped, true);
  assert.equal(log.buffers[0].destroyed, true);
});

test('readPixel decodes binary16 edge cases explicitly', async () => {
  const { renderer } = await recordingRuntime([
    { bits: [0x0000, 0x8000, 0x0001, 0x3c00] },
    { bits: [0x7c00, 0xfc00, 0x7e00, 0xc000] },
  ]);
  const target = createWebgpuRenderTarget(renderer, 1, 1);

  const first = await target.readPixel(0, 0);
  assert.equal(first[0], 0);
  assert.ok(Object.is(first[1], -0));
  assert.equal(first[2], 2 ** -24);
  assert.equal(first[3], 1);
  const second = await target.readPixel(0, 0);
  assert.equal(second[0], Infinity);
  assert.equal(second[1], -Infinity);
  assert.ok(Number.isNaN(second[2]));
  assert.equal(second[3], -2);
});

test('readPixel validates integer top-left coordinates and rejects disposed targets', async () => {
  const { log, renderer } = await recordingRuntime();
  const target = createWebgpuRenderTarget(renderer, 3, 2);

  for (const [x, y] of [[-1, 0], [3, 0], [0, -1], [0, 2], [0.5, 0], [0, NaN]]) {
    await assert.rejects(target.readPixel(x, y), /integer coordinates inside the target/);
  }
  assert.equal(log.buffers.length, 0);
  target.dispose();
  await assert.rejects(target.readPixel(0, 0), /disposed render target/);
  assert.equal(log.buffers.length, 0);
});

test('concurrent reads own separate staging buffers and settle independently', async () => {
  const firstGate = deferred();
  const secondGate = deferred();
  const { log, renderer } = await recordingRuntime([
    { bits: [0x3c00, 0, 0, 0], mapGate: firstGate },
    { bits: [0x4000, 0, 0, 0], mapGate: secondGate },
  ]);
  const target = createWebgpuRenderTarget(renderer, 2, 1);
  const first = target.readPixel(0, 0);
  const second = target.readPixel(1, 0);

  assert.equal(log.buffers.length, 2);
  assert.notEqual(log.buffers[0], log.buffers[1]);
  secondGate.resolve();
  assert.deepEqual(await second, [2, 0, 0, 0]);
  assert.equal(log.buffers[1].destroyed, true);
  assert.equal(log.buffers[0].destroyed, false);
  firstGate.resolve();
  assert.deepEqual(await first, [1, 0, 0, 0]);
  assert.equal(log.buffers[0].destroyed, true);
});

test('mapping, device-loss, and decode failures always release the staging buffer', async () => {
  const { log, renderer } = await recordingRuntime([
    { mapError: new Error('mapping failed') },
    { mapError: new Error('device lost') },
    { rangeError: new Error('decode failed') },
  ]);
  const target = createWebgpuRenderTarget(renderer, 1, 1);

  await assert.rejects(target.readPixel(0, 0), /mapping failed/);
  await assert.rejects(target.readPixel(0, 0), /device lost/);
  await assert.rejects(target.readPixel(0, 0), /decode failed/);
  assert.deepEqual(log.buffers.map((buffer) => buffer.destroyed), [true, true, true]);
  assert.deepEqual(log.buffers.map((buffer) => buffer.unmapped), [false, false, true]);
});

test('a target cannot read itself while attached, but another target remains readable', async () => {
  const { renderer } = await recordingRuntime([{ bits: [0x3c00, 0, 0, 0] }]);
  const active = createWebgpuRenderTarget(renderer, 1, 1);
  const other = createWebgpuRenderTarget(renderer, 1, 1);
  let activeRead;
  let otherRead;

  renderer.drawTo(active, () => {
    activeRead = active.readPixel(0, 0);
    otherRead = other.readPixel(0, 0);
  });

  await assert.rejects(activeRead, /active render attachment/);
  assert.deepEqual(await otherRead, [1, 0, 0, 0]);
});
