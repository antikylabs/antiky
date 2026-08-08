import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const demosDirectory = new URL('../', import.meta.url);
const showcase = Object.freeze([
  { category: 'antiky', slug: 'antiky-town', renderer: 'brometal', framework: true },
  { category: 'antiky', slug: 'point-light-expo', renderer: 'brometal', framework: true },
  { category: 'brometal', slug: 'town-study', renderer: 'brometal', framework: false },
  { category: 'brometal', slug: 'shader-study', renderer: 'brometal', framework: false },
  { category: 'brometal', slug: 'solar-forge', renderer: 'brometal', framework: false },
  { category: 'brometal', slug: 'luminous-reef', renderer: 'brometal', framework: false },
  { category: 'threejs', slug: 'orbital-atlas', renderer: 'three', framework: false },
  { category: 'threejs', slug: 'glass-garden', renderer: 'three', framework: false },
]);

function demoDirectory(demo) {
  return new URL(`${demo.category}/${demo.slug}/`, demosDirectory);
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (entry.isFile() && /\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(url);
  }
  return files;
}

test('the showcase has the approved category and project matrix', async () => {
  const expected = {
    antiky: ['antiky-town', 'point-light-expo'],
    brometal: ['luminous-reef', 'shader-study', 'solar-forge', 'town-study'],
    threejs: ['glass-garden', 'orbital-atlas'],
  };
  for (const [category, slugs] of Object.entries(expected)) {
    await access(new URL(`${category}/README.md`, demosDirectory));
    const entries = await readdir(new URL(`${category}/`, demosDirectory), { withFileTypes: true });
    assert.deepEqual(
      entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
      slugs,
    );
  }
});

test('every public demo is one manifest-owned game project', async () => {
  for (const demo of showcase) {
    const directory = demoDirectory(demo);
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const manifest = JSON.parse(await readFile(new URL(`${demo.slug}.antiky`, directory), 'utf8'));
    await access(new URL('src/game.ts', directory));
    assert.equal(metadata.private, true);
    assert.ok(Array.isArray(manifest.development?.shaderCommand));
    assert.equal(
      manifest.development.shaderCommand.length > 0,
      demo.renderer === 'brometal',
      `${demo.slug} shader watcher`,
    );
    for (const script of ['build', 'dev', 'test', 'typecheck']) {
      assert.equal(typeof metadata.scripts?.[script], 'string', `${demo.slug} needs ${script}`);
    }
  }
});

test('demo dependency boundaries identify Framework, BroMetal, and Three.js projects', async () => {
  for (const demo of showcase) {
    const metadata = JSON.parse(await readFile(new URL('package.json', demoDirectory(demo)), 'utf8'));
    const dependencies = metadata.dependencies ?? {};
    assert.equal('@antiky/framework' in dependencies, demo.framework, `${demo.slug} Framework boundary`);
    assert.equal('brometal' in dependencies, demo.renderer === 'brometal', `${demo.slug} BroMetal boundary`);
    assert.equal('three' in dependencies, demo.renderer === 'three', `${demo.slug} Three.js boundary`);
  }
});

test('game projects contain no delivery host or sibling-demo source imports', async () => {
  for (const demo of showcase) {
    const directory = demoDirectory(demo);
    const source = (await Promise.all((await sourceFiles(new URL('src/', directory))).map(
      (path) => readFile(path, 'utf8'),
    ))).join('\n');
    assert.doesNotMatch(source, /@antiky\/(?:cli|studio|website)/);
    assert.doesNotMatch(source, /(?:node:http|node:net|createServer\s*\()/);
    assert.doesNotMatch(source, /packages\/demos|\.\.\/\.\.\/(?:antiky|brometal|threejs)\//);
    assert.doesNotMatch(source, /(?:React|createRoot|<canvas|document\.body\.appendChild)/);
    if (!demo.framework) assert.doesNotMatch(source, /@antiky\/framework/);
  }
  await assert.rejects(() => access(new URL('dev-host/', demosDirectory)));
  await assert.rejects(() => access(new URL('package.json', demosDirectory)));
  await assert.rejects(() => access(new URL('src/', demosDirectory)));
  await assert.rejects(() => access(new URL('src/react/', demosDirectory)));
  await assert.rejects(() => access(new URL('src/runtime.ts', demosDirectory)));
});

test('every public demo owns its source without a shared demo package', async () => {
  await assert.rejects(() => access(new URL('../../demo-support/town/package.json', import.meta.url)));
  for (const demo of showcase) {
    const directory = demoDirectory(demo);
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const demoDependencies = Object.keys(metadata.dependencies ?? {})
      .filter((name) => name.startsWith('@antiky/demo-'));
    assert.deepEqual(demoDependencies, [], `${demo.slug} depends on shared demo source`);
    const source = (await Promise.all((await sourceFiles(new URL('src/', directory))).map(
      (path) => readFile(path, 'utf8'),
    ))).join('\n');
    assert.doesNotMatch(source, /@antiky\/demo-/);
  }
});

test('every public demo owns its build without repository artifact tooling', async () => {
  for (const demo of showcase) {
    const metadata = JSON.parse(await readFile(new URL('package.json', demoDirectory(demo)), 'utf8'));
    for (const [name, command] of Object.entries(metadata.scripts ?? {})) {
      assert.doesNotMatch(command, /\.\.\//, `${demo.slug} ${name} escapes its project`);
      assert.doesNotMatch(command, /build-demo-artifact/, `${demo.slug} ${name} builds a website artifact`);
    }
  }
  await assert.rejects(() => access(new URL('../../../scripts/build-demo-artifact.mjs', import.meta.url)));
  await assert.rejects(() => access(new URL('../../../scripts/build-public-demos.mjs', import.meta.url)));
  await assert.rejects(() => access(new URL('../../../scripts/stage-demo-artifacts.mjs', import.meta.url)));
});
