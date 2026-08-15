import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceDirectory = new URL('../src/', import.meta.url);
const forbiddenImports = [
  /^node:/,
  /^react(?:\/|$)/,
  /^next(?:\/|$)/,
  /^brometal(?:\/|$)/,
  /^@antiky\/studio(?:\/|$)/,
  /^@modelcontextprotocol(?:\/|$)/,
];

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await sourceFiles(url));
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(url);
    }
  }
  return files;
}

test('framework source has no Node, React, Next, BroMetal, Studio, or MCP imports', async () => {
  const sources = await Promise.all((await sourceFiles(sourceDirectory)).map(async (url) => ({
    name: url.pathname.slice(sourceDirectory.pathname.length),
    text: await readFile(url, 'utf8'),
  })));

  for (const source of sources) {
    // `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` decides that the framework
    // owns one component that speaks BroMetal, and that "framework code outside the driver will not
    // use BroMetal". This is that one file. The carve-out is a single exact path rather than a
    // directory or a pattern, so a second file cannot quietly join it.
    const isRenderDriver = source.name === 'render/brometal-driver.ts';
    const specifiers = Array.from(
      source.text.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g),
      (match) => match[1],
    );
    for (const specifier of specifiers) {
      const forbidden = forbiddenImports.filter(
        (pattern) => !(isRenderDriver && pattern.source.startsWith('^brometal')),
      );
      assert.ok(
        !forbidden.some((pattern) => pattern.test(specifier)),
        `${source.name} imports forbidden dependency ${specifier}`,
      );
    }
    assert.doesNotMatch(
      source.text,
      /Market Lamp West|antiky-town/,
      `${source.name} contains demo-specific point-light data`,
    );
  }
});

test('framework runtime source does not reference browser globals', async () => {
  for (const url of await sourceFiles(sourceDirectory)) {
    const source = await readFile(url, 'utf8');
    const name = url.pathname.slice(sourceDirectory.pathname.length);
    assert.doesNotMatch(source, /\b(?:window|document|navigator)\b/, `${name} uses a browser global`);
  }
});

test('the game contract module imports nothing at all', async () => {
  // The reason six demos hand-copied the contract instead of importing it: `host.ts` reaches the
  // inspection snapshot and the whole point-light type graph, so the shape of a game module could
  // not be obtained without them. This module is the shape on its own, and it stays that way only
  // while this passes.
  const source = await readFile(new URL('../src/game/contract.ts', import.meta.url), 'utf8');
  const imports = source.match(/^\s*import[\s{*]/gm) ?? [];
  assert.deepEqual(imports, [], 'src/game/contract.ts must have zero import statements');
  assert.doesNotMatch(source, /\brequire\(/, 'and no require() either');
});

test('exactly one framework file is allowed to import BroMetal', async () => {
  // The carve-out ADR 0021 grants is to *the driver*, singular. If a second file starts importing
  // BroMetal, the boundary has stopped meaning anything and this catches it before review does.
  const importers = [];
  for (const url of await sourceFiles(sourceDirectory)) {
    const text = await readFile(url, 'utf8');
    if (/from\s+['"]brometal/.test(text)) {
      importers.push(url.pathname.slice(sourceDirectory.pathname.length));
    }
  }
  assert.deepEqual(importers, ['render/brometal-driver.ts']);
});
