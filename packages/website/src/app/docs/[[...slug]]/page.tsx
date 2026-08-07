import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CopyMarkdownButton from '@/components/CopyMarkdownButton';
import DocsSearch from '@/components/DocsSearch';
import {
  getDocsEntries,
  getDocsEntry,
  getDocsNavigation,
  getDocsSearchRecords,
  renderDocsMarkdown,
  type DocsEntry,
  type DocsNavigationSection,
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

  const orderedEntries = [
    entries.find((candidate) => candidate.slug.length === 0)!,
    ...navigation.flatMap((section) => section.pages),
  ];
  const currentIndex = orderedEntries.findIndex((candidate) => candidate.href === entry.href);
  const previous = currentIndex > 0 ? orderedEntries[currentIndex - 1] : undefined;
  const next = currentIndex < orderedEntries.length - 1 ? orderedEntries[currentIndex + 1] : undefined;
  const searchRecords = getDocsSearchRecords(entries);

  return (
    <div className="docs-layout wrap">
      <aside className="docs-sidebar" aria-label="Documentation navigation">
        <DocsSearch records={searchRecords} />
        <DocsNavigation activeHref={entry.href} navigation={navigation} />
      </aside>

      <div className="docs-main">
        <details className="docs-mobile-navigation">
          <summary>Browse documentation</summary>
          <DocsSearch records={searchRecords} />
          <DocsNavigation activeHref={entry.href} navigation={navigation} />
        </details>

        <div className="docs-page-tools">
          <p className="docs-breadcrumb">
            <Link href="/docs">Docs</Link>
            {entry.section && <><span>/</span><span>{entry.section}</span></>}
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
        <nav>
          {entry.headings.map((heading) => (
            <a className={heading.depth === 3 ? 'nested' : undefined} href={`#${heading.id}`} key={heading.id}>
              {heading.title}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function DocsNavigation({
  activeHref,
  navigation,
}: {
  activeHref: string;
  navigation: DocsNavigationSection[];
}) {
  return (
    <nav>
      <Link className={activeHref === '/docs' ? 'active' : undefined} href="/docs" aria-current={activeHref === '/docs' ? 'page' : undefined}>
        Overview
      </Link>
      {navigation.map((section) => (
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
