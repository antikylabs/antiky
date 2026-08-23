import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Free game assets, installable agent skills, and upcoming shader and project libraries from Antiky Labs.',
  alternates: { canonical: '/resources' },
};

const LIBRARIES = [
  {
    href: '/assets',
    status: 'Current',
    evidenceStatus: 'current',
    title: 'CC0 asset library',
    body: 'Find free game assets with clear licenses, source links, previews, formats, tags, and download links.',
  },
  {
    href: '/resources/skills',
    status: 'Current',
    evidenceStatus: 'current',
    title: 'Skills library',
    body: 'Install reviewed, portable ways of working for coding agents from a pinned public source snapshot.',
  },
  {
    href: '/resources/shaders',
    status: 'Coming soon',
    evidenceStatus: 'direction',
    title: 'Shader library',
    body: 'Browse reusable BroMetal shader sources, generated output, and working examples. Coming soon.',
  },
  {
    href: '/resources/projects',
    status: 'Coming soon',
    evidenceStatus: 'direction',
    title: 'Project library',
    body: 'Start from maintained Antiky projects for common game-development tasks. Coming soon.',
  },
] as const;

export default function ResourcesPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-live" /> Current assets and skills · more libraries ahead</p>
        <h1>Free assets and reusable tools for making games.</h1>
        <p className="page-lead">
          Browse CC0 assets and installable agent skills today. Shader and project libraries are
          coming later.
        </p>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>Choose a library</h2>
          <p>Assets and skills are available now. Shader and project libraries are coming later.</p>
        </header>
        <div className="editorial-list">
          {LIBRARIES.map((library) => (
            <Link
              className="editorial-row"
              data-evidence-status={library.evidenceStatus}
              href={library.href}
              key={library.href}
            >
              <span className="row-status">{library.status}</span>
              <span className="row-copy"><strong>{library.title}</strong><span>{library.body}</span></span>
              <ArrowRight className="row-arrow" />
            </Link>
          ))}
        </div>
      </section>

    </>
  );
}
