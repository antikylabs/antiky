import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

test('production Studio page presents the shipped workspace and honest availability', async () => {
  const studio = await readFile(new URL('studio.html', outputRoot), 'utf8');
  const screenshot = await readFile(new URL('../public/media/antiky-studio-workspace.jpeg', import.meta.url));

  for (const marker of [
    'Your game and its living state. One workspace.',
    'macOS source-development build',
    'Create a project',
    'recent project',
    'Studio starts the local development services',
    'compact <code>%</code> prompt',
    'Pause, resume, step, restart, or stop',
    'Hierarchy',
    'Stores',
    'Snapshot',
    'MCP calls',
    'Diagnostics',
    'Antiky Framework',
    'pure BroMetal',
    'Three.js',
    'other browser renderers',
    'Inspector views are read-only',
    'release packaging is not available yet',
  ]) {
    assert.ok(studio.includes(marker), `Studio page is missing: ${marker}`);
  }

  assert.match(studio, /href="\/docs\/studio\/getting-started"/);
  assert.match(studio, /href="\/docs\/studio\/development-connection"/);
  assert.match(studio, /antiky-studio-workspace\.jpeg/);
  assert.doesNotMatch(studio, /studio-window|illustrated from|town-study-poster\.png/);
  assert.deepEqual(screenshot.subarray(0, 3), Buffer.from([0xff, 0xd8, 0xff]));
  assert.ok(screenshot.length > 100_000, 'Studio screenshot must contain the real native workspace');
  assert.doesNotMatch(screenshot.toString('latin1'), /\/Users\/|@[A-Za-z0-9._-]*(?:mac|MacBook)/i);
  assert.doesNotMatch(studio, /NEXT_REDIRECT/);
});

test('Studio is discoverable from production navigation, home, and sitemap', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');

  assert.match(home, /href="\/studio"/);
  assert.match(home, /Antiky Studio/);
  assert.ok(sitemap.includes(`<loc>${new URL('/studio', siteUrl)}</loc>`));
});
