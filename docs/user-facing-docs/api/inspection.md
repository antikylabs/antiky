---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:8832ca5e375d42b2
---

# Inspection API

Publish immutable runtime snapshots, bounded world views, and declared event history to development tools.

Use inspection as a read-only adapter boundary; keep live engine objects, credentials, and renderer resources out of it.

For the task-first workflow, read [Publish runtime inspection](../framework/inspection.md). Import every API on this page from `@antiky/framework`.

## Example

Create the initial immutable snapshot before exposing the store to development adapters.

```ts
import {
  INSPECTION_SCHEMA_VERSION,
  createInspectionSnapshot,
  createInspectionStore,
} from '@antiky/framework';

const store = createInspectionStore(createInspectionSnapshot({
  schemaVersion: INSPECTION_SCHEMA_VERSION,
  runtime: { instanceId: 'game-runtime-1', lifecycle: 'running' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 0 },
    render: { owner: 'framework' },
  },
}));
```

## Runtime snapshots

Validate a complete runtime view and publish its latest value to subscribers in sequence order.

### `INSPECTION_SCHEMA_VERSION`

The schema version required by runtime inspection snapshots.

```ts
const INSPECTION_SCHEMA_VERSION = 1 as const;
```

### `MAX_INSPECTION_DIAGNOSTICS`

The maximum diagnostics retained in one snapshot.

```ts
const MAX_INSPECTION_DIAGNOSTICS = 64;
```

### `MAX_DIAGNOSTIC_RELATED_IDS`

The maximum related IDs attached to one diagnostic.

```ts
const MAX_DIAGNOSTIC_RELATED_IDS = 16;
```

### `RuntimeLifecycle`

The observable lifecycle states a game runtime can report.

```ts
type RuntimeLifecycle = 'initializing' | 'ready' | 'running' | 'paused' | 'error' | 'stopped';
```

### `DiagnosticSeverity`

The display and urgency level of an inspection diagnostic.

```ts
type DiagnosticSeverity = 'info' | 'warning' | 'error';
```

### `DiagnosticSource`

The framework boundary that produced a diagnostic.

```ts
type DiagnosticSource = 'runtime' | 'render';
```

### `InspectionDiagnosticInput`

Mutable-friendly input shape accepted for one diagnostic.

```ts
type InspectionDiagnosticInput = {
    id: string;
    owner: 'framework';
    source: DiagnosticSource;
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    relatedIds: string[];
};
```

### `InspectionRuntimeMeasurementsInput`

Input frame measurements owned by the framework.

```ts
type InspectionRuntimeMeasurementsInput = {
    owner: 'framework';
    frameCount: number;
    framesPerSecond?: number;
};
```

### `InspectionRenderMeasurementsInput`

Optional renderer measurements accepted in a snapshot.

```ts
type InspectionRenderMeasurementsInput = {
    owner: 'framework';
    canvasWidth?: number;
    canvasHeight?: number;
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
};
```

### `InspectionSnapshotInput`

Complete input shape accepted by `createInspectionSnapshot`.

```ts
type InspectionSnapshotInput = {
    schemaVersion: typeof INSPECTION_SCHEMA_VERSION;
    runtime: {
        instanceId: string;
        lifecycle: RuntimeLifecycle;
    };
    diagnostics: InspectionDiagnosticInput[];
    measurements: {
        runtime: InspectionRuntimeMeasurementsInput;
        render: InspectionRenderMeasurementsInput;
    };
    session?: EngineSessionStatus;
    pointLights?: PointLightInspectionInput;
    world?: WorldInspectionInput;
    events?: EventHistoryInput;
};
```

### `InspectionDiagnostic`

An immutable validated diagnostic with a stable code and related IDs.

```ts
type InspectionDiagnostic = Readonly<{
    id: string;
    owner: 'framework';
    source: DiagnosticSource;
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    relatedIds: readonly string[];
}>;
```

### `InspectionRuntimeMeasurements`

Validated runtime frame measurements.

```ts
type InspectionRuntimeMeasurements = Readonly<{
    owner: 'framework';
    frameCount: number;
    framesPerSecond?: number;
}>;
```

### `InspectionRenderMeasurements`

Validated optional renderer measurements.

```ts
type InspectionRenderMeasurements = Readonly<{
    owner: 'framework';
    canvasWidth?: number;
    canvasHeight?: number;
    drawCalls?: number;
    instances?: number;
    uploadBytesPerFrame?: number;
}>;
```

### `InspectionSnapshot`

The immutable top-level runtime view shared by CLI, MCP, Studio, and tests.

```ts
type InspectionSnapshot = Readonly<{
    schemaVersion: typeof INSPECTION_SCHEMA_VERSION;
    runtime: Readonly<{
        instanceId: string;
        lifecycle: RuntimeLifecycle;
    }>;
    diagnostics: readonly InspectionDiagnostic[];
    measurements: Readonly<{
        runtime: InspectionRuntimeMeasurements;
        render: InspectionRenderMeasurements;
    }>;
    session?: EngineSessionStatus;
    pointLights?: PointLightInspection;
    world?: WorldInspection;
    events?: EventHistory;
}>;
```

### `InspectionUpdate`

A published snapshot paired with its store-local sequence.

```ts
type InspectionUpdate = Readonly<{
    sequence: number;
    snapshot: InspectionSnapshot;
}>;
```

### `InspectionSubscriber`

A callback invoked for each later inspection publication.

```ts
type InspectionSubscriber = (update: InspectionUpdate) => void;
```

### `InspectionSource`

Read-and-subscribe interface for consumers that cannot publish.

```ts
interface InspectionSource {
    read(): InspectionSnapshot;
    subscribe(subscriber: InspectionSubscriber): () => void;
}
```

### `InspectionStore`

Inspection source that can validate and publish a new snapshot.

```ts
interface InspectionStore extends InspectionSource {
    publish(input: unknown): InspectionUpdate;
}
```

### `InspectionValidationError`

Thrown for an invalid snapshot; `code` and `path` identify the stable failure.

```ts
class InspectionValidationError extends Error {
    readonly code = 'ANTIKY_INSPECTION_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `createInspectionSnapshot`

Validates, copies, and freezes an entire runtime snapshot.

```ts
function createInspectionSnapshot(input: unknown): InspectionSnapshot;
```

### `createInspectionStore`

Keeps the latest validated snapshot and notifies subscribers in order.

```ts
function createInspectionStore(initialSnapshot: unknown): InspectionStore;
```

## World views

Describe bounded entity, relationship, component, and store data without exposing mutable engine state.

### `WORLD_INSPECTION_SCHEMA_VERSION`

The schema version required by generic world views.

```ts
const WORLD_INSPECTION_SCHEMA_VERSION = 1 as const;
```

### `MAX_WORLD_INSPECTION_ENTITIES`

The maximum entity headers retained in one world view.

```ts
const MAX_WORLD_INSPECTION_ENTITIES = 512;
```

### `MAX_WORLD_INSPECTION_COMPONENTS`

The maximum component summaries retained across a world view.

```ts
const MAX_WORLD_INSPECTION_COMPONENTS = 2048;
```

### `MAX_WORLD_INSPECTION_RELATIONSHIPS`

The maximum parent-child relationships retained in one world view.

```ts
const MAX_WORLD_INSPECTION_RELATIONSHIPS = 1024;
```

### `MAX_WORLD_INSPECTION_STORES`

The maximum named stores retained in one world view.

```ts
const MAX_WORLD_INSPECTION_STORES = 64;
```

### `MAX_WORLD_INSPECTION_STORE_ENTRIES`

The maximum entries retained across all world stores.

```ts
const MAX_WORLD_INSPECTION_STORE_ENTRIES = 2048;
```

### `InspectionCountInput`

Available and retained counts supplied while building a bounded view.

```ts
type InspectionCountInput = {
    available: number;
    retained: number;
};
```

### `WorldInspectionComponentInput`

Untrusted component-summary input before JSON copying and validation.

```ts
type WorldInspectionComponentInput = {
    typeId: string;
    schemaVersion: number;
    summary: string;
    data: unknown;
};
```

### `WorldInspectionEntityInput`

Untrusted entity header and component input.

```ts
type WorldInspectionEntityInput = {
    entityId: unknown;
    label: string;
    revision: number;
    components: WorldInspectionComponentInput[];
};
```

### `ChildOfInspectionInput`

Untrusted parent-child relationship input.

```ts
type ChildOfInspectionInput = {
    type: 'ChildOf';
    childEntityId: unknown;
    parentEntityId: unknown;
};
```

### `WorldInspectionStoreEntryInput`

Untrusted key, optional entity link, and JSON store data.

```ts
type WorldInspectionStoreEntryInput = {
    key: string;
    entityId?: unknown;
    data: unknown;
};
```

### `WorldInspectionStoreInput`

Untrusted named authoring, runtime, or render store input.

```ts
type WorldInspectionStoreInput = {
    storeId: string;
    label: string;
    kind: 'authoring' | 'runtime' | 'render';
    incomplete: boolean;
    counts: InspectionCountInput;
    entries: WorldInspectionStoreEntryInput[];
};
```

### `WorldInspectionInput`

Complete untrusted input shape for a generic world view.

```ts
type WorldInspectionInput = {
    schemaVersion: typeof WORLD_INSPECTION_SCHEMA_VERSION;
    owner: 'framework';
    worldId: unknown;
    runtimeInstanceId: string;
    revision: number;
    incomplete: boolean;
    counts: {
        entities: InspectionCountInput;
        components: InspectionCountInput;
        relationships: InspectionCountInput;
        stores: InspectionCountInput;
    };
    entities: WorldInspectionEntityInput[];
    relationships: ChildOfInspectionInput[];
    stores: WorldInspectionStoreInput[];
};
```

### `InspectionCount`

Validated available and retained counts for bounded data.

```ts
type InspectionCount = Readonly<{
    available: number;
    retained: number;
}>;
```

### `WorldInspectionComponent`

Immutable component type, version, summary, and bounded JSON data.

```ts
type WorldInspectionComponent = Readonly<{
    typeId: string;
    schemaVersion: number;
    summary: string;
    data: InspectionJsonValue;
}>;
```

### `WorldInspectionEntity`

Immutable entity identity, label, revision, and component summaries.

```ts
type WorldInspectionEntity = Readonly<{
    entityId: EntityId;
    label: string;
    revision: number;
    components: readonly WorldInspectionComponent[];
}>;
```

### `ChildOfInspection`

Immutable real parent-child relationship between two entities.

```ts
type ChildOfInspection = Readonly<{
    type: 'ChildOf';
    childEntityId: EntityId;
    parentEntityId: EntityId;
}>;
```

### `WorldInspectionStoreEntry`

Immutable store entry with optional stable entity identity.

```ts
type WorldInspectionStoreEntry = Readonly<{
    key: string;
    entityId?: EntityId;
    data: InspectionJsonValue;
}>;
```

### `WorldInspectionStore`

Immutable bounded authoring, runtime, or render store view.

```ts
type WorldInspectionStore = Readonly<{
    storeId: string;
    label: string;
    kind: 'authoring' | 'runtime' | 'render';
    incomplete: boolean;
    counts: InspectionCount;
    entries: readonly WorldInspectionStoreEntry[];
}>;
```

### `WorldInspection`

Immutable generic view of world entities, relationships, and stores.

```ts
type WorldInspection = Readonly<{
    schemaVersion: typeof WORLD_INSPECTION_SCHEMA_VERSION;
    owner: 'framework';
    worldId: WorldId;
    runtimeInstanceId: string;
    revision: number;
    incomplete: boolean;
    counts: Readonly<{
        entities: InspectionCount;
        components: InspectionCount;
        relationships: InspectionCount;
        stores: InspectionCount;
    }>;
    entities: readonly WorldInspectionEntity[];
    relationships: readonly ChildOfInspection[];
    stores: readonly WorldInspectionStore[];
}>;
```

### `WorldInspectionValidationError`

Thrown for an invalid world view; `code` and `path` identify the failure.

```ts
class WorldInspectionValidationError extends Error {
    readonly code = 'ANTIKY_WORLD_INSPECTION_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `createWorldInspection`

Validates, bounds, copies, and freezes a generic world view.

```ts
function createWorldInspection(input: unknown, path = '$'): WorldInspection;
```

## Bounded event recorder

Retain the newest events within a capacity, number them without reuse, and build the history envelope with its counts and drop accounting derived rather than hand-assembled.

### `completeCounts`

The counts block for a set whose every available item is also retained.

```ts
function completeCounts(value: number): {
    available: number;
    retained: number;
};
```

### `RecordedEvent`

One retained event with its sequence number and timestamp.

```ts
type RecordedEvent<TEvent> = Readonly<{
    event: TEvent;
    sequence: number;
    occurredAt: string;
}>;
```

### `EventHistoryDescriptor`

What a caller must supply to turn retained events into a history envelope.

```ts
type EventHistoryDescriptor<TEvent> = Readonly<{
    owner: string;
    sourceId: string;
    worldId: string;
    runtimeInstanceId: string;
    describe(recorded: RecordedEvent<TEvent>): Record<string, unknown>;
}>;
```

### `BoundedEventRecorder`

A capped ring of simulation events that owns its own drop accounting.

```ts
type BoundedEventRecorder<TEvent> = Readonly<{
    record(event: TEvent, occurredAt: string): void;
    retained(): readonly RecordedEvent<TEvent>[];
    available(): number;
    history(descriptor: EventHistoryDescriptor<TEvent>): EventHistory;
}>;
```

### `createBoundedEventRecorder`

Create a bounded recorder that keeps the newest events and reports what it dropped.

```ts
function createBoundedEventRecorder<TEvent>(capacity: number): BoundedEventRecorder<TEvent>;
```

## Event history

Describe accepted domain facts together with their ordering and retention policy.

### `EVENT_HISTORY_SCHEMA_VERSION`

The schema version required by event-history views.

```ts
const EVENT_HISTORY_SCHEMA_VERSION = 1 as const;
```

### `MAX_EVENT_HISTORY_EVENTS`

The maximum accepted facts retained in one inspection response.

```ts
const MAX_EVENT_HISTORY_EVENTS = 512;
```

### `MAX_EVENT_ENTITY_IDS`

The maximum related entities recorded on one event.

```ts
const MAX_EVENT_ENTITY_IDS = 16;
```

### `EventHistoryEntryInput`

Untrusted accepted-fact input before ID and JSON validation.

```ts
type EventHistoryEntryInput = {
    eventSchemaVersion: number;
    type: string;
    sequence: number;
    commandId: unknown;
    worldId: unknown;
    entityIds: unknown[];
    revision: number;
    occurredAt: string;
    data: unknown;
};
```

### `EventHistoryInput`

Complete untrusted event history and retention declaration.

```ts
type EventHistoryInput = {
    schemaVersion: typeof EVENT_HISTORY_SCHEMA_VERSION;
    owner: 'framework';
    sourceId: string;
    worldId: unknown;
    runtimeInstanceId: string;
    incomplete: boolean;
    counts: InspectionCountInput;
    retention: {
        lifetime: 'runtime-instance' | 'session' | 'durable';
        storage: 'memory' | 'persistent';
        overflow: 'reject-new' | 'drop-oldest';
        capacity: number;
        droppedCount: number;
    };
    events: EventHistoryEntryInput[];
};
```

### `EventHistoryEntry`

Immutable accepted fact with stable ordering, identities, revision, time, and data.

```ts
type EventHistoryEntry = Readonly<{
    eventSchemaVersion: number;
    type: string;
    sequence: number;
    commandId: CommandId;
    worldId: WorldId;
    entityIds: readonly EntityId[];
    revision: number;
    occurredAt: string;
    data: InspectionJsonValue;
}>;
```

### `EventHistory`

Immutable bounded fact list plus explicit lifetime, storage, and overflow rules.

```ts
type EventHistory = Readonly<{
    schemaVersion: typeof EVENT_HISTORY_SCHEMA_VERSION;
    owner: 'framework';
    sourceId: string;
    worldId: WorldId;
    runtimeInstanceId: string;
    incomplete: boolean;
    counts: InspectionCount;
    retention: Readonly<{
        lifetime: 'runtime-instance' | 'session' | 'durable';
        storage: 'memory' | 'persistent';
        overflow: 'reject-new' | 'drop-oldest';
        capacity: number;
        droppedCount: number;
    }>;
    events: readonly EventHistoryEntry[];
}>;
```

### `EventHistoryValidationError`

Thrown for invalid event history; `code` and `path` identify the failure.

```ts
class EventHistoryValidationError extends Error {
    readonly code = 'ANTIKY_EVENT_HISTORY_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `createEventHistory`

Validates ordering and retention, copies JSON data, and freezes event history.

```ts
function createEventHistory(input: unknown, path = '$'): EventHistory;
```
