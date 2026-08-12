import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
/**
 * Every package that ships generated shaders, discovered rather than listed.
 *
 * A hardcoded list meant a new demo's `.gen.ts` was never compared against a compiler and could
 * assert anything — an audit added a package containing `{ wgslSrc: "garbage that never compiled" }`
 * and this test passed. Discovery makes omission impossible instead of merely unlikely.
 */
async function discoverShaderPackages() {
  const packages = [];
  for (const category of ['antiky', 'brometal', 'threejs']) {
    const root = fileURLToPath(new URL(`../${category}/`, import.meta.url));
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (!entry.isDirectory()) continue;
      const packageDirectory = path.join(root, entry.name);
      const sourceDirectory = new URL(`../${category}/${entry.name}/src/`, import.meta.url);
      const generated = await generatedFiles(sourceDirectory);
      if (generated.length === 0) continue;
      packages.push({ slug: entry.name, packageDirectory, sourceDirectory });
    }
  }
  return packages;
}

const brometalEntry = fileURLToPath(import.meta.resolve('brometal'));
const brometalDirectory = path.resolve(path.dirname(brometalEntry), '..');
const compiler = path.join(brometalDirectory, 'dist/cli/index.js');

test('BroMetal version and cut-out shader support match the repository contract', async () => {
  const [metadataSource, declarations, contextDeclarations, webgpuRuntime] = await Promise.all([
    readFile(path.join(brometalDirectory, 'package.json'), 'utf8'),
    readFile(path.join(brometalDirectory, 'dist/index.d.ts'), 'utf8'),
    readFile(path.join(brometalDirectory, 'dist/runtime/context.d.ts'), 'utf8'),
    readFile(path.join(brometalDirectory, 'dist/runtime/webgpu.js'), 'utf8'),
  ]);
  const metadata = JSON.parse(metadataSource);

  assert.equal(metadata.version, '0.17.2');
  assert.match(declarations, /\bdiscard\b/);
  assert.match(contextDeclarations, /present\(callback: \(\) => void\): void;/);
  assert.match(webgpuRuntime, /present\(callback\) \{/);
});

async function generatedFiles(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) paths.push(...await generatedFiles(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile() && entry.name.endsWith('.shader.gen.ts')) paths.push(url);
  }
  return paths;
}

async function readOutputs(paths) {
  return new Map(await Promise.all(paths.map(async (path) => [path.href, await readFile(path)])));
}

test('the committed shader output is what the compiler actually produces', async () => {
  /**
   * What this has to prove, and what it used to prove instead.
   *
   * `.shader.gen.ts` is the code that runs on the GPU. `.shader.ts` is what almost every invariant
   * in this directory reads. This test is the only thing connecting the two, so if it is weak then
   * every source-level assertion in the repository is checking a file with no established
   * relationship to the shipped shader.
   *
   * It used to compile in dev mode, compile in prod mode, and assert those two agreed — never
   * comparing either against the committed file, and then restoring the committed file in a
   * `finally`. A `.gen.ts` replaced with `export default { wgslSrc: 'garbage' }` passed, and the
   * test wrote the garbage back afterwards.
   *
   * Now: the committed bytes must equal what the compiler emits, in both modes. Regenerating is
   * still restored afterwards so the test leaves no diff behind, but the comparison is against what
   * is committed, not against itself.
   */
  let checked = 0;
  const shaderPackages = await discoverShaderPackages();
  assert.ok(
    shaderPackages.length >= 8,
    `expected to discover every package with generated shaders, found ${shaderPackages.length}`,
  );
  for (const shaderPackage of shaderPackages) {
    const paths = await generatedFiles(shaderPackage.sourceDirectory);
    assert.ok(
      paths.length > 0,
      `${shaderPackage.slug}: found no .shader.gen.ts files — the search root is wrong, and an `
      + 'empty list would otherwise pass this test without asserting anything',
    );
    // Every generated shader must have the source it was generated from.
    //
    // Without this the comparison below can be vacuous: the compiler only rewrites a `.gen.ts` that
    // has a `.shader.ts` beside it, so an orphan generated file is never touched and "what the
    // compiler produces" equals "what is committed" trivially. An audit shipped a package whose only
    // shader was `{ wgslSrc: 'garbage that never compiled' }` and this test passed.
    for (const generated of paths) {
      const authored = fileURLToPath(generated).replace(/\.shader\.gen\.ts$/, '.shader.ts');
      let exists = true;
      try {
        await readFile(authored);
      } catch {
        exists = false;
      }
      assert.ok(
        exists,
        `${shaderPackage.slug}: ${path.basename(fileURLToPath(generated))} has no .shader.ts beside `
        + 'it, so nothing regenerates it and its contents are unverified.',
      );
    }

    const committed = await readOutputs(paths);
    try {
      for (const mode of [['dev', '--once'], ['prod']]) {
        await execute(compiler, mode, { cwd: shaderPackage.packageDirectory });
        const produced = await readOutputs(paths);
        for (const shaderPath of paths) {
          assert.ok(
            produced.get(shaderPath.href).equals(committed.get(shaderPath.href)),
            `${shaderPackage.slug}: ${fileURLToPath(shaderPath)} does not match what \`brometal `
            + `${mode[0]}\` produces. The committed generated shader is stale or hand-edited — `
            + 'regenerate it and commit the result.',
          );
          checked += 1;
        }
      }
    } finally {
      await Promise.all(paths.map(async (shaderPath) => {
        await writeFile(fileURLToPath(shaderPath), committed.get(shaderPath.href));
      }));
    }
  }
  // Guards the whole loop doing nothing: a bad package list would otherwise pass silently.
  assert.ok(checked >= 60, `expected to verify well over sixty generated shaders, verified ${checked}`);
});
