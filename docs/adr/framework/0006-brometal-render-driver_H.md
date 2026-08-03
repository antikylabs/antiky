# 0006: Keep BroMetal behind an Antiky render driver

## Status

Accepted

## Context

BroMetal provides the shader compiler and GPU runtime that Antiky uses. It does not own world
semantics, gameplay, persistence, networking, Studio, or agent protocols. Allowing BroMetal types and
resources to spread through those layers would couple the framework to one renderer contract and
prevent the core runtime from operating headlessly.

## Decision

We will treat BroMetal as Antiky's rendering backend and isolate it behind an Antiky-owned
`RenderDriver`. The driver owns BroMetal programs, textures, render targets, buffers, GPU state, and
disposal. Framework-facing render data uses Antiky identifiers, pipeline keys, assets, and typed
deltas rather than BroMetal objects.

BroMetal changes proposed upstream will remain renderer-general capabilities or correctness fixes.

## Consequences

- Framework, server, persistence, Studio, and protocol code can run without BroMetal or a DOM.
- BroMetal upgrades and backend details are concentrated in one adapter and its tests.
- Render extraction must translate Antiky state into the driver's efficient input format.
- Antiky owns render orchestration, dependency inspection, and safe resource replacement.
- Some useful GPU features may require focused upstream BroMetal work.
