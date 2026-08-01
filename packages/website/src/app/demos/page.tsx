import type { Metadata } from 'next';
import Link from 'next/link';
import { DEMOS } from '@antiky/demos/catalog';
import { DemoStage } from '@antiky/demos/react';
import { BROMETAL_VERSION } from '@/lib/site';
import { ArrowUpRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Demos',
  description: 'Two live browser studies from Antiky Labs: 2.3D depth and one shader source across WebGPU and WebGL2.',
  alternates: { canonical: '/demos' },
};

export default function DemosPage() {
  return (
    <>
      <section className="page-hero wrap demos-intro">
        <h1>Run the work.</h1>
        <p className="status-line"><span className="status-dot status-live" /> Two live studies</p>
        <p className="page-lead">These are small browser experiments, not trailers. Each renders through BroMetal {BROMETAL_VERSION} and can run on WebGPU or WebGL2 from the same source.</p>
      </section>

      <section className="demo-index wrap">
        {DEMOS.map((demo) => (
          <article className="demo-entry" key={demo.slug}>
            <Link className="demo-entry-media" href={`/demos/${demo.slug}`} aria-label={`Open ${demo.title}`}>
              <DemoStage slug={demo.slug} variant="thumb" label={`${demo.title} rendered preview`} />
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
