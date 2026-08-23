import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import StudioPrimaryAction from '@/components/StudioPrimaryAction';
import { DISCORD_URL, STUDIO_RELEASES_READY } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Antiky Studio | Visual workspace for Antiky projects',
  description: 'Run a game beside a native terminal, simulation controls, inspection tools, and development activity in Antiky Studio.',
  alternates: { canonical: '/studio' },
};

const NEXT_STEPS = [
  ['Emerging', 'emerging', 'Packaged downloads', 'The macOS source build works today. Public downloads are still in progress.'],
  ['Planned', 'direction', 'Select a game object for an agent', 'Pass the selected object and its live context into a coding-agent conversation.'],
  ['Exploring', 'research-question', 'Workspaces that fit the task', 'Arrange tools for lighting, assets, simulation, debugging, and review.'],
] as const;

export default function StudioPage() {
  return (
    <>
      <section className="page-hero studio-hero wrap">
        <p className="status-line"><span className="status-dot status-live" /> {STUDIO_RELEASES_READY ? 'Early Studio release · details on GitHub' : 'Working macOS source build · no public download yet'}</p>
        <h1>Direct the work. Keep the game in view.</h1>
        <p className="page-lead">
          Antiky Studio is the native visual workspace for Antiky development. Run the game beside
          a terminal, control simulation, inspect live state, and review development activity in one
          window.
        </p>
        <div className="actions">
          <StudioPrimaryAction className="button button-primary" fallbackHref="/docs/getting-started/studio" fallbackLabel="Run Studio from source" />
          <Link className="text-link" href="/docs/studio/getting-started">Read the Studio guide <ArrowRight /></Link>
        </div>
      </section>

      <figure className="wide-media wrap evidence-figure studio-hero-media">
        <Image src="/media/studio/workspace-overview.webp" alt="Antiky Studio showing a running game, native terminal, structured inspection, and development activity in one window." width={1920} height={1200} sizes="(max-width: 760px) 100vw, 92vw" priority />
        <figcaption>Current source build · game, terminal, inspection, and activity</figcaption>
      </figure>

      <section className="content-section wrap" data-evidence-status="current">
        <header className="section-intro compact">
          <p className="section-label">Current</p>
          <h2>Open a project and work beside the running game.</h2>
          <p>The current source build supports the core Studio workflow.</p>
        </header>
        <div className="studio-proof-sequence">
          <article className="studio-proof-row">
            <div className="prose"><h3>Open an Antiky project</h3><p>Create a project, choose an existing <code>.antiky</code> file, or return to a recent project.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/project-launcher.webp" alt="Antiky Studio project launcher with Create project, Open project, and Recent projects choices." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Project launcher · create, open, or return</figcaption></figure>
          </article>
          <article className="studio-proof-row text-only">
            <div className="prose"><h3>Keep the game and terminal together</h3><p>Studio starts the local game and development tools for the selected project. The native terminal opens in that project, ready for your shell or coding agent.</p></div>
          </article>
          <article className="studio-proof-row">
            <div className="prose"><h3>Control simulation time</h3><p>Pause, resume, advance one frame, restart, or stop the game without leaving the workspace.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/simulation-controls.webp" alt="Antiky Studio showing a paused game with Pause, Step, Restart, and Stop controls above the workspace." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Simulation controls · pause, step, restart, and stop</figcaption></figure>
          </article>
          <article className="studio-proof-row">
            <div className="prose"><h3>Inspect the running game</h3><p>Read the hierarchy, stores, snapshot, events, MCP calls, and diagnostics that the game and development tools publish.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/inspection-activity.webp" alt="Antiky Studio inspection and activity panels showing hierarchy, stores, events, MCP calls, and diagnostics." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Inspection and activity · live project information</figcaption></figure>
          </article>
        </div>
        <Link className="text-link section-link" href="/docs/getting-started/studio">Open Antiky Town in Studio <ArrowRight /></Link>
      </section>

      <section className="content-section studio-session-section studio-session-boundary">
        <div className="wrap split-heading">
          <div><p className="section-label">One project session</p><h2>Studio, the CLI, and agent tools see the same game.</h2></div>
          <div className="prose">
            <p className="lead">Each tool connects to the same local game, build status, inspection data, and commands.</p>
            <p>Inspection is read-only. Simulation controls and checked game commands make deliberate changes.</p>
            <Link className="text-link section-link" href="/docs/studio/development-connection">See how Studio connects <ArrowRight /></Link>
          </div>
        </div>
        <div className="wrap studio-session-map" aria-label="CLI, Studio, and MCP connect to one local project session for the game, build, inspection, and tools.">
          <div className="studio-session-clients"><span><b>CLI</b><small>Terminal</small></span><span><b>Studio</b><small>Visual workspace</small></span><span><b>MCP</b><small>Agent tools</small></span></div>
          <span className="studio-session-line" aria-hidden="true" />
          <div className="studio-session-runtime"><span className="status-dot status-live" /><span><b>Project session</b><small>Game · build · inspection · tools</small></span></div>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact"><h2>What we are building next</h2><p>The workspace works from source today. These additions come later.</p></header>
        <div className="editorial-list">
          {NEXT_STEPS.map(([status, evidenceStatus, title, body]) => (
            <div className="editorial-row static studio-status-row" data-evidence-status={evidenceStatus} key={status}>
              <span className="row-status">{status}</span><span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Independent games</p><h2>Your game does not depend on Studio.</h2></div>
        <div className="prose">
          <p className="lead">Use Studio while developing, then build, test, and ship the game on its own.</p>
          <Link className="text-link section-link" href="/framework">Explore Antiky Framework <ArrowRight /></Link>
        </div>
      </section>

      <section className="studio-availability">
        <div className="wrap studio-availability-grid">
          <div><p className="section-label">Availability</p><h2>{STUDIO_RELEASES_READY ? 'Download the current Studio release.' : 'Run Studio from source.'}</h2></div>
          <div className="prose">
            <p className="lead">{STUDIO_RELEASES_READY ? 'Downloadable builds and release notes are on GitHub.' : 'There is no public download yet. The tutorial starts the working macOS app from the repository.'}</p>
            <StudioPrimaryAction className="button button-primary" fallbackHref="/docs/getting-started/studio" fallbackLabel="Run Studio from source" />
          </div>
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Try the current Studio workspace.</p>
        <StudioPrimaryAction className="closing-action" fallbackHref="/docs/getting-started/studio" fallbackLabel="Run Studio from source" />
        <a href={DISCORD_URL} target="_blank" rel="noreferrer">Join the Studio discussion <ArrowUpRight /></a>
      </section>
    </>
  );
}
