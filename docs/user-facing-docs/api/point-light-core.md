---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:22a6c0d73a27da1f
---

# Point-light core API

Validate point-light records and manage the authoritative lights for one world.

Use records for isolated values and the authoring service when lights need stable identity, revisions, history, and renderer handoff.

For the task-first workflow, read [Add point lights](../framework/point-lights.md). Import every API on this page from `@antiky/framework`.

## Example

Create validated component records before placing them in a point-light authoring service.

```ts
import {
  POINT_LIGHT_SCHEMA_VERSION,
  TRANSFORM_SCHEMA_VERSION,
  createPointLight,
  createTransform,
} from '@antiky/framework';

const transform = createTransform({
  schemaVersion: TRANSFORM_SCHEMA_VERSION,
  position: [0, 2, 0],
});
const light = createPointLight({
  schemaVersion: POINT_LIGHT_SCHEMA_VERSION,
  color: [1, 0.6, 0.3],
  radius: 4,
  power: 1,
});
```

## Light records

Create immutable transforms and point lights from unknown input, applying defaults and numeric bounds.

### `TRANSFORM_SCHEMA_VERSION`

The schema version required by transform records.

```ts
const TRANSFORM_SCHEMA_VERSION = 1 as const;
```

### `POINT_LIGHT_SCHEMA_VERSION`

The schema version required by point-light records.

```ts
const POINT_LIGHT_SCHEMA_VERSION = 1 as const;
```

### `MIN_POINT_LIGHT_POWER`

The lowest accepted point-light power.

```ts
const MIN_POINT_LIGHT_POWER = 0;
```

### `MAX_POINT_LIGHT_POWER`

The highest accepted point-light power.

```ts
const MAX_POINT_LIGHT_POWER = 4;
```

### `MAX_WORLD_COORDINATE`

The absolute bound for each transform position coordinate.

```ts
const MAX_WORLD_COORDINATE = 1000000;
```

### `MAX_POINT_LIGHT_RADIUS`

The largest accepted point-light radius in world units.

```ts
const MAX_POINT_LIGHT_RADIUS = 1000000;
```

### `MAX_LINEAR_LIGHT_VALUE`

The largest accepted linear RGB channel value.

```ts
const MAX_LINEAR_LIGHT_VALUE = 65504;
```

### `Vector3`

A read-only three-number tuple used for world positions.

```ts
type Vector3 = readonly [
    number,
    number,
    number
];
```

### `LinearRgb`

A read-only linear red, green, and blue tuple.

```ts
type LinearRgb = readonly [
    number,
    number,
    number
];
```

### `TransformInput`

Transform input with an optional position that defaults to the origin.

```ts
type TransformInput = Readonly<{
    schemaVersion: typeof TRANSFORM_SCHEMA_VERSION;
    position?: readonly number[];
}>;
```

### `PointLightInput`

Point-light input with optional color, radius, and power defaults.

```ts
type PointLightInput = Readonly<{
    schemaVersion: typeof POINT_LIGHT_SCHEMA_VERSION;
    color?: readonly number[];
    radius?: number;
    power?: number;
}>;
```

### `Transform`

An immutable validated transform record.

```ts
type Transform = Readonly<{
    schemaVersion: typeof TRANSFORM_SCHEMA_VERSION;
    position: Vector3;
}>;
```

### `PointLight`

An immutable validated linear color, radius, and power record.

```ts
type PointLight = Readonly<{
    schemaVersion: typeof POINT_LIGHT_SCHEMA_VERSION;
    color: LinearRgb;
    radius: number;
    power: number;
}>;
```

### `PointLightValidationError`

Thrown for an invalid transform or light record; `code` and `path` identify the failure.

```ts
class PointLightValidationError extends Error {
    readonly code = 'ANTIKY_POINT_LIGHT_INVALID';
    constructor(message: string, readonly path: string);
}
```

### `createTransform`

Validates unknown input, applies the origin default, and returns an immutable transform.

```ts
function createTransform(input: unknown): Transform;
```

### `createPointLight`

Validates unknown input, applies light defaults, and returns an immutable point light.

```ts
function createPointLight(input: unknown): PointLight;
```

## Authoring service

Own a world’s lights, accept ordered authoring commands, expose projections, and rebuild state from facts.

### `MAX_POINT_LIGHTS`

The maximum authored lights owned by one point-light service.

```ts
const MAX_POINT_LIGHTS = 256;
```

### `MAX_POINT_LIGHT_LABEL_LENGTH`

The maximum trimmed label length for one authored light.

```ts
const MAX_POINT_LIGHT_LABEL_LENGTH = 128;
```

### `PointLightAuthoringRecordInput`

Untrusted authored-light input before IDs, revisions, and component records are validated.

```ts
type PointLightAuthoringRecordInput = Readonly<{
    entityId: unknown;
    label: unknown;
    revision: unknown;
    transform: unknown;
    pointLight: unknown;
}>;
```

### `PointLightAuthoringRecord`

Immutable authoritative light state with world and entity identity.

```ts
type PointLightAuthoringRecord = Readonly<{
    worldId: WorldId;
    entityId: EntityId;
    label: string;
    revision: number;
    transform: Transform;
    pointLight: PointLight;
}>;
```

### `PointLightAuthoringService`

The main interface for light reads, commands, facts, projections, replay, and cleanup.

```ts
interface PointLightAuthoringService {
    readonly worldId: WorldId;
    listPointLights(): readonly PointLightAuthoringRecord[];
    getPointLight(entityId: unknown): PointLightAuthoringRecord | undefined;
    submitPointLightPower(command: unknown, context: PointLightCommandContextInput | unknown): PointLightCommandResult;
    correctPointLightPower(request: unknown, context: PointLightCommandContextInput | unknown): PointLightCommandResult;
    listPointLightPowerFacts(): readonly PointLightPowerSetFact[];
    listPointLightCommandResults(): readonly PointLightCommandResult[];
    readPointLightState(): PointLightStateSnapshot;
    readPointLightRenderChanges(): PointLightRenderChanges;
    acknowledgePointLightRenderChanges(eventSequence: number): boolean;
    replayPointLightPowerFacts(facts: unknown): PointLightStateSnapshot;
    rebuildPointLightState(): PointLightStateSnapshot;
    dispose(): void;
}
```

### `PointLightServiceErrorCode`

Stable construction errors for invalid service data or duplicate entities.

```ts
type PointLightServiceErrorCode = 'INVALID_POINT_LIGHT_SERVICE' | 'DUPLICATE_ENTITY_ID';
```

### `PointLightServiceValidationError`

Thrown when point-light service construction fails, with stable `code` and `path`.

```ts
class PointLightServiceValidationError extends Error {
    constructor(readonly code: PointLightServiceErrorCode, message: string, readonly path: string);
}
```

### `PointLightReplayError`

Thrown when explicit fact replay breaks event-sequence ordering.

```ts
class PointLightReplayError extends Error {
    readonly code = 'EVENT_SEQUENCE_ERROR';
    constructor(message: string, readonly eventSequence: number | null);
}
```

### `createPointLightAuthoringService`

Creates one world-scoped light service from authored records and optional render bindings.

```ts
function createPointLightAuthoringService(input: unknown): PointLightAuthoringService;
```
