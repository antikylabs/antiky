import 'server-only';

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { Marked } from 'marked';
import { CATALOG_ASSETS } from '@antiky/asset-catalog/catalog';
import { canonical } from '@/lib/site';

const DOCS_ROOT = resolve(process.cwd(), '../../docs/user-facing-docs');

const PRODUCT_DOCS_SECTIONS = [
  { directory: 'framework', label: 'Framework' },
  { directory: 'cli', label: 'CLI' },
  { directory: 'mcp', label: 'MCP' },
  { directory: 'studio', label: 'Studio' },
  { directory: 'assets', label: 'Game Assets' },
] as const;

const API_DOCS_SECTION = { directory: 'api', label: 'API Reference' } as const;
const DOCS_SECTIONS = [...PRODUCT_DOCS_SECTIONS, API_DOCS_SECTION] as const;

const CONTRIBUTOR_PAGE = {
  relativePath: 'DOCUMENTATION_STANDARDS_A.md',
  slug: ['contributing', 'documentation-standards'],
};

export type DocsHeading = {
  depth: number;
  id: string;
  title: string;
};

export type DocsEntry = {
  description: string;
  headings: DocsHeading[];
  href: string;
  markdownHref: string;
  relativePath: string;
  section: string | null;
  slug: string[];
  source: string;
  title: string;
};

export type DocsSearchRecord = {
  content: string;
  description: string;
  href: string;
  section: string;
  title: string;
};

export type DocsNavigationSection = {
  label: string;
  pages: DocsEntry[];
};

function docsHref(slug: string[]): string {
  return slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`;
}

function docsMarkdownHref(slug: string[]): string {
  return slug.length === 0 ? '/docs/index.html.md' : `${docsHref(slug)}.md`;
}

function sourcePathToSlug(relativePath: string): string[] | null {
  const normalizedPath = normalize(relativePath).replaceAll('\\', '/');
  if (normalizedPath === 'README.md') return [];
  if (normalizedPath === CONTRIBUTOR_PAGE.relativePath) return CONTRIBUTOR_PAGE.slug;

  const match = normalizedPath.match(/^(framework|cli|mcp|studio|assets|api)\/(.+)\.md$/);
  return match ? [match[1]!, match[2]!] : null;
}

function plainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDocsSource(rawSource: string, relativePath: string): { publish: boolean; source: string } {
  const frontmatter = rawSource.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return { publish: true, source: rawSource };

  const publishSetting = frontmatter[1]!.match(/^publish:\s*(\S+)\s*$/m)?.[1];
  if (publishSetting && publishSetting !== 'true' && publishSetting !== 'false') {
    throw new Error(`${relativePath} has an invalid publish setting; use true or false.`);
  }

  return {
    publish: publishSetting !== 'false',
    source: rawSource.slice(frontmatter[0].length),
  };
}

function headingText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageTitle(source: string): string {
  const title = source.match(/^#\s+(.+)$/m)?.[1];
  if (!title) throw new Error('Every public documentation page needs one level-one heading.');
  return plainText(title);
}

function pageDescription(source: string): string {
  const content = source.replace(/^#\s+.+$/m, '').trimStart();
  const firstSection = content.split(/^##\s+/m, 1)[0] ?? '';
  return plainText(firstSection);
}

function slugBase(title: string): string {
  return headingText(title)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}_\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

function uniqueSlug(title: string, seen: Map<string, number>): string {
  const base = slugBase(title) || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function pageHeadings(source: string): DocsHeading[] {
  const headings: DocsHeading[] = [];
  const seen = new Map<string, number>();

  for (const match of source.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
    const title = headingText(match[2]!);
    headings.push({ depth: match[1]!.length, id: uniqueSlug(title, seen), title });
  }

  return headings;
}

async function readEntry(relativePath: string): Promise<DocsEntry | null> {
  const rawSource = await readFile(join(DOCS_ROOT, relativePath), 'utf8');
  const { publish, source } = parseDocsSource(rawSource, relativePath);
  if (!publish) return null;

  const slug = sourcePathToSlug(relativePath);
  if (!slug) throw new Error(`Unsupported public documentation path: ${relativePath}`);

  return {
    description: pageDescription(source),
    headings: pageHeadings(source),
    href: docsHref(slug),
    markdownHref: docsMarkdownHref(slug),
    relativePath,
    section: slug.length > 1 && slug[0] !== 'contributing' ? slug[0]! : null,
    slug,
    source,
    title: pageTitle(source),
  };
}

export async function getDocsEntries(): Promise<DocsEntry[]> {
  const sectionPaths = await Promise.all(DOCS_SECTIONS.map(async ({ directory }) => {
    const names = await readdir(join(DOCS_ROOT, directory));
    return names
      .filter((name) => name.endsWith('.md'))
      .map((name) => `${directory}/${name}`);
  }));

  const entries = await Promise.all([
    readEntry('README.md'),
    ...sectionPaths.flat().map(readEntry),
    readEntry(CONTRIBUTOR_PAGE.relativePath),
  ]);
  return entries.filter((entry): entry is DocsEntry => entry !== null);
}

export async function getDocsEntry(slug: string[]): Promise<DocsEntry | undefined> {
  const href = docsHref(slug);
  return (await getDocsEntries()).find((entry) => entry.href === href);
}

export async function getDocsNavigation(): Promise<DocsNavigationSection[]> {
  const entries = await getDocsEntries();
  const homeSource = entries.find((entry) => entry.slug.length === 0)?.source ?? '';
  const sourceOrder = Array.from(homeSource.matchAll(/\]\(([^)#]+\.md)(?:#[^)]+)?\)/g), (match) => (
    normalize(match[1]!).replaceAll('\\', '/')
  ));

  const ordered = (pages: DocsEntry[]) => [...pages].sort((left, right) => {
    const leftIndex = sourceOrder.indexOf(left.relativePath);
    const rightIndex = sourceOrder.indexOf(right.relativePath);
    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) return 1;
      if (rightIndex === -1) return -1;
      return leftIndex - rightIndex;
    }
    return left.title.localeCompare(right.title);
  });

  return [
    ...PRODUCT_DOCS_SECTIONS.map(({ directory, label }) => ({
      label,
      pages: ordered(entries.filter((entry) => entry.section === directory)),
    })),
    {
      label: 'Contributing',
      pages: ordered(entries.filter((entry) => entry.slug[0] === 'contributing')),
    },
    {
      label: API_DOCS_SECTION.label,
      pages: ordered(entries.filter((entry) => entry.section === API_DOCS_SECTION.directory)),
    },
  ]
    .filter((section) => section.pages.length > 0);
}

export function getDocsSearchRecords(entries: DocsEntry[]): DocsSearchRecord[] {
  return entries.map((entry) => ({
    content: plainText(entry.source),
    description: entry.description,
    href: entry.href,
    section: entry.section ?? 'Overview',
    title: entry.title,
  }));
}

export function renderLlmsTxt(entries: DocsEntry[], navigation: DocsNavigationSection[]): string {
  const home = entries.find((entry) => entry.slug.length === 0);
  if (!home) throw new Error('The documentation home is required to generate llms.txt.');

  const lines = [
    '# Antiky Labs',
    '',
    `> ${home.description}`,
    '',
    'Public documentation and CC0 game assets for developers and agents building with Antiky Framework, CLI, MCP, and Studio.',
    '',
    '## Overview',
    '',
    `- [${home.title}](${canonical(home.markdownHref)}): ${home.description}`,
  ];

  lines.push(
    '',
    '## Complete context',
    '',
    `- [Antiky complete documentation and asset context](${canonical('/llms-full.txt')}): Full public docs, generated API reference, and every asset catalog record.`,
  );

  for (const section of navigation) {
    lines.push('', `## ${section.label}`, '');
    for (const page of section.pages) {
      lines.push(`- [${page.title}](${canonical(page.markdownHref)}): ${page.description}`);
    }
  }

  lines.push(
    '',
    '## Asset Catalog',
    '',
    `- [Static catalog API](https://catalog-api.antikylabs.com/v1/): Versioned index for frontend and agent clients.`,
    `- [Complete asset catalog JSON](https://catalog-api.antikylabs.com/v1/catalog.json): Static schema-versioned JSON containing all ${CATALOG_ASSETS.length.toLocaleString('en-US')} asset records.`,
  );
  for (const asset of CATALOG_ASSETS) {
    lines.push(`- [${asset.name}](${canonical(`/assets/${asset.provider.id}/${asset.slug}`)}): ${asset.provider.name} ${asset.kind}; ${asset.license.name}; ${asset.verification}.`);
  }

  return `${lines.join('\n')}\n`;
}

export function renderLlmsFullTxt(entries: DocsEntry[]): string {
  const lines = [
    '# Antiky Labs full context',
    '',
    '> Complete public documentation, generated API reference, and CC0-first asset catalog context.',
    '',
    `Canonical index: ${canonical('/llms.txt')}`,
  ];

  for (const entry of entries) {
    lines.push(
      '',
      `## Documentation: ${entry.title}`,
      '',
      `Source: ${canonical(entry.markdownHref)}`,
      '',
      entry.source.trim(),
    );
  }

  lines.push('', '## Asset catalog records', '');
  for (const asset of CATALOG_ASSETS) {
    lines.push(
      `### ${asset.name}`,
      '',
      `- Catalog URL: ${canonical(`/assets/${asset.provider.id}/${asset.slug}`)}`,
      `- JSON URL: https://catalog-api.antikylabs.com/v1/assets/${asset.provider.id}/${asset.slug}.json`,
      `- Stable ID: ${asset.id}`,
      `- Provider: ${asset.provider.name}`,
      `- Creator: ${asset.provenance.creator}`,
      `- Type: ${asset.kind}`,
      `- Description: ${asset.description}`,
      `- Tags: ${asset.tags.join(', ')}`,
      `- Formats: ${asset.formats.join(', ') || 'not published'}`,
      `- Published file count: ${asset.fileCount ?? 'not published'}`,
      `- License: ${asset.license.name} (${asset.license.referenceUrl})`,
      `- Verification: ${asset.verification}`,
      `- Official source: ${asset.upstream.url}`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function rewriteLink(href: string, sourcePath: string): string {
  if (/^(?:https?:|mailto:|#|\/)/i.test(href)) return href;
  if (/^[a-z]+:/i.test(href)) return '#';

  const [path, fragment] = href.split('#', 2);
  if (!path?.endsWith('.md')) return href;

  const targetPath = normalize(join(dirname(sourcePath), path)).replaceAll('\\', '/');
  const targetSlug = sourcePathToSlug(targetPath);
  if (!targetSlug) return href;
  return `${docsHref(targetSlug)}${fragment ? `#${fragment}` : ''}`;
}

export function renderDocsMarkdown(entry: DocsEntry): string {
  const marked = new Marked();
  const seenHeadings = new Map<string, number>();

  marked.use({
    gfm: true,
    breaks: false,
    renderer: {
      heading(token) {
        const id = uniqueSlug(token.text, seenHeadings);
        const content = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${escapeHtml(id)}"><a href="#${escapeHtml(id)}">${content}</a></h${token.depth}>`;
      },
      html(token) {
        return escapeHtml(token.text);
      },
      link(token) {
        const href = rewriteLink(token.href, entry.relativePath);
        const content = this.parser.parseInline(token.tokens);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
        const external = /^https?:/i.test(href);
        const externalAttributes = external ? ' target="_blank" rel="noreferrer"' : '';
        return `<a href="${escapeHtml(href)}"${title}${externalAttributes}>${content}</a>`;
      },
    },
  });

  return marked.parse(entry.source, { async: false });
}
