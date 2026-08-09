import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import DemoStage from '@/components/DemoStage';
import { BROMETAL_URL, BROMETAL_VERSION } from '@/lib/site';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';

export const metadata: Metadata = {
  title: 'Antiky Framework',
  description:
    'The pre-release headless game-session and structured-state foundation behind Antiky development tools and current Framework studies.',
  alternates: { canonical: '/framework' },
};

const CAPABILITIES = [
  ['Fixed-step sessions', 'Run game systems on a predictable clock with pause, resume, single-step controls, explicit inputs, and fail-closed faults.'],
  ['Stable identity', 'Keep public world, session, entity, command, and event identities stable across the development boundary.'],
  ['Structured inspection', 'Publish immutable lifecycle, session, hierarchy, store, event, diagnostic, and measurement snapshots for tools and tests.'],
  ['Bounded authoring', 'Use validated commands for the current point-light authoring slice instead of letting inspection mutate state.'],
  ['Portable game modules', 'Keep game code separate from browser, Studio, CLI, and website hosts so the same module can run in different delivery contexts.'],
] as const;

export default function FrameworkPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-emerging" /> Pre-release · working foundation</p>
        <h1>A headless foundation for a game tools can understand.</h1>
        <p className="page-lead">
          Antiky Framework owns game sessions, identity, structured inspection, and bounded state
          changes beneath Studio, CLI, MCP, direct clients, and the current Framework studies.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/docs/framework/engine-sessions">
            Read Framework docs <ArrowRight />
          </Link>
          <Link className="text-link" href="/demos/antiky-town">Run Antiky Town <ArrowUpRight /></Link>
        </div>
      </section>

      <section className="wide-media wrap" aria-label="Antiky Town preview">
        <DemoStage
          slug="antiky-town"
          controlMode="move"
          label="Antiky Town — live Framework experiment"
        />
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="current">
        <div>
          <p className="section-label">Current boundary</p>
          <h2>Narrow, working, and still pre-release.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Framework is not a complete engine and it has no stable package release today.
          </p>
          <p>
            The current source implements a focused foundation: fixed-step EngineSession behavior,
            UUIDv7 identities, immutable inspection snapshots, portable game-module contracts, and
            a point-light command and correction flow. The public API documentation records the exact
            surface that exists.
          </p>
          <p>
            Broader world systems, abilities, persistence, online authority, physics, sandboxes, and
            agent workflows remain architectural direction until working public slices earn those
            claims.
          </p>
        </div>
      </section>

      <section className="content-section wrap" data-evidence-status="current">
        <header className="section-intro compact">
          <h2>What works now</h2>
          <p>Concrete development behavior, kept deliberately smaller than a general-purpose engine.</p>
        </header>
        <div className="editorial-list">
          {CAPABILITIES.map(([title, body]) => (
            <div className="editorial-row static" key={title}>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="emerging">
        <div>
          <p className="section-label">One development model</p>
          <h2>Shared services, different clients.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            CLI project services start and supervise one local development session. Studio uses the
            same library path; MCP and typed clients adapt the same inspection and tool boundaries.
          </p>
          <p>
            That makes the running project legible from several workflows without giving each client
            its own engine rules. The shared foundation exists. The broader human-agent creation
            experience is still being built.
          </p>
          <Link className="text-link section-link" href="/docs/cli/development">See the development session <ArrowRight /></Link>
        </div>
      </section>

      <figure className="framework-architecture wrap" aria-labelledby="framework-architecture-caption">
        <Image
          src="/media/antiky-architecture.png"
          alt="Diagram of the Antiky target architecture from game hosts through engine state and execution"
          width={1672}
          height={941}
          sizes="(max-width: 760px) 100vw, 92vw"
        />
        <figcaption id="framework-architecture-caption">
          Antiky target architecture · accepted direction, not a list of completed features
        </figcaption>
      </figure>

      <section className="statement-band" data-evidence-status="direction">
        <div className="wrap statement-grid">
          <h2>Rendering is one layer, not the identity.</h2>
          <div>
            <p className="lead">2D, 3D, and 2.3D are creative possibilities.</p>
            <p>
              BroMetal {BROMETAL_VERSION} is the current Framework render driver and remains an
              important part of the work. Pure BroMetal and Three.js studies also use the portable
              host boundary. Renderer choice does not own game rules, session state, or development
              authority.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/demos">Compare the studies <ArrowRight /></Link>
              <a className="text-link" href={BROMETAL_URL} target="_blank" rel="noreferrer">
                Explore BroMetal <ArrowUpRight />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>The visual expression of this foundation lives in Studio.</p>
        <Link href="/studio">Explore Antiky Studio <ArrowRight /></Link>
      </section>
    </>
  );
}
