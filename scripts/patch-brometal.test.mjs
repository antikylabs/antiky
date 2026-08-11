import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..');
const patchScript = path.join(repositoryRoot, 'scripts', 'patch-brometal.mjs');
const installedRuntime = path.join(
  repositoryRoot, 'node_modules', 'brometal', 'dist', 'runtime', 'webgpu.js',
);

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
  await runPatch();
  const before = await checksum(installedRuntime);
  await runPatch();
  assert.equal(await checksum(installedRuntime), before);
});

test('the installed package carries both render-pipeline patches', async () => {
  await runPatch();
  const runtime = await readFile(installedRuntime, 'utf8');

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

test('a different BroMetal version stops the patch rather than applying it blindly', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-brometal-version-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFixture(directory, { version: '0.16.0' });

  await assert.rejects(
    runPatch(directory),
    (error) => {
      assert.match(error.stderr, /Expected BroMetal 0\.15\.0, found 0\.16\.0/);
      return true;
    },
  );
});

test('a moved patch target is an error, never a silent no-op', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'antiky-brometal-target-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Right version, but the first patch target's surrounding source has changed.
  await writeFixture(directory, {
    version: '0.15.0',
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
