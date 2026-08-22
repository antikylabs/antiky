import type { Metadata } from 'next';
import Link from 'next/link';
import DemoPoster from '@/components/DemoPoster';
import { DEMOS, DEMO_GROUPS } from '@/lib/demos';
import { BROMETAL_VERSION } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Demos',
  description: 'Play three Antiky Framework demos in your browser: Antiky Town, Traversal Study, and Point Light Expo.',
  alternates: { canonical: '/demos' },
};

export default function DemosPage() {
  return (
    <>
      <section className="page-hero wrap demos-intro">
        <h1>Play the Framework demos.</h1>
        <p className="status-line"><span className="status-dot status-live" /> Three playable demos</p>
        <p className="page-lead">
          Explore an authored town, a movement course, and live point-light editing. Each demo is a
          real Antiky Framework game module rendered through BroMetal {BROMETAL_VERSION}.
        </p>
      </section>

      <section className="demo-index wrap">
        {DEMO_GROUPS.map((group) => {
          const demos = DEMOS.filter((demo) => demo.pillar === group.pillar);
          return (
            <section className="demo-family" aria-labelledby={group.id} key={group.id}>
              <header className="demo-family-head">
                <p>{String(demos.length).padStart(2, '0')} live {demos.length === 1 ? 'study' : 'studies'}</p>
                <h2 id={group.id}>{group.title}</h2>
                <p>{group.description}</p>
              </header>
              {demos.map((demo) => (
                <article className="demo-entry" key={demo.slug}>
                  <div className="demo-entry-media">
                    <DemoPoster demo={demo} />
                  </div>
                  <div className="demo-entry-copy">
                    <p>{demo.pillar} · Playable demo</p>
                    <h3><Link href={`/demos/${demo.slug}`}>{demo.title}</Link></h3>
                    <p>{demo.tagline}</p>
                    <div className="tag-list">{demo.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </section>
    </>
  );
}
