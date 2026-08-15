# Antiky Labs Website Product

**Last updated:** 2026-08-08

## Platform

Web.

## Audience

The website serves three current audiences:

1. Game builders exploring how human creators and software agents can work on the same living game.
2. Skeptical technical visitors who want to distinguish Antiky's working software from its
   architectural direction and research questions.
3. People following Antiky Labs as it builds games, tools, and research in public.

Players are a future audience. Until Emberwyrd has real player-facing material, the website must not
present it as a playable game.

## Product purpose

The website is the public home for the Antiky idea, the games that motivate it, the architecture
being tested, the software that works today, and the community invited to explore the questions.

It should move a thoughtful visitor through:

**clarity → conviction → evidence → participation**

Success means a visitor can understand:

- why Antiky exists;
- why human creative authority matters;
- what “AI-native” means in concrete architectural terms;
- which capabilities work today;
- which ideas are emerging, direction, or research questions;
- how Antiky Town, the focused studies, and Emberwyrd relate;
- how Studio, Framework, CLI project services, MCP, and agents fit one development model;
- why 2D, 3D, 2.3D, and BroMetal are supporting creative and rendering choices rather than the
  company identity; and
- how to download Studio, read the Thesis, run current evidence, or join the Discord.

The site is not primarily a conversion funnel. Studio downloads and Discord participation should be
obvious, but the public experience must feel like an active game technology lab sharing serious work.

## Positioning

Antiky Labs is a game technology lab building games and an AI-native development system around human
creative authority.

The central thesis is:

> Game development will increasingly become collaboration between human creators and software
> agents. The systems that support that collaboration should be designed around shared understanding
> and human authority from the beginning, then tested by building real games.

The website should communicate this hierarchy:

1. The idea is the hero.
2. The games are the reason.
3. The architecture is the argument.
4. The working software is the evidence.
5. Studio is how people participate.
6. The community is where people explore it together.

## Product model

Antiky is one development model with several responsibilities and surfaces:

- **Antiky Framework** owns headless game sessions, identity, structured inspection, game rules, and
  the bounded authoring systems implemented within it.
- **CLI project services** own the local project lifecycle, build and process supervision,
  inspection service, MCP endpoint, development state, and cleanup.
- **Antiky Studio** is the current native visual workspace over those shared services. It keeps the
  running game, terminal, simulation controls, structured inspection, and development activity
  together.
- **MCP and typed clients** adapt shared inspection and tool boundaries. They do not receive a
  separate engine or automatic authority over game state.
- **Games and studies** create real problems, demonstrate narrow working slices, and keep the system
  accountable to creative outcomes.
- **Research** contains questions and reproducible evidence. A hypothesis does not become a product
  claim because it appears in a plan or accepted architecture direction.

Studio is not the engine. Framework works without Studio. The game module selects rendering while
the host supplies platform lifecycle. Antiky Framework games render with BroMetal today. A
Framework-owned BroMetal render driver is accepted direction, not a current capability.

## Evidence status

Every meaningful public claim belongs to one of these states:

- **Current** — implemented and documented through a public boundary today.
- **Emerging** — a narrow working slice exists, but the broader capability remains incomplete or
  pre-release.
- **Direction** — supported by an accepted decision or explicit product direction, but not a public
  capability yet.
- **Research question** — a hypothesis that needs a published method and result before it can become
  a product claim.

The website must label status in text. Color may reinforce status but cannot replace it.

### Current evidence

- A fixed-step `EngineSession` with explicit input, pause, resume, single-step controls, command
  ordering, state revisions, and fail-closed faults.
- Stable public identities and immutable structured inspection snapshots.
- A first Framework-owned point-light command, correction, inspection, and rendering slice.
- One project service used by CLI and the Studio application host.
- MCP and typed inspection/tool adapters for the same local development session.
- A native Studio workspace with project launch, running game, terminal, simulation controls,
  hierarchy, stores, snapshots, events, MCP calls, and diagnostics.
- Four current Antiky Framework studies, four pure BroMetal studies, and two pure Three.js studies in
  one portable website-owned game host.
- Combat Arena as the strongest immediate motion proof, Traversal Study as a distinct movement proof,
  and Antiky Town as the broadest current authored-world proof.

All current packages remain early and pre-release. Current behavior does not imply stable APIs or a
complete general-purpose game engine.

### Emerging work

- Studio release packaging and the first public download/installation experience.
- A broader creator workflow around the current shared-service foundation.
- More Framework-owned game systems earned through real game requirements.

### Direction

- Contextual feedback attached to an exact game target and revision.
- General bounded experiments or sandboxes with review evidence and explicit promotion through
  authority rules.
- Broader editor and authoring commands.
- Emberwyrd as the larger game and proving ground.

### Research questions

- Whether better context, tools, interfaces, and feedback make software agents materially more
  effective at bounded game-development tasks.
- Whether smaller or local models can do useful work with lower token, latency, or infrastructure
  costs in that environment.
- Model-training, adapter, and generated-asset outcomes.
- Rendering and simulation directions that have not yet become Framework capability.

Do not market these questions as results without a public method, baseline, configuration, outcome,
failure record, and limitations.

## Games and rendering

Antiky Labs will build games, not just technology. The game creates real problems. Reusable
solutions can become Antiky after working evidence justifies the boundary.

- **Combat Arena** is the immediate action proof, **Traversal Study** is the movement proof, and
  **Antiky Town** is the larger authored-world proof.
- **Focused studies** isolate rendering, hosting, shader, identity, and authoring questions.
- **Emberwyrd** is the larger creative and technical test in development. It has no playable release
  today.

The creative idea should lead and the engine should follow. 2D, 3D, and 2.3D are creative
possibilities, not product boundaries. BroMetal is where Antiky's rendering work began and is the
renderer Antiky Framework games use today. Preserve its attribution and useful links without
presenting it as the Antiky Labs identity.

## Public information architecture

- **Home (`/`)** — explain why Antiky exists, introduce the current architecture and evidence, then
  offer clear participation paths.
- **The Thesis (`/thesis`)** — hold the durable public argument without becoming a product page.
- **Studio (`/studio`)** — show the strongest current visual expression of the Thesis and separate
  current, emerging, and direction.
- **Framework (`/framework`)** — explain the headless session/state foundation, current public
  slices, and target architecture.
- **Games (`/games`)** — connect Antiky Town, focused studies, and Emberwyrd to the game-led method.
- **Research (`/research`)** — maintain the boundary between runnable evidence, direction, and open
  questions.
- **Demos (`/demos`)** — let visitors run nine approved artifacts and understand what each does and
  does not show.
- **Docs (`/docs`)** — publish exact current Framework, CLI, MCP, Studio, and API behavior.

`/worlds` permanently redirects to `/games`. “Antiky Worlds” is not a primary public navigation or
company-positioning concept.

## Participation

Canonical destinations:

- Studio releases: `https://github.com/antikylabs/antiky/releases`
- Discord: `https://discord.gg/3Qs2uejUf9`
- Source repository: `https://github.com/antikylabs/antiky`

The site-launch gate requires packaged Studio release assets with version, platform, installation,
release-note, and limitation information. Do not deploy a download-led build before those assets
exist.

The default build therefore links people to the Studio page and source-build guide without claiming
a download exists. After the release assets pass inspection, build the launch site with
`NEXT_PUBLIC_STUDIO_RELEASES_READY=true`. That explicit publication assertion changes the primary
Studio actions to **Download Studio** and exposes the canonical GitHub Releases destination. Verify
both states with the normal website test and `npm run test:release-ready --workspace
@antiky/website`.

Discord language should promise member value, not member count. Invite builders to ask for Studio
help, share work, challenge the Thesis, compare approaches, and help turn questions into evidence.
Do not claim an established ecosystem until community evidence supports it.

The participation loop is: see a real game moving → download Studio from the release authority →
open or run a study → join Discord for help, critique, project sharing, and direct influence on what
the lab tests next. Download and community actions should recur after convincing proof, not interrupt
the opening idea before the visitor understands why the product exists.

## Voice and language

The public voice is:

- technical;
- human;
- curious;
- ambitious;
- candid;
- builder-oriented;
- evidence-led;
- early but serious.

Prefer these durable lines where they do real work:

- Build the world in your mind. Stay in the director's chair.
- AI should increase creative agency, not replace it.
- AI-native is architectural.
- One game. One source of truth.
- Give agents context before asking them to guess.
- Read access is not change authority.
- The creative idea should lead. The engine should follow.
- We will build games, not just technology.
- Evidence before adjectives.

Avoid generic AI hype, startup clichés, autonomous game-generator language, attacks on existing
engines, replacement claims about creative specialists, and language that presents target
architecture as shipped.

## Product principles

1. **Lead with the idea and show real proof quickly.** The argument earns attention; working media,
   documented behavior, and runnable studies earn trust.
2. **Keep human authority explicit.** Agents increase creative agency; they do not become the
   creative owner or receive implied change authority.
3. **Say what is real.** Separate current, emerging, direction, and research questions everywhere.
4. **Build from games outward.** Let creative requirements pull reusable technology into Antiky.
5. **Keep Framework sufficient.** Studio is useful and visual, but it is not required to run the
   Framework.
6. **Treat rendering as a layer.** Preserve BroMetal attribution and creative range without reducing
   Antiky to one renderer or art direction.
7. **Invite participation modestly.** Make Studio and Discord easy to find while letting the Thesis
   and evidence breathe.
8. **Publish deliberately.** Working source does not automatically create an approved public claim,
   release, or research result.

## Open product decisions

- Stable package and versioning policy for Framework and CLI.
- Supported platforms and cadence for Studio releases after the launch package.
- The first complete creator-agent workflow to publish as a reproducible evaluation.
- Public research-artifact format and cadence.
- The point at which Emberwyrd has player-facing material worth publishing.
- Website accessibility conformance target; do not claim conformance until it is chosen and tested.
