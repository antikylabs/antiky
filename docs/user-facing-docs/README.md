# Antiky documentation

Antiky gives you a game framework, a local development command, and shared tools for people,
agents, and Studio. Start with the task you want to complete.

## Framework

- [Run a fixed-step game session](framework/engine-sessions.md) to keep game rules independent from
  display timing and support pause, resume, and single-step development controls.
- [Add point lights](framework/point-lights.md) to place local light sources in a world and change
  their power while the game runs.
- [Publish runtime inspection](framework/inspection.md) so development tools can read diagnostics,
  measurements, and game state.

## CLI

- [Run a local development session](cli/development.md) with the game, shader watcher, inspection
  service, and MCP server started together, or generate stable IDs for game data.

## MCP

- [Connect an MCP client](mcp/overview.md) to the local development session over Streamable HTTP or
  standard input/output.
- Use the [MCP tool reference](mcp/tools.md) to inspect builds and runtime state, capture frames,
  control an engine session, reload the game, and work with point lights.

## Studio

- [Inspect a running game in Studio](studio/getting-started.md) beside a native terminal, simulation
  controls, hierarchy, stores, event history, and MCP call history.
- [Connect Studio to a development session](studio/development-connection.md) through the same typed
  client used by CLI and MCP adapters.

## API reference

- Use the [framework API reference](api/reference.md) for every public export, exact TypeScript
  signature, limit, result code, and guidance on choosing the right API area.
