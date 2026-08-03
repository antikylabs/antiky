# 0008: Put EngineSession above World

## Status

Accepted

## Context

A world needs lifecycle, clocks, command ordering, assets, projections, diagnostics, and optional
rendering. Development also needs primary, preview, test, and agent-sandbox worlds to coexist without
duplicating global services or sharing mutable state.

## Decision

We will make `EngineSession` the unit of runtime lifecycle and authority above `World`. A session may
own one or more independent worlds plus their command queue, clock, services, projections,
diagnostics, assets, and optional render driver. A world owns its simulation state and may divide
space into zones or regions for loading and organization.

At MMO scale, a higher-level world host may coordinate multiple sessions for zones, shards,
instances, or matches rather than treating one process or session as the entire universe.

## Consequences

- Local, headless, preview, test, and sandbox runtimes use the same lifecycle model.
- Commands and queries must identify their target session and world explicitly.
- Shared services need clear ownership and disposal rules.
- Each authoritative world has one ordered mutation loop, even when requests arrive concurrently.
- Cross-session movement becomes an explicit handoff rather than shared-memory mutation.
