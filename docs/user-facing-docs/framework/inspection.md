# Runtime inspection

Runtime inspection lets development tools see what your game is doing while it runs. Publish one
snapshot to expose the game's lifecycle, diagnostics, performance measurements, and optional
session, world, store, and event state to the CLI, MCP clients, Studio, and your tests.

## Publish a snapshot

Create a snapshot whenever the state you want development tools to read changes:

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

`createInspectionSnapshot` checks the complete value, rejects unknown fields, copies caller-owned
data, and returns an immutable snapshot.

## Choose what to report

| Area | What it describes |
| --- | --- |
| `runtime` | The current game-runtime ID and lifecycle |
| `diagnostics` | Problems or useful notices from the framework or renderer |
| `measurements.runtime` | Frame count and an optional frames-per-second sample |
| `measurements.render` | Canvas size, draw calls, instance count, and upload bytes per frame |
| `session` | Optional engine-session identity, clock, controls, order, and revisions |
| `pointLights` | Optional point-light state and accepted change history |
| `world` | Optional entities, component summaries, `ChildOf` hierarchy, and named store views |
| `events` | Optional accepted event-sourcing facts and their declared retention policy |

Report only measurements that your game can obtain truthfully. Omit an optional value instead of
estimating it.

Every measurement inside this snapshot uses `owner: 'framework'`. Process-launch and build timing
belong to the CLI development snapshot, not the framework snapshot.

## Keep the latest snapshot

`createInspectionStore` keeps the current snapshot and lets other parts of your game read or
subscribe to it:

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

`read` returns the latest snapshot. `subscribe` receives each later publication in sequence
order. Publishing validates and copies the new value before subscribers receive it, so do not use a
snapshot as mutable game state.

## Include point lights

If your game owns a point-light service, turn its state into an inspection view with
`inspectPointLightService`:

```ts
import {
  createInspectionSnapshot,
  inspectPointLightService,
} from '@antiky/framework';

const pointLights = inspectPointLightService(lightService);

const snapshotWithLights = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: {
    instanceId: pointLights.runtime.instanceId,
    lifecycle: 'running',
  },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 120 },
    render: { owner: 'framework', drawCalls: 16 },
  },
  pointLights,
});
```

The point-light view includes stable world and entity IDs, authored values and revisions, current
game values, optional render bindings, pending render slots, and accepted facts. It does not include
credentials, permissions, renderer objects, or GPU resources.

The point-light runtime ID must match the runtime ID on the enclosing snapshot. Games that do not
use the point-light service leave `pointLights` out.

See [Point lights](point-lights.md) for creation, live changes, and renderer integration.

If your game uses an `EngineSession`, include `session.readStatus()` as `session`. Its runtime ID
must match the enclosing snapshot. See [Run a fixed-step game session](engine-sessions.md) for the
clock and control workflow.

## Publish hierarchy, stores, and events

Publish `world` when tools need more than one feature-specific inspection view. A world view contains
stable entity headers, bounded component summaries, real `ChildOf` relationships, and named store
views. A store view is a safe copy of useful authoring, runtime, or render data. It is not a live
`Map`, engine handle, renderer object, or GPU resource.

Publish `events` for accepted domain facts that your game deliberately event-sources. Do not put
simulation steps, rejected commands, diagnostics, or development-tool traffic in this history.

The point-light service supplies a complete adapter for both views:

```ts
import {
  createInspectionSnapshot,
  createPointLightWorldViews,
  inspectPointLightService,
} from '@antiky/framework';

const pointLights = inspectPointLightService(lightService);
const { world, events } = createPointLightWorldViews(pointLights);

const snapshotWithWorld = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: {
    instanceId: pointLights.runtime.instanceId,
    lifecycle: 'running',
  },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 120 },
    render: { owner: 'framework', drawCalls: 16 },
  },
  pointLights,
  world,
  events,
});
```

For another game system, call `createWorldInspection` and `createEventHistory` with semantic copies
from that system. Both functions reject unknown fields and return immutable values.

### Describe a world view

Every entity has a stable UUIDv7, label, revision, and zero or more component summaries. A component
summary has a stable type ID, schema version, short text summary, and bounded JSON data. Use a
`ChildOf` relationship only for a real parent-child relationship. Unparented entities remain valid
roots in the hierarchy.

Each named store declares one of these kinds:

| Kind | Use |
| --- | --- |
| `authoring` | Values that a developer or command authored |
| `runtime` | The current game-side projection |
| `render` | The render-side projection or binding state |

Counts state how many records are available and retained. Set `incomplete: true` when a bounded view
retains fewer records than its source. Consumers can then show partial data without treating it as
complete.

One world view can retain at most 512 entities, 2,048 component summaries, 1,024 relationships, 64
stores, and 2,048 total store entries. Each structured component, store, or event value is copied
and bounded before publication.

### Describe event retention

An event history identifies one source, world, and runtime. Each retained fact keeps its source
sequence, event schema and type, command ID, related entity IDs, resulting revision, UTC time, and
bounded data. Sequences are contiguous in source order.

The source must declare its retention instead of making a consumer guess:

| Field | Values | Meaning |
| --- | --- | --- |
| `lifetime` | `runtime-instance`, `session`, or `durable` | The identity boundary after which history can disappear |
| `storage` | `memory` or `persistent` | Where the source keeps accepted facts |
| `overflow` | `reject-new` or `drop-oldest` | What happens when capacity is full |
| `capacity` | Positive integer | Maximum records in the source |
| `droppedCount` | Non-negative integer | Older accepted facts no longer in this view |

An inspection response retains at most 512 events. `incomplete` and the available and retained
counts must agree with `droppedCount`. A `runtime-instance` and `memory` history disappears when the
game runtime is replaced. It is not durable replay storage.

## Report diagnostics

A diagnostic contains:

| Field | Meaning |
| --- | --- |
| `id` | A stable ID for this occurrence |
| `owner` | `framework` inside a framework snapshot |
| `source` | `runtime` or `render` |
| `code` | A stable uppercase code for control flow |
| `severity` | `info`, `warning`, or `error` |
| `message` | A bounded explanation for a person |
| `relatedIds` | Up to 16 related runtime, build, capture, or action IDs |

A snapshot can contain up to 64 diagnostics. Consumers should use `code` to choose recovery and
show `message` to a person.

## Handle invalid snapshots

Invalid input throws `InspectionValidationError`. Its stable code is
`ANTIKY_INSPECTION_INVALID`, and its `path` identifies the rejected field. Treat the whole
publication as rejected; do not publish a partial snapshot.

The inspection module is headless. It does not import browser, Node.js, React, Studio, MCP, or
renderer code. Your game adapter reads real state from those systems and maps it into this public
snapshot.

After `antiky dev` connects to the game, use `antiky inspect` or the
[MCP inspection tools](../mcp/tools.md#development-state-tools) to read the published state.
