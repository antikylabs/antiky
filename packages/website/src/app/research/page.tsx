import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Active Antiky Labs research into game assets, rendering, physics, and practical game-technology systems.',
  alternates: { canonical: '/research' },
};

const AREAS = [
  {
    status: 'Active research',
    title: 'Generated voxel assets',
    body: 'Studying how model adaptation, constrained palettes, and deterministic tooling can produce editable, game-ready voxel work.',
  },
  {
    status: 'Active research',
    title: 'Rendering and physics',
    body: 'Testing the boundaries of sprite depth, browser rendering, and simulation before those ideas become framework promises.',
  },
  {
    status: 'Active research',
    title: 'Models for game languages',
    body: 'Training and adapting models to work fluently with shader DSLs and game-framework languages, with an emphasis on valid, useful code rather than generic completion.',
  },
];

export default function ResearchPage() {
  return (
    <>
      <section className="page-hero wrap">
        <h1>Research for games we intend to make.</h1>
        <p className="status-line"><span className="status-dot status-active" /> Active research</p>
        <p className="page-lead">Antiky Labs studies asset creation, rendering, physics, and engine structure. We publish selectively: a claim belongs here when there is a concrete experiment or artifact behind it.</p>
        <div className="actions">
          <Link className="button button-primary" href="/demos/shader-study">Run Shader Study <ArrowUpRight /></Link>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>Current areas</h2>
          <p>A working research map, not a list of finished capabilities.</p>
        </header>
        <div className="editorial-list">
          {AREAS.map((area) => (
            <div className="editorial-row static research-row" key={area.title}>
              <span className="row-status">{area.status}</span>
              <span className="row-copy"><strong>{area.title}</strong><span>{area.body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>Evidence before adjectives.</h2>
          <div>
            <p className="lead">Research can inform the framework without becoming a marketing promise.</p>
            <p>Current notes and experiments may change as better evidence arrives. Public product language stays narrower than the lab.</p>
            <Link className="text-link" href="/demos">Explore live studies <ArrowRight /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
