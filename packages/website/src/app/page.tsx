import Link from 'next/link';
import { redirect } from 'next/navigation';
import ChangedAssumptionDiagram from '@/components/ChangedAssumptionDiagram';
import DemoStage from '@/components/DemoStage';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import StudioPrimaryAction from '@/components/StudioPrimaryAction';
import { BROMETAL_URL, DISCORD_URL } from '@/lib/site';

const SYSTEM = [
  {
    href: '/framework',
    status: 'Current foundation · pre-release',
    evidenceStatus: 'current',
    title: 'Framework',
    body: 'Build games with predictable simulation, live inspection, and tools that work from the CLI, Studio, or a coding agent.',
  },
  {
    href: '/studio',
    status: 'Current workspace · early',
    evidenceStatus: 'current',
    title: 'Antiky Studio',
    body: 'Keep the running game, native terminal, simulation controls, and live inspection in one window.',
  },
  {
    href: '/docs/cli/development',
    status: 'Current services · pre-release',
    evidenceStatus: 'current',
    title: 'CLI and project services',
    body: 'Start the game, build watcher, inspection, and MCP tools with one local command.',
  },
  {
    href: '/docs/mcp/overview',
    status: 'Current tools · more ahead',
    evidenceStatus: 'emerging',
    title: 'Agents',
    body: 'Let compatible coding agents inspect the running game and use its development tools.',
  },
] as const;

export default function HomePage() {
  const demoSlug = process.env.ANTIKY_DEMO_SLUG;
  if (demoSlug) redirect(`/demos/${demoSlug}`);

  return (
    <>
      <section className="home-hero" id="idea">
        <DemoStage slug="antiky-town" variant="hero" label="Antiky Town: a current Framework world with a golden-hour market, water, foliage, and live light authoring" />
        <div className="home-hero-copy">
          <h1>Build the world in your mind.<br />Stay in the director&apos;s chair.</h1>
          <p>
            Antiky Labs builds games and tools for creators working with coding agents. You choose
            the direction. Agents help you make, inspect, and test the game.
          </p>
          <div className="actions">
            <StudioPrimaryAction className="button button-primary" />
            <Link className="button button-secondary" href="/assets">Get free game assets <ArrowRight /></Link>
            <Link className="text-link" href="/thesis">Read the Thesis <ArrowRight /></Link>
          </div>
        </div>
        <p className="media-caption"><span>Playable now · Antiky Town</span> Live Framework world, light authoring, and BroMetal rendering</p>
      </section>

      <section className="content-section assumption-section" id="changed-assumption">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">The assumption that changed</p>
            <h2>The tools were built around one kind of participant.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Most game tools expect a person to gather context from the editor, project files,
              running game, and debugger.
            </p>
            <p>
              Antiky gives people and coding agents shared game state, commands, diagnostics, and
              captures so they can work from the same information.
            </p>
            <Link className="text-link section-link" href="/thesis">Follow the full argument <ArrowRight /></Link>
          </div>
        </div>
        <ChangedAssumptionDiagram />
      </section>

      <section className="statement-band" id="creative-agency">
        <div className="wrap statement-grid">
          <h2>AI should increase creative agency, not replace it.</h2>
          <div>
            <p className="lead">We do not want a button that says “make game.”</p>
            <p>
              The creator imagines the world, sets direction, makes judgments, and authorizes change.
              Agents can help explore, implement, test, and iterate. The goal is not to remove people
              from game development. It is to help more people make the work only they can direct.
            </p>
          </div>
        </div>
      </section>

      <section className="content-section shared-state-section" id="shared-state">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">How it works today</p>
            <h2>One game. Shared live context.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Studio, the CLI, MCP tools, and tests connect to the same local project session.
            </p>
            <p>
              They see the same build, game state, diagnostics, and captures. Read-only inspection
              stays separate from commands that change the game.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/studio">See it in Studio <ArrowRight /></Link>
              <Link className="text-link" href="/docs/framework/inspection">Read the inspection docs <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="work-index wrap" id="system">
        <header className="section-intro">
          <h2>Everything around the same game.</h2>
          <p>
            Framework, Studio, project services, and agent tools work together during development.
          </p>
        </header>
        <div className="editorial-list">
          {SYSTEM.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="editorial-row"
              data-evidence-status={item.evidenceStatus}
            >
              <span className="row-status">{item.status}</span>
              <span className="row-copy"><strong>{item.title}</strong><span>{item.body}</span></span>
              <ArrowUpRight className="row-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-proof" id="games">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">The reason</p>
            <h2>We will build games, not just technology.</h2>
          </div>
          <div className="prose">
            <p className="lead">Play the Framework demos now and follow Emberwyrd as it develops.</p>
            <p>
              Antiky Town, Traversal Study, and Point Light Expo are the three public technical
              studies running today. Emberwyrd is our larger game in development and is not playable yet.
            </p>
            <div className="thesis-links">
              <Link className="button button-primary" href="/demos/antiky-town">Run Antiky Town <ArrowUpRight /></Link>
              <Link className="text-link" href="/games">See the games <ArrowRight /></Link>
              <Link className="text-link" href="/resources">Browse Resources <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="statement-band" id="research">
        <div className="wrap statement-grid">
          <h2>See what we are learning.</h2>
          <div>
            <p className="lead">We publish experiments in rendering, game tools, asset pipelines, and agent workflows.</p>
            <p>
              Read completed reports, follow work in progress, and inspect the code and reference
              material behind each experiment.
            </p>
            <div className="thesis-links">
              <Link className="text-link" href="/research">Explore the research <ArrowRight /></Link>
              <Link className="text-link" href="/roadmap">Read the roadmap <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section wrap split-heading" id="creative-range">
        <div>
          <p className="section-label">Rendering</p>
          <h2>Build in the style your game needs.</h2>
        </div>
        <div className="prose">
          <p className="lead">Build in 2D, 3D, or anywhere between them.</p>
          <p>
            Antiky&apos;s current games render through BroMetal. The Framework&apos;s game-module host keeps
            rendering separate so the game is not limited to one visual style.
          </p>
          <div className="thesis-links">
            <Link className="text-link" href="/demos">Explore all three studies <ArrowRight /></Link>
            <a className="text-link" href={BROMETAL_URL} target="_blank" rel="noreferrer">
              Visit BroMetal <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>

      <section className="home-community" id="community">
        <div className="wrap split-heading">
          <div>
            <p className="section-label">Explore it together</p>
            <h2>Build and learn with us.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              Meet builders exploring human-agent game development and share what you are making.
            </p>
            <p>
              Ask for help, share what you are building, compare approaches, and challenge our ideas.
            </p>
            <a className="button button-primary section-button" href={DISCORD_URL} target="_blank" rel="noreferrer">
              Join the Antiky Discord <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>

      <section className="home-closing wrap" id="closing">
        <p className="section-label">The creative outcome</p>
        <h2>Turn what exists in your mind into something people can see, play, share, and grow.</h2>
        <p>
          Build the world in your mind. Stay in the director&apos;s chair.
        </p>
        <div className="actions">
          <StudioPrimaryAction className="button button-primary" />
          <Link className="text-link" href="/thesis">Read the Antiky Thesis <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
