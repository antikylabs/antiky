# Antiky Studio objective summary

The Studio objective is complete and was archived on 2026-08-10. It established Antiky Studio as
the macOS visual development client for the same Framework and CLI project services used by the
command line, MCP clients, and tests. The completed objective folder was removed after this summary
was written so that finished plans and temporary closeout material do not remain in the active
objectives tree.

## Delivered outcome

- Added the portable React Studio workspace in `packages/studio/app` and its Tauri macOS host in
  `packages/studio/tauri`.
- Added one game-first workspace with the live game, a native `libghostty` terminal, simulation
  controls, structured inspection, diagnostics, event history, and MCP call history.
- Added bounded Framework world inspection and event-history views. The point-light service was the
  first adapter and publishes stable entity, hierarchy, store, and accepted-event data without
  introducing a general ECS store or durable event database.
- Added browser-safe development-client reads and the read-only MCP Tools
  `get_world_inspection` and `get_event_log`. The development host retains a bounded, redacted
  in-memory MCP call log that is available through a protected development query rather than an MCP
  Tool.
- Established `<name>.antiky` as the project boundary. The CLI can create a manifest with
  `antiky init`; Studio can create or open a project, handle Finder file-open events, switch projects,
  and maintain a bounded recent-project menu.
- Made the CLI project-service library the single development authority. `antiky dev` and Studio use
  that service instead of maintaining separate game hosts. Studio starts it directly when a project
  opens and leaves the embedded terminal available for the user's shell or coding agent.
- Made Antiky Town, Town Study, and Shader Study self-contained projects that build portable
  `antiky.game.js` artifacts. The website stages approved compiled artifacts and hosts them without
  importing demo source into production pages.
- Aligned Studio with the website's compact, game-first visual language. The wide layout places the
  game and inspection above the terminal and activity panels; the narrow layout stacks those
  surfaces. The native terminal clips to its panel and uses an audited Antiky color profile while
  preserving the user's shell, prompt, keybindings, history, and other nonvisual preferences.
- Added project lifecycle controls, managed game startup and cleanup, renderer showcase support,
  native project menus, and packaged gameplay-capture support as follow-up refinements.
- Updated the durable Studio, Framework inspection, CLI development, MCP Tool, architecture, and
  project documentation to describe the shipped system.

## Durable boundaries and decisions

- Studio is a client and lifecycle owner, not a second engine runtime or source of Framework rules.
- Game projects own game code and portable artifacts. The CLI service owns development hosting.
  Studio owns the desktop experience, and the website owns public artifact delivery.
- The terminal is a real native user terminal. Studio does not inject commands, fake output, parse
  transcripts, or use terminal text as engine state.
- Event history and MCP call history have different authorities and lifetimes. Event history contains
  accepted domain facts; MCP history is bounded local development telemetry and is not persisted as
  game history.
- Inspection is semantic, immutable, versioned, and bounded. It does not expose live engine objects,
  runtime handles, GPU resources, or a generic raw store.
- Opening or switching projects validates the manifest and canonical project root before replacing
  active state. A canceled or invalid replacement leaves the current workspace intact.

## Verification and closeout

The objective was developed through incremental automated checks, package builds, native runs, and
owner-reviewed macOS interaction. The recorded closeout covered project opening and switching,
Finder integration, terminal input and lifecycle, session controls, inspection and log views,
responsive panel geometry, self-contained demo builds, compiled website delivery, and cleanup.

The original closeout recorded that repository checks, Studio builds, artifact checks, and native
verification passed. Some browser evidence was unavailable because no Browser Control session was
attached; those evidence limitations were recorded rather than represented as completed captures.
Some native demo views were also intentionally not retained because they contained private absolute
paths.

## Work not carried forward

The completed objective intentionally did not add component editing, canvas selection, comments,
attach/detach authoring, a general ECS implementation, durable event storage, terminal transcript
capture, another development host, or Windows and Linux distribution. Early feedback plans whose
status became stale or whose approach was superseded are historical context only; the shipped system
and maintained product documentation are authoritative.

Future Studio work must start as a new objective with current requirements and architecture review.
When that objective is complete, replace its working folder with one summary under
`docs/objectives/_archives/`.
