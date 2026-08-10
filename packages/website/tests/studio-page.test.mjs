import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';
const studioReleasesReady = process.env.NEXT_PUBLIC_STUDIO_RELEASES_READY === 'true';

test('production Studio page presents the working workspace and honest availability', async () => {
  const studio = await readFile(new URL('studio.html', outputRoot), 'utf8');

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
  assert.doesNotMatch(studio, /studio-workspace-(?:wide|detail)-v1|studio-(?:pause|step)-wide-v1|studio-(?:combat|traversal)-workflow-v2/);
  assert.doesNotMatch(studio, /studio-window|illustrated from|town-study-poster\.png/);
  assert.doesNotMatch(studio, /NEXT_REDIRECT/);
});

test('the high-resolution media pass ships bounded real delivery media', async () => {
  const assets = [
    ['demos/combat-arena.webp', 1_200_000, Buffer.from('WEBP')],
    ['demos/traversal-study.webp', 1_200_000, Buffer.from('WEBP')],
  ];

  for (const [path, budget, signature] of assets) {
    const url = new URL(`../public/media/${path}`, import.meta.url);
    const bytes = await readFile(url);
    assert.ok(bytes.length <= budget, `${path} exceeds its delivery budget`);
    const signatureOffset = 8;
    assert.deepEqual(
      bytes.subarray(signatureOffset, signatureOffset + signature.length),
      signature,
      `${path} has the wrong delivery format`,
    );
  }
});

test('Studio is discoverable from production navigation, home, and sitemap', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');

  assert.match(home, /href="\/studio"/);
  assert.match(home, /Antiky Studio/);
  assert.ok(sitemap.includes(`<loc>${new URL('/studio', siteUrl)}</loc>`));
});
