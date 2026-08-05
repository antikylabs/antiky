# Antiky documentation

Antiky gives you a game framework, a local development command, and shared tools for people,
agents, and Studio. Start with the task you want to complete.

## Framework

- [Add point lights](framework/point-lights.md) to place local light sources in a world and change
  their power while the game runs.
- [Publish runtime inspection](framework/inspection.md) so development tools can read diagnostics,
  measurements, and game state.

## CLI

- [Run a local development session](cli/development.md) with the game, shader watcher, inspection
  service, and MCP server started together.

## MCP

- [Connect an MCP client](mcp/overview.md) to the local development session over Streamable HTTP or
  standard input/output.
- Use the [MCP tool reference](mcp/tools.md) to inspect builds and runtime state, capture frames,
  reload the game, and work with point lights.

## Studio

- [Connect Studio to a development session](studio/development-connection.md) and use the same live
  state as the CLI and MCP clients.

## Documentation contributors

Read the [documentation standards](DOCUMENTATION_STANDARDS_A.md) before you add or change a
user-facing page. Planning records, implementation reports, and demo verification belong elsewhere
in the repository.
