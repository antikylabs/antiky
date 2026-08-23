import type { Metadata } from 'next';
import Link from 'next/link';
import DemoPoster from '@/components/DemoPoster';
import FrameworkArchitecture from '@/components/FrameworkArchitecture';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { DEMOS } from '@/lib/demos';
import { BROMETAL_URL, BROMETAL_VERSION } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Antiky Framework | Headless TypeScript game framework',
  description: 'Open-source TypeScript game framework for running, testing, inspecting, and editing a game from Studio, the CLI, or agent tools.',
  alternates: { canonical: '/framework' },
};

const TOWN = DEMOS.find((demo) => demo.slug === 'antiky-town')!;

const CAPABILITIES = [
  ['Predictable game time', 'Run systems on a fixed clock, then pause, resume, or advance the game one step at a time.'],
  ['Stable identities', 'Refer to worlds, sessions, entities, commands, and events without relying on screen positions or temporary render slots.'],
  ['Live inspection', 'Read the hierarchy, stores, events, diagnostics, measurements, and session state that a game publishes.'],
  ['Safe editing tools', 'Change point-light power through checked commands while read-only tools remain read-only.'],
  ['Portable game modules', 'Keep game code separate from the browser, Studio, CLI, and website that host it during development.'],
] as const;

const AVAILABILITY = [
  ['Current', 'current', 'Sessions, inspection, capture, and light editing', 'These features work in the source repository, docs, and public demos.'],
  ['Emerging', 'emerging', 'More shared rendering support', 'The demos use the first Framework-owned BroMetal driver while some rendering code still belongs to each game.'],
  ['Direction', 'direction', 'World tools, selection, physics, abilities, and online play', 'These are areas we want to build, not features you can use today.'],
  ['Pre-release', 'direction', 'Source access, without a stable package yet', 'The APIs can change and there is no stable npm release or compatibility promise yet.'],
] as const;

export default function FrameworkPage() {
  return (
    <>
      <section className="page-hero wrap">
        <p className="status-line"><span className="status-dot status-emerging" /> Pre-release · open source</p>
        <h1>Build games that people and agents can inspect together.</h1>
        <p className="page-lead">
          Antiky Framework is an open-source TypeScript game framework. It runs without Studio and
          gives the CLI, Studio, tests, and coding agents a shared way to run and understand a game.
        </p>
        <div className="actions">
          <Link className="button button-primary" href="/docs/getting-started/framework">Run Antiky Town from source <ArrowRight /></Link>
          <Link className="text-link" href="/demos">Play the browser demos <ArrowUpRight /></Link>
        </div>
      </section>

      <figure className="wide-media wrap evidence-figure">
        <DemoPoster demo={TOWN} priority />
        <figcaption>Antiky Town · a playable Framework game rendered through BroMetal</figcaption>
      </figure>

      <section className="content-section wrap" data-evidence-status="current">
        <header className="section-intro compact">
          <p className="section-label">Available now</p>
          <h2>Start with the working foundation.</h2>
          <p>Use these features from the source repository today.</p>
        </header>
        <div className="editorial-list">
          {CAPABILITIES.map(([title, body]) => (
            <div className="editorial-row static" key={title}>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
        <div className="thesis-links">
          <Link className="text-link" href="/docs/framework/game-modules">Build a game module <ArrowRight /></Link>
          <Link className="text-link" href="/docs/api/reference">Browse the API <ArrowRight /></Link>
          <a className="text-link" href="https://github.com/antikylabs/antiky/tree/main/packages/framework" target="_blank" rel="noreferrer">Open the source <ArrowUpRight /></a>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">One local session</p><h2>See the same game from every tool.</h2></div>
        <div className="prose">
          <p className="lead">Studio, the CLI, tests, and MCP tools read the same running game and development status.</p>
          <p>
            A coding agent can check a build, inspect the world, capture a frame, or use an approved
            command without scraping the editor or guessing from terminal text.
          </p>
          <Link className="text-link section-link" href="/docs/getting-started/tools">Try the development tools <ArrowRight /></Link>
        </div>
      </section>

      <FrameworkArchitecture />

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Rendering</p><h2>Use TypeScript from game logic to shader source.</h2></div>
        <div className="prose">
          <p className="lead">Antiky games use BroMetal {BROMETAL_VERSION} for typed WebGPU rendering.</p>
          <p>
            BroMetal compiles its TypeScript shader language to WebGPU Shading Language before the
            game runs. Framework keeps rendering separate from game rules so that other renderers
            can use the same game-module host.
          </p>
          <a className="text-link section-link" href={BROMETAL_URL} target="_blank" rel="noreferrer">Explore BroMetal <ArrowUpRight /></a>
        </div>
      </section>

      <section className="content-section wrap split-heading">
        <div><p className="section-label">Works without an editor</p><h2>Your game does not depend on Studio.</h2></div>
        <div className="prose">
          <p className="lead">Build, run, test, and ship a Framework game on its own.</p>
          <p>Studio is a visual workspace for development. It does not own the game or its runtime state.</p>
          <Link className="text-link section-link" href="/studio">See the same game in Studio <ArrowRight /></Link>
        </div>
      </section>

      <section className="content-section wrap">
        <header className="section-intro compact"><h2>What works now</h2><p>Antiky is useful from source, but it is still pre-release.</p></header>
        <div className="editorial-list">
          {AVAILABILITY.map(([status, evidenceStatus, title, body]) => (
            <div className="editorial-row static" data-evidence-status={evidenceStatus} key={status}>
              <span className="row-status">{status}</span>
              <span className="row-copy"><strong>{title}</strong><span>{body}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing-cta wrap">
        <p>Run the current Framework from source.</p>
        <Link href="/docs/getting-started/framework">Follow the tutorial <ArrowRight /></Link>
        <Link href="/demos/antiky-town">Play Antiky Town <ArrowRight /></Link>
      </section>
    </>
  );
}
