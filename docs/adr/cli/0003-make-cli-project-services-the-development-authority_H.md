# 0003: Make CLI project services the development authority

## Status

Accepted

## Context

[Studio ADR 0005](../studio/0005-use-one-antiky-project-manifest_H.md) gives one `.antiky` project
manifest and its version 1 schema.

An Antiky project is one project root that its canonical manifest path identifies. Project metadata
is durable data in the project manifest.

Development state is temporary data for one development session. It includes process, build,
connection, inspection, and cleanup facts.

CLI commands and Studio must have one authority for project metadata and development state. In this
record, the authority is the one service that accepts or rejects each local project operation.

## Decision

We will make CLI project services the authority for the local project lifecycle.

The project service will use the canonical manifest path for project identity. It will use the
manifest content hash for the project revision.

The project service will read and validate these project metadata groups:

- Schema version and project name
- Development and shader commands
- Build command
- Project-relative working directories
- Game URL and default viewport
- Loopback host, game port, and inspection port.

Studio ADR 0005 gives all version 1 fields. A subsequent schema decision must use a new schema
version when it changes these fields.

The project service will record these development-state groups:

- Development session identity
- Child-process and build state
- Runtime identity and connection state
- Inspection and MCP state
- Diagnostics and measurements
- Cleanup state.

The project manifest will not contain development state, credentials, process identifiers, website
copy, publication approval, or deployment state.

[Framework ADR 0020](../framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md)
gives the game-project boundary. A game project will contain its game code, shaders, assets, tests,
build configuration, package data, and documentation.

The game project will not contain a development game host or process supervisor.

The project service will start the development build process and the development game host. It will
also start inspection and MCP services for the same development session.

CLI commands and Studio will call the project service with the library API in
[CLI ADR 0002](0002-supply-cli-project-services-through-a-library-api_H.md).

## Consequences

- CLI and Studio accept or reject the same project data.
- One service has primary responsibility for startup order, state, and cleanup.
- A developer can read the durable project manifest.
- The project manifest does not contain temporary state.
- A game project does not contain a local server or development host.
- A project schema change must have a new schema version and migration rules.
- The Antiky project does not contain website publication data.
