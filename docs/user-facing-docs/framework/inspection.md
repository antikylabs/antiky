# Runtime Inspection

`@antiky/framework` supplies one structured source for runtime diagnostics and semantic measurements.
Your game can publish those facts once and let direct tests, the Antiky CLI, MCP clients, and Studio
integrations read the same state.

## Create a snapshot

Use `createInspectionSnapshot` at a trust boundary. It validates the complete value, rejects unknown
fields, clones caller-owned data, and freezes the result.

```ts
import {
  INSPECTION_SCHEMA_VERSION,
  createInspectionSnapshot,
} from '@antiky/framework';

const snapshot = createInspectionSnapshot({
  schemaVersion: INSPECTION_SCHEMA_VERSION,
  runtime: {
    instanceId: crypto.randomUUID(),
    lifecycle: 'running',
  },
  diagnostics: [],
  measurements: {
    runtime: {
      owner: 'framework',
      frameCount: 120,
      framesPerSecond: 60,
    },
    render: {
      owner: 'framework',
      canvasWidth: 1280,
      canvasHeight: 720,
      drawCalls: 16,
      instances: 1247,
      uploadBytesPerFrame: 320,
    },
  },
});
```

The framework owns every fact in `measurements`. Development-process and build measurements belong
to the CLI development host and do not enter this object.

## Read and subscribe

`createInspectionStore` keeps the latest immutable snapshot. `read` returns that snapshot.
`subscribe` reports each later publication in sequence order.

```ts
import { createInspectionStore } from '@antiky/framework';

const store = createInspectionStore(snapshot);
const unsubscribe = store.subscribe(({ sequence, snapshot: next }) => {
  console.log(sequence, next.runtime.instanceId, next.runtime.lifecycle);
});

store.publish({
  ...snapshot,
  runtime: { ...snapshot.runtime, lifecycle: 'paused' },
});

unsubscribe();
```

Publishing validates and clones the new value before subscribers receive it. Do not use a snapshot
as mutable application state.

## Diagnostics

A diagnostic contains these fields:

- `id`: a stable ID for this diagnostic.
- `owner`: always `framework` in an inspection snapshot.
- `source`: `runtime` or `render`.
- `code`: a stable uppercase machine code.
- `severity`: `info`, `warning`, or `error`.
- `message`: a bounded human-readable explanation.
- `relatedIds`: up to 16 runtime, build, capture, or action IDs.

A snapshot contains at most 64 diagnostics. A client must use `code` for control flow and can show
`message` to a person.

## Measurements

Runtime measurements contain the total frame count and an optional frames-per-second sample.
Render measurements can contain canvas size, draw calls, instances, and CPU-to-GPU bytes for each
frame. A producer omits a value that it cannot report truthfully.

The inspection module is headless. It does not import Node.js, React, Next.js, BroMetal, Studio, MCP,
or browser globals. A host adapter maps its real runtime facts into this contract.

## Validation errors

Invalid input throws `InspectionValidationError`. The error has the stable code
`ANTIKY_INSPECTION_INVALID` and a `path` that identifies the rejected field. Treat this error as a
request rejection. Do not publish a partial snapshot.

See the [framework system overview](../../architecture/framework/overview_A.md) for the ownership and
state-flow rules.
