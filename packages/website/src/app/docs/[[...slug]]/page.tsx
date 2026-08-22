import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyMarkdownButton from '@/components/CopyMarkdownButton';
import DocsSearch from '@/components/DocsSearch';
import DocsTableOfContents from '@/components/DocsTableOfContents';
import {
  getDocsEntries,
  getDocsEntry,
  getDocsNavigation,
  getDocsNavigationGroups,
  getDocsSearchRecords,
  renderDocsMarkdown,
  type DocsEntry,
  type DocsNavigationGroup,
} from '@/lib/docs';

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDocsEntries()).map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const entry = await getDocsEntry((await params).slug ?? []);
  if (!entry) return {};

  return {
    title: entry.slug.length === 0 ? 'Documentation' : entry.title,
    description: entry.description,
    alternates: { canonical: entry.href },
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const slug = (await params).slug ?? [];
  const [entry, navigation, entries] = await Promise.all([
    getDocsEntry(slug),
    getDocsNavigation(),
    getDocsEntries(),
  ]);

  if (!entry) notFound();

  const groups = getDocsNavigationGroups(navigation);
  const activeGroup = groups.find((group) => (
    entry.href === '/docs' ? group.id === 'start' : entry.section && group.sectionIds.includes(entry.section)
  )) ?? groups[0]!;
  const orderedEntries = [
    entries.find((candidate) => candidate.slug.length === 0)!,
    ...groups.flatMap((group) => group.sections.flatMap((section) => section.pages)),
  ];
  const currentIndex = orderedEntries.findIndex((candidate) => candidate.href === entry.href);
  const previous = currentIndex > 0 ? orderedEntries[currentIndex - 1] : undefined;
  const next = currentIndex < orderedEntries.length - 1 ? orderedEntries[currentIndex + 1] : undefined;
  const searchRecords = getDocsSearchRecords(entries);
  const sectionLabel = activeGroup.sections.find((section) => section.id === entry.section)?.label;

  return (
    <div className="docs-shell wrap">
      <DocsTabs activeGroup={activeGroup} groups={groups} />
      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label={`${activeGroup.label} documentation navigation`}>
          <DocsSearch records={searchRecords} />
          <DocsNavigation activeHref={entry.href} group={activeGroup} />
        </aside>

        <div className="docs-main">
          <details className="docs-mobile-navigation">
            <summary>Browse {activeGroup.label.toLowerCase()} docs</summary>
            <DocsSearch records={searchRecords} />
            <DocsNavigation activeHref={entry.href} group={activeGroup} />
          </details>

          <div className="docs-page-tools">
            <p className="docs-breadcrumb">
              <Link href="/docs">Docs</Link>
              {sectionLabel && <><span>/</span><span>{sectionLabel}</span></>}
            </p>
            <div className="docs-page-actions">
              <CopyMarkdownButton markdown={entry.source} />
              <a className="docs-markdown-link" href={entry.markdownHref}>View Markdown</a>
            </div>
          </div>
          <article
            className="docs-prose"
            dangerouslySetInnerHTML={{ __html: renderDocsMarkdown(entry) }}
          />
          <DocsPager previous={previous} next={next} />
        </div>

        <aside className="docs-toc" aria-label="On this page">
          <p>On this page</p>
          <DocsTableOfContents headings={entry.headings} />
        </aside>
      </div>
    </div>
  );
}

function DocsTabs({
  activeGroup,
  groups,
}: {
  activeGroup: DocsNavigationGroup;
  groups: DocsNavigationGroup[];
}) {
  return (
    <nav className="docs-tabs" aria-label="Documentation sections">
      {groups.map((group) => (
        <Link className={activeGroup.id === group.id ? 'active' : undefined} href={group.href} aria-current={activeGroup.id === group.id ? 'page' : undefined} key={group.id}>
          {group.label}
        </Link>
      ))}
    </nav>
  );
}

function DocsNavigation({
  activeHref,
  group,
}: {
  activeHref: string;
  group: DocsNavigationGroup;
}) {
  return (
    <nav>
      {group.id === 'start' && (
        <Link className={activeHref === '/docs' ? 'active' : undefined} href="/docs" aria-current={activeHref === '/docs' ? 'page' : undefined}>
          Overview
        </Link>
      )}
      {group.sections.map((section) => (
        <section key={section.label}>
          <h2>{section.label}</h2>
          {section.pages.map((page) => (
            <Link className={activeHref === page.href ? 'active' : undefined} href={page.href} key={page.href} aria-current={activeHref === page.href ? 'page' : undefined}>
              {page.title}
            </Link>
          ))}
        </section>
      ))}
    </nav>
  );
}

function DocsPager({ previous, next }: { previous?: DocsEntry; next?: DocsEntry }) {
  if (!previous && !next) return null;

  return (
    <nav className="docs-pager" aria-label="Adjacent documentation">
      {previous ? <Link href={previous.href}><span>Previous</span>{previous.title}</Link> : <span />}
      {next ? <Link className="next" href={next.href}><span>Next</span>{next.title}</Link> : <span />}
    </nav>
  );
}
