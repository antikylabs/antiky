# 0009: Keep authoring, runtime, and render state separate

## Status

Accepted

## Context

Authoring tools need stable data that people can understand and save. Runtime code needs simulation
data that it can change quickly. Render code needs dense batches for the GPU.

One shared object structure cannot meet all three needs. It would expose private details, require
unnecessary serialization, and slow frequent operations.

## Decision

Antiky will keep separate copies of authoring, runtime, and render state. Small updates will move
in one direction:

```text
authoring -> runtime -> render -> RenderDriver
```

Authoring state records the durable intent of a creator. Runtime state contains the current
simulation and specialized storage.

Render state contains draw items, batches, visible items, and changed data ranges.

Runtime code must not change authoring state through shared references. Render code must not change
runtime state through shared references. Diagnostics and read-only views can flow back to
clients.

## Consequences

- Each state copy can use the best data layout for its work.
- In one process, typed mappings and small updates connect the state copies. Serialization is not
  necessary.
- State copies can get out of sync. This error is projection drift. Sequence checks, rebuild
  operations, and tests must detect and correct it.
- The same change can exist in more than one state copy. The code must track these copies.
- GPU resources are temporary implementation data. They are not the true world state.

## Revision history

- `4c35b270f3da017454b12dd75e104b0c50355818` — Prior version before the plain-language rewrite.
