import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Antiky Worlds',
  description: 'Antiky Worlds is the future game studio behind Emberwyrd, a character-first online fantasy action RPG in development.',
  alternates: { canonical: '/worlds' },
};

const DIRECTIONS = [
  ['A memorable journey', 'Places, people, and mysteries worth caring about—not a world assembled to fill space.'],
  ['Tactile action', 'A compact, equipment-defined moveset where timing, range, facing, and commitment matter.'],
  ['Consequential travel', 'A world where goods come from somewhere, distance has weight, and risk is chosen rather than ambient.'],
];

export default function WorldsPage() {
  return (
    <>
      <section className="page-hero worlds-hero wrap">
        <h1>Places worth leaving.<br />And returning to.</h1>
        <p className="status-line"><span className="status-dot status-planned" /> Planned world</p>
        <p className="page-lead">Antiky Worlds is our future game studio. Its first planned title is Emberwyrd, a character-first online fantasy action RPG now in development.</p>
      </section>

      <section className="world-title" id="emberwyrd">
        <div className="wrap">
          <p>Antiky Worlds presents</p>
          <h2>Emberwyrd</h2>
          <span>In development · no playable release yet</span>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div>
          <h2>An adventure shaped by what you carry.</h2>
        </div>
        <div className="prose">
          <p className="lead">Equipment defines how a traveler fights. Regional stories give the journey a spine. Trade, scarce resources, and deliberate danger give movement through the world consequence.</p>
          <p>This is the creative direction, not a shipped feature list. We will show the game when there is real player-facing material worth seeing.</p>
        </div>
      </section>

      <section className="content-section wrap">
        <div className="editorial-list">
          {DIRECTIONS.map(([title, body]) => (
            <div className="editorial-row static" key={title}>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>The technology work is already visible.</p>
        <Link href="/demos/depth-study">See the 2.3D study <ArrowRight /></Link>
      </section>
    </>
  );
}
