import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const userDocsRoot = new URL('../../../docs/user-facing-docs/', import.meta.url);

async function markdownFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    if (entry.isDirectory()) files.push(...await markdownFiles(url));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(url);
  }
  return files;
}

async function verifyLocalLinks(path: URL, source: string): Promise<void> {
  const links = Array.from(source.matchAll(/\[[^\]]+]\(([^)]+)\)/g), (match) => match[1]!);
  for (const link of links) {
    if (/^(?:https?:|mailto:|#)/.test(link)) continue;
    const target = link.split('#', 1)[0]!;
    await access(resolve(dirname(fileURLToPath(path)), target));
  }
}

test('user-facing documentation has valid local links', async () => {
  await Promise.all((await markdownFiles(userDocsRoot)).map(async (path) => {
    await verifyLocalLinks(path, await readFile(path, 'utf8'));
  }));
});

test('the Studio guide describes the game-first responsive workspace', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /live game in the larger upper-left area/i);
  assert.match(source, /terminal is below the game/i);
  assert.match(source, /stack in this order:\s*Live game,\s*Terminal,\s*Inspection,\s*Activity/i);
});

test('the Studio guide explains the optional online presence signal', async () => {
  const source = await readFile(new URL('../../../docs/user-facing-docs/studio/getting-started.md', import.meta.url), 'utf8');

  assert.match(source, /Settings.*Online presence signal/is);
  assert.match(source, /does not send\s+project names, commands, activity, or usage information/i);
  assert.match(source, /active-user count on the Antiky website/i);
});
