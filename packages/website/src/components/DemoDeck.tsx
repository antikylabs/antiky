'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DEMOS, type DemoMeta } from '@antiky/demos/catalog';
import { CodePanes, DemoStage, type ShaderSources } from '@antiky/demos/react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@/components/Icons';

type Props = {
  demo: DemoMeta;
  prev: DemoMeta;
  next: DemoMeta;
  index: number;
  sources?: ShaderSources;
};

export default function DemoDeck({ demo, prev, next, index, sources }: Props) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(`/demos/${prev.slug}`);
    router.prefetch(`/demos/${next.slug}`);
  }, [router, prev.slug, next.slug]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT|CANVAS|BUTTON)$/.test(target.tagName)) return;
      if (event.key === 'ArrowLeft') router.push(`/demos/${prev.slug}`);
      else if (event.key === 'ArrowRight') router.push(`/demos/${next.slug}`);
      else if (event.key === 'Escape') router.push('/demos');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, prev.slug, next.slug]);

  return (
    <>
      <section className="demo-detail-head wrap">
        <div>
          <h1>{demo.title}</h1>
          <p className="status-line"><span className="status-dot status-live" /> Live demo · {demo.pillar}</p>
          <p>{demo.tagline}</p>
        </div>
        <Link className="text-link" href="/demos">All studies <ArrowUpRight /></Link>
      </section>

      <div className="deck-stage wrap">
        <DemoStage key={demo.slug} slug={demo.slug} label={`${demo.title} — interactive live study`} />
      </div>

      <div className="demo-meta wrap">
        <p>{demo.controls ?? 'Use the controls in the media frame'}</p>
        <nav className="demo-switcher" aria-label="Study navigation">
          <Link href={`/demos/${prev.slug}`} aria-label={`Previous: ${prev.title}`}><ArrowLeft /></Link>
          <span>{index + 1} / {DEMOS.length}</span>
          <Link href={`/demos/${next.slug}`} aria-label={`Next: ${next.title}`}><ArrowRight /></Link>
        </nav>
      </div>

      <section className="content-section wrap demo-notes">
        <div>
          <p className="section-label">About the study</p>
          <p className="lead">{demo.notes}</p>
        </div>
        <div>
          <p className="section-label">What it shows</p>
          <ul>
            {demo.proves.map((claim) => <li key={claim}>{claim}</li>)}
          </ul>
        </div>
      </section>

      {sources ? <section className="source-section wrap"><h2>Authored once. Compiled twice.</h2><CodePanes sources={sources} /></section> : null}
    </>
  );
}
