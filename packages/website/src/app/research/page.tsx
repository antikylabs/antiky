import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { DISCORD_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Research',
  description:
    'Antiky Labs research questions and working game-technology evidence, separated from shipped product claims.',
  alternates: { canonical: '/research' },
};

const AREAS = [
  {
    status: 'Current evidence',
    evidenceStatus: 'current',
    title: 'Rendering and portable game hosts',
    body: 'Four runnable Antiky Framework demos share one website-owned host. Each artifact answers a narrow question about game state, rendering, or authoring.',
  },
  {
    status: 'Direction to test',
    evidenceStatus: 'direction',
    title: 'A complete creator-agent loop',
    body: 'Connect exact-target feedback, bounded changes, isolated experiments, review evidence, and explicit authority to a visible game result.',
  },
  {
    status: 'Research question',
    evidenceStatus: 'research-question',
    title: 'The environment versus the model',
    body: 'Test whether structured context, narrow tools, clear interfaces, and useful feedback help smaller or local models complete game-development tasks.',
  },
] as const;

export default function ResearchPage() {
  return (
    <>
      <section className="page-hero wrap">
        <h1>Evidence before adjectives.</h1>
        <p className="status-line"><span className="status-dot status-active" /> Active questions · narrow current proof</p>
        <p className="page-lead">
          Antiky Labs publishes working artifacts and keeps hypotheses labeled. Research can shape
          the games and development system without becoming a product promise too early.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/demos">Run the current evidence <ArrowUpRight /></Link>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>Research ledger</h2>
          <p>What can be run, what the architecture points toward, and what still needs a result.</p>
        </header>
        <div className="editorial-list">
          {AREAS.map((area) => (
            <div
              className="editorial-row static research-row"
              data-evidence-status={area.evidenceStatus}
              key={area.title}
            >
              <span className="row-status">{area.status}</span>
              <span className="row-copy"><strong>{area.title}</strong><span>{area.body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>Show the method. Publish the limits.</h2>
          <div>
            <p className="lead">A research claim should carry enough detail to be challenged.</p>
            <p>
              Model, configuration, task, baseline, success criteria, time, tokens, failures, and
              limitations all matter. Until that evidence exists, smaller-model efficiency,
              training outcomes, and generalized agent workflows remain questions.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/demos">Explore live studies <ArrowRight /></Link>
              <a className="text-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
                Challenge a question on Discord <ArrowUpRight />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
