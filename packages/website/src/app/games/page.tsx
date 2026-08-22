import type { Metadata } from 'next';
import Link from 'next/link';
import DemoPoster from '@/components/DemoPoster';
import { ArrowRight } from '@/components/Icons';
import { DEMOS } from '@/lib/demos';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Play Antiky Town and two Framework demos, then follow Combat Arena and Emberwyrd in development.',
  alternates: { canonical: '/games' },
};

const DIRECTIONS = [
  ['A memorable journey', 'Places, people, and mysteries worth caring about, not a world assembled to fill space.'],
  ['Tactile action', 'A compact, equipment-defined moveset where timing, range, facing, and commitment matter.'],
  ['Consequential travel', 'A world where goods come from somewhere, distance has weight, and risk is chosen rather than ambient.'],
];

export default function GamesPage() {
  return (
    <>
      <section className="page-hero games-hero wrap">
        <h1>Play what we are building.</h1>
        <p className="status-line"><span className="status-dot status-planned" /> Three playable demos · two games in development</p>
        <p className="page-lead">
          Play Antiky Town and two focused Framework demos in your browser. Combat Arena and
          Emberwyrd are in development.
        </p>
      </section>

      <section className="content-section games-current-section" data-evidence-status="current">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Playable now</p>
            <h2>{DEMOS.length} playable Framework demos.</h2>
          </div>
          <div className="prose">
            <p className="lead">Play three Framework studies in your browser.</p>
            <p>
              Antiky Town explores an authored world, Traversal Study focuses on movement, and Point
              Light Expo lets you edit lighting while the scene runs.
            </p>
            <Link className="text-link section-link" href="/demos">
              Play all demos <ArrowRight />
            </Link>
          </div>
        </div>
        <div className="game-proof-grid wrap">
          {DEMOS.map((demo) => (
            <article className="game-proof" key={demo.slug}>
              <div className="game-proof-media">
                <DemoPoster demo={demo} />
              </div>
              <p>Playable Framework demo</p>
              <h3><Link href={`/demos/${demo.slug}`}>{demo.title}</Link></h3>
              <p>{demo.tagline}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="content-section wrap split-heading"
        id="combat-arena"
        data-evidence-status="direction"
      >
        <div>
          <p className="section-label">In development</p>
          <h2>Combat Arena</h2>
        </div>
        <div className="prose">
          <p className="lead">A top-down space-combat prototype built with Antiky Framework.</p>
          <p>
            Dash through marked enemies, deflect incoming fire, and clear three authored rounds.
            There is no public browser build yet.
          </p>
        </div>
      </section>

      <section className="world-title" id="emberwyrd" data-evidence-status="direction">
        <div className="wrap">
          <p>Our game in development</p>
          <h2>Emberwyrd</h2>
          <span>In development · no playable release today</span>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div>
          <h2>A fantasy world built with Antiky.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Emberwyrd is a character-first fantasy action RPG about story, travel, risk, and consequence.
          </p>
          <p>
            It is still early and has no public build. We use the work to shape the Framework and
            Studio around the needs of a real game.
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
        <p>Start with our best playable demo.</p>
        <Link href="/demos/antiky-town">Play Antiky Town <ArrowRight /></Link>
      </section>
    </>
  );
}
