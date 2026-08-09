import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { canonical, DISCORD_URL, STUDIO_RELEASES_URL } from '@/lib/site';

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

const STATUS_GROUPS = [
  {
    status: 'Current',
    evidenceStatus: 'current',
    title: 'A working native workspace',
    body: 'Project launch, the running game, a native terminal, simulation controls, structured inspection, and activity views work in the current source build.',
  },
  {
    status: 'Emerging',
    evidenceStatus: 'emerging',
    title: 'Early packaged releases',
    body: 'Packaged Studio builds are the site-launch distribution path. Each GitHub release is the authority for its version, supported platforms, installation notes, and limitations.',
  },
  {
    status: 'Direction',
    evidenceStatus: 'direction',
    title: 'Richer creator-agent collaboration',
    body: 'Exact-target feedback, broader bounded authoring, experiments, review, and explicit promotion remain architectural direction—not current Studio capability.',
  },
] as const;

export default function StudioPage() {
  return (
    <>
      <section className="page-hero studio-hero wrap">
        <div className="status-line">
          <span className="status-dot status-emerging" />
          Early Studio · release details on GitHub
        </div>
        <h1>Your game and its living state. One workspace.</h1>
        <p className="page-lead">
          Antiky Studio brings project launch, the running game, a native terminal,
          simulation controls, and structured runtime inspection into one workspace.
        </p>
        <div className="actions">
          <a className="button button-primary" href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">
            Download Studio <ArrowUpRight />
          </a>
          <Link className="text-link" href="/docs/studio/getting-started">Open Studio docs <ArrowRight /></Link>
          <a className="text-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
            Get help on Discord <ArrowUpRight />
          </a>
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
          Real Antiky Studio workspace · current source build
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
            <Link className="text-link section-link" href="/docs/studio/development-connection">
              How Studio connects <ArrowRight />
            </Link>
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

      <section className="content-section wrap studio-status-boundary">
        <header className="section-intro compact">
          <h2>Current, emerging, and ahead</h2>
          <p>The product boundary stays visible as Studio grows.</p>
        </header>
        <div className="editorial-list">
          {STATUS_GROUPS.map((group) => (
            <div
              className="editorial-row static studio-status-row"
              data-evidence-status={group.evidenceStatus}
              key={group.status}
            >
              <span className="row-status">{group.status}</span>
              <span className="row-copy"><strong>{group.title}</strong><span>{group.body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-availability">
        <div className="wrap studio-availability-grid">
          <div>
            <p className="section-label">Current availability</p>
            <h2>Start with the release that fits your system.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Downloadable builds are distributed through GitHub Releases. Check the selected
              release for platform support, installation guidance, version, and known limitations.
            </p>
            <p>
              Inspector views are read-only. Simulation controls and approved MCP commands can
              change the running game through their defined boundaries.
            </p>
            <p>
              Antiky Framework projects can publish the richest semantic inspection data. Renderer-only projects keep
              generic lifecycle data, measurements that they report, reload, and canvas capture.
            </p>
            <div className="thesis-links">
              <a className="button button-primary" href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">
                Download Studio <ArrowUpRight />
              </a>
              <Link className="text-link" href="/docs/studio/getting-started">Follow the first-run guide <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
