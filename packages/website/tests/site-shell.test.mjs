import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const rootLayout = new URL('../src/app/layout.tsx', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';
const studioReleasesReady = process.env.NEXT_PUBLIC_STUDIO_RELEASES_READY === 'true';
const studioReleasesUrl = 'https://github.com/antikylabs/antiky/releases';
const discordUrl = 'https://discord.gg/3Qs2uejUf9';

async function filesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) files.push(...await filesBelow(new URL(`${entry.name}/`, directory)));
    else if (entry.isFile()) files.push(url);
  }
  return files;
}

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

test('homepage follows the why-first evidence-to-participation sequence', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const sectionIds = [
    'idea',
    'changed-assumption',
    'creative-agency',
    'shared-state',
    'system',
    'games',
    'research',
    'creative-range',
    'community',
    'closing',
  ];
  const positions = sectionIds.map((id) => {
    const position = home.indexOf(`id="${id}"`);
    assert.ok(position >= 0, `homepage is missing #${id}`);
    return position;
  });

  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.match(home, /data-evidence-status="current"/);
  assert.match(home, /data-evidence-status="emerging"/);
  assert.match(home, /href="\/thesis"/);
  assert.match(home, /href="\/demos\/antiky-town"/);
  assert.doesNotMatch(home, /Tools for making worlds|<h1>2D character|emerging 2\.3D framework/);
});

test('production navigation exposes the public architecture and release-aware Studio action', async () => {
  for (const page of ['index.html', 'framework.html', 'studio.html', 'games.html']) {
    const output = await readFile(new URL(page, outputRoot), 'utf8');
    for (const route of ['/thesis', '/studio', '/framework', '/games', '/research', '/docs']) {
      assert.ok(output.includes(`href="${route}"`), `${page} is missing ${route}`);
    }
    assert.ok(output.includes(`href="${discordUrl}"`), `${page} is missing Discord`);
    assert.doesNotMatch(output, /href="\/worlds(?:[\/#"])/);
    if (studioReleasesReady) {
      assert.ok(output.includes(`href="${studioReleasesUrl}"`), `${page} is missing Studio releases`);
      assert.match(output, /aria-label="Mobile navigation"[\s\S]*Download Studio/);
    } else {
      assert.doesNotMatch(output, /Download Studio/);
      assert.match(output, /aria-label="Mobile navigation"[\s\S]*Explore Studio/);
    }
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

test('product and research pages expose status boundaries without stale primary positioning', async () => {
  const framework = await readFile(new URL('framework.html', outputRoot), 'utf8');
  const studio = await readFile(new URL('studio.html', outputRoot), 'utf8');
  const research = await readFile(new URL('research.html', outputRoot), 'utf8');
  const games = await readFile(new URL('games.html', outputRoot), 'utf8');
  const demos = await readFile(new URL('demos.html', outputRoot), 'utf8');
  const demo = await readFile(new URL('demos/antiky-town.html', outputRoot), 'utf8');

  assert.match(framework, /data-evidence-status="current"/);
  assert.match(framework, /data-evidence-status="emerging"/);
  assert.match(framework, /data-evidence-status="direction"/);
  assert.match(framework, /A headless foundation for a game that tools can understand\./);
  assert.doesNotMatch(framework, /Built for 2D characters in 3D worlds|emerging 2\.3D game framework/);

  for (const status of ['current', 'emerging', 'direction']) {
    assert.ok(studio.includes(`data-evidence-status="${status}"`));
  }
  assert.match(research, /data-evidence-status="current"/);
  assert.match(research, /data-evidence-status="direction"/);
  assert.match(research, /data-evidence-status="research-question"/);
  assert.doesNotMatch(research, /Training and adapting models|Generated voxel assets/);
  assert.match(games, /data-evidence-status="current"/);
  assert.match(games, /data-evidence-status="direction"/);
  assert.match(demos.replaceAll('<!-- -->', ''), /four BroMetal 0\.14\.0 studies/);
  assert.match(demo, /What it does not show/);
});

test('core page metadata uses the lab positioning and canonical routes', async () => {
  const home = await readFile(new URL('index.html', outputRoot), 'utf8');
  const framework = await readFile(new URL('framework.html', outputRoot), 'utf8');
  const games = await readFile(new URL('games.html', outputRoot), 'utf8');
  const thesis = await readFile(new URL('thesis.html', outputRoot), 'utf8');

  assert.match(home, /<meta name="description" content="Antiky Labs is a game technology lab/);
  assert.doesNotMatch(home, /<meta name="description" content="[^"]*2\.3D/);
  assert.doesNotMatch(framework, /<meta name="description" content="[^"]*2\.3D/);
  assert.match(games, /<link rel="canonical" href="https:\/\/antikylabs\.com\/games"/);
  assert.match(thesis, /<link rel="canonical" href="https:\/\/antikylabs\.com\/thesis"/);
});

test('every production HTML page points internal anchors at a built route', async () => {
  const pages = (await filesBelow(outputRoot)).filter((file) => file.pathname.endsWith('.html'));
  assert.ok(pages.length > 0, 'production HTML output is missing');

  for (const page of pages) {
    const source = await readFile(page, 'utf8');
    const hrefs = Array.from(source.matchAll(/<a\b[^>]*\shref="(\/[^"]+)"/g), (match) => match[1]);
    for (const href of hrefs) {
      const route = href.split(/[?#]/, 1)[0];
      if (!route || route.startsWith('/_next/') || route.endsWith('.md')) continue;
      const output = route === '/'
        ? new URL('index.html', outputRoot)
        : new URL(`${route.slice(1)}.html`, outputRoot);
      await assert.doesNotReject(
        readFile(output),
        `${page.pathname} links to missing production route ${route}`,
      );
    }
  }
});
