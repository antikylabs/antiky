import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Studio',
  description:
    'Antiky Studio keeps project launch, the running game, a native terminal, simulation controls, and live runtime state together.',
  alternates: { canonical: canonical('/studio') },
};

const CAPABILITIES = [
  {
    number: '01',
    title: 'Start from the project launcher',
    body: 'Create a project, open an existing project, or return to a recent project from the screen that appears at startup.',
  },
  {
    number: '02',
    title: 'Work beside the running game',
    body: 'Studio starts the local development services and keeps the configured game beside a native terminal with a compact prompt.',
  },
  {
    number: '03',
    title: 'Control simulation time',
    body: 'Pause, resume, step, restart, or stop the current development session without leaving the workspace.',
  },
  {
    number: '04',
    title: 'Inspect published game state',
    body: 'Use Hierarchy, Stores, and Snapshot views for semantic state. Review Events, MCP calls, and Diagnostics in the activity panel.',
  },
  {
    number: '05',
    title: 'Keep renderer choice in the game',
    body: 'The shared game host can run Antiky Framework, pure BroMetal, Three.js, or other browser renderers that follow the game-module contract.',
  },
] as const;

export default function StudioPage() {
  return (
    <>
      <section className="page-hero studio-hero wrap">
        <div className="status-line">
          <span className="status-dot status-emerging" />
          macOS source-development build
        </div>
        <h1>Your game and its living state. One workspace.</h1>
        <p className="page-lead">
          Antiky Studio brings project launch, the running game, a native terminal,
          simulation controls, and structured runtime inspection into one workspace.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/docs/studio/getting-started">
            Open Studio docs <ArrowRight />
          </Link>
          <Link className="text-link" href="/docs/studio/development-connection">
            How Studio connects <ArrowRight />
          </Link>
        </div>
      </section>

      <figure className="studio-showcase wrap" aria-labelledby="studio-workspace-caption">
        <div className="studio-capture">
          <Image
            src="/media/antiky-studio-workspace.jpeg"
            alt="Antiky Studio native workspace with a running game, terminal, inspection views, and development activity"
            width={1228}
            height={768}
            sizes="(max-width: 760px) 100vw, min(1228px, 92vw)"
            priority
          />
        </div>
        <figcaption id="studio-workspace-caption">
          Real Antiky Studio source build · native macOS workspace
        </figcaption>
      </figure>

      <section className="content-section studio-session-section">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Project start</p>
            <h2>Open a project and begin in Studio.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Create a project, choose an existing folder, or reopen a recent project from the default launcher.
            </p>
            <p>
              Studio starts the local development services for the selected project. The native
              terminal is ready with a compact <code>%</code> prompt, so it does not expose a user or machine name.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section studio-session-section studio-session-boundary">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Shared development session</p>
            <h2>One game. One source of truth.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Studio does not start a second renderer or read terminal output to understand the game.
            </p>
            <p>
              Studio, the command-line interface, and connected agents use the same typed development services.
              Each client sees the same running project session.
            </p>
          </div>
        </div>

        <div className="wrap studio-session-map" aria-label="CLI, Studio, and MCP share one Antiky development session">
          <div className="studio-session-clients">
            <span><b>CLI</b><small>Terminal workflow</small></span>
            <span><b>Studio</b><small>Visual workspace</small></span>
            <span><b>MCP</b><small>Agent tools</small></span>
          </div>
          <span className="studio-session-line" aria-hidden="true" />
          <div className="studio-session-runtime">
            <span className="status-dot status-live" />
            <span><b>Project services</b><small>Game · inspection · tools</small></span>
          </div>
        </div>
      </section>

      <section className="content-section wrap studio-capabilities">
        <header className="section-intro compact">
          <h2>Built around the development loop</h2>
          <p>Each current surface answers a practical question about the project that runs in front of you.</p>
        </header>
        <div className="studio-feature-list">
          {CAPABILITIES.map((capability) => (
            <article key={capability.number} className="studio-feature-row">
              <span>{capability.number}</span>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="studio-availability">
        <div className="wrap studio-availability-grid">
          <div>
            <p className="section-label">Current availability</p>
            <h2>Built for development. Available from source.</h2>
          </div>
          <div className="prose">
            <p className="lead">Studio currently runs as a macOS source-development build.</p>
            <p>
              Inspector views are read-only. Simulation controls and approved MCP commands can change the running game,
              and release packaging is not available yet.
            </p>
            <p>
              Antiky Framework projects can publish the richest semantic inspection data. Renderer-only projects keep
              generic lifecycle data, measurements that they report, reload, and canvas capture.
            </p>
            <Link className="text-link" href="/docs/studio/getting-started">
              Get started from source <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
