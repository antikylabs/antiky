import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
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
async function findInstalledRuntime() {
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
    const runtime = path.join(root, 'dist', 'runtime', 'webgpu.js');
    try {
      await readFile(runtime);
      return runtime;
    } catch {
      // Not installed here.
    }
  }
  throw new Error('No installed BroMetal found. Run npm install first.');
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
