'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DemoStage from '@/components/DemoStage';
import { DEMOS, type DemoMeta } from '@/lib/demos';
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@/components/Icons';

type Props = {
  demo: DemoMeta;
  prev: DemoMeta;
  next: DemoMeta;
  index: number;
};

const DEMO_LIMITS: Record<DemoMeta['pillar'], string> = {
  Framework: 'This working slice does not represent a complete engine or the full creator-agent workflow.',
  BroMetal: 'This rendering study does not demonstrate Framework-owned game state or a complete game-development workflow.',
  'Three.js': 'This host-compatibility study does not add Three.js to Antiky Framework or prove semantic Framework inspection.',
};

export default function DemoDeck({ demo, prev, next, index }: Props) {
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
        <DemoStage
          key={demo.slug}
          slug={demo.slug}
          label={`${demo.title} — interactive live study`}
          controlMode={demo.controlMode}
        />
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
          <p className="demo-limit"><span>What it does not show</span>{DEMO_LIMITS[demo.pillar]}</p>
        </div>
      </section>
    </>
  );
}
