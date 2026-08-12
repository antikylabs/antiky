import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
/**
 * Every package that ships generated shaders, not just the two town demos this once covered.
 * `src/` is the search root so nested shader directories are included wherever a demo puts them.
 */
const shaderPackages = [
  { category: 'antiky', slug: 'antiky-town' },
  { category: 'antiky', slug: 'combat-arena' },
  { category: 'antiky', slug: 'point-light-expo' },
  { category: 'antiky', slug: 'traversal-study' },
  { category: 'brometal', slug: 'luminous-reef' },
  { category: 'brometal', slug: 'shader-study' },
  { category: 'brometal', slug: 'solar-forge' },
  { category: 'brometal', slug: 'town-study' },
].map(({ category, slug }) => ({
  slug,
  packageDirectory: fileURLToPath(new URL(`../${category}/${slug}/`, import.meta.url)),
  sourceDirectory: new URL(`../${category}/${slug}/src/`, import.meta.url),
}));
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
  for (const shaderPackage of shaderPackages) {
    const paths = await generatedFiles(shaderPackage.sourceDirectory);
    assert.ok(
      paths.length > 0,
      `${shaderPackage.slug}: found no .shader.gen.ts files — the search root is wrong, and an `
      + 'empty list would otherwise pass this test without asserting anything',
    );
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
