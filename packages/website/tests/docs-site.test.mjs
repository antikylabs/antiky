import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const docsRoot = new URL('../../../docs/user-facing-docs/', import.meta.url);
const outputRoot = new URL('../.next/server/app/', import.meta.url);
const sections = ['framework', 'cli', 'mcp', 'studio'];
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

async function documentationSources() {
  const sectionSources = await Promise.all(sections.map(async (section) => {
    const directory = new URL(`${section}/`, docsRoot);
    const names = await readdir(directory);
    return names.filter((name) => name.endsWith('.md')).map((name) => `${section}/${name}`);
  }));

  return ['README.md', ...sectionSources.flat(), 'DOCUMENTATION_STANDARDS_A.md'];
}

function routeForSource(sourcePath) {
  if (sourcePath === 'README.md') return '/docs';
  if (sourcePath === 'DOCUMENTATION_STANDARDS_A.md') {
    return '/docs/contributing/documentation-standards';
  }
  return `/docs/${sourcePath.slice(0, -3)}`;
}

function markdownRouteForSource(sourcePath) {
  const route = routeForSource(sourcePath);
  return route === '/docs' ? '/docs/index.html.md' : `${route}.md`;
}

function markdownOutputForSource(sourcePath) {
  const route = routeForSource(sourcePath);
  const path = route === '/docs' ? 'index.html' : route.slice('/docs/'.length);
  return new URL(`docs-markdown/${path}.body`, outputRoot);
}

function parseSource(rawSource) {
  const frontmatter = rawSource.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return { publish: true, source: rawSource };
  return {
    publish: !/^publish:\s*false\s*$/m.test(frontmatter[1]),
    source: rawSource.slice(frontmatter[0].length),
  };
}

function outputForRoute(route) {
  return new URL(`.${route}.html`, outputRoot);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

test('production docs publish every canonical user page with web-native links', async () => {
  const sources = await documentationSources();
  const docsHome = await readFile(new URL('docs.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');
  const llms = await readFile(new URL('llms.txt.body', outputRoot), 'utf8');

  for (const sourcePath of sources) {
    const rawSource = await readFile(new URL(sourcePath, docsRoot), 'utf8');
    const { publish, source } = parseSource(rawSource);
    if (!publish) continue;
    const title = source.match(/^#\s+(.+)$/m)?.[1];
    assert.ok(title, `${sourcePath} is missing its title`);

    const route = routeForSource(sourcePath);
    const output = await readFile(outputForRoute(route), 'utf8');
    assert.match(output, new RegExp(`<h1[^>]*>.*${escapeHtml(title)}.*<\\/h1>`));
    const markdownLinks = new Set(Array.from(output.matchAll(/href="([^"]+\.md(?:#[^"]*)?)"/g), (match) => match[1]));
    assert.deepEqual(markdownLinks, new Set([markdownRouteForSource(sourcePath)]));
    assert.ok(docsHome.includes(`href="${route}"`), `${route} is missing from documentation navigation`);
    assert.ok(sitemap.includes(`<loc>${new URL(route, siteUrl)}</loc>`), `${route} is missing from the sitemap`);
    assert.ok(llms.includes(new URL(markdownRouteForSource(sourcePath), siteUrl).toString()));
    assert.equal(await readFile(markdownOutputForSource(sourcePath), 'utf8'), source);
  }

  const pointLights = await readFile(new URL('docs/framework/point-lights.html', outputRoot), 'utf8');
  const tools = await readFile(new URL('docs/mcp/tools.html', outputRoot), 'utf8');
  assert.ok(pointLights.includes('href="/docs/mcp/tools#set_point_light_power"'));
  assert.ok(tools.includes('id="set_point_light_power"'));
});

test('docs publication metadata excludes repository-only pages from every public surface', async () => {
  const excludedSource = 'DOCUMENTATION_STANDARDS_A.md';
  const rawSource = await readFile(new URL(excludedSource, docsRoot), 'utf8');
  assert.equal(parseSource(rawSource).publish, false);

  const docsHome = await readFile(new URL('docs.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');
  const llms = await readFile(new URL('llms.txt.body', outputRoot), 'utf8');
  const excludedRoute = routeForSource(excludedSource);

  assert.doesNotMatch(docsHome, /User documentation standards/);
  assert.ok(!sitemap.includes(excludedRoute));
  assert.ok(!llms.includes(excludedRoute));
  await assert.rejects(readFile(outputForRoute(excludedRoute)), { code: 'ENOENT' });
  await assert.rejects(readFile(markdownOutputForSource(excludedSource)), { code: 'ENOENT' });
});

test('docs production output provides search, Markdown copy, and an llms.txt index', async () => {
  const docsHome = await readFile(new URL('docs.html', outputRoot), 'utf8');
  const llms = await readFile(new URL('llms.txt.body', outputRoot), 'utf8');
  const llmsMeta = JSON.parse(await readFile(new URL('llms.txt.meta', outputRoot), 'utf8'));
  const routesManifest = await readFile(new URL('../../routes-manifest.json', outputRoot), 'utf8');

  assert.match(docsHome, /placeholder="Search docs"/);
  assert.match(docsHome, />Copy Markdown<\/button>/);
  assert.match(docsHome, /href="\/docs\/index\.html\.md"/);
  assert.match(llms, /^# Antiky Documentation\n\n> /);
  assert.equal(llmsMeta.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.match(routesManifest, /docs-markdown/);
});
