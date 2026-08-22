import type { Metadata } from 'next';
import Link from 'next/link';
import DemoPoster from '@/components/DemoPoster';
import FrameworkArchitecture from '@/components/FrameworkArchitecture';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { DEMOS } from '@/lib/demos';
import { BROMETAL_URL, BROMETAL_VERSION } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Antiky Framework | Headless TypeScript game framework',
  description: 'Open-source, headless TypeScript game framework where humans, agents, tools, and tests inspect and change one game through explicit interfaces.',
  alternates: { canonical: '/framework' },
};

const TOWN = DEMOS.find((demo) => demo.slug === 'antiky-town')!;

const CAPABILITIES = [
  ['Fixed-step sessions', 'Run game systems on a predictable clock with explicit input, ordered commands, pause, resume, single-step control, and fail-closed faults.'],
  ['Stable public identity', 'Refer to worlds, sessions, entities, commands, and events with durable identifiers instead of screen coordinates or temporary render slots.'],
  ['Structured inspection', 'Read immutable lifecycle, session, hierarchy, store, event, diagnostic, and measurement snapshots without handing a client the live world.'],
  ['Controlled authoring', 'Change and correct point-light power through validated commands with expected revisions. Read access stays separate from write access.'],
  ['Portable game modules', 'Keep game rules, systems, shaders, and assets separate from the browser, Studio, command-line interface (CLI), and website hosts.'],
] as const;

const BOUNDARIES = [
  ['Current', 'current', 'Sessions, identity, inspection, capture, and light editing', 'These capabilities are available in the current source, documentation, and playable studies.'],
  ['Emerging', 'emerging', 'A broader Framework-owned BroMetal render path', 'Current demos use the first driver path. More rendering work still lives inside individual games.'],
  ['Planned', 'direction', 'World services, sandboxes, selection, physics, abilities, and online play', 'These areas are planned, but they are not current Framework features or release promises.'],
  ['Pre-release', 'direction', 'No stable npm package or API guarantee yet', 'The repository is open and current behavior is documented, but package publication, versioning, and compatibility policy are still open decisions.'],
] as const;

export default function FrameworkPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-emerging" /> Pre-release · open source · working foundation</p>
        <h1>Build games that can explain themselves.</h1>
        <p className="page-lead">
          Antiky Framework is an open-source TypeScript game framework that runs without Studio. It
          lets you and software agents inspect, run, test, and change the same game through explicit
          interfaces. It powers Antiky Studio, command-line tools, agent tools, and Antiky Labs games.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/docs/framework/engine-sessions">Read the Framework docs <ArrowRight /></Link>
          <Link className="text-link" href="/demos">Run the Framework studies <ArrowUpRight /></Link>
        </div>
        <p className="review-date">Technical claims reviewed 2026-08-21</p>
      </section>

      <figure className="wide-media wrap evidence-figure">
        <DemoPoster demo={TOWN} priority />
        <figcaption>Antiky Town runs as a portable Framework game module and renders through BroMetal.</figcaption>
      </figure>

      <section className="content-section wrap split-heading">
        <div>
          <p className="section-label">Why AI-native starts below the interface</p>
          <h2>The agent is a user of the engine.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Most game engines expect a person to interpret an editor, project, running game, and debugger.
            An agent usually arrives later and must reconstruct that truth from files, output, and screenshots.
          </p>
          <p>
            Antiky starts from a different requirement: the game must be able to tell an agent what
            is true. That changes the runtime, world model, development services, rendering boundary,
            and evidence the system produces. Generating code is useful. Understanding what it did is harder.
          </p>
          <blockquote>Give agents context before asking them to guess.</blockquote>
        </div>
      </section>

      <section className="statement-band" data-evidence-status="direction">
        <div className="wrap statement-grid">
          <h2>Change the game. Run it. Inspect the result. Prove what happened.</h2>
          <div>
            <p className="section-label">Direction</p>
            <p className="lead">
              The complete loop connects a controlled change to a repeatable run, semantic inspection,
              visual evidence, performance checks, and a human creative decision.
            </p>
            <p>
              Sessions, inspection, captures, project services, and narrow commands work today. The
              complete creator-agent workflow remains direction; a metric cannot decide whether a
              jump feels alive or a world is worth remembering.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section wrap" data-evidence-status="current">
        <header className="section-intro compact">
          <p className="section-label">Current · pre-release</p>
          <h2>What you can use today.</h2>
          <p>The current source covers a focused set of documented game and development features.</p>
        </header>
        <div className="editorial-list">
          {CAPABILITIES.map(([title, body]) => (
            <div className="editorial-row static" key={title}>
              <span className="row-status">Current</span>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
        <div className="thesis-links">
          <Link className="text-link" href="/docs/api/reference">Inspect the current API <ArrowRight /></Link>
          <a className="text-link" href="https://github.com/antikylabs/antiky/tree/main/packages/framework" target="_blank" rel="noreferrer">Inspect the Framework source <ArrowUpRight /></a>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Architectural choice</p><h2>One language from game logic to shader source.</h2></div>
        <div className="prose">
          <p className="lead">TypeScript gives builders and agents one coherent path across game logic, engine systems, browser hosts, Canvas, and WebGPU integration.</p>
          <p>
            BroMetal carries that idea onto the GPU. Its typed TypeScript shader domain-specific
            language compiles to WebGPU Shading Language (WGSL) before the game runs. WebGPU still
            creates graphics pipelines at runtime; ahead-of-time shader generation is not itself a performance claim.
          </p>
          <p>Framework games currently declare BroMetal {BROMETAL_VERSION} through package metadata.</p>
          <a className="text-link section-link" href={BROMETAL_URL} target="_blank" rel="noreferrer">Explore BroMetal <ArrowUpRight /></a>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Shared development model</p><h2>Every client meets the same game.</h2></div>
        <div className="prose">
          <p className="lead">Humans, agents, Studio, CLI project services, and tests meet the game through the same commands, queries, events, diagnostics, and visual captures.</p>
          <p>
            Model Context Protocol (MCP) adapts that contract into tools for an agent. It is not a
            second engine. Inspection stays read-only, and changes cross validated commands,
            expected revisions, and narrow grants.
          </p>
          <Link className="text-link section-link" href="/docs/cli/development">Read how the development session works <ArrowRight /></Link>
        </div>
      </section>

      <FrameworkArchitecture />

      <section className="content-section wrap split-heading">
        <div><p className="section-label">See what changed</p><h2>Inspect the result, not only the code.</h2></div>
        <div className="prose">
          <p className="lead">The same development session can publish structured state, diagnostics, measurements, captures, and limited event history.</p>
          <p>
            That evidence protects human judgment rather than replacing it. It can expose a broken
            frame, missed budget, or unexpected transition. It cannot make the creative call.
          </p>
        </div>
      </section>

      <section className="statement-band">
        <div className="wrap statement-grid">
          <h2>The game leads. The engine follows.</h2>
          <div>
            <p className="lead">Antiky Labs games are the Framework's first customer.</p>
            <p>
              We build complete game slices, find the systems that help across more than one game,
              and move those systems into Framework.
            </p>
            <Link className="text-link" href="/games">See the games and studies <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Headless by design</p><h2>Studio helps you see the work. Framework does not depend on it.</h2></div>
        <div className="prose">
          <p className="lead">A Framework game can build, run, test, host, and ship without Antiky Studio.</p>
          <p>Studio is a visual client over the same project services. It never becomes the engine or the source of game truth.</p>
          <Link className="text-link section-link" href="/studio">See the same session in Studio <ArrowRight /></Link>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact"><h2>Available now and planned</h2><p>See what works today and what is still ahead.</p></header>
        <div className="editorial-list">
          {BOUNDARIES.map(([status, evidenceStatus, title, body]) => (
            <div className="editorial-row static" data-evidence-status={evidenceStatus} key={status}>
              <span className="row-status">{status}</span>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Start with Framework today.</p>
        <Link href="/docs/framework/engine-sessions">Read the Framework docs <ArrowRight /></Link>
        <Link href="/demos/antiky-town">Run Antiky Town <ArrowRight /></Link>
        <Link href="/studio">Explore Antiky Studio <ArrowRight /></Link>
      </section>
    </>
  );
}
