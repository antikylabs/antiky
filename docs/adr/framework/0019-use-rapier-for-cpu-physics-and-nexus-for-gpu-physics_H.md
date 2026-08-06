# 0019: Use Rapier for CPU physics and Nexus for GPU physics

## Status

Accepted

## Context

[ADR 0018](0018-select-physics-authority-and-execution-independently_H.md) selects physics authority
and physics execution independently. It does not select a physics engine.

A CPU physics path keeps authoritative physics state in CPU memory. The CPU calculates each physics
result.

A GPU physics path keeps authoritative physics state in GPU memory. The GPU calculates each physics
result.

[Rapier](https://rapier.rs/) is a 2D and 3D physics engine. It has rigid-body physics, collision
queries, JavaScript bindings, and optional cross-platform determinism.

[Nexus](https://github.com/dimforge/nexus) is a 2D and 3D GPU physics engine. It uses WebGPU compute
shaders for rigid-body physics.

On 2026-08-05, the Nexus project uses the label "heavy development" and identifies missing
features.

Only the Antiky render driver can use BroMetal in
[ADR 0006](0006-brometal-render-driver_H.md). Antiky does not have a Nexus and BroMetal integration.

## Decision

Antiky will use Rapier for each CPU physics path.

Antiky will use Nexus for each GPU physics path.

A private Antiky adapter will contain each physics engine.

These items will use Antiky types:

- Public application programming interfaces (APIs)
- World state
- Saved data
- Domain events
- Commands
- Snapshots.

Rapier and Nexus types, objects, and temporary handles will stay private to their adapters.

Antiky will do qualification tests for each selected version of a physics engine before a release.

Antiky will do qualification tests of the Nexus and BroMetal integration. Before Antiky uses GPU
physics, these test results must be satisfactory. This ADR does not select that integration.

This ADR does not select a Rapier language binding or a public physics API.

Rapier and Nexus can calculate different results from the same input. ADR 0018 still identifies
which `EngineSession` can accept a physics result.

## Consequences

- The CPU physics path will use Rapier.
- The GPU physics path will use Nexus.
- Antiky must have two private adapters and two conformance test suites.
- Rapier supplies a CPU path for browser, headless, and server runtimes.
- Nexus can keep authoritative local physics state in GPU memory.
- Nexus development and missing features increase dependency risk.
- Antiky must complete the Nexus and BroMetal integration and its qualification tests.
- Rapier and Nexus can calculate different results from the same input.
- If Antiky changes either physics engine, it must add a new ADR.
