import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Games',
  description: 'The games that give Antiky its questions: Antiky Town today, and Emberwyrd as the larger test ahead.',
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
          Antiky Labs is building technology in service of games. Antiky Town is the current working
          proof. Emberwyrd is the larger creative and technical test ahead.
        </p>
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="current">
        <div>
          <p className="section-label">Current proof</p>
          <h2>Antiky Town runs today.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Antiky Town is a runnable Framework study with stable light identity, structured runtime
            state, and a visible point-light authoring slice.
          </p>
          <p>
            Seven focused studies alongside it isolate rendering, shaders, and portable-host
            questions. They are working evidence, not production games or substitutes for
            Emberwyrd.
          </p>
          <Link className="text-link section-link" href="/demos/antiky-town">
            Run Antiky Town <ArrowRight />
          </Link>
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
            Emberwyrd is a character-first online fantasy action RPG—and the reason Antiky exists.
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
        <Link href="/demos/antiky-town">Explore Antiky Town <ArrowRight /></Link>
      </section>
    </>
  );
}
