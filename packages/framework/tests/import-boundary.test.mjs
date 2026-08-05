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
    assert.doesNotMatch(
      source.text,
      /Market Lamp West|town-study/,
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
