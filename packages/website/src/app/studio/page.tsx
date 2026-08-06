import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from '@/components/Icons';
import { canonical } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Studio',
  description:
    'Antiky Studio keeps your running game, terminal, simulation controls, and live runtime state together in one development workspace.',
  alternates: { canonical: canonical('/studio') },
};

const CAPABILITIES = [
  {
    number: '01',
    title: 'Work beside the running game',
    body: 'Keep the configured game and a native terminal in the same workspace. Start antiky dev without leaving Studio.',
  },
  {
    number: '02',
    title: 'Control simulation time',
    body: 'Pause, resume, or advance one step while inspecting the state produced by the current development session.',
  },
  {
    number: '03',
    title: 'Inspect semantic state',
    body: 'Browse the entity hierarchy, authoring and runtime stores, and a bounded development snapshot without reaching into private renderer objects.',
  },
  {
    number: '04',
    title: 'Understand what happened',
    body: 'Review accepted events, MCP tool calls, and current diagnostics through the same typed services used by the CLI.',
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
          Antiky Studio brings the running game, a native terminal, simulation controls,
          and structured runtime inspection into one focused development environment.
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
        <div className="studio-window">
          <header className="studio-titlebar">
            <span className="studio-product">
              <span className="studio-product-mark" aria-hidden="true">A</span>
              <span>Antiky Labs</span>
              <strong>Studio</strong>
            </span>
            <span className="studio-project">antiky-town</span>
            <span className="studio-connected"><i />Connected</span>
          </header>

          <div className="studio-toolbar">
            <span className="studio-toolbar-label">Simulation</span>
            <span className="studio-toolbar-control is-active">Pause</span>
            <span className="studio-toolbar-control">Resume</span>
            <span className="studio-toolbar-control">Step</span>
            <span className="studio-toolbar-runtime">Runtime 0.0.0 · Frame 18,204</span>
          </div>

          <div className="studio-workspace">
            <section className="studio-surface studio-terminal" aria-label="Embedded terminal">
              <div className="studio-surface-head">
                <span>Terminal</span>
                <span>zsh</span>
              </div>
              <div className="studio-terminal-body">
                <p><b>›</b> antiky dev</p>
                <p><span>[game]</span> ready on 127.0.0.1:3010</p>
                <p><span>[inspect]</span> development session connected</p>
                <p><span>[mcp]</span> tools ready</p>
                <p className="studio-terminal-cursor"><b>›</b><i /></p>
              </div>
            </section>

            <section className="studio-surface studio-game" aria-label="Live game view">
              <div className="studio-surface-head">
                <span>Live game</span>
                <span>127.0.0.1:3010</span>
              </div>
              <div className="studio-game-media">
                <Image
                  src="/media/town-study-poster.png"
                  alt="Pixel characters exploring a voxel town at golden hour"
                  fill
                  sizes="(max-width: 760px) 100vw, 55vw"
                />
                <span className="studio-game-state"><i />Connected</span>
              </div>
            </section>

            <section className="studio-surface studio-inspection" aria-label="Runtime inspection">
              <div className="studio-surface-head">
                <span>Inspection</span>
                <span>read-only</span>
              </div>
              <div className="studio-tabs"><b>Hierarchy</b><span>Stores</span><span>Snapshot</span></div>
              <div className="studio-tree">
                <p><span className="tree-caret">⌄</span><strong>Town Root</strong><small>scene</small></p>
                <p className="tree-child"><span className="tree-caret">⌄</span><strong>Harbor Lamp</strong><small>entity</small></p>
                <p className="tree-leaf"><span />Transform <small>component</small></p>
                <p className="tree-leaf"><span />Point Light <small>component</small></p>
                <p className="tree-child"><span className="tree-caret">›</span><strong>Market Square</strong><small>entity</small></p>
                <p className="tree-child"><span className="tree-caret">›</span><strong>Player</strong><small>entity</small></p>
              </div>
            </section>

            <section className="studio-surface studio-activity" aria-label="Development activity">
              <div className="studio-surface-head">
                <span>Activity</span>
                <span>retained</span>
              </div>
              <div className="studio-tabs"><b>Events</b><span>MCP calls</span><span>Diagnostics</span></div>
              <div className="studio-log">
                <p><time>15:42:08</time><span>simulation.paused</span><em>accepted</em></p>
                <p><time>15:42:05</time><span>point_light.updated</span><em>accepted</em></p>
                <p><time>15:41:59</time><span>runtime.connected</span><em>accepted</em></p>
              </div>
            </section>
          </div>

          <footer className="studio-statusbar">
            <span>Build <b>development</b></span>
            <span>Runtime <b>connected</b></span>
            <span>Draws <b>42</b></span>
            <span className="studio-status-spacer">Antiky Studio · source build</span>
          </footer>
        </div>
        <figcaption id="studio-workspace-caption">
          Current workspace map · illustrated from the shipped source-development interface
        </figcaption>
      </figure>

      <section className="content-section studio-session-section">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Shared development session</p>
            <h2>One game. One source of truth.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Studio does not start a second renderer or scrape terminal output to understand your game.
            </p>
            <p>
              The CLI, Studio, and connected agents use the same typed development services from
              <code> antiky dev</code>. What you inspect in one client is the same running session seen by the others.
            </p>
          </div>
        </div>

        <div className="wrap studio-session-map" aria-label="CLI, Studio, and MCP share one Antiky development session">
          <div className="studio-session-clients">
            <span><b>CLI</b><small>Human commands</small></span>
            <span><b>Studio</b><small>Visual workspace</small></span>
            <span><b>MCP</b><small>Agent tools</small></span>
          </div>
          <span className="studio-session-line" aria-hidden="true" />
          <div className="studio-session-runtime">
            <span className="status-dot status-live" />
            <span><b>antiky dev</b><small>Game · inspection · tools</small></span>
          </div>
        </div>
      </section>

      <section className="content-section wrap studio-capabilities">
        <header className="section-intro compact">
          <h2>Built around the development loop</h2>
          <p>Every current surface answers a practical question about the game running in front of you.</p>
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
              Inspection is read-only, and release packaging is not available yet. The getting-started
              guide covers the current setup, launch flow, and recovery behavior without promising unfinished editor features.
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
