# Framework page copy

Page type: Explanation

Reader: a technically skeptical game builder deciding what makes Antiky Framework different, what
works today, and whether the project is worth exploring.

Primary action: read the current Framework documentation.

## Metadata

Title: Antiky Framework | Headless TypeScript game framework

Description: Open-source, headless TypeScript game framework where humans, agents, tools, and tests
inspect and change one game through explicit interfaces.

Canonical: `/framework`

## Link destinations

| Action | Destination |
| --- | --- |
| Read the Framework docs | `/docs/framework/engine-sessions` |
| Run the Framework studies | `/demos` |
| Inspect the Framework source | `https://github.com/antikylabs/antiky/tree/main/packages/framework` |
| Inspect the current API | `/docs/api/reference` |
| Explore BroMetal | `https://brometal.dev` |
| Read how the development session works | `/docs/cli/development` |
| See the games and studies | `/games` |
| See the same session in Studio | `/studio` |
| Run Combat Arena | `/demos/combat-arena` |

## Hero

Status: Pre-release · open source · working foundation

Headline: Build games that can explain themselves.

Lead:

Antiky Framework is an open-source TypeScript game framework that runs without Studio. It lets you
and software agents inspect, run, test, and change the same game through explicit interfaces. It
powers Antiky Studio, command-line tools, agent tools, and Antiky Labs games.

Primary action: Read the Framework docs

Secondary action: Run the Framework studies

Media: current Antiky Town capture

Alt text: Antiky Town running as an Antiky Framework game, with a character standing in a sunlit
voxel market.

Caption: Current proof · Antiky Town runs as a portable Framework game module and renders through
BroMetal.

## The assumption that changes the engine

Section label: Why AI-native starts below the interface

Headline: The agent is a user of the engine.

Body:

Most game engines were designed around a person interpreting an editor, a project, a running game,
and a debugger. An agent usually arrives later, with files, terminal output, and screenshots—and is
asked to reconstruct the rest.

Antiky starts from a different requirement: the game must be able to tell an agent what is true.
That changes the runtime, world model, development services, rendering boundary, and evidence the
system produces. Generating code is useful. Understanding what the code did is the harder problem.

Pull quote: Give agents context before asking them to guess.

## The loop we are building

Status: Direction

Headline: Change the game. Run it. Inspect the result. Prove what happened.

Body:

Imagine describing how a creature should move. The agent changes the code, launches a bounded
session, and runs a repeatable scenario. It inspects the creature, its relationships, the events
that mattered, and the state before and after the change. It captures what the player would see and
checks the result against a performance budget.

When the movement is correct but does not feel right, the human makes the creative call. The agent
can measure, implement, and iterate. The person remains the authority on taste.

Boundary note: Parts of this loop work today through sessions, inspection, captures, project
services, and bounded commands. The complete creator-agent workflow remains direction.

## What works now

Section label: Current · pre-release

Headline: A narrow foundation with observable behavior.

Intro:

The current source is smaller than a general-purpose engine. Its working boundaries are explicit
and covered by public documentation and tests.

Capability: Fixed-step sessions

Copy: Run game systems on a predictable clock with explicit input, ordered commands, pause, resume,
single-step control, and fail-closed faults.

Capability: Stable public identity

Copy: Refer to worlds, sessions, entities, commands, and events with durable identifiers instead of
screen coordinates or temporary render slots.

Capability: Structured inspection

Copy: Read immutable lifecycle, session, hierarchy, store, event, diagnostic, and measurement
snapshots without handing a client the live world.

Capability: Bounded authoring

Copy: Change and correct point-light power through validated commands with expected revisions. Read
access does not become write access by accident.

Capability: Portable game modules

Copy: Keep game rules, systems, shaders, and assets separate from the browser, Studio, the
command-line interface (CLI), and website hosts that provide canvas and platform lifecycle.

Supporting action: Inspect the current API

Source action: Inspect the Framework source

## TypeScript through the stack

Section label: Architectural choice

Headline: One language from game logic to shader source.

Body:

TypeScript gives agents a widely represented language and gives game builders one coherent path
across game logic, engine systems, browser hosts, Canvas, and WebGPU integration. An agent can work
at the level the problem requires: use Framework systems, write game code, or add focused TypeScript
where the Framework does not yet reach.

BroMetal carries the same idea onto the GPU. Shader programs are written with a typed TypeScript
domain-specific language and compiled to WebGPU Shading Language (WGSL) before the game runs.
WebGPU still creates the graphics pipelines at runtime. The distinction matters: ahead-of-time
shader generation does not, by itself, decide whether a subsystem belongs on the CPU or GPU, and it
is not a performance claim.

Framework's own render path targets WebGPU. A portable game module can still own a different browser
renderer when it stays behind the game-module contract.

Supporting action: Explore BroMetal

## One world, one contract

Section label: Shared development model

Headline: Every client meets the same game.

Body:

Humans, agents, Studio, the CLI, project services, and tests should not receive separate versions
of the engine. They meet the game through the same commands, queries, events, diagnostics, and
visual captures.

Model Context Protocol (MCP) translates that contract into tools an agent can use to launch,
control, observe, and inspect a development session. MCP is an adapter, not a second engine. Studio
and typed clients use the same project-service authority instead of rebuilding the truth in their
own interfaces.

Read access is not change authority. Inspection stays read-only. Changes cross validated commands,
expected revisions, and narrow grants. The broader sandbox and promotion model is still direction.

Supporting action: Read how the development session works

Architecture diagram alt text: Target Antiky architecture showing game hosts and clients using
shared project services and explicit Framework state, execution, inspection, and command boundaries.

Architecture diagram caption: Target architecture · accepted direction, not a list of completed
features.

## Proof is part of creation

Section label: Evidence-led development

Headline: A plausible change is not a verified change.

Body:

The current system can publish structured state, diagnostics, measurements, captures, and bounded
event history from the same development session. The direction goes further: targeted queries,
revision diffs, deterministic scenarios, input traces, GPU readback, causal events, and explicit
performance budgets.

That evidence protects human judgment rather than replacing it. A metric can expose a broken frame,
a missed budget, or an unexpected state transition. It cannot decide whether a jump feels alive or
whether a world is worth remembering.

## Grow the engine from games

Section label: Product method

Headline: The game leads. The engine follows.

Body:

Antiky Labs games are the Framework's first customer. We build a complete game slice, find the
systems that prove reusable, and move those systems into the Framework when the evidence supports
the boundary.

This is how support for 2D, 3D, and the space between them will grow. It is how abilities, assets,
materials, physics, rendering features, and online services can grow. Each begins with a game that
needs it, not a box on an engine feature matrix.

The cost is deliberate: Framework will be narrower before it is broad. A small system proven by a
working game is more useful than a large system made of promises.

Supporting action: See the games and studies

## Framework stands on its own

Section label: Headless by design

Headline: Studio helps you see the work. Framework does not depend on it.

Body:

A Framework game can build, run, test, host, and ship without Antiky Studio. The game module owns
its rules, systems, shaders, and assets. The host owns its canvas and platform lifecycle.

Studio is the human gateway into that same world. Its visual feedback and controls make the running
game easier to understand and direct, but Studio never becomes the engine or the source of truth.

Supporting action: See the same session in Studio

## What is current—and what is not

Headline: The boundary stays visible as the Framework grows.

Status: Current

Title: Session, identity, inspection, capture, and a bounded light-authoring slice

Copy: These capabilities exist in the current source and public documentation. Four approved game
studies exercise different parts of the foundation.

Status: Emerging

Title: A broader Framework-owned BroMetal render path

Copy: A narrow driver path exists in current demos, but games still contain renderer-owned work and
the broader rendering system is incomplete.

Status: Direction

Title: General world services, sandboxes, selection, physics, abilities, and online authority

Copy: Accepted architecture and active work guide these areas. They are not current Framework
features or release promises.

Status: Pre-release

Title: No stable npm package or API guarantee yet

Copy: The repository is open and the current behavior is documented, but package publication,
versioning, and compatibility policy are still open decisions.

## Closing action

Headline: Start with what the Framework can prove today.

Body: Read the current contracts, run a study, and inspect the same game through the development
tools. The broader vision is public; the working boundary is too.

Primary action: Read the Framework docs

Secondary action: Run Combat Arena

Tertiary action: Explore Antiky Studio

## Alternatives

These are deliberate alternatives, not additional headings to ship.

- **A game framework built for humans and agents from the start.** More category-led than the
  approved headline; use if the page needs to state the changed assumption in the H1.
- **Build games humans and agents can understand together.** Warmer and more collaborative, but less
  specific about the Framework's inspectable contract.
- **A headless TypeScript game framework for human-agent development.** Stronger search/category
  clarity, but less distinctive and less human.

CTA alternatives:

- **Inspect the current API** — use beside technical proof, not as the hero's main action.
- **Run the current proof** — use when the destination is the complete demo index rather than one
  named study.

## Editorial notes

- The approved headline names the differentiating outcome. The definition immediately below names
  the category and mechanism. It avoids “first generation” and “most AI-native”; neither has
  comparative evidence.
- Keep the first paragraph intact as the extractable definition of Antiky Framework.
- Keep the complete imagined loop labeled Direction. Do not convert future-tense systems into
  present-tense feature bullets.
- Link implementation facts to the narrow docs page that owns them. Do not expand this explanation
  page into command or API reference.
