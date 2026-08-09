import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const rootLayout = new URL('../src/app/layout.tsx', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';
const studioReleasesUrl = 'https://github.com/antikylabs/antiky/releases';
const discordUrl = 'https://discord.gg/3Qs2uejUf9';

test('the root layout gates Fathom behind the production environment', async () => {
  const source = await readFile(rootLayout, 'utf8');
  const gateStart = source.indexOf("{process.env.NODE_ENV === 'production' && (");
  const gateEnd = source.indexOf(')}', gateStart);
  const script = source.indexOf('src="https://cdn.usefathom.com/script.js"');

  assert.ok(gateStart >= 0, 'Fathom is missing its production gate');
  assert.ok(script > gateStart && script < gateEnd, 'Fathom must stay inside the production gate');
});

test('the root layout gates SSPS behind the production environment', async () => {
  const source = await readFile(rootLayout, 'utf8');
  const script = source.indexOf('src="https://usessps.com/ssps.js"');
  const gateStart = source.lastIndexOf("{process.env.NODE_ENV === 'production' && (", script);
  const gateEnd = source.indexOf(')}', script);

  assert.ok(script >= 0, 'SSPS is missing from the root layout');
  assert.ok(gateStart >= 0 && gateEnd > script, 'SSPS must stay inside a production gate');
});

test('production pages load the configured Fathom analytics script once', async () => {
  for (const page of ['index.html', 'framework.html', 'studio.html']) {
    const output = await readFile(new URL(page, outputRoot), 'utf8');
    const scripts = output.match(/<script[^>]+src="https:\/\/cdn\.usefathom\.com\/script\.js"[^>]*>/g) ?? [];

    assert.equal(scripts.length, 1, `${page} must load Fathom once`);
    assert.match(scripts[0], /data-site="HELZNBFB"/);
    assert.match(scripts[0], /(?:^|\s)defer(?:="")?(?:\s|>)/);
  }
});

test('production pages report the configured SSPS live visitor count once', async () => {
  for (const page of ['index.html', 'framework.html', 'studio.html']) {
    const output = await readFile(new URL(page, outputRoot), 'utf8');
    const scripts = output.match(/<script[^>]+src="https:\/\/usessps\.com\/ssps\.js"[^>]*>/g) ?? [];
    const counters = output.match(/<[^>]+\sid="ssps-live-count"[^>]*>/g) ?? [];

    assert.equal(scripts.length, 1, `${page} must load SSPS once`);
    assert.match(scripts[0], /data-site-id="268"/);
    assert.match(scripts[0], /(?:^|\s)async(?:="")?(?:\s|>)/);
    assert.equal(counters.length, 1, `${page} must expose one SSPS live-count target`);
    assert.match(output, /active now/);
  }
});

test('home and Framework pages feature current Antiky media', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const framework = await readFile(new URL('framework.html', outputRoot), 'utf8');

  assert.match(home, /href="\/demos\/antiky-town"/);
  assert.match(home, /antiky-town\.png/);
  assert.doesNotMatch(home, /href="\/demos\/town-study">Explore Town Study/);

  assert.match(framework, /href="\/demos\/antiky-town"/);
  assert.match(framework, /antiky-architecture\.png/);
  assert.match(framework, /Antiky target architecture/);
});

test('production navigation exposes the new public architecture and canonical participation links', async () => {
  for (const page of ['index.html', 'framework.html', 'studio.html', 'games.html']) {
    const output = await readFile(new URL(page, outputRoot), 'utf8');
    for (const route of ['/thesis', '/studio', '/framework', '/games', '/research', '/docs']) {
      assert.ok(output.includes(`href="${route}"`), `${page} is missing ${route}`);
    }
    assert.ok(output.includes(`href="${studioReleasesUrl}"`), `${page} is missing Studio releases`);
    assert.ok(output.includes(`href="${discordUrl}"`), `${page} is missing Discord`);
    assert.doesNotMatch(output, /href="\/worlds(?:[\/#"])/);
    assert.match(output, /aria-label="Mobile navigation"[\s\S]*Download Studio/);
  }
});

test('Games replaces Worlds in the sitemap and Worlds permanently redirects', async () => {
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');
  const routesManifest = JSON.parse(await readFile(new URL('../../routes-manifest.json', outputRoot), 'utf8'));

  assert.ok(sitemap.includes(`<loc>${new URL('/games', siteUrl)}</loc>`));
  assert.ok(sitemap.includes(`<loc>${new URL('/thesis', siteUrl)}</loc>`));
  assert.ok(!sitemap.includes(`<loc>${new URL('/worlds', siteUrl)}</loc>`));
  assert.ok(routesManifest.redirects.some((entry) => (
    entry.source === '/worlds'
      && entry.destination === '/games'
      && entry.statusCode === 308
  )));
});
