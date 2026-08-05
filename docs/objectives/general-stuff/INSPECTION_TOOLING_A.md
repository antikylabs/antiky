# Antiky Inspection Tooling Direction

**Status: Accepted direction for Slice 00**

## Purpose

This document defines what Antiky takes from WebGPU Inspector research. It also defines what Antiky
must build itself.

WebGPU Inspector is a design reference only. Antiky does not install, inject, wrap, launch, or
depend on it.

## Useful reference ideas

WebGPU Inspector shows useful inspection patterns:

- Give resources stable labels.
- Show live objects and their lifecycle.
- Relate a frame to its passes, commands, shaders, buffers, textures, and errors.
- Use capture IDs so a result can link to the run that made it.
- Summarize or paginate large results.
- Keep captures suitable for later diagnosis.

These ideas do not define Antiky's API. They help Antiky design native tools.

## Minimum for Slice 00

Slice 00 builds a small native inspection surface.

The framework supplies:

- A versioned immutable `InspectionSnapshot`.
- A stable runtime-instance ID and lifecycle state.
- Structured diagnostics with stable codes and related IDs.
- Frame and render measurements that the current demo can report truthfully.
- Read and subscribe operations over one source of truth.

The CLI development host supplies:

- A stable development-session ID.
- The accepted build revision.
- Process, build, connection, and cleanup state.
- A versioned `DevelopmentSnapshot` that includes the framework snapshot.

Direct tests, CLI, MCP, and the future Studio connection use these same services. They do not read
React state, terminal text, screenshots, BroMetal objects, or raw GPU objects to calculate engine
facts.

Slice 00 also supplies controlled reload and frame-capture operations. Their results include the
development-session, runtime, and build IDs. A screenshot supports visual review. It is not the
source of engine facts.

## Deferred inspection

Later render slices can add these capabilities when a real feature needs them:

- GPU resource inventory and lifecycle counts.
- Render-pass and command timelines.
- Shader and pipeline diagnostics.
- Buffer and texture summaries or previews.
- GPU timing and memory measurements.
- Multi-frame capture, export, and replay.

These items are candidates, not Slice 00 commitments.

## Rules for later additions

Add an inspection capability only when a slice can name its consumer and proof.

- Antiky owns entity, command, revision, permission, projection, and diagnostic meaning.
- BroMetal owns typed GPU work and can expose low-level measurements through a narrow adapter.
- Keep CPU state authoritative. Inspection must not use GPU readback to decide game behavior.
- Return versioned and bounded data. Do not return live engine, DOM, BroMetal, or GPU objects.
- Keep browser extensions, CDP controllers, and inspection bridges out of production output.
- Update `docs/user-facing-docs/` when a shipped inspection workflow changes.

## References

- [Development harness research](DEV_HARNESS_RESEARCH_A.md)
- [Antiky Town Slice 00 plan](../antiky-town/slice-00/plan.md)
- [WebGPU Inspector](https://github.com/brendan-duncan/webgpu_inspector)
