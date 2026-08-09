import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';
const studioReleasesReady = process.env.NEXT_PUBLIC_STUDIO_RELEASES_READY === 'true';

test('production Studio page presents the working workspace and honest availability', async () => {
  const studio = await readFile(new URL('studio.html', outputRoot), 'utf8');
  const screenshot = await readFile(new URL('../public/media/antiky-studio-workspace.jpeg', import.meta.url));

  for (const marker of [
    'Your game and its living state. One workspace.',
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
    'Current, emerging, and ahead',
    'data-evidence-status="current"',
    'data-evidence-status="emerging"',
    'data-evidence-status="direction"',
  ]) {
    assert.ok(studio.includes(marker), `Studio page is missing: ${marker}`);
  }

  assert.match(studio, /href="\/docs\/studio\/getting-started"/);
  assert.match(studio, /href="\/docs\/studio\/development-connection"/);
  assert.match(studio, /href="https:\/\/discord\.gg\/3Qs2uejUf9"/);
  if (studioReleasesReady) {
    assert.match(studio, /href="https:\/\/github\.com\/antikylabs\/antiky\/releases"/);
    assert.match(studio, /Download Studio/);
    assert.doesNotMatch(studio, /Run Studio from source/);
  } else {
    assert.doesNotMatch(studio, /Download Studio/);
    assert.match(studio, /Run Studio from source/);
  }
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
