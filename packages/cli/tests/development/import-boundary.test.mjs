import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceDirectory = new URL('../../src/', import.meta.url);

async function readReachableSource(url, visited = new Set()) {
  if (visited.has(url.href)) return [];
  visited.add(url.href);
  const source = await readFile(url, 'utf8');
  const files = [{ relativePath: url.pathname.slice(sourceDirectory.pathname.length), source }];
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const importPath = match[1];
    if (!importPath.endsWith('.ts')) continue;
    const importedUrl = new URL(importPath, url);
    assert.ok(importedUrl.href.startsWith(sourceDirectory.href), `import escapes CLI source: ${importPath}`);
    files.push(...await readReachableSource(importedUrl, visited));
  }
  return files;
}

test('@antiky/cli/development is a browser-safe public entry point', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.exports['./development'], './src/development/index.ts');

  const sources = await readReachableSource(new URL('development/index.ts', sourceDirectory));
  assert.ok(sources.length > 1);
  for (const { relativePath, source } of sources) {
    assert.doesNotMatch(source, /(?:from\s+|import\s*)['"]node:/, relativePath);
    assert.doesNotMatch(source, /\.\.\/config\.ts|session-descriptor/, relativePath);
  }
});
