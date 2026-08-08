import type { Metadata } from 'next';
import Link from 'next/link';
import DemoStage from '@/components/DemoStage';
import { DEMOS } from '@/lib/demos';
import { BROMETAL_VERSION } from '@/lib/site';
import { ArrowUpRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Demos',
  description: 'Eight live Antiky Framework, BroMetal, and Three.js studies in one portable host.',
  alternates: { canonical: '/demos' },
};

export default function DemosPage() {
  return (
    <>
      <section className="page-hero wrap demos-intro">
        <h1>Run the work.</h1>
        <p className="status-line"><span className="status-dot status-live" /> Eight live studies</p>
        <p className="page-lead">These are live modules, not trailers: two Antiky Framework worlds, four BroMetal {BROMETAL_VERSION} showcases, and two Three.js scenes in the same portable host.</p>
      </section>

      <section className="demo-index wrap">
        {DEMOS.map((demo) => (
          <article className="demo-entry" key={demo.slug}>
            <Link className="demo-entry-media" href={`/demos/${demo.slug}`} aria-label={`Open ${demo.title}`}>
              <DemoStage slug={demo.slug} variant="thumb" poster={demo.poster} label={`${demo.title} preview`} />
              <span className="demo-open">Open study <ArrowUpRight /></span>
            </Link>
            <div className="demo-entry-copy">
              <p>{demo.pillar} · Live demo</p>
              <h2><Link href={`/demos/${demo.slug}`}>{demo.title}</Link></h2>
              <p>{demo.tagline}</p>
              <div className="tag-list">{demo.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
