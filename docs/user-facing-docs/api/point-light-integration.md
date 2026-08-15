---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:8832ca5e375d42b2
---

# Point-light integration API

Project authored lights into runtime, renderer, inspection, world, and event views.

Use these adapters to keep framework records independent from renderer objects while giving tools a consistent read-only model.

For the task-first workflow, read [Point lights: Renderer integration](../framework/point-lights.md#send-changes-to-your-renderer). Import every API on this page from `@antiky/framework`.

## Example

`lights` is a `PointLightAuthoringService`; `rendererLights` is your renderer adapter. Acknowledge only after every renderer update succeeds.

```ts
import { inspectPointLightWorld } from '@antiky/framework';

const { world, events } = inspectPointLightWorld(lights);
const changes = lights.readPointLightRenderChanges();

for (const light of changes.pointLights) {
  rendererLights.setBasePower(light.renderSlot, light.power);
}
lights.acknowledgePointLightRenderChanges(changes.eventSequence);
```

## Runtime and renderer projections

Build immutable projections and read only the render slots whose authored values changed.

### `MAX_POINT_LIGHT_RENDER_SLOT`

The largest numeric renderer slot accepted in a light binding.

```ts
const MAX_POINT_LIGHT_RENDER_SLOT = 1000000;
```

### `PointLightRenderBinding`

Connects one stable entity ID to one temporary renderer slot.

```ts
type PointLightRenderBinding = Readonly<{
    entityId: EntityId;
    renderSlot: number;
}>;
```

### `RuntimePointLight`

The minimal runtime projection of entity, revision, and power.

```ts
type RuntimePointLight = Readonly<{
    entityId: EntityId;
    revision: number;
    power: number;
}>;
```

### `RenderPointLight`

The minimal renderer projection with its assigned slot.

```ts
type RenderPointLight = Readonly<{
    entityId: EntityId;
    renderSlot: number;
    revision: number;
    power: number;
}>;
```

### `PointLightStateSnapshot`

Immutable authoring, runtime, and render projections at one event sequence.

```ts
type PointLightStateSnapshot = Readonly<{
    eventSequence: number;
    authoring: readonly PointLightAuthoringRecord[];
    runtime: Readonly<{
        instanceId: string;
        eventSequence: number;
        pointLights: readonly RuntimePointLight[];
    }>;
    render: Readonly<{
        eventSequence: number;
        pointLights: readonly RenderPointLight[];
        dirtySlots: readonly number[];
    }>;
}>;
```

### `PointLightRenderChanges`

Only renderer-bound lights whose slots are currently dirty.

```ts
type PointLightRenderChanges = Readonly<{
    eventSequence: number;
    pointLights: readonly RenderPointLight[];
}>;
```

### `PointLightProjectionValidationError`

Thrown for invalid runtime IDs, bindings, or projection state, with a stable path.

```ts
class PointLightProjectionValidationError extends Error {
    readonly code = 'ANTIKY_POINT_LIGHT_PROJECTION_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `parsePointLightRuntimeInstanceId`

Validates the bounded runtime identity used by point-light projections.

```ts
function parsePointLightRuntimeInstanceId(value: unknown): string;
```

### `parsePointLightRenderBindings`

Validates unique known entity bindings and unique renderer slots.

```ts
function parsePointLightRenderBindings(value: unknown, pointLights: readonly PointLightAuthoringRecord[]): readonly PointLightRenderBinding[];
```

### `createPointLightStateSnapshot`

Builds sorted authoring, runtime, and render projections for one sequence.

```ts
function createPointLightStateSnapshot(authoringInput: readonly PointLightAuthoringRecord[], runtimeInstanceId: string, bindings: readonly PointLightRenderBinding[], eventSequence: number, dirtySlotsInput: ReadonlySet<number> | readonly number[]): PointLightStateSnapshot;
```

### `readRenderChanges`

Selects dirty renderer slots from a point-light state snapshot.

```ts
function readRenderChanges(snapshot: PointLightStateSnapshot): PointLightRenderChanges;
```

## Feature inspection

Validate or derive the complete read-only point-light state used by framework inspection.

### `POINT_LIGHT_INSPECTION_SCHEMA_VERSION`

The schema version required by feature-specific point-light inspection.

```ts
const POINT_LIGHT_INSPECTION_SCHEMA_VERSION = 1 as const;
```

### `PointLightInspectionInput`

Complete untrusted point-light inspection input.

```ts
type PointLightInspectionInput = Readonly<{
    schemaVersion: typeof POINT_LIGHT_INSPECTION_SCHEMA_VERSION;
    owner: 'framework';
    worldId: WorldId;
    eventSequence: number;
    authoring: readonly PointLightAuthoringRecord[];
    runtime: PointLightStateSnapshot['runtime'];
    render: PointLightStateSnapshot['render'];
    facts: readonly PointLightPowerSetFact[];
}>;
```

### `PointLightInspection`

Immutable feature view of authoritative, runtime, renderer, and fact state.

```ts
type PointLightInspection = Readonly<{
    schemaVersion: typeof POINT_LIGHT_INSPECTION_SCHEMA_VERSION;
    owner: 'framework';
    worldId: WorldId;
    eventSequence: number;
    authoring: readonly PointLightAuthoringRecord[];
    runtime: Readonly<{
        instanceId: string;
        eventSequence: number;
        pointLights: readonly RuntimePointLight[];
    }>;
    render: Readonly<{
        eventSequence: number;
        pointLights: readonly RenderPointLight[];
        dirtySlots: readonly number[];
    }>;
    facts: readonly PointLightPowerSetFact[];
}>;
```

### `PointLightInspectionValidationError`

Thrown for invalid point-light inspection with stable `code` and `path`.

```ts
class PointLightInspectionValidationError extends Error {
    readonly code = 'ANTIKY_POINT_LIGHT_INSPECTION_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `createPointLightInspection`

Validates, cross-checks, copies, and freezes a complete point-light inspection view.

```ts
function createPointLightInspection(input: unknown, path = '$'): PointLightInspection;
```

### `inspectPointLightService`

Reads a point-light service and returns its validated feature inspection view.

```ts
function inspectPointLightService(service: PointLightAuthoringService): PointLightInspection;
```

## World inspection adapter

Map point-light state to generic world stores, component summaries, and event history.

### `POINT_LIGHT_AUTHORING_STORE_ID`

The stable generic-world store ID for authored point-light records.

```ts
const POINT_LIGHT_AUTHORING_STORE_ID = 'antiky.point-lights.authoring' as const;
```

### `POINT_LIGHT_RUNTIME_STORE_ID`

The stable generic-world store ID for runtime point-light projections.

```ts
const POINT_LIGHT_RUNTIME_STORE_ID = 'antiky.point-lights.runtime' as const;
```

### `POINT_LIGHT_RENDER_STORE_ID`

The stable generic-world store ID for renderer point-light projections.

```ts
const POINT_LIGHT_RENDER_STORE_ID = 'antiky.point-lights.render' as const;
```

### `POINT_LIGHT_EVENT_SOURCE_ID`

The stable event-history source ID for point-light authoring facts.

```ts
const POINT_LIGHT_EVENT_SOURCE_ID = 'antiky.point-light-authoring' as const;
```

### `TRANSFORM_COMPONENT_TYPE_ID`

The stable generic-world component type for a transform summary.

```ts
const TRANSFORM_COMPONENT_TYPE_ID = 'antiky.transform' as const;
```

### `POINT_LIGHT_COMPONENT_TYPE_ID`

The stable generic-world component type for a point-light summary.

```ts
const POINT_LIGHT_COMPONENT_TYPE_ID = 'antiky.point-light' as const;
```

### `PointLightWorldViews`

The paired generic world and event views derived from point-light state.

```ts
type PointLightWorldViews = Readonly<{
    world: WorldInspection;
    events: EventHistory;
}>;
```

### `createPointLightWorldViews`

Validates feature inspection input and maps it to generic world and event views.

```ts
function createPointLightWorldViews(input: unknown): PointLightWorldViews;
```

### `inspectPointLightWorld`

Reads a point-light service and returns its generic world and event inspection views.

```ts
function inspectPointLightWorld(service: PointLightAuthoringService): PointLightWorldViews;
```
