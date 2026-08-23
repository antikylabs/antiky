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
          We are building tools that help them understand the same game while keeping the creator
          in control.
        </p>
      </header>

      <section className="thesis-intro wrap" aria-labelledby="assumption-changed">
        <p className="section-label">The assumption that changed</p>
        <h2 id="assumption-changed">
          Most game-development tools assume that a person will gather and interpret all the context.
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
          <h2 id="architecture">Agents need more than a chat box.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Adding chat, filesystem access, or screenshots to an existing workflow can be useful.
            It does not give people and agents a shared understanding of a living game.
          </p>
          <p>
            Studio, the CLI, MCP tools, and tests connect to the same local project session. They can
            read the same build status, running game state, diagnostics, and captures. Checked
            commands handle the editing tools that exist today.
          </p>
          <p>
            This is still an early foundation. Broader editing, selected-object context, and direct
            agent conversations are not available yet.
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
          <h2 id="shared-context">Everyone should see the same game state.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Studio, CLI, tests, humans, and agents should not each invent their own version of
            reality.
          </p>
          <p>
            A capture shows what the game looks like. Inspection shows what it is doing: which game
            is running, what entities and stores it publishes, which events occurred, and what went wrong.
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
          <h2 id="authority">Agents can inspect without having unrestricted control.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            A capable collaborator needs room to investigate without receiving unchecked control.
          </p>
          <p>
            Studio&apos;s inspector is read-only. Editing tools use checked commands. In the future, an
            agent should be able to try a change safely, show the result, and wait for approval before
            it changes the creator&apos;s game.
          </p>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="environment">
        <div>
          <p className="section-label">05 · The environment</p>
          <h2 id="environment">Better tools can help agents do better work.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Better context, narrower tools, clear interfaces, and useful feedback can reduce what an
            agent must infer.
          </p>
          <p>
            We are testing whether better context and narrower tools help smaller or local models do
            useful game-development work. We do not have a published result yet.
          </p>
        </div>
      </section>

      <section className="thesis-chapter wrap" aria-labelledby="rendering">
        <div>
          <p className="section-label">06 · Creative range</p>
          <h2 id="rendering">Choose the visual style the game needs.</h2>
        </div>
        <div className="thesis-prose">
          <p className="lead">
            Antiky is meant for 2D, 3D, and everything between them.
          </p>
          <p>
            Our current games render through BroMetal. Framework keeps rendering separate from game
            rules so a game is not defined by one renderer or visual style.
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
              Building games tells us which tools are actually useful. Antiky Town and the other
              browser demos let you play the work today.
            </p>
            <Link className="text-link" href="/demos/antiky-town">Run Antiky Town <ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="thesis-chapter thesis-bet wrap" aria-labelledby="bet">
        <div>
          <p className="section-label">07 · The bet</p>
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
