import Link from 'next/link';
import { redirect } from 'next/navigation';
import DemoStage from '@/components/DemoStage';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { BROMETAL_URL, DISCORD_URL, STUDIO_RELEASES_URL } from '@/lib/site';

const SYSTEM = [
  {
    href: '/framework',
    status: 'Current foundation · pre-release',
    evidenceStatus: 'current',
    title: 'Framework',
    body: 'Headless fixed-step sessions, stable identities, structured inspection, portable game modules, and a first bounded authoring slice.',
  },
  {
    href: '/studio',
    status: 'Current workspace · early',
    evidenceStatus: 'current',
    title: 'Studio',
    body: 'The running game, native terminal, simulation controls, and live structured state in one visual workspace.',
  },
  {
    href: '/docs/cli/development',
    status: 'Current services · pre-release',
    evidenceStatus: 'current',
    title: 'CLI and project services',
    body: 'One local authority starts the game, build, inspection, and MCP services for CLI, Studio, and typed clients.',
  },
  {
    href: '/docs/mcp/overview',
    status: 'Bounded tools now · broader work ahead',
    evidenceStatus: 'emerging',
    title: 'Agents',
    body: 'Agents can inspect the same session and use approved tools today. Richer feedback, experiments, and authority boundaries remain direction.',
  },
] as const;

export default function HomePage() {
  const demoSlug = process.env.ANTIKY_DEMO_SLUG;
  if (demoSlug) redirect(`/demos/${demoSlug}`);

  return (
    <>
      <section className="home-hero" id="idea">
        <DemoStage slug="antiky-town" variant="hero" label="Antiky Town — current Framework proof in a golden-hour voxel town" />
        <div className="home-hero-copy">
          <h1>Build the world in your mind.<br />Stay in the director&apos;s chair.</h1>
          <p>
            Antiky Labs explores game development where human creators and software agents are both
            first-class participants—and the human remains the creative authority.
          </p>
          <div className="actions">
            <a className="button button-primary" href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">
              Download Studio <ArrowUpRight />
            </a>
            <Link className="text-link" href="/thesis">Read the Thesis <ArrowRight /></Link>
            <a className="text-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
              Join Discord <ArrowUpRight />
            </a>
          </div>
        </div>
        <p className="media-caption"><span>Current proof · Antiky Town</span> Run the real Framework study</p>
      </section>

      <section className="content-section wrap split-heading" id="changed-assumption">
        <div>
          <p className="section-label">The assumption that changed</p>
          <h2>The tools were built for a different cast.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Existing game tools are powerful. Most were designed around people interpreting the
            editor, project files, runtime, and debugging environment.
          </p>
          <p>
            Software agents introduce another capable participant. Giving an agent a terminal,
            source files, and screenshots can help, but it still leaves the agent reconstructing the
            game from fragments. Antiky asks what changes when shared understanding is part of the
            system from the beginning.
          </p>
          <Link className="text-link section-link" href="/thesis">Follow the full argument <ArrowRight /></Link>
        </div>
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

      <section className="content-section wrap split-heading" id="shared-state">
        <div>
          <p className="section-label">Current architectural proof</p>
          <h2>One game. One source of truth.</h2>
        </div>
        <div className="prose">
          <p className="lead">
            Studio, the CLI, MCP tools, and direct typed clients use the same local project services
            instead of maintaining separate versions of the running game.
          </p>
          <p>
            A capture shows what the game looks like. Structured state explains what the game is
            doing: lifecycle, stable identities, hierarchy, stores, events, diagnostics,
            measurements, session controls, and the narrow authoring facts a game publishes.
          </p>
          <p>
            Inspection is read-only. Bounded controls and commands cross explicit change boundaries.
            The complete creator-agent loop is still being built, but the shared foundation works
            today.
          </p>
          <div className="thesis-links">
            <Link className="text-link" href="/studio">See it in Studio <ArrowRight /></Link>
            <Link className="text-link" href="/docs/framework/inspection">Read the inspection docs <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="work-index wrap" id="system">
        <header className="section-intro">
          <h2>One development model.</h2>
          <p>
            Framework, Studio, project services, and agent tools are different views and
            responsibilities around the same game—not four unrelated products.
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
            <p className="lead">The game creates real problems. Reusable solutions become Antiky.</p>
            <p>
              Antiky Town and seven focused browser studies are the working proof today. Emberwyrd
              is the larger creative and technical test Antiky Labs is building toward. It is not a
              playable release yet.
            </p>
            <div className="thesis-links">
              <Link className="button button-primary" href="/demos/antiky-town">Run Antiky Town <ArrowUpRight /></Link>
              <Link className="text-link" href="/games">See the games <ArrowRight /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="statement-band" id="research">
        <div className="wrap statement-grid">
          <h2>Evidence before adjectives.</h2>
          <div>
            <p className="lead">Antiky is a lab because the important questions still need testing.</p>
            <p>
              Can better context reduce guessing? Can a creator give feedback to an exact target?
              Can bounded experiments produce useful evidence without granting authority? Can a
              better environment help smaller models do meaningful work? The questions are public;
              results become claims only when the evidence exists.
            </p>
            <Link className="text-link" href="/research">See the research boundary <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="content-section wrap split-heading" id="creative-range">
        <div>
          <p className="section-label">Creative range</p>
          <h2>The idea should choose the form.</h2>
        </div>
        <div className="prose">
          <p className="lead">2D, 3D, and 2.3D are creative possibilities, not product boundaries.</p>
          <p>
            BroMetal is the current Framework render driver and where Antiky&apos;s rendering work
            began. Pure BroMetal and Three.js studies also run through the portable game host. The
            research can follow the needs of the games without turning one rendering style or
            library into the identity of the lab.
          </p>
          <div className="thesis-links">
            <Link className="text-link" href="/demos">Explore all eight studies <ArrowRight /></Link>
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
            <h2>Bring questions. Bring work. Bring disagreement.</h2>
          </div>
          <div className="prose">
            <p className="lead">
              The Antiky Discord is for builders curious about human-agent game development—not a
              claim that a finished ecosystem already exists.
            </p>
            <p>
              Ask for Studio help, share what you are building, challenge the thesis, compare
              approaches, and help turn open questions into useful evidence.
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
          <a className="button button-primary" href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">
            Download Studio <ArrowUpRight />
          </a>
          <Link className="text-link" href="/thesis">Read the Antiky Thesis <ArrowRight /></Link>
        </div>
      </section>
    </>
  );
}
