import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const demosDirectory = new URL('../', import.meta.url);
const publicDemos = ['antiky-town', 'town-study', 'shader-study'];

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(url);
  }
  return files;
}

test('every public demo is one manifest-owned game project', async () => {
  for (const slug of publicDemos) {
    const directory = new URL(`${slug}/`, demosDirectory);
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    await access(new URL(`${slug}.antiky`, directory));
    await access(new URL('src/game.ts', directory));
    assert.equal(metadata.private, true);
    for (const script of ['build', 'dev', 'test', 'typecheck']) {
      assert.equal(typeof metadata.scripts?.[script], 'string', `${slug} needs ${script}`);
    }
  }
});

test('game projects contain no delivery host or sibling-demo source imports', async () => {
  for (const slug of publicDemos) {
    const directory = new URL(`${slug}/`, demosDirectory);
    const source = (await Promise.all((await sourceFiles(new URL('src/', directory))).map(
      (path) => readFile(path, 'utf8'),
    ))).join('\n');
    assert.doesNotMatch(source, /@antiky\/(?:cli|studio|website)/);
    assert.doesNotMatch(source, /(?:node:http|node:net|createServer\s*\()/);
    assert.doesNotMatch(source, /\.\.\/+(?:antiky-town|town-study|shader-study)(?:\/|['"])/);
    assert.doesNotMatch(source, /(?:React|createRoot|<canvas|document\.body\.appendChild)/);
  }
  await assert.rejects(() => access(new URL('dev-host/', demosDirectory)));
  await assert.rejects(() => access(new URL('package.json', demosDirectory)));
  await assert.rejects(() => access(new URL('src/', demosDirectory)));
  await assert.rejects(() => access(new URL('src/react/', demosDirectory)));
  await assert.rejects(() => access(new URL('src/runtime.ts', demosDirectory)));
});

test('every public demo owns its source without a shared demo package', async () => {
  await assert.rejects(() => access(new URL('../../demo-support/town/package.json', import.meta.url)));
  for (const slug of publicDemos) {
    const directory = new URL(`${slug}/`, demosDirectory);
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const demoDependencies = Object.keys(metadata.dependencies ?? {})
      .filter((name) => name.startsWith('@antiky/demo-'));
    assert.deepEqual(demoDependencies, [], `${slug} depends on shared demo source`);
    const source = (await Promise.all((await sourceFiles(new URL('src/', directory))).map(
      (path) => readFile(path, 'utf8'),
    ))).join('\n');
    assert.doesNotMatch(source, /@antiky\/demo-/);
  }
});

test('every public demo owns its build without repository artifact tooling', async () => {
  for (const slug of publicDemos) {
    const directory = new URL(`${slug}/`, demosDirectory);
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    for (const [name, command] of Object.entries(metadata.scripts ?? {})) {
      assert.doesNotMatch(command, /\.\.\//, `${slug} ${name} escapes its project`);
      assert.doesNotMatch(command, /build-demo-artifact/, `${slug} ${name} builds a website artifact`);
    }
  }
  await assert.rejects(() => access(new URL('../../../scripts/build-demo-artifact.mjs', import.meta.url)));
  await assert.rejects(() => access(new URL('../../../scripts/build-public-demos.mjs', import.meta.url)));
  await assert.rejects(() => access(new URL('../../../scripts/stage-demo-artifacts.mjs', import.meta.url)));
});
