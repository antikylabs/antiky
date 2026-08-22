import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Current Antiky game assets and agent skills, plus honestly labeled shader and project libraries in development.',
  alternates: { canonical: '/resources' },
};

const LIBRARIES = [
  {
    href: '/assets',
    status: 'Current',
    evidenceStatus: 'current',
    title: 'CC0 asset library',
    body: 'Find source-linked game assets with licenses, formats, tags, verification state, permanent pages, and structured records for agents.',
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
    status: 'Direction · Coming soon',
    evidenceStatus: 'direction',
    title: 'Shader library',
    body: 'The intended library will make BroMetal shader sources, generated output, examples, and support boundaries easier to inspect and reuse.',
  },
  {
    href: '/resources/projects',
    status: 'Direction · Coming soon',
    evidenceStatus: 'direction',
    title: 'Project library',
    body: 'The intended library will publish bounded, maintained Antiky project starting points after they have real users and verification.',
  },
] as const;

export default function ResourcesPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-live" /> Current assets and skills · more libraries ahead</p>
        <h1>Reusable work, with its boundary attached.</h1>
        <p className="page-lead">
          Antiky Resources is the public home for reusable game material and agent guidance. Assets
          and Skills are available now; Shader and Project libraries remain direction until their
          reviewed catalogs exist.
        </p>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>Choose a library</h2>
          <p>Each destination states what is usable today and what still needs evidence.</p>
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

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>Libraries grow from proved work.</h2>
          <div>
            <p className="lead">A useful building block needs source, provenance, a boundary, and a maintained path.</p>
            <p>
              Research can expose a candidate and a game can prove it. Publication is a separate
              decision, so experimental work does not silently become a supported resource.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/roadmap">Read the roadmap <ArrowRight /></Link>
              <Link className="text-link" href="/docs">Read the documentation <ArrowRight /></Link>
              <Link className="text-link" href="/research">See the research method <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
