import type { Metadata } from 'next';
import Link from 'next/link';
import { DemoStage } from '@antiky/demos/react';
import { BROMETAL_URL, BROMETAL_VERSION } from '@/lib/site';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Antiky Framework',
  description: 'An emerging 2.3D game framework for 2D characters and objects inside spatial 3D worlds.',
  alternates: { canonical: '/framework' },
};

const DIRECTIONS = [
  ['World composition', 'Bring sprites, simple geometry, camera, light, and depth into one coherent scene.'],
  ['Game structure', 'Keep real-time simulation predictable and project code understandable as a game grows.'],
  ['Useful tooling', 'Add visual tools where they make game work clearer, while keeping the framework usable on its own.'],
];

export default function FrameworkPage() {
  return (
    <>
      <section className="page-hero wrap">
        <h1>Built for 2D characters in 3D worlds.</h1>
        <p className="status-line"><span className="status-dot status-emerging" /> Emerging framework</p>
        <p className="page-lead">Antiky Framework is an open-source game framework taking shape on top of BroMetal. Its focus is 2.3D: crisp 2D characters and objects inside spatial, depth-aware environments.</p>
        <div className="actions">
          <Link className="button button-primary" href="/demos/town-study">Run Town Study <ArrowUpRight /></Link>
          <a className="text-link" href={BROMETAL_URL} target="_blank" rel="noreferrer">Explore BroMetal {BROMETAL_VERSION} <ArrowUpRight /></a>
        </div>
      </section>

      <section className="wide-media wrap" aria-label="Town Study preview">
        <DemoStage
          slug="town-study"
          poster="/media/town-study-poster.png"
          controlMode="move"
          label="Town Study — live framework experiment"
        />
      </section>

      <section className="content-section wrap split-heading">
        <div>
          <h2>The direction is clear. The framework is early.</h2>
        </div>
        <div className="prose">
          <p className="lead">The public workspace exists, but Antiky Framework is not a finished product and no stable release is available yet.</p>
          <p>The live studies show the rendering ideas being explored today. BroMetal—the rendering and shader layer beneath them—is available now. Framework capabilities will be documented here only as they become genuinely useful.</p>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <h2>What it is aiming to make easier</h2>
          <p>Three practical concerns, kept deliberately narrower than an all-purpose engine.</p>
        </header>
        <div className="editorial-list">
          {DIRECTIONS.map(([title, body]) => (
            <div className="editorial-row static" key={title}>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Want the part that runs today?</p>
        <Link href="/demos">Explore the browser studies <ArrowRight /></Link>
      </section>
    </>
  );
}
