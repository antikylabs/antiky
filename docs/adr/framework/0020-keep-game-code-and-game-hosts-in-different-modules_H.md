# 0020: Keep game code and game hosts in different modules

## Status

Accepted

## Context

A game host is the platform adapter in
[Framework ADR 0016](0016-give-platform-work-to-game-host_H.md). The first game host in that record
is Antiky Town code.

As a result, the same host code can occur in many game projects. Different host code can also cause
different behavior in each delivery target.

Antiky uses game code in CLI, Studio, website, and test hosts. The same game module must operate in
each host.

A game module is the compiled JavaScript entry that gives game code to an Antiky game host.

`Mount` is a technical verb. A host mounts a game module when it connects the module to one canvas
and starts a game instance.

## Decision

We will keep game code and game hosts in different modules.

An Antiky game project will contain these runtime items:

- Game rules and game state
- `EngineSession` setup and game systems
- Semantic input actions
- Render data, shaders, and assets
- One game module entry.

The project can also contain source files, tests, build data, package data, and documentation.

The game host will have primary responsibility for these platform items:

- Canvas creation or selection
- Raw device events
- Platform time
- Focus, visibility, and window-size signals
- Presentation callback requests and cancellation
- Platform listener removal
- Lifecycle of development services.

The game host will change raw device events into semantic input. It will give platform time,
platform signals, and semantic input to the `EngineSession`.

The `EngineSession` will have primary responsibility for simulation. The render driver will have
primary responsibility for graphics resources and graphics work.

The CLI and Studio will supply the development game host. A delivery target will supply a game host
when it operates a compiled game module.

The game module entry will give a new game instance to the host. It will not start a local server,
process supervisor, inspection service, or MCP endpoint.

The game module will not import CLI, Studio, website, or server code. The host will mount the game
module on a canvas that the host selects.

The compiled output will contain the game module and all necessary runtime files. It will not
contain a development game host.

This record replaces Framework ADR 0016.

## Consequences

- One game module can operate in different game hosts.
- Game developers can write game rules, shaders, assets, and render code.
- CLI and Studio must use one development game host implementation.
- A website must supply a game host for a compiled game module.
- The game module interface becomes a compatibility boundary.
- A game host must stop game instances and remove its platform listeners.
- Game-code tests do not use a canvas, local server, or development service.
- The CLI package must contain the Antiky Town host code.
