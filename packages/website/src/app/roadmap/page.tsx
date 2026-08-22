import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';
import { loadRoadmap } from '@/lib/roadmap';

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'The ordered Antiky Labs delivery scope, without invented dates or progress estimates.',
  alternates: { canonical: '/roadmap' },
};

export default async function RoadmapPage() {
  const roadmap = await loadRoadmap();

  return (
    <>
      <section className="page-hero wrap roadmap-hero">
        <p className="status-line"><span className="status-dot status-planned" /> Direction · release scope without dates</p>
        <h1>{roadmap.title}</h1>
        <p className="page-lead">{roadmap.intro}</p>
        <p className="roadmap-notice">{roadmap.notice}</p>
      </section>

      <section className="content-section wrap roadmap-list" aria-label="Roadmap deliveries">
        {roadmap.deliveries.map((delivery, index) => (
          <article className="roadmap-delivery" key={delivery.title}>
            <header>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{delivery.title}</h2>
                <p>{delivery.description}</p>
              </div>
            </header>
            <ul>
              {delivery.subitems.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="closing-cta wrap">
        <p>Start with the current contracts and the studies proving them.</p>
        <Link href="/docs">Read the documentation <ArrowRight /></Link>
        <Link href="/demos">Run current studies <ArrowRight /></Link>
      </section>
    </>
  );
}
