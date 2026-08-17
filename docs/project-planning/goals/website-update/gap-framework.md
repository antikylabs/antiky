# Framework direction gaps

Important direction that is missing or under-specified in `direction-framework.md`.

```text
Framework direction gaps
|-- Product boundary [Vision; Framework ADRs 0003-0005]
|   |-- State that Framework runs headless and does not require Studio.
|   |-- Name Antiky Labs games as the primary customer and outside reuse as a benefit.
|   |-- Give 2D, 3D, and 2.3D equal support instead of framing only one game shape.
|   `-- Grow reusable systems from complete game slices instead of designing a broad engine first.
|-- Human and agent contract [Framework ADRs 0003, 0007, 0014; CLI ADR 0001]
|   |-- Humans, agents, Studio, CLI, services, and tests must use the same engine API.
|   |-- The shared API includes commands, queries, events, diagnostics, and visual capture.
|   |-- MCP translates that API for agents; MCP tools are adapters, not the architecture.
|   |-- Read access does not imply change authority; permissions stay explicit and narrow.
|   `-- Agent changes start in bounded sandboxes and reach the primary world through commands.
|-- World model [Framework ADRs 0001, 0008, 0009, 0011]
|   |-- EngineSession owns world lifecycle, clocks, ordered work, services, and disposal.
|   |-- Entities use stable UUIDv7 IDs while hot paths use lifetime-scoped numeric aliases.
|   |-- Components need runtime schemas, typed relationships, validation, and semantic queries.
|   |-- Authoring, runtime, and render state are separate one-way projections.
|   `-- Dense data such as voxels, particles, and render batches belongs in specialized stores.
|-- Simulation and history [Framework ADRs 0002, 0013, 0017]
|   |-- Event sourcing records important authored changes and durable results, not every live value.
|   |-- Undo and redo issue correction commands; accepted history is not rewritten.
|   |-- Fixed-step simulation receives time, input, random state, and system order explicitly.
|   |-- One writer changes each authoritative world in a defined order.
|   `-- Game-code faults stop mutation but preserve inspection and disposal.
|-- Rendering and physics [Framework ADRs 0015, 0018-0019, 0021-0022; Studio ADR 0007]
|   |-- Framework owns one BroMetal render driver; direct BroMetal use is a game-owned exception.
|   |-- Framework supports WebGPU only; renderer-only game modules can use another browser renderer.
|   |-- BroMetal compiles the TypeScript DSL to WGSL before runtime, not WebGPU pipelines themselves.
|   |-- CPU/GPU authority and execution are selected per subsystem, not implied by shader compilation.
|   |-- Rapier is the CPU physics path and Nexus is the GPU physics path behind private adapters.
|   |-- Nexus/BroMetal requires qualification before GPU physics becomes a supported claim.
|   `-- GPU selection resolves temporary pick IDs to stable EntityIds before leaving the driver.
|-- Hosting, protocols, and online play [Framework ADRs 0010, 0012, 0020]
|   |-- Game modules own rules, systems, shaders, and assets; hosts own canvas and platform work.
|   |-- Serialize only across process, network, trust, storage, worker, or import/export boundaries.
|   |-- Version schemas independently from transports and validate every external boundary.
|   |-- Online sessions are server-authoritative; clients send inputs and intended actions.
|   `-- Large worlds need session placement, zones, relevance filtering, and explicit handoff rules.
|-- Repeatable game systems [Framework ADR 0005; library and asset objectives]
|   |-- The Antiky Ability System is a planned shared system grown from real game abilities.
|   |-- Assets need stable identity, dependencies, provenance, rights, and bounded discovery.
|   `-- Shader functions, programs, material recipes, driver features, and game effects are distinct.
|-- Agent-legible proof [inspection-tooling and demo-refining objectives]
|   |-- Agents need targeted queries, revision diffs, readback, diagnostics, and causal evidence.
|   |-- Deterministic scenarios, input traces, captures, and performance budgets must prove changes.
|   `-- Visual metrics can expose defects, but human creative judgment remains the quality authority.
|-- Current reality to state [current packages]
|   |-- Current: fixed-step sessions, stable IDs, bounded inspection, capture, and point-light flow.
|   |-- Emerging: the BroMetal driver and a small set of Framework-backed game slices.
|   |-- Direction: general ECS services, sandboxes, selection, physics, abilities, and online play.
|   |-- Pre-release: @antiky/framework is private, version 0.0.0, and not an npm product today.
|   `-- Avoid "most AI-native" and performance claims until comparative evidence supports them.
`-- Decisions still open [ADRs under review; active objectives and ideas]
    |-- Select the runtime schema catalog, ECS storage, and public query implementation.
    |-- Select sandbox isolation, principals, grants, event storage, and snapshot retention.
    |-- Select replication, rollback, cross-session handoff, and the authoritative server runtime.
    |-- Define the asset-ID bridge, material model, render graph, and package/versioning policy.
    |-- Define 2.3D depth, player-presentation, voxel, and game-extension boundaries from proofs.
    `-- Treat global illumination, voxel rendering, and executable requirements as research, not promises.
```
