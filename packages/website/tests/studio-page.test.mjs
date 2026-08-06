import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

test('production Studio page presents the shipped workspace and honest availability', async () => {
  const studio = await readFile(new URL('studio.html', outputRoot), 'utf8');

  for (const marker of [
    'Your game and its living state. One workspace.',
    'macOS source-development build',
    'Current workspace map',
    'Terminal',
    'Live game',
    'Hierarchy',
    'Stores',
    'Snapshot',
    'MCP calls',
    'Diagnostics',
    'Inspection is read-only',
    'release packaging is not available yet',
  ]) {
    assert.ok(studio.includes(marker), `Studio page is missing: ${marker}`);
  }

  assert.match(studio, /href="\/docs\/studio\/getting-started"/);
  assert.match(studio, /href="\/docs\/studio\/development-connection"/);
  assert.match(studio, /town-study-poster\.png/);
  assert.doesNotMatch(studio, /NEXT_REDIRECT/);
});

test('Studio is discoverable from production navigation, home, and sitemap', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');

  assert.match(home, /href="\/studio"/);
  assert.match(home, /Antiky Studio/);
  assert.ok(sitemap.includes(`<loc>${new URL('/studio', siteUrl)}</loc>`));
});
