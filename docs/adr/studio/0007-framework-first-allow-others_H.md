# 0007: Use Antiky Framework first and select the renderer in the game module

## Status

Accepted

## Context

[Framework ADR 0006](../framework/0006-brometal-render-driver_H.md) selects BroMetal as the Framework render driver.
In [Framework ADR 0015](../framework/0015-webgpu-support-only_H.md), the Framework render driver uses WebGPU only.
[Framework ADR 0020](../framework/0020-keep-game-code-and-game-hosts-in-different-modules_H.md) gives the boundaries of the game module and the game host.
In [Studio ADR 0006](0006-use-cli-project-services-directly_H.md), Studio uses command-line interface (CLI) project services.

The development game host is software that connects a game module to the development tools.
A game module supplies `frame` and `dispose` operations to the game host.
A renderer is software that draws the game on the host canvas.
Inspection data is a copy of game state for the development tools.
This game-module contract does not select a renderer.

## Decision

We will use Antiky Framework first for Antiky game features.
BroMetal will stay as the Framework render driver.
The Framework render driver will use WebGPU only.

Studio and the CLI will use the game-module contract to load each project.
The game host will not select, import, or call a renderer.
Pure BroMetal is BroMetal without Antiky Framework.
A renderer-only game module uses a renderer without Antiky Framework.
The contract lets a game module use these renderers:

- Antiky Framework with BroMetal
- Pure BroMetal
- Three.js
- A different browser renderer.

This decision does not add Three.js or WebGL to Antiky Framework.
A renderer must run in the browser and use the host canvas.
The game module must supply the necessary lifecycle operations.

The game module initializes and resizes the renderer.
The game module disposes its renderer resources.
These two statements apply to a game module that owns its renderer.
If a game module uses the framework render driver, that driver owns the renderer resources.
[Framework ADR 0021](../framework/0021-brometal-render-driver-ownership_H.md) gives the full rule.
The game host supplies the canvas and input.
The game host calls `frame` and replaces the game module.

The game host supplies host inspection for all game modules.
Host inspection gives lifecycle data, canvas dimensions, game measurements, runtime errors, reload, and canvas capture.
The game module supplies each game measurement.
The game host does not calculate renderer measurements.

Semantic inspection data can show a game hierarchy, stores, events, and an engine session.
A Framework game module can publish semantic inspection data.
Studio will not inspect renderer objects.

If a renderer-only game module publishes semantic inspection data, Studio can show the data.
The game module must use the optional inspection port to publish this data.

## Consequences

Studio and the CLI have no renderer-specific branch.
Project manifests have no renderer field.
Renderer-only game modules can run without an Antiky Framework dependency.

If a renderer-only game module does not publish semantic inspection data, Studio does not show that data.

Host inspection stays available for all game modules.

A renderer does not supply Framework features or semantic inspection data.
Antiky Framework stays WebGPU-only.
Three.js stays a game-module selection, not a Framework render driver.

## Revision history

- `f403e4b2d125d7d13cb69c6cead4866c9f340023`: Prior version before the ADR 0021 render driver clarification.
- `d59e241c5dc6948743a5f70db1e41ae65c183b44`: Replaced em dash punctuation with standard punctuation.
