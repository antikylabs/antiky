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

test('framework source has no Node, React, Next, BroMetal, Studio, or MCP imports', async () => {
  const names = await readdir(sourceDirectory);
  const sources = await Promise.all(
    names
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map(async (name) => ({
        name,
        text: await readFile(new URL(name, sourceDirectory), 'utf8'),
      })),
  );

  for (const source of sources) {
    const specifiers = Array.from(
      source.text.matchAll(/(?:from\s+|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g),
      (match) => match[1],
    );
    for (const specifier of specifiers) {
      assert.ok(
        !forbiddenImports.some((pattern) => pattern.test(specifier)),
        `${source.name} imports forbidden dependency ${specifier}`,
      );
    }
  }
});

test('framework runtime source does not reference browser globals', async () => {
  const names = await readdir(sourceDirectory);
  for (const name of names.filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'))) {
    const source = await readFile(new URL(name, sourceDirectory), 'utf8');
    assert.doesNotMatch(source, /\b(?:window|document|navigator)\b/, `${name} uses a browser global`);
  }
});
