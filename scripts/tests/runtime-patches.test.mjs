import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');

async function findPackage() {
  if (process.env.ANTIKY_BROMETAL_TEST_ROOT !== undefined) {
    return process.env.ANTIKY_BROMETAL_TEST_ROOT;
  }
  const roots = [path.join(repositoryRoot, 'node_modules/brometal')];
  const demosRoot = path.join(repositoryRoot, 'packages/demos');
  for (const category of await readdir(demosRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name === 'node_modules') continue;
    for (const demo of await readdir(path.join(demosRoot, category.name), { withFileTypes: true })) {
      if (demo.isDirectory()) {
        roots.push(path.join(demosRoot, category.name, demo.name, 'node_modules/brometal'));
      }
    }
  }
  for (const root of roots) {
    try {
      await readFile(path.join(root, 'package.json'));
      return root;
    } catch {
      // Try the next npm placement.
    }
  }
  throw new Error('No installed BroMetal found. Run npm install first.');
}

const packageRoot = await findPackage();
const importPackage = (relative) => import(pathToFileURL(path.join(packageRoot, relative)).href);
const {
  createWebgpuProgram,
  createWebgpuRenderer,
  createWebgpuRenderTarget,
  createWebgpuTexture,
  webgpuInternals,
} = await importPackage('dist/runtime/webgpu.js');

function installWebgpuGlobals(gpu) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu } });
  globalThis.window = { devicePixelRatio: 1 };
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
  globalThis.GPUBufferUsage = Object.freeze({
    COPY_DST: 1,
    INDEX: 2,
    STORAGE: 4,
    UNIFORM: 8,
    VERTEX: 16,
  });
  globalThis.GPUShaderStage = Object.freeze({ COMPUTE: 1, FRAGMENT: 2, VERTEX: 4 });
}

async function recordingRenderer() {
  const log = {
    bindGroups: [],
    buffers: [],
    passes: [],
    samplers: [],
    submissions: [],
    textures: [],
    vertexBindings: [],
    writes: [],
  };
  const queue = {
    copyExternalImageToTexture() {},
    submit(commands) { log.submissions.push(commands); },
    writeBuffer(buffer, offset, data) { log.writes.push({ buffer, data, offset }); },
    writeTexture() {},
  };
  const device = {
    addEventListener() {},
    createBindGroup(descriptor) {
      log.bindGroups.push(descriptor);
      return descriptor;
    },
    createBindGroupLayout: (descriptor) => descriptor,
    createBuffer(descriptor) {
      const buffer = {
        ...descriptor,
        destroyed: false,
        destroy() { buffer.destroyed = true; },
      };
      log.buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder() {
      const encoded = { passes: [] };
      return {
        beginRenderPass(descriptor) {
          const pass = {
            descriptor,
            draw() {},
            drawIndexed() {},
            end() {},
            setBindGroup() {},
            setIndexBuffer() {},
            setPipeline() {},
            setVertexBuffer(slot, buffer, offset) {
              log.vertexBindings.push({ buffer, offset, slot });
            },
          };
          encoded.passes.push(pass);
          log.passes.push(pass);
          return pass;
        },
        finish: () => encoded,
      };
    },
    createPipelineLayout: (descriptor) => descriptor,
    createRenderPipeline: (descriptor) => ({
      descriptor,
      getBindGroupLayout: () => ({}),
    }),
    createSampler(descriptor) {
      const sampler = { descriptor };
      log.samplers.push(sampler);
      return sampler;
    },
    createShaderModule: (descriptor) => descriptor,
    createTexture(descriptor) {
      const texture = {
        descriptor,
        destroyed: false,
        createView: (view = {}) => ({ texture, view }),
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
    clientHeight: 3,
    clientWidth: 4,
    getContext: (kind) => (kind === 'webgpu' ? context : null),
    height: 3,
    width: 4,
  };
  const renderer = await createWebgpuRenderer(canvas, { antialias: false });
  return { device, log, renderer };
}

test('discard compiles as a fragment statement and emits WGSL discard', async () => {
  const { compileShaderSource } = await importPackage('dist/compiler/compile.js');
  const shaderPath = path.join(
    repositoryRoot,
    'packages/demos/antiky/antiky-town/src/town/shaders/town-sprite-shadow.shader.ts',
  );
  const compiled = compileShaderSource(shaderPath, await readFile(shaderPath, 'utf8'));

  assert.match(compiled.wgslSrc, /\bdiscard;/);
});

test('present draws exactly one caller-owned frame without scheduling a loop', async () => {
  const { log, renderer } = await recordingRenderer();
  let callbacks = 0;

  renderer.present(() => { callbacks += 1; });

  assert.equal(callbacks, 1);
  assert.equal(log.passes.length, 1);
  assert.equal(log.submissions.length, 1);
});

test('render-target filtering reaches the GPU sampler descriptor', async () => {
  const { log, renderer } = await recordingRenderer();
  createWebgpuRenderTarget(renderer, 8, 6, false, 'linear', 1);
  const targetSampler = log.samplers.at(-1);

  assert.equal(targetSampler.descriptor.magFilter, 'linear');
  assert.equal(targetSampler.descriptor.minFilter, 'linear');
});

test('offscreen multisampling resolves a multisampled attachment into the target texture', async () => {
  const { log, renderer } = await recordingRenderer();
  const target = createWebgpuRenderTarget(renderer, 8, 6, true, 'nearest', 4);
  assert.ok(log.textures.some((texture) => (
    texture.descriptor.format === 'rgba16float' && texture.descriptor.sampleCount === 4
  )));
  assert.ok(log.textures.some((texture) => (
    texture.descriptor.format === 'depth24plus' && texture.descriptor.sampleCount === 4
  )));

  renderer.drawTo(target, () => {});
  const attachment = log.passes.at(-1).descriptor.colorAttachments[0];
  assert.equal(attachment.storeOp, 'discard');
  assert.ok(attachment.resolveTarget);
  assert.equal(attachment.view.texture.descriptor.sampleCount, 4);
  assert.equal(attachment.resolveTarget.texture.descriptor.sampleCount, undefined);
});

test('texture LOD clamps reach the WebGPU sampler without inventing defaults', async () => {
  const { log, renderer } = await recordingRenderer();
  createWebgpuTexture(renderer, { height: 1, width: 1 }, {
    filter: 'linear',
    lodMaxClamp: 3,
    lodMinClamp: 1,
  });
  const explicit = log.samplers.at(-1).descriptor;
  assert.equal(explicit.lodMinClamp, 1);
  assert.equal(explicit.lodMaxClamp, 3);

  createWebgpuTexture(renderer, { height: 1, width: 1 }, { filter: 'linear' });
  const omitted = log.samplers.at(-1).descriptor;
  assert.equal(omitted.lodMinClamp, undefined);
  assert.equal(omitted.lodMaxClamp, undefined);
});

test('repeated attribute uploads keep both draws and retire a grown buffer next frame', async () => {
  const { log, renderer } = await recordingRenderer();
  const compiled = {
    hasCompute: false,
    layout: {
      attributes: [{ divisor: 0, location: 0, name: 'aPosition', size: 2 }],
      uniformBlockSize: 0,
      uniforms: [],
    },
    storageWritten: [],
    wgslSrc: 'mock-wgsl',
  };
  const program = createWebgpuProgram(renderer, compiled);
  const internals = webgpuInternals(renderer);
  const pass = {
    draw() {},
    setBindGroup() {},
    setPipeline() {},
    setVertexBuffer(slot, buffer, offset) {
      log.vertexBindings.push({ buffer, offset, slot });
    },
  };
  internals.frame = 1;
  internals.pass = pass;

  program.attributes.aPosition.set(new Float32Array([0, 0]));
  program.draw();
  program.attributes.aPosition.set(new Float32Array([1, 1]));
  program.draw();

  assert.deepEqual(log.writes.slice(-2).map((write) => write.offset), [0, 8]);
  assert.deepEqual(log.vertexBindings.slice(-2).map((binding) => binding.offset), [0, 8]);
  const retired = log.vertexBindings.at(-2).buffer;
  assert.equal(retired.destroyed, false);
  internals.frame = 2;
  program.draw();
  assert.equal(retired.destroyed, true);
});
