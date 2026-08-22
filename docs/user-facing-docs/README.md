# Antiky documentation

Antiky gives you a game framework, a local development command, and shared tools for people,
agents, and Studio. Start with the task you want to complete.

## Assets

- [Find and use game assets](assets/catalog.md) with explicit CC0 licensing, source links, useful
  metadata, permanent pages, and structured records for agents.

## Framework

- [Build a game module](framework/game-modules.md) that mounts on a host-owned canvas without
  owning a server or development service.
- [Run a fixed-step game session](framework/engine-sessions.md) to keep game rules independent from
  display timing and support pause, resume, and single-step development controls.
- [Add point lights](framework/point-lights.md) to place local light sources in a world and change
  their power while the game runs.
- [Publish runtime inspection](framework/inspection.md) so development tools can read diagnostics,
  measurements, and game state.

## CLI

- [Initialize a project and run a local development session](cli/development.md) with one manifest,
  the game, shader watcher, inspection service, and MCP server.

## MCP

- [Connect an MCP client](mcp/overview.md) to the local development session over Streamable HTTP or
  standard input/output.
- Use the [MCP tool reference](mcp/tools.md) to inspect builds and runtime state, capture frames,
  control an engine session, reload the game, and work with point lights.

## Studio

- [Create and open an Antiky project](studio/projects.md) with one named manifest shared by Studio,
  Finder, and the CLI.
- [Inspect a running game in Studio](studio/getting-started.md) beside a native terminal, simulation
  controls, hierarchy, stores, event history, and MCP call history.
- [Connect Studio to a project service](studio/development-connection.md) through the same lifecycle
  library and typed client used by CLI and MCP adapters.
- [Use BroMetal or Three.js in Studio](studio/renderers.md) while keeping the host lifecycle,
  measurements, captures, and local agent connection.

## Skills

- [Understand Antiky agent skills](skills/overview.md), their portable format, and their
  compatibility boundary.
- [Install and manage Antiky skills](skills/install.md) for one project, one agent, or your user
  account.
- Use the [Ready skills reference](skills/reference.md) to look up public skill names, purposes, and
  subcommands.

## API reference

- Use the [framework API reference](api/reference.md) for every public export, exact TypeScript
  signature, limit, result code, and guidance on choosing the right API area.
