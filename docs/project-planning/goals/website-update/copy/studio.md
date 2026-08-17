# Studio page copy

Page type: Explanation

Reader: a game builder who wants to understand what Studio does now, how it relates to Framework and
agents, and what the longer-term creator workflow is intended to become.

Primary action: run or download the current Studio build through the release-aware action.

## Metadata

Title: Antiky Studio | Visual workspace for Antiky projects

Description: Native visual workspace for running Antiky projects, controlling simulation,
inspecting live game state, and directing human-agent development.

Canonical: `/studio`

## Hero

Status before packaged release: Current macOS source build · packaged downloads are not public yet

Status after release gate: Early Studio release · version, platforms, and limitations on GitHub

Headline: Direct the work. Keep the game in view.

Lead:

Antiky Studio is the native visual workspace for Antiky development. It keeps project launch, the
running game, a native terminal, simulation controls, structured inspection, and development
activity together—so a person can see what is happening while the shared project services do the
work underneath.

Primary action before packaged release: Run Studio from source

Primary action after release gate: Download Studio

Secondary action: Read the Studio docs

Tertiary action: Get help on Discord

Hero media: `studio/workspace-overview.webp`

Alt text: Antiky Studio showing a running game in the main viewport, a native terminal below it,
structured inspection on the right, and development activity along the bottom.

Caption: Current source build · one project workspace with the game, terminal, inspection, and
activity visible together.

## The working loop today

Section label: Current

Headline: Open a project and work beside the running game.

Intro:

Studio is already a working macOS Tauri application with a portable React interface. The current
workspace is early and fixed, but its core development loop is real.

Step: Start with the project

Copy: Create a project, open an existing `.antiky` manifest, or return to a recent project from the
launcher. Studio validates the project before replacing the current workspace.

Media: `studio/project-launcher.webp`

Alt text: Antiky Studio's project launcher with actions to create a project, open a project, and
reopen a recent project.

Caption: Current launcher · create, open, or return to one validated Antiky project.

Step: See the game and terminal together

Copy: Studio starts the same local project services used by the CLI. The configured game runs in
the workspace beside a native terminal with a compact prompt that does not expose the user or
machine name.

Step: Control simulation time

Copy: Pause, resume, step, restart, or stop the current development session without leaving the
workspace. A single step advances exactly one presented frame through the shared session boundary.

Media: `studio/simulation-controls.webp`

Alt text: Antiky Studio with the running game paused and the Pause, Step, Restart, and Stop controls
visible above the workspace.

Caption: Current controls · the paused session remains available for inspection and one-frame
stepping.

Step: Inspect what the game publishes

Copy: Use Hierarchy, Stores, and Snapshot views for semantic game state. Review Events, MCP calls,
and Diagnostics in the activity panel. Inspector views are read-only; approved controls and
commands cross separate change boundaries.

Media: `studio/inspection-activity.webp`

Alt text: Antiky Studio inspection and activity panels showing a game hierarchy, structured store
data, event history, MCP calls, and diagnostics.

Caption: Current inspection · structured projections and activity from the same running project
session.

Supporting action: Follow the current Studio guide

## One game, one source of truth

Section label: Shared development session

Headline: Studio sees the same game as the CLI and the agent.

Body:

CLI project services own the local build, game host, inspection service, MCP endpoint, and cleanup.
Studio calls the same service library directly. Connected agents use MCP adapters over the same
session. None of those clients gets a private copy of the engine rules.

That boundary keeps the facts consistent. Engine state stays distinct from process, build, and
connection state. Inspection stays read-only. Simulation controls and approved Framework commands
can change the session through explicit interfaces.

Diagram labels:

- CLI · terminal workflow
- Studio · visual workspace
- MCP · agent tools
- Project services · game, build, inspection, tools

Diagram alt text: CLI, Studio, and MCP connected to one local project-service session that owns the
game, build, inspection, and tool boundaries.

Supporting action: See how Studio connects

## The human gateway

Section label: Product direction

Headline: Point at what you mean.

Body:

The long-term job of Studio is not to reproduce every game value as a property field. It is to help
a person look at the game, select the exact thing that matters, and give an agent precise creative
direction with the relevant context attached.

You might select a creature whose landing feels too light, mark the place where lighting breaks,
or ask why a particular event occurred. Studio should already know the project, build, runtime,
world, entity, revision, hierarchy, and evidence behind that selection. You should not have to
rebuild that context before you can describe what you imagined.

Tradeoff:

Studio will expose fewer manual authoring surfaces at first than a traditional game editor. In
return, every new interaction can use the same validated commands and shared game truth as agents,
tests, and the CLI.

Boundary note: Stable entity selection, click-to-agent context, and feedback attached to an exact
target are direction. They are not present in the current workspace.

## Bring the agent you already use

Section label: Direction · ACP conversation

Headline: Studio is not another coding agent.

Body:

Studio is intended to connect to compatible coding agents people already use, with their existing
provider, account, and plan. ACP is the conversation layer: it can carry a streaming exchange and
the structured context a person chooses to attach. A terminal remains useful for terminal-shaped
work, but it cannot carry the visual and semantic context Studio understands on its own.

MCP has a different job. MCP is the agent-to-engine API for launching, controlling, observing, and
inspecting a game session. ACP carries the conversation between the person and the agent. Neither
one bypasses Framework commands, grants, or revision checks.

Boundary note: Native ACP conversation and selected-entity context are the next focused proof, not
current Studio behavior.

## A canvas for the work at hand

Section label: Research and direction

Headline: The workspace should change with the task.

Body:

Lighting work needs a viewport, diagnostics, and captures. Asset work needs a catalog, provenance,
and previews. Simulation work needs events, state, controls, and time. One permanent wall of panels
is not the right shape for every job.

The Studio direction calls these focused workspaces **mini apps**. A mini app could provide an asset
browser, shader workspace, game editor, GPU tool, or narrow utility while participating in the same
selection and feedback model as the rest of Studio.

Flexibility does not mean raw access. Mini apps need stable identities, declared capabilities,
activation and disposal, isolated failures, and bounded optional services. They do not receive the
Framework world, Tauri host, renderer, or GPU as an unchecked capability.

Boundary note: The current four resizable panels are a working shell, not a mini-app platform.
Mini-app contracts, reusable GPU viewports, and persisted workspaces still need to be designed and
proven.

## Feedback that survives the prompt

Section label: Direction

Headline: Creative direction should remain attached to what it meant.

Body:

A useful comment needs more than prompt text. It needs an author, a target, the revision that was
observed, the evidence that came with it, and a visible state such as open, assigned, resolved, or
reopened.

The intended feedback model lets people collect observations from several places, review them as a
bundle, and send one coherent brief to an agent. The record can then connect the request, proposed
change, and proof without turning the comment itself into a hidden command.

Boundary note: Durable feedback, staging, attachments, sandboxes, review, and promotion are not in
the current source build.

## A window into the game

Section label: Product boundary

Headline: Studio never becomes the game itself.

Body:

Framework games build, run, test, and ship without Studio. Studio is a visual client over the same
project services. Editor cameras do not become game cameras. Preview gestures do not become durable
authoring changes until one validated command commits them. Stale selections and late results must
remain visibly stale instead of attaching to the wrong project or revision.

Because Studio does not carry a separate engine inside its interface, it can focus on the part only
it can do: help a person see, understand, and direct the work.

## What is current—and what comes next

Status: Current

Title: A working native workspace

Copy: Project launch, recent projects, a live game, native terminal, simulation controls, structured
inspection, activity history, and settings work in the current macOS source build.

Status: Emerging

Title: The first packaged Studio release

Copy: Packaging and release delivery are still being completed. GitHub Releases becomes the
authority for version, supported platforms, installation, release notes, and limitations only after
the release gate is satisfied.

Status: Direction

Title: Exact-target feedback and native agent conversation

Copy: Stable selection, native ACP, click-to-agent context, and bounded authoring form the next
creator-agent proof.

Status: Research question

Title: Mini apps, durable feedback, and broader creator modes

Copy: App isolation, reusable viewports, workspace persistence, feedback retention, sandboxes,
multi-agent behavior, accessibility targets, and cross-platform packaging still need decisions and
working evidence.

## Current availability

Headline before packaged release: Run Studio from the current source build.

Body before packaged release:

Packaged downloads are not public yet. The current guide explains how to run the working macOS
workspace from the repository while release packaging is completed.

Primary action before packaged release: Run Studio from source

Headline after release gate: Start with the release that fits your system.

Body after release gate:

Downloadable builds are distributed through GitHub Releases. Check the selected release for its
version, supported platforms, installation steps, release notes, and known limitations.

Primary action after release gate: Download Studio

Secondary action after release gate: Follow the first-run guide

Permanent supporting note:

Antiky Framework projects can publish the richest semantic inspection data. Renderer-only projects
retain generic lifecycle state, measurements they report, reload, canvas capture, and the local
agent connection supported by the host.

## Closing action

Headline: Keep the game close to the conversation.

Body: Run the current workspace, inspect the shared session, and follow the work as selection and
native agent conversation move from direction into proof.

Primary action: Use the release-aware Studio action

Secondary action: Read the Studio docs

Tertiary action: Join the Studio discussion

## Alternatives

These are deliberate alternatives, not additional headings to ship.

- **Your game and its living state. One workspace.** Strongest description of the current product;
  use if the launch page should lead with shipped behavior rather than human direction.
- **The place where human direction meets a running game.** Stronger vision language, but it needs
  the current-status line and real screenshot immediately below it.

CTA alternatives:

- **Open the current Studio guide** — safest primary action before a packaged release exists.
- **See the workspace in detail** — suitable for an in-page jump to the screenshot sequence, not an
  external conversion action.

## Editorial notes

- Keep the hero definition and real workspace screenshot in the first viewport. The longer-term
  creator-agent vision follows current evidence.
- Never place “Current” visual treatment on ACP, exact-target selection, feedback storage, mini apps,
  sandboxes, or workspace persistence.
- Use the four specified screenshots as evidence of distinct current states. Do not reuse one crop
  under several claims.
- Keep availability copy conditional. The public action changes only when the explicit release-ready
  build flag is true and the release artifact passes inspection.
