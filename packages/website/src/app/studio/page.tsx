import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import StudioPrimaryAction from '@/components/StudioPrimaryAction';
import { DISCORD_URL, STUDIO_RELEASES_READY } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Antiky Studio | Visual workspace for Antiky projects',
  description: 'Native visual workspace for running Antiky projects, controlling simulation, inspecting live game state, and directing human-agent development.',
  alternates: { canonical: '/studio' },
};

const STATUS_GROUPS = [
  ['Current', 'current', 'A working native workspace', 'Project launch, recent projects, a live game, native terminal, simulation controls, structured inspection, activity history, and settings work in the current macOS source build.'],
  ['Emerging', 'emerging', 'The first packaged Studio release', 'Packaging is still in progress. There is no public download yet.'],
  ['Planned', 'direction', 'Exact-target feedback and native agent conversation', 'Select something in the running game, carry its context into a coding agent, and keep feedback attached to that target.'],
  ['Exploring', 'research-question', 'Task-specific workspaces and durable feedback', 'We are exploring flexible workspaces, saved feedback, reusable viewports, accessibility, and support beyond macOS.'],
] as const;

export default function StudioPage() {
  return (
    <>
      <section className="page-hero studio-hero wrap">
        <p className="status-line"><span className="status-dot status-live" /> {STUDIO_RELEASES_READY ? 'Early Studio release · details on GitHub' : 'Current macOS source build · packaged downloads are not public yet'}</p>
        <h1>Direct the work. Keep the game in view.</h1>
        <p className="page-lead">
          Antiky Studio is the native visual workspace for Antiky development. It keeps project
          launch, the running game, a native terminal, simulation controls, structured inspection,
          and development activity together, so you can see what is happening, direct the next
          change, and keep the shared project state in view.
        </p>
        <div className="actions">
          <StudioPrimaryAction className="button button-primary" fallbackHref="/docs/studio/getting-started" fallbackLabel="Run Studio from source" />
          <Link className="text-link" href="/docs/studio/getting-started">Read the Studio docs <ArrowRight /></Link>
        </div>
        <p className="review-date">Current workspace reviewed 2026-08-21</p>
      </section>

      <figure className="wide-media wrap evidence-figure studio-hero-media">
        <Image src="/media/studio/workspace-overview.webp" alt="Antiky Studio showing a running game in the main viewport, a native terminal below it, structured inspection on the right, and development activity along the bottom." width={1920} height={1200} sizes="(max-width: 760px) 100vw, 92vw" priority />
        <figcaption>Current source build · one project workspace with the game, terminal, inspection, and activity visible together.</figcaption>
      </figure>

      <section className="content-section wrap">
        <header className="section-intro compact">
          <p className="section-label">Current</p>
          <h2>Open a project and work beside the running game.</h2>
          <p>Studio is early and its layout is fixed, but the core development loop is real.</p>
        </header>
        <div className="studio-proof-sequence">
          <article className="studio-proof-row">
            <div className="prose"><span className="row-status">01 · Current</span><h3>Start with the project</h3><p>Create a project, open an existing <code>.antiky</code> manifest, or return to a recent project. Studio validates it before replacing the current workspace.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/project-launcher.webp" alt="Antiky Studio project launcher with actions to create a project, open a project, and reopen a recent project." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Current launcher · create, open, or return to one validated Antiky project.</figcaption></figure>
          </article>
          <article className="studio-proof-row text-only">
            <div className="prose"><span className="row-status">02 · Current</span><h3>See the game and terminal together</h3><p>Studio starts the same local project services used by the command-line interface (CLI). The configured game runs beside a native terminal with a compact prompt that does not expose the user or machine name.</p></div>
          </article>
          <article className="studio-proof-row">
            <div className="prose"><span className="row-status">03 · Current</span><h3>Control simulation time</h3><p>Pause, resume, step, restart, or stop the development session. A single step advances exactly one presented frame.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/simulation-controls.webp" alt="Antiky Studio with the running game paused and the Pause, Step, Restart, and Stop controls visible above the workspace." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Current controls · the paused session remains available for inspection and one-frame stepping.</figcaption></figure>
          </article>
          <article className="studio-proof-row">
            <div className="prose"><span className="row-status">04 · Current</span><h3>Inspect what the game publishes</h3><p>Use Hierarchy, Stores, and Snapshot views for semantic state. Review Events, Model Context Protocol (MCP) calls, and Diagnostics in the activity panel. Inspection is read-only.</p></div>
            <figure className="evidence-figure"><Image src="/media/studio/inspection-activity.webp" alt="Antiky Studio inspection and activity panels showing game hierarchy, structured store data, event history, MCP calls, and diagnostics." width={1600} height={1000} sizes="(max-width: 900px) 100vw, 54vw" /><figcaption>Current inspection · structured projections and activity from the same running project session.</figcaption></figure>
          </article>
        </div>
        <Link className="text-link section-link" href="/docs/studio/getting-started">Follow the current Studio guide <ArrowRight /></Link>
      </section>

      <section className="content-section studio-session-section studio-session-boundary">
        <div className="wrap split-heading">
          <div><p className="section-label">Shared development session</p><h2>Studio sees the same game as the CLI and the agent.</h2></div>
          <div className="prose">
            <p className="lead">CLI project services own the local build, game host, inspection service, MCP endpoint, and cleanup. Studio calls the same service library directly.</p>
            <p>Engine state stays distinct from build and connection state. Inspection stays read-only. Only simulation controls and approved Framework commands can change game state.</p>
            <Link className="text-link section-link" href="/docs/studio/development-connection">See how Studio connects <ArrowRight /></Link>
          </div>
        </div>
        <div className="wrap studio-session-map" aria-label="CLI, Studio, and MCP connect to one local project-service session for the game, build, inspection, and tools.">
          <div className="studio-session-clients"><span><b>CLI</b><small>Terminal workflow</small></span><span><b>Studio</b><small>Visual workspace</small></span><span><b>MCP</b><small>Agent tools</small></span></div>
          <span className="studio-session-line" aria-hidden="true" />
          <div className="studio-session-runtime"><span className="status-dot status-live" /><span><b>Project services</b><small>Game · build · inspection · tools</small></span></div>
        </div>
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="direction">
        <div><p className="section-label">Planned · visual selection</p><h2>Point at what you mean.</h2></div>
        <div className="prose">
          <p className="lead">Studio's long-term job is to help a person select the exact thing that matters and give an agent precise creative direction with the relevant context attached.</p>
          <p>Stable entity selection, click-to-agent context, and feedback attached to an exact target are planned but not available in the current workspace.</p>
        </div>
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="direction">
        <div><p className="section-label">Planned · agent connections</p><h2>Use the coding agent you already have.</h2></div>
        <div className="prose">
          <p className="lead">Studio is intended to connect to compatible coding agents people already use, with their existing provider, account, and plan.</p>
          <p>Native Agent Client Protocol (ACP) conversations and selected-entity context are planned but not available in the current workspace.</p>
        </div>
      </section>

      <section className="statement-band" data-evidence-status="research-question">
        <div className="wrap statement-grid">
          <h2>The workspace should change with the task.</h2>
          <div>
            <p className="section-label">Exploring</p>
            <p className="lead">Lighting, assets, simulation, and debugging need different arrangements and evidence.</p>
            <p>We are exploring task-specific workspaces that rearrange Studio around the work. The current version has four resizable panels.</p>
          </div>
        </div>
      </section>

      <section className="content-section wrap split-heading" data-evidence-status="direction">
        <div><p className="section-label">Planned · contextual feedback</p><h2>Keep feedback attached to what you meant.</h2></div>
        <div className="prose">
          <p className="lead">Select a target, leave feedback on the state you saw, and keep that context with the conversation.</p>
          <p>Saved feedback, attachments, and review tools are planned but not available in the current source build.</p>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Independent games</p><h2>Your game does not depend on Studio.</h2></div>
        <div className="prose">
          <p className="lead">Framework games build, run, test, and ship without Studio.</p>
          <p>Use Studio while developing, then build, run, test, and ship the game on its own.</p>
          <Link className="text-link section-link" href="/framework">Explore Antiky Framework <ArrowRight /></Link>
        </div>
      </section>

      <section className="content-section wrap studio-status-boundary">
        <header className="section-intro compact"><h2>What is current, and what comes next</h2><p>See what works today and what is planned.</p></header>
        <div className="editorial-list">
          {STATUS_GROUPS.map(([status, evidenceStatus, title, body]) => (
            <div className="editorial-row static studio-status-row" data-evidence-status={evidenceStatus} key={status}>
              <span className="row-status">{status}</span><span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-availability">
        <div className="wrap studio-availability-grid">
          <div><p className="section-label">Current availability</p><h2>{STUDIO_RELEASES_READY ? 'Start with the release that fits your system.' : 'Run Studio from the current source build.'}</h2></div>
          <div className="prose">
            <p className="lead">{STUDIO_RELEASES_READY ? 'Downloadable builds are distributed through GitHub Releases. Check the selected release for platform, installation, release notes, and limitations.' : 'Packaged downloads are not public yet. The current guide explains how to run the working macOS workspace from the repository.'}</p>
            <StudioPrimaryAction className="button button-primary" fallbackHref="/docs/studio/getting-started" fallbackLabel="Run Studio from source" />
          </div>
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Keep the game close to the conversation.</p>
        <StudioPrimaryAction className="closing-action" fallbackHref="/docs/studio/getting-started" fallbackLabel="Run Studio from source" />
        <Link href="/docs/studio/getting-started">Read the Studio docs <ArrowRight /></Link>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer">Join the Studio discussion <ArrowUpRight /></a>
      </section>
    </>
  );
}
