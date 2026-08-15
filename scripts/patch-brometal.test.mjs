import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..');
const patchScript = path.join(repositoryRoot, 'scripts', 'patch-brometal.mjs');
const EXPECTED_VERSION = '0.17.2';

/**
 * Find an installed BroMetal. npm places it wherever hoisting allows, and that has changed with the
 * dependency graph — it used to sit at the repository root and currently nests inside each demo
 * workspace. A test that hard-codes one location breaks on a layout change rather than on a defect.
 */
async function findInstalledPackage() {
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
      await readFile(path.join(root, 'dist', 'runtime', 'webgpu.js'));
      return root;
    } catch {
      // Not installed here.
    }
  }
  throw new Error('No installed BroMetal found. Run npm install first.');
}

async function findInstalledRuntime() {
  return path.join(await findInstalledPackage(), 'dist', 'runtime', 'webgpu.js');
}

/**
 * Import a module out of the patched installation.
 *
 * Deep-imports `dist/` rather than the package root because the runtime internals a patch adds are
 * deliberately not part of BroMetal's public surface. Every caller runs `runPatch()` first, so the
 * ESM cache only ever holds the patched copy.
 */
async function importInstalled(relativePath) {
  const file = path.join(await findInstalledPackage(), relativePath);
  return import(pathToFileURL(file).href);
}

async function runPatch(brometalRoot) {
  const environment = brometalRoot === undefined
    ? process.env
    : { ...process.env, ANTIKY_BROMETAL_ROOT: brometalRoot };
  return execute(process.execPath, [patchScript], { cwd: repositoryRoot, env: environment });
}

async function checksum(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

/** A fixture package carrying only what a given assertion needs to reach its throw. */
async function writeFixture(directory, { version, files = {} }) {
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'brometal', version }, null, 2),
  );
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(directory, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents);
  }
}

test('patching twice changes no bytes', async () => {
  // The postinstall hook runs on every install, so a patch that is not idempotent corrupts the
  // package the second time it is applied.
  const runtime = await findInstalledRuntime();
  await runPatch();
  const before = await checksum(runtime);
  await runPatch();
  assert.equal(await checksum(runtime), before);
});

test('every installed copy is patched, not just the first one found', async () => {
  // npm places BroMetal wherever hoisting allows and that placement has changed more than once in
  // this repository. Patching one copy and leaving another unpatched fails silently — the demo
  // just renders with the unpatched runtime — so every copy on disk must carry the patch.
  await runPatch();
  const roots = [path.join(repositoryRoot, 'node_modules/brometal')];
  const demosRoot = path.join(repositoryRoot, 'packages/demos');
  roots.push(path.join(demosRoot, 'node_modules/brometal'));
  for (const category of await readdir(demosRoot, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name === 'node_modules') continue;
    for (const demo of await readdir(path.join(demosRoot, category.name), { withFileTypes: true })) {
      if (!demo.isDirectory()) continue;
      roots.push(path.join(demosRoot, category.name, demo.name, 'node_modules/brometal'));
    }
  }

  let checked = 0;
  for (const root of roots) {
    const runtime = path.join(root, 'dist', 'runtime', 'webgpu.js');
    let source;
    try { source = await readFile(runtime, 'utf8'); } catch { continue; }
    assert.match(source, /const sampleFilter = filter === 'linear'/, `unpatched: ${runtime}`);
    assert.match(source, /resolveTarget: binding\.view,/, `unpatched: ${runtime}`);
    checked += 1;
  }
  assert.ok(checked > 0, 'no installed BroMetal copies were found to check');
});

test('the installed package carries both render-pipeline patches', async () => {
  await runPatch();
  const runtime = await readFile(await findInstalledRuntime(), 'utf8');

  // W A.1 — filtering is a per-target choice that still defaults to nearest.
  assert.match(runtime, /createWebgpuRenderTarget\(renderer, width, height, depth = false, filter = 'nearest', samples = 1\)/);
  assert.match(runtime, /const sampleFilter = filter === 'linear' \? 'linear' : 'nearest';/);

  // W A.2 — an off-screen pass resolves from a multisampled attachment instead of dropping to one
  // sample, and carries the configured count rather than a hard-coded 1.
  assert.match(runtime, /sampleCount: passSampleCount,/);
  assert.match(runtime, /resolveTarget: binding\.view,/);
  assert.match(runtime, /internals\.passSamples = binding\.samples \?\? 1;/);
  assert.doesNotMatch(runtime, /internals\.passSamples = 1;/);
});

test('the installed package can clamp a texture to a mip range', async () => {
  await runPatch();
  const runtime = await readFile(await findInstalledRuntime(), 'utf8');
  const types = await readFile(path.join(path.dirname(await findInstalledRuntime()), 'texture.d.ts'), 'utf8');

  // `lodMinClamp` and `lodMaxClamp` are standard GPUSamplerDescriptor fields. BroMetal exposed
  // wrap, filter and anisotropy and nothing else, so a caller could not cap the mip chain at all.
  assert.match(types, /lodMinClamp\?: number;/);
  assert.match(types, /lodMaxClamp\?: number;/);

  // Passed through only when asked for: an unset clamp must leave the descriptor untouched rather
  // than pinning it to a default, because WebGPU's own defaults (0 and 32) are what we want then.
  assert.match(runtime, /lodMinClamp: options\.lodMinClamp/);
  assert.match(runtime, /lodMaxClamp: options\.lodMaxClamp/);
});

/**
 * The smallest shader that needs an array atlas: one sampler, one layer index, one sample.
 *
 * Written out here rather than kept as a fixture file because it *is* the assertion — the DSL
 * type, the three-argument `texture()` call and the WGSL below are one statement about one
 * capability, and splitting them across files hides that.
 */
const ARRAY_SAMPLER_SHADER = `
import { shader, texture, vec4 } from 'brometal';

export default shader({
  attributes: { aPosition: 'vec2' },
  uniforms: { uViewProj: 'mat4', uAtlas: 'sampler2DArray', uLayer: 'float' },
  varyings: { vUv: 'vec2' },

  vertex({ aPosition }, { uViewProj }, v) {
    v.vUv = aPosition;
    return uViewProj.mul(vec4(aPosition, 0, 1));
  },

  fragment({ uAtlas, uLayer }, { vUv }) {
    return texture(uAtlas, vUv, uLayer);
  },
});
`;

test('a sampler2DArray shader compiles to an array texture and a three-argument sample', async () => {
  await runPatch();
  const { compileShaderSource } = await importInstalled('dist/compiler/compile.js');
  const compiled = compileShaderSource('array-atlas.shader.ts', ARRAY_SAMPLER_SHADER);

  // WGSL has had `texture_2d_array<f32>` and `textureSample(t, s, uv, layer)` since 1.0. The layer
  // is an integer there and a float in this DSL, so the emitter narrows it at the call.
  assert.match(compiled.wgslSrc, /var uAtlas : texture_2d_array<f32>;/);
  assert.match(compiled.wgslSrc, /textureSample\(uAtlas, uAtlas_sampler, bm_in\.vUv, i32\(bm_u\.uLayer\)\)/);

  // A sampler is a separate binding, never a member of the uniform block — the same rule
  // sampler2D and sampler3D already follow.
  assert.doesNotMatch(compiled.wgslSrc, /uAtlas : (?:f32|vec|mat)/);
  const atlas = compiled.layout.uniforms.find((entry) => entry.name === 'uAtlas');
  assert.equal(atlas.type, 'sampler2DArray');
  assert.equal(typeof atlas.textureBinding, 'number');
  assert.equal(atlas.samplerBinding, atlas.textureBinding + 1);
  assert.equal(atlas.offset, undefined);
  assert.deepEqual(compiled.warnings, []);
});

test('the program binds an array sampler as a 2d-array view', async () => {
  await runPatch();
  const runtime = await readFile(await findInstalledRuntime(), 'utf8');

  // `'2d-array'` is a standard GPUTextureBindingLayout viewDimension. The layout hard-coded a
  // two-way choice between '3d' and '2d', so an array view could not fill any slot — WebGPU
  // rejects the whole bind group rather than ignoring the mismatch.
  assert.match(runtime, /viewDimension: VIEW_DIMENSIONS\[entry\.type\]/);
  assert.match(runtime, /sampler2DArray: '2d-array'/);
  // An unbound array slot needs a layered placeholder for the same reason sampler3D needed a
  // volume one: a 2D view cannot fill a slot the layout declared as '2d-array'.
  assert.match(runtime, /placeholderLayerBinding/);
});

/**
 * A GPUDevice that records what it was asked to do.
 *
 * Mocking at the WebGPU boundary is the only way to assert this from Node — there is no headless
 * GPU here, and standing up a second browser harness beside the capture MCP would be a worse
 * trade than a stub. What the stub cannot prove (that the pixels land where the descriptors say)
 * the demo capture does.
 */
function recordingDevice() {
  // WebGPU's usage flags are a browser global, not something the runtime imports. Only the bits
  // the code under test ORs together are needed, and the real values keep the assertion honest.
  globalThis.GPUTextureUsage ??= Object.freeze({
    COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16,
  });
  const log = { textures: [], copies: [], writes: [], passes: [], bindGroups: [] };
  let current = null;
  const encoder = {
    beginRenderPass(descriptor) {
      current = { target: descriptor.colorAttachments[0].view, source: null };
      log.passes.push(current);
      return {
        setPipeline() {},
        setBindGroup(_index, group) {
          current.source = group.entries[0].resource;
        },
        draw() {},
        end() {
          current = null;
        },
      };
    },
    finish: () => ({}),
  };
  const device = {
    createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createSampler: (descriptor) => ({ kind: 'sampler', ...descriptor }),
    createBindGroup(descriptor) {
      log.bindGroups.push(descriptor);
      return descriptor;
    },
    createCommandEncoder: () => encoder,
    queue: {
      submit() {},
      writeTexture(destination, data, dataLayout, size) {
        log.writes.push({ destination, data, dataLayout, size });
      },
      copyExternalImageToTexture(source, destination, size) {
        log.copies.push({ source, destination, size });
      },
    },
    createTexture(descriptor) {
      const texture = {
        descriptor,
        destroy() {},
        createView: (view = {}) => ({ kind: 'view', ...view }),
      };
      log.textures.push(texture);
      return texture;
    },
  };
  return { device, log };
}

test('an array texture uploads one layer per image and views itself as a 2d-array', async () => {
  await runPatch();
  const { buildWebgpuTextureArray } = await importInstalled('dist/runtime/webgpu.js');
  const { device, log } = recordingDevice();

  const layers = [{ width: 4, height: 4 }, { width: 4, height: 4 }];
  const texture = buildWebgpuTextureArray(device, layers, { filter: 'nearest' });

  assert.deepEqual(log.textures[0].descriptor.size, { width: 4, height: 4, depthOrArrayLayers: 2 });
  // Layer N of the source list has to land at z = N, or a layer index selects the wrong picture.
  assert.deepEqual(log.copies.map((copy) => copy.destination.origin), [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
  ]);
  assert.deepEqual(log.copies.map((copy) => copy.source.source), layers);
  assert.equal(texture.__wgpu.view.dimension, '2d-array');
  assert.equal(texture.layers, 2);
});

test('an array texture refuses layers that are not the same size', async () => {
  await runPatch();
  const { buildWebgpuTextureArray } = await importInstalled('dist/runtime/webgpu.js');
  const { device } = recordingDevice();

  // Every layer shares one GPUTexture, so a mismatch is a caller error. WebGPU would report it as
  // a copy-size validation failure detached from the call that caused it.
  assert.throws(
    () => buildWebgpuTextureArray(device, [{ width: 4, height: 4 }, { width: 8, height: 4 }], {}),
    /layer 1 is 8x4 but layer 0 is 4x4/,
  );
  assert.throws(() => buildWebgpuTextureArray(device, [], {}), /at least one layer/);
});

test('array mips are built per layer, so no layer can take colour from another', async () => {
  await runPatch();
  const { generateWebgpuMipmaps } = await importInstalled('dist/runtime/webgpu.js');
  const { device, log } = recordingDevice();
  const texture = { createView: (view = {}) => ({ kind: 'view', ...view }) };

  generateWebgpuMipmaps(device, texture, 3, 2);

  // Two layers, three levels: level 1 and level 2 are rendered for each layer, and nothing else.
  assert.equal(log.passes.length, 4);
  assert.deepEqual(
    log.passes.map((pass) => [pass.source.baseArrayLayer, pass.target.baseArrayLayer]),
    [[0, 0], [0, 0], [1, 1], [1, 1]],
  );
  assert.deepEqual(
    log.passes.map((pass) => [pass.source.baseMipLevel, pass.target.baseMipLevel]),
    [[0, 1], [1, 2], [0, 1], [1, 2]],
  );

  // This is the assertion the whole change exists for. A view spanning more than one layer is the
  // only way a coarse mip could average across layers, exactly as an atlas mip averages across a
  // tile boundary. There is no such view.
  for (const pass of log.passes) {
    for (const view of [pass.source, pass.target]) {
      assert.equal(view.arrayLayerCount, 1);
      assert.equal(view.mipLevelCount, 1);
      assert.equal(view.dimension, '2d');
    }
  }
});

test('mipping a plain 2D texture is unchanged by the array path', async () => {
  await runPatch();
  const { generateWebgpuMipmaps } = await importInstalled('dist/runtime/webgpu.js');
  const { device, log } = recordingDevice();
  const texture = { createView: (view = {}) => ({ kind: 'view', ...view }) };

  // Every existing caller passes three arguments. One layer must still mean one chain.
  generateWebgpuMipmaps(device, texture, 4);
  assert.equal(log.passes.length, 3);
  assert.deepEqual(log.passes.map((pass) => pass.target.baseArrayLayer), [0, 0, 0]);
});

test('a different BroMetal version stops the patch rather than applying it blindly', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-brometal-version-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFixture(directory, { version: '0.16.0' });

  await assert.rejects(
    runPatch(directory),
    (error) => {
      assert.match(error.stderr, /Expected BroMetal 0\.17\.2, found 0\.16\.0/);
      return true;
    },
  );
});

test('a moved patch target is an error, never a silent no-op', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-brometal-target-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Right version, but the first patch target's surrounding source has changed.
  await writeFixture(directory, {
    version: EXPECTED_VERSION,
    files: { 'dist/dsl/builtins.js': 'export function texture() { return somethingElse(); }\n' },
  });

  await assert.rejects(
    runPatch(directory),
    (error) => {
      assert.match(error.stderr, /BroMetal patch target changed/);
      return true;
    },
  );
});

test('every patch module on disk is registered in the runner', async () => {
  // A modular split introduces a failure mode a single file could not have: a patch that exists,
  // reads correctly, and is never applied because nobody imported it.
  const { PATCHES } = await import('./patch-brometal.mjs');
  const directory = path.join(repositoryRoot, 'scripts', 'patch-brometal');
  const onDisk = (await readdir(directory))
    .filter((entry) => entry.endsWith('.mjs'))
    .map((entry) => entry.replace(/\.mjs$/, ''))
    .sort();

  assert.deepEqual(PATCHES.map((patch) => patch.name).sort(), onDisk);
  assert.equal(new Set(PATCHES.map((patch) => patch.name)).size, PATCHES.length, 'duplicate name');
  for (const patch of PATCHES) assert.equal(typeof patch.apply, 'function', patch.name);
});
