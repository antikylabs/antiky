import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const outputRoot = new URL('../.next/server/app/', import.meta.url);
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';
const mediaPublication = JSON.parse(await readFile(new URL('../media-publication.json', import.meta.url), 'utf8'));

const EXPLANATIONS = [
  ['framework.html', '/framework', /Antiky Framework is an open-source TypeScript game framework/, ['Current', 'Emerging', 'Direction']],
  ['studio.html', '/studio', /Antiky Studio is the native visual workspace/, ['Current', 'Emerging', 'Planned', 'Exploring']],
  ['research.html', '/research', /Explore Antiky Labs experiments/, ['Completed study', 'Active gym', 'Research question']],
  ['resources.html', '/resources', /Browse CC0 assets and installable agent skills today/, ['Current', 'Coming soon']],
  ['resources/skills.html', '/resources/skills', /An agent skill is a small, independently installable/, ['Current', 'Available skills']],
  ['roadmap.html', '/roadmap', /See what Antiky can do today/, ['Planned', 'no release dates']],
];

function mainContent(source) {
  return source.slice(source.indexOf('<main>'), source.indexOf('</main>'));
}

function anchors(source) {
  return Array.from(source.matchAll(/<a\b[^>]*\shref="([^"]+)"/g), (match) => match[1]);
}

test('core explanation pages answer their question in server HTML with metadata and ordered headings', async () => {
  for (const [file, route, definition, statuses] of EXPLANATIONS) {
    const source = await readFile(new URL(file, outputRoot), 'utf8');
    const main = mainContent(source);
    assert.match(source, /<meta name="description" content="[^"]+"/);
    assert.ok(source.includes(`<link rel="canonical" href="${new URL(route, siteUrl)}"`), `${route} has the wrong canonical URL`);
    assert.match(main, definition, `${route} does not define itself in initial HTML`);
    assert.equal((main.match(/<h1(?:\s|>)/g) ?? []).length, 1, `${route} must have one H1`);

    const levels = Array.from(main.matchAll(/<h([1-6])(?:\s|>)/g), (match) => Number(match[1]));
    assert.equal(levels[0], 1, `${route} must begin its heading outline at H1`);
    for (let index = 1; index < levels.length; index += 1) {
      assert.ok(levels[index] <= levels[index - 1] + 1, `${route} skips from H${levels[index - 1]} to H${levels[index]}`);
    }
    for (const status of statuses) assert.ok(main.includes(status), `${route} is missing visible status ${status}`);
  }
});

test('header, mobile, and footer navigation keep the approved order and route parity', async () => {
  const source = await readFile(new URL('framework.html', outputRoot), 'utf8');
  const desktop = source.slice(source.indexOf('<nav class="desktop-nav"'), source.indexOf('</nav>', source.indexOf('<nav class="desktop-nav"')));
  const mobileStart = source.indexOf('<nav aria-label="Mobile navigation"');
  const mobile = source.slice(mobileStart, source.indexOf('</nav>', mobileStart));
  const footerStart = source.indexOf('<nav aria-label="Footer navigation"');
  const footer = source.slice(footerStart, source.indexOf('</nav>', footerStart));

  const expectedPrimary = ['/thesis', '/framework', '/studio', '/games', '/resources', '/research', '/docs'];
  for (const navigation of [desktop, mobile]) {
    const positions = expectedPrimary.map((href) => {
      const position = navigation.indexOf(`href="${href}"`);
      assert.ok(position >= 0, `navigation is missing ${href}`);
      return position;
    });
    assert.deepEqual([...positions].sort((left, right) => left - right), positions);
    assert.match(navigation, /<summary[^>]*>Resources<\/summary>/);
    for (const href of ['/assets', '/resources/skills', '/resources/shaders', '/resources/projects']) {
      assert.ok(navigation.includes(`href="${href}"`), `Resources navigation is missing ${href}`);
    }
  }

  const headerActionsStart = source.indexOf('<div class="header-actions"');
  const headerActions = source.slice(headerActionsStart, source.indexOf('</div>', headerActionsStart));
  assert.deepEqual(anchors(headerActions), ['/assets', 'https://discord.gg/3Qs2uejUf9']);
  assert.match(headerActions, /Get free game assets/);
  assert.match(headerActions, /Join Discord/);
  assert.deepEqual(
    anchors(footer).filter((href) => href.startsWith('/')).slice(0, 8),
    ['/studio', '/framework', '/games', '/demos', '/resources', '/research', '/roadmap', '/docs'],
  );
});

test('production images have descriptive alt text and generated research visuals are clearly illustrative', async () => {
  const entriesByUrl = new Map(mediaPublication.entries.map((entry) => [entry.delivery.publicUrl, entry]));
  for (const file of ['index.html', 'framework.html', 'studio.html', 'games.html', 'demos.html', 'research.html']) {
    const source = await readFile(new URL(file, outputRoot), 'utf8');
    const main = mainContent(source);
    const images = Array.from(main.matchAll(/<img\b[^>]*>/g), (match) => match[0]);
    for (const image of images) {
      const alt = image.match(/\balt="([^"]*)"/)?.[1];
      assert.ok(alt && alt.length >= 12, `${file} has an image without descriptive alt text`);
    }

    const mediaUrls = new Set();
    for (const match of main.matchAll(/\burl=([^&"]+)/g)) {
      const decoded = decodeURIComponent(match[1]);
      if (decoded.startsWith('/media/')) mediaUrls.add(decoded);
    }
    for (const match of main.matchAll(/(?:src|href)="(\/media\/[^"]+)"/g)) mediaUrls.add(match[1]);
    for (const url of mediaUrls) {
      const entry = entriesByUrl.get(url);
      assert.ok(entry, `${file} uses undeclared production media ${url}`);
      if (entry.publicRole === 'Evidence') continue;
      assert.equal(file, 'research.html', `${file} uses non-evidence media ${url}`);
      assert.equal(entry.publicRole, 'Illustrative', `${file} uses unsupported media role ${entry.publicRole}`);
      assert.ok(
        main.includes(`data-media-role="illustrative" data-media-url="${url}"`),
        `${url} must be visibly separated from research evidence`,
      );
    }
    assert.doesNotMatch(main, /media\/marketing\//);
  }
});

test('research presents the declarative scene DSL with its exact reference visuals', async () => {
  const research = mainContent(await readFile(new URL('research.html', outputRoot), 'utf8'));

  assert.match(research, /Declarative scene DSL/);
  assert.match(research, /Research in progress/);
  for (const image of [
    'blue-winter-grove-reference-01-clearing-v4.webp',
    'blue-winter-grove-reference-02-frozen-creek-v4.webp',
    'blue-winter-grove-reference-03-frost-tree-detail-v4.webp',
  ]) assert.ok(research.includes(image), `research is missing ${image}`);
  assert.match(research, /These images show the intended result; they do not show a shipped Framework feature/);
});

test('agent-readable discovery and crawler policy include the new public explanations', async () => {
  const [llms, llmsFull, robots] = await Promise.all([
    readFile(new URL('llms.txt.body', outputRoot), 'utf8'),
    readFile(new URL('llms-full.txt.body', outputRoot), 'utf8'),
    readFile(new URL('robots.txt.body', outputRoot), 'utf8'),
  ]);
  for (const [name, route] of [
    ['Antiky Framework', '/framework'],
    ['Antiky Studio', '/studio'],
    ['Antiky Research', '/research'],
    ['Antiky Resources', '/resources'],
    ['Antiky Skills', '/resources/skills'],
    ['Antiky Roadmap', '/roadmap'],
  ]) {
    assert.ok(llms.includes(name), `llms.txt is missing ${name}`);
    assert.ok(llms.includes(new URL(route, siteUrl).toString()), `llms.txt is missing ${route}`);
  }
  for (const page of ['Understand Antiky agent skills', 'Install and manage Antiky skills', 'Antiky skills reference']) {
    assert.ok(llmsFull.includes(page), `llms-full.txt is missing ${page}`);
  }
  assert.match(robots, /User-Agent: \*/i);
  assert.match(robots, /Allow: \//i);
  assert.doesNotMatch(robots, /Disallow:/i);
});

test('Coming soon libraries state availability and do not render fake catalog entries', async () => {
  const shaders = mainContent(await readFile(new URL('resources/shaders.html', outputRoot), 'utf8'));
  const projects = mainContent(await readFile(new URL('resources/projects.html', outputRoot), 'utf8'));
  assert.match(shaders, /There is no public catalog yet/);
  assert.match(projects, /There is no public template catalog yet/);
  assert.doesNotMatch(shaders, /class="(?:editorial-row|asset-card|skill-row)"/);
  assert.doesNotMatch(projects, /class="(?:editorial-row|asset-card|skill-row)"/);
});

test('mobile controls and demo activation retain accessible interaction contracts', async () => {
  const [styles, host] = await Promise.all([
    readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/DemoStage.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(styles, /\.mobile-menu summary \{[^}]*min-height: 44px/);
  assert.match(styles, /\.mobile-menu nav a \{[^}]*min-height: 48px/);
  assert.match(styles, /\.stage-activate \{[^}]*min-height: 50px/);
  assert.match(styles, /\.demo-switcher a \{ width: 44px; height: 44px/);
  assert.match(styles, /\.deck-stage:has\(\.stage\[data-phase='poster'\]\) \{ height: auto; min-height: 0; aspect-ratio: 16\/9;/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(host, /<button className="stage-activate" type="button"/);
  assert.match(host, /Play \{findDemo\(slug\)\?\.title/);
  assert.match(host, /requestAnimationFrame/);
  assert.match(host, /document\.hidden/);
});

test('launch production output excludes stale media, stale counts, and unsupported proof language', async () => {
  const files = [
    'index.html',
    'framework.html',
    'studio.html',
    'games.html',
    'demos.html',
    'research.html',
    'resources.html',
    'resources/shaders.html',
    'resources/projects.html',
    'resources/skills.html',
    'roadmap.html',
  ];
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, outputRoot), 'utf8')));
  const source = sources.join('\n');
  const nonGamesSource = sources.filter((_, index) => files[index] !== 'games.html').join('\n');
  assert.doesNotMatch(source, /(?:town-study|depth-study|media\/worlds|media\/machinery|seven focused browser studies|four technical studies)/i);
  assert.doesNotMatch(nonGamesSource, /Combat Arena|combat-arena/i);
  assert.match(sources[files.indexOf('games.html')], /Combat Arena/);
  assert.doesNotMatch(sources[files.indexOf('games.html')], /href="\/demos\/combat-arena"/);
  assert.doesNotMatch(source, /(?:trained model result|completed selection workflow|durable feedback is current|online play is current)/i);
});
