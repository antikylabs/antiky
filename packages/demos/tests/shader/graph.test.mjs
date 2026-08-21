import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import * as graph from './graph.mjs';

const expectedRoot = path.resolve(import.meta.dirname, '..', '..');
const expectedSlugs = [
  'antiky-town',
  'combat-arena',
  'point-light-expo',
  'traversal-study',
];

test('the shared demo graph is rooted at the flat demo package directory', () => {
  assert.equal(graph.demosRoot, expectedRoot);
});

test('Antiky demo discovery is non-empty and manifest-owned', async () => {
  const demos = await graph.discoverDemos();
  assert.deepEqual(demos.map((demo) => demo.slug), expectedSlugs);
  for (const demo of demos) {
    assert.equal(path.dirname(demo.manifest), demo.directory);
    assert.ok(demo.manifest.endsWith(`${demo.slug}.antiky`));
    assert.ok(demo.directory.startsWith(`${expectedRoot}${path.sep}`));
  }
});

test('demoSources scopes a scan to one named Antiky demo', async () => {
  assert.equal(typeof graph.demoSources, 'function');
  const sources = await graph.demoSources('combat-arena');
  assert.ok(sources.length > 0, 'combat-arena source discovery must not be empty');
  assert.ok(
    sources.every((source) => source.relative.startsWith(`combat-arena${path.sep}`)),
    `combat-arena scan escaped its demo:\n${sources.map((source) => source.relative).join('\n')}`,
  );
});

test('demoSources rejects an unknown Antiky demo by name', async () => {
  assert.equal(typeof graph.demoSources, 'function');
  await assert.rejects(
    graph.demoSources('missing-demo'),
    /Unknown Antiky demo "missing-demo"/,
  );
});

test('a deliberately wrong graph root fails instead of returning an empty success', async () => {
  assert.equal(typeof graph.createDemoGraph, 'function');
  const wrong = graph.createDemoGraph(path.resolve(import.meta.dirname, '..'));
  await assert.rejects(wrong.discoverDemos(), /outside the demo package root/);
});

test('an out-of-scope directory cannot become the Antiky graph', async () => {
  const outOfScope = graph.createDemoGraph(path.resolve(expectedRoot, '..', 'website'));
  await assert.rejects(outOfScope.discoverDemos(), /outside the demo package root/);
});

test('discovery has the same result from a nested test process', () => {
  const graphUrl = pathToFileURL(path.join(import.meta.dirname, 'graph.mjs')).href;
  const child = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    `const graph = await import(${JSON.stringify(graphUrl)});`
      + 'process.stdout.write(JSON.stringify((await graph.discoverDemos()).map((demo) => demo.slug)));',
  ], {
    cwd: path.join(expectedRoot, 'combat-arena', 'tests'),
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), expectedSlugs);
});
