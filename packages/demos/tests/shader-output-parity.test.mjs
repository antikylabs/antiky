import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const townPackages = [
  { category: 'antiky', slug: 'antiky-town' },
  { category: 'brometal', slug: 'town-study' },
].map(({ category, slug }) => ({
  slug,
  packageDirectory: fileURLToPath(new URL(`../${category}/${slug}/`, import.meta.url)),
  sourceDirectory: new URL(`../${category}/${slug}/src/town/`, import.meta.url),
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

test('development and production shader compilation produce identical tracked output', async () => {
  for (const townPackage of townPackages) {
    const paths = await generatedFiles(townPackage.sourceDirectory);
    const original = await readOutputs(paths);
    try {
      await execute(compiler, ['dev', '--once'], { cwd: townPackage.packageDirectory });
      const development = await readOutputs(paths);
      await execute(compiler, ['prod'], { cwd: townPackage.packageDirectory });
      const production = await readOutputs(paths);
      for (const path of paths) {
        assert.ok(
          production.get(path.href).equals(development.get(path.href)),
          `${townPackage.slug}: ${fileURLToPath(path)} differs between compiler modes`,
        );
      }
    } finally {
      await Promise.all(paths.map(async (path) => {
        await writeFile(fileURLToPath(path), original.get(path.href));
      }));
    }
  }
});
