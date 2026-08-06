import 'server-only';

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { Marked } from 'marked';

const DOCS_ROOT = resolve(process.cwd(), '../../docs/user-facing-docs');

const DOCS_SECTIONS = [
  { directory: 'framework', label: 'Framework' },
  { directory: 'cli', label: 'CLI' },
  { directory: 'mcp', label: 'MCP' },
  { directory: 'studio', label: 'Studio' },
] as const;

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
  relativePath: string;
  section: string | null;
  slug: string[];
  source: string;
  title: string;
};

export type DocsNavigationSection = {
  label: string;
  pages: DocsEntry[];
};

function docsHref(slug: string[]): string {
  return slug.length === 0 ? '/docs' : `/docs/${slug.join('/')}`;
}

function sourcePathToSlug(relativePath: string): string[] | null {
  const normalizedPath = normalize(relativePath).replaceAll('\\', '/');
  if (normalizedPath === 'README.md') return [];
  if (normalizedPath === CONTRIBUTOR_PAGE.relativePath) return CONTRIBUTOR_PAGE.slug;

  const match = normalizedPath.match(/^(framework|cli|mcp|studio)\/(.+)\.md$/);
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

async function readEntry(relativePath: string): Promise<DocsEntry> {
  const source = await readFile(join(DOCS_ROOT, relativePath), 'utf8');
  const slug = sourcePathToSlug(relativePath);
  if (!slug) throw new Error(`Unsupported public documentation path: ${relativePath}`);

  return {
    description: pageDescription(source),
    headings: pageHeadings(source),
    href: docsHref(slug),
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

  return Promise.all([
    readEntry('README.md'),
    ...sectionPaths.flat().map(readEntry),
    readEntry(CONTRIBUTOR_PAGE.relativePath),
  ]);
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
    ...DOCS_SECTIONS.map(({ directory, label }) => ({
      label,
      pages: ordered(entries.filter((entry) => entry.section === directory)),
    })),
    {
      label: 'Contributing',
      pages: ordered(entries.filter((entry) => entry.slug[0] === 'contributing')),
    },
  ];
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
