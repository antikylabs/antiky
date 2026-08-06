import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const docsRoot = new URL('../../../docs/user-facing-docs/', import.meta.url);
const outputRoot = new URL('../.next/server/app/', import.meta.url);
const sections = ['framework', 'cli', 'mcp', 'studio'];
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

async function publishedSources() {
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
  const sources = await publishedSources();
  const docsHome = await readFile(new URL('docs.html', outputRoot), 'utf8');
  const sitemap = await readFile(new URL('sitemap.xml.body', outputRoot), 'utf8');

  for (const sourcePath of sources) {
    const source = await readFile(new URL(sourcePath, docsRoot), 'utf8');
    const title = source.match(/^#\s+(.+)$/m)?.[1];
    assert.ok(title, `${sourcePath} is missing its title`);

    const route = routeForSource(sourcePath);
    const output = await readFile(outputForRoute(route), 'utf8');
    assert.match(output, new RegExp(`<h1[^>]*>.*${escapeHtml(title)}.*<\\/h1>`));
    assert.doesNotMatch(output, /href="[^"]+\.md(?:#[^"]*)?"/);
    assert.ok(docsHome.includes(`href="${route}"`), `${route} is missing from documentation navigation`);
    assert.ok(sitemap.includes(`<loc>${new URL(route, siteUrl)}</loc>`), `${route} is missing from the sitemap`);
  }

  const pointLights = await readFile(new URL('docs/framework/point-lights.html', outputRoot), 'utf8');
  const tools = await readFile(new URL('docs/mcp/tools.html', outputRoot), 'utf8');
  assert.ok(pointLights.includes('href="/docs/mcp/tools#set_point_light_power"'));
  assert.ok(tools.includes('id="set_point_light_power"'));
});
