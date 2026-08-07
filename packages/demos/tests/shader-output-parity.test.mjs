import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const packageDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectory = new URL('../src/', import.meta.url);
const compiler = fileURLToPath(new URL('../node_modules/.bin/brometal', import.meta.url));

test('BroMetal version and cut-out shader support match the repository contract', async () => {
  const [metadataSource, declarations, contextDeclarations, webgpuRuntime] = await Promise.all([
    readFile(new URL('../node_modules/brometal/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../node_modules/brometal/dist/index.d.ts', import.meta.url), 'utf8'),
    readFile(new URL('../node_modules/brometal/dist/runtime/context.d.ts', import.meta.url), 'utf8'),
    readFile(new URL('../node_modules/brometal/dist/runtime/webgpu.js', import.meta.url), 'utf8'),
  ]);
  const metadata = JSON.parse(metadataSource);

  assert.equal(metadata.version, '0.15.0');
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
  const paths = await generatedFiles(sourceDirectory);
  const original = await readOutputs(paths);
  try {
    await execute(compiler, ['dev', '--once'], { cwd: packageDirectory });
    const development = await readOutputs(paths);
    await execute(compiler, ['prod'], { cwd: packageDirectory });
    const production = await readOutputs(paths);
    for (const path of paths) {
      assert.ok(
        production.get(path.href).equals(development.get(path.href)),
        `${fileURLToPath(path)} differs between compiler modes`,
      );
    }
  } finally {
    await Promise.all(paths.map(async (path) => {
      await writeFile(fileURLToPath(path), original.get(path.href));
    }));
  }
});
