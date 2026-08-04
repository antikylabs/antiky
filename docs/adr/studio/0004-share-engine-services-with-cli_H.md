# 0004: Make CLI and Studio use the same engine services

## Status

Accepted

## Context

Antiky has two development clients: the command-line interface (CLI) and Studio.

Both clients must start or find a game session. Both clients must inspect the session and send
permitted requests.

Separate control services would create duplicate behavior. They would also create different results
for a terminal user, a Studio user, and an agent.

Studio needs visual workflows. The CLI needs scripts and concise terminal output. These presentation
needs do not require different engine behavior.

## Decision

CLI and Studio will be separate clients of the same Antiky engine services.

The framework will own engine commands, queries, events, diagnostics, captures, and semantic
measurements. A semantic measurement describes game or engine state, such as a simulation step or
draw count.

The first CLI package will be `@antiky/cli`. It will supply the `antiky` command.

`antiky dev` will start and supervise the local development host and game process. The development
host will own local process state, build state, connections, and cleanup.

Studio will attach to the same development host. It will not create a separate engine control path.

A future Studio host can start the same launch service when a real use case needs direct
integration. It must not create a second launch implementation.

CLI output, Studio panels, MCP, and tests are adapters. They will call the same framework services.
They will not contain engine rules.

An adapter can use direct calls or a validated data boundary. The connection method must not change
the meaning or authority of an operation.

The framework core will not import Node.js process APIs, Tauri APIs, Studio code, or MCP code.

## Consequences

- A game can use the CLI without Studio.
- Studio can attach to a game that the CLI already started.
- CLI and Studio need one compatible session and inspection contract.
- Studio must not parse terminal text to get engine state.
- The development host must separate engine facts from process and build facts.
- Framework tests can prove behavior once for CLI, Studio, MCP, and other clients.
- Each adapter still needs tests for its connection, presentation, permissions, and failure behavior.
- The project will extract a separate launch library only when a second in-process consumer needs it.
