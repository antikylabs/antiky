import type { Metadata } from 'next';
import Link from 'next/link';
import DemoPoster from '@/components/DemoPoster';
import { ArrowRight } from '@/components/Icons';
import { DEMOS } from '@/lib/demos';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Three public Antiky Framework technical studies today, with Emberwyrd kept separate as the larger game in development.',
  alternates: { canonical: '/games' },
};

const DIRECTIONS = [
  ['A memorable journey', 'Places, people, and mysteries worth caring about—not a world assembled to fill space.'],
  ['Tactile action', 'A compact, equipment-defined moveset where timing, range, facing, and commitment matter.'],
  ['Consequential travel', 'A world where goods come from somewhere, distance has weight, and risk is chosen rather than ambient.'],
];

export default function GamesPage() {
  return (
    <>
      <section className="page-hero games-hero wrap">
        <h1>Games create the questions.</h1>
        <p className="status-line"><span className="status-dot status-planned" /> Emberwyrd in development</p>
        <p className="page-lead">
          Antiky Labs builds technology in service of games. Three public Framework studies show
          traversal, authored worlds, and bounded light authoring today. Emberwyrd is the larger
          creative and technical test ahead.
        </p>
      </section>

      <section className="content-section games-current-section" data-evidence-status="current">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Current proof</p>
            <h2>{DEMOS.length} different game problems run today.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              These are playable Framework studies: bounded technical evidence rather than released games.
            </p>
            <p>
              Their catalog is the one source for this page and the Demos index. They are working
              evidence, not production games or substitutes for Emberwyrd.
            </p>
            <Link className="text-link section-link" href="/demos">
              Run all current studies <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="game-proof-grid wrap">
          {DEMOS.map((demo) => (
            <article className="game-proof" key={demo.slug}>
              <div className="game-proof-media">
                <DemoPoster demo={demo} />
              </div>
              <p>Current Framework study</p>
              <h3><Link href={`/demos/${demo.slug}`}>{demo.title}</Link></h3>
              <p>{demo.tagline}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="world-title" id="emberwyrd" data-evidence-status="direction">
        <div className="wrap">
          <p>The larger test</p>
          <h2>Emberwyrd</h2>
          <span>In development · no playable release today</span>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div>
          <h2>The game leads. The engine follows.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Emberwyrd is the larger game in development—and the reason Antiky exists.
          </p>
          <p>
            The game creates real creative and technical problems. When a solution proves reusable,
            it can become part of Antiky. This is the direction, not a shipped feature list or a
            playable game announcement.
          </p>
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
        <p>Want to see what runs now?</p>
        <Link href="/demos/antiky-town">Run Antiky Town <ArrowRight /></Link>
      </section>
    </>
  );
}
