import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@/components/Icons';
import { DISCORD_URL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The Antiky Thesis',
  description:
    'Why Antiky Labs is building games and an AI-native development system around human creative authority.',
  alternates: { canonical: '/thesis' },
  openGraph: {
    title: 'The Antiky Thesis',
    description:
      'Game development is becoming collaboration between human creators and software agents. The tools should be designed for that reality.',
    type: 'article',
  },
};

export default function ThesisPage() {
  return (
    <article className="thesis-page">
      <header className="page-hero thesis-hero wrap">
        <p className="section-label">The argument behind the work</p>
        <h1>The Antiky Thesis</h1>
        <p className="page-lead">
          Game development is becoming collaboration between human creators and software agents.
          The systems supporting that collaboration should be designed around shared understanding
          and human authority from the beginning, then tested by building real games.
        </p>
      </header>

      <section className="thesis-intro wrap" aria-labelledby="assumption-changed">
        <p className="section-label">The assumption that changed</p>
        <h2 id="assumption-changed">
          Game development tools were built for a world where humans were the only intelligent
          participants in the creative process.
        </h2>
        <p>That world is changing.</p>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="origin">
        <div>
          <p className="section-label">01 · The origin</p>
          <h2 id="origin">Antiky began because we wanted to build a game.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Emberwyrd began as a world we wanted to play: a character-first online fantasy action
            RPG with story, risk, travel, and player consequence.
          </p>
          <p>
            Building it exposed a familiar limit. A game asks for engineering, art, animation,
            design, writing, sound, production, and more. Few creators hold every craft themselves.
            Software agents may give a creator meaningful leverage across those boundaries, but only
            if the tools help them collaborate with intent.
          </p>
          <p>
            Emberwyrd has no playable release today. It is the larger game Antiky is building toward
            and the test that keeps the technology tied to real creative problems.
          </p>
          <Link className="text-link" href="/games">Why games are the test <ArrowRight /></Link>
        </div>
      </section>

      <section className="statement-band thesis-statement">
        <div className="wrap statement-grid">
          <h2>AI should increase creative agency, not replace it.</h2>
          <div>
            <p className="lead">We do not want a button that says “make game.”</p>
            <p>
              We want someone with a world in their mind to have a better chance of making it real.
              The creator chooses the world, sets the direction, judges the result, and remains the
              creative authority. Agents can explore, propose, implement, test, and help, but the
              human stays in the director&apos;s chair.
            </p>
          </div>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="architecture">
        <div>
          <p className="section-label">02 · AI-native</p>
          <h2 id="architecture">AI-native is architectural.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Adding chat, filesystem access, or screenshots to an existing workflow can be useful.
            It does not give people and agents a shared understanding of a living game.
          </p>
          <p>
            Antiky&apos;s current foundation gives Studio, the CLI, MCP tools, and direct typed clients
            access to the same local project services. A fixed-step session owns game time and state.
            Inspection publishes validated snapshots. Commands provide bounded ways to change the
            narrow authoring surfaces that exist today.
          </p>
          <p>
            That is an early foundation, not the complete creator-agent workflow. General sandboxes,
            contextual feedback, broad editor commands, and richer permission systems remain work
            ahead.
          </p>
          <div className="thesis-links">
            <Link className="text-link" href="/docs/framework/engine-sessions">Engine sessions <ArrowRight /></Link>
            <Link className="text-link" href="/docs/framework/inspection">Runtime inspection <ArrowRight /></Link>
            <Link className="text-link" href="/docs/mcp/overview">MCP connection <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="shared-context">
        <div>
          <p className="section-label">03 · Shared context</p>
          <h2 id="shared-context">One game. One source of truth.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Studio, CLI, tests, humans, and agents should not each invent their own version of
            reality.
          </p>
          <p>
            A capture shows what the game looks like. Structured state explains what the game is
            doing: which runtime is alive, what entities and stores a game publishes, which events
            occurred, what diagnostics exist, and which revision a tool observed.
          </p>
          <p>
            Pixels should complement understanding, not substitute for it. Stable identities,
            explicit hierarchy, diagnostics, measurements, and typed results give collaborators
            context before asking them to guess.
          </p>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="authority">
        <div>
          <p className="section-label">04 · Authority</p>
          <h2 id="authority">Read access is not change authority.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            A capable collaborator needs room to investigate without receiving unchecked control.
          </p>
          <p>
            Current inspection snapshots are immutable, and Studio&apos;s inspector views are read-only.
            The authoring operations that exist today cross explicit command boundaries. The target
            architecture goes further: agents should be able to test bounded changes away from
            primary state, present evidence, and ask a person or authorized system to apply them.
          </p>
          <blockquote>
            A successful experiment is evidence for a change. It is not permission to make that
            change.
          </blockquote>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="environment">
        <div>
          <p className="section-label">05 · The environment</p>
          <h2 id="environment">The environment matters as much as the model.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Better context, narrower tools, clear interfaces, and useful feedback can reduce what an
            agent must infer.
          </p>
          <p>
            We are researching whether that environment can help smaller or local coding models do
            useful game-development work with less waste. It is a question, not a result. Antiky has
            not yet published the task evaluations, baselines, or model evidence required to claim
            that outcome.
          </p>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="typescript">
        <div>
          <p className="section-label">06 · A practical language</p>
          <h2 id="typescript">TypeScript keeps the current stack close together.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Framework, CLI, Studio, game modules, development clients, and the website can share
            types and run across the browser and local development environment.
          </p>
          <p>
            That makes TypeScript a practical implementation choice for Antiky today. It is not a
            claim that one language is universally best, or that TypeScript alone makes agents more
            capable. The value comes from fewer boundaries and interfaces the whole system can
            validate.
          </p>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="rendering">
        <div>
          <p className="section-label">07 · Creative range</p>
          <h2 id="rendering">Rendering is research, not identity.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            2D, 3D, and 2.3D are creative possibilities, not the boundaries of Antiky.
          </p>
          <p>
            BroMetal is where Antiky&apos;s rendering work began and remains the renderer our Framework
            games use. The game-module boundary keeps renderer choice separate from the broader
            questions about game state, development services, and human-agent collaboration.
          </p>
          <Link className="text-link" href="/demos">Run the rendering studies <ArrowRight /></Link>
        </div>
      </section>

      <section className="statement-band thesis-statement">
        <div className="wrap statement-grid">
          <h2>We will build games, not just technology.</h2>
          <div>
            <p className="lead">The creative idea should lead. The engine should follow.</p>
            <p>
              The game creates real problems. We solve them. When a solution proves reusable, it can
              become part of Antiky. Working software teaches us more than speculative architecture.
              Playable experiments teach us more than promises.
            </p>
            <Link className="text-link" href="/demos/antiky-town">Run Antiky Town <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="thesis-chapter thesis-bet wrap" aria-labelledby="bet">
        <div>
          <p className="section-label">08 · The bet</p>
          <h2 id="bet">Build the future by testing it in public.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Our bet is that game development will become collaboration between human creators and
            increasingly capable software agents.
          </p>
          <p>
            The best tools for that future will not simply attach AI to workflows designed in the
            past. They will be designed around shared context, explicit authority, and human creative
            direction from the beginning.
          </p>
          <p>
            Antiky is early. If it only helps us build Emberwyrd, learn deeply, and have fun exploring
            these ideas, it will have been worthwhile. We hope the work becomes useful to many more
            creators, and we invite thoughtful builders to help test, question, and improve it.
          </p>
          <div className="thesis-links">
            <Link className="text-link" href="/studio">See the current Studio <ArrowRight /></Link>
            <a className="text-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
              Join the conversation <ArrowUpRight />
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
