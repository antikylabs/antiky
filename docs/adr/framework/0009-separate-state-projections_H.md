# 0009: Separate authoring, runtime, and render state

## Status

Accepted

## Context

Authoring tools need stable, serializable semantics; simulation needs mutable, cache-friendly state;
rendering needs dense GPU-oriented batches. One shared object graph cannot serve all three without
leaking implementation details, forcing unnecessary serialization, or making hot paths inefficient.

## Decision

We will maintain authoring, runtime, and render state as distinct representations connected by
one-way incremental projections:

```text
authoring -> runtime -> render -> RenderDriver
```

Authoring state expresses durable intent. Runtime state owns simulation and specialized stores.
Render state owns extracted draw items, batches, visibility, and dirty ranges. Lower layers will not
mutate their source representation through shared references; diagnostics and read models may flow
outward.

## Consequences

- Each representation can use the data layout appropriate to its workload.
- In-process transitions use typed mapping and deltas rather than encode/decode cycles.
- Projection drift is a new failure mode and requires sequence checks, rebuild paths, and tests.
- Changes may exist in more than one representation, increasing explicit bookkeeping.
- GPU resources remain disposable implementation state rather than world truth.
