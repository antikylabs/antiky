---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:e91c4d2f79d1d6e4
---

# Point-light command API

Validate versioned power-change commands, trusted execution context, results, and accepted facts.

Use these parsers at tool or process boundaries; create trusted context in the host instead of accepting authority from a command.

For the task-first workflow, read [Point lights: Change power](../framework/point-lights.md#change-power-while-the-game-runs). Import every API on this page from `@antiky/framework`.

## Example

`untrustedCommand` comes from a file, tool, or request boundary. `lights` is the world’s authoring service, and `trustedContext` is created by the host.

```ts
import { parseSetPointLightPowerCommand } from '@antiky/framework';

const command = parseSetPointLightPowerCommand(untrustedCommand);
const result = lights.submitPointLightPower(command, trustedContext);

if (result.code !== 'ACCEPTED' && result.code !== 'NO_OP') {
  handleRejectedCommand(result.code);
}
```

## Commands and facts

Parse external values before submission and branch on stable result codes rather than human-readable messages.

### `POINT_LIGHT_COMMAND_PROTOCOL_VERSION`

The outer protocol version required by point-light power requests.

```ts
const POINT_LIGHT_COMMAND_PROTOCOL_VERSION = 1 as const;
```

### `POINT_LIGHT_COMMAND_VERSION`

The payload version required by point-light power requests.

```ts
const POINT_LIGHT_COMMAND_VERSION = 1 as const;
```

### `POINT_LIGHT_FACT_SCHEMA_VERSION`

The schema version emitted for accepted power-set facts.

```ts
const POINT_LIGHT_FACT_SCHEMA_VERSION = 1 as const;
```

### `POINT_LIGHT_RESULT_SCHEMA_VERSION`

The schema version emitted for command results.

```ts
const POINT_LIGHT_RESULT_SCHEMA_VERSION = 1 as const;
```

### `MAX_POINT_LIGHT_COMMAND_BYTES`

The maximum UTF-8 JSON size accepted for one power command.

```ts
const MAX_POINT_LIGHT_COMMAND_BYTES = 4 * 1024;
```

### `MAX_POINT_LIGHT_COMMAND_RESULTS`

The maximum command results retained by one service.

```ts
const MAX_POINT_LIGHT_COMMAND_RESULTS = 256;
```

### `MAX_POINT_LIGHT_POWER_FACTS`

The maximum accepted power facts retained by one service.

```ts
const MAX_POINT_LIGHT_POWER_FACTS = 256;
```

### `POINT_LIGHT_EDIT_PERMISSION`

The permission required in trusted context to change point-light power.

```ts
const POINT_LIGHT_EDIT_PERMISSION = 'world.light.edit' as const;
```

### `SET_POINT_LIGHT_POWER_COMMAND_TYPE`

The stable command discriminator for a power change.

```ts
const SET_POINT_LIGHT_POWER_COMMAND_TYPE = 'antiky.authoring.set-point-light-power' as const;
```

### `POINT_LIGHT_POWER_SET_FACT_TYPE`

The stable event discriminator for an accepted power change.

```ts
const POINT_LIGHT_POWER_SET_FACT_TYPE = 'antiky.authoring.point-light-power-set' as const;
```

### `SetPointLightPowerCommand`

A validated optimistic-concurrency command that requests a new power value.

```ts
type SetPointLightPowerCommand = Readonly<{
    protocolVersion: typeof POINT_LIGHT_COMMAND_PROTOCOL_VERSION;
    commandVersion: typeof POINT_LIGHT_COMMAND_VERSION;
    type: typeof SET_POINT_LIGHT_POWER_COMMAND_TYPE;
    commandId: CommandId;
    worldId: WorldId;
    entityId: EntityId;
    expectedRevision: number;
    data: Readonly<{
        power: number;
        correctionOf?: CommandId;
    }>;
}>;
```

### `CorrectPointLightPowerRequest`

A request that restores the old value from an accepted command by creating another fact.

```ts
type CorrectPointLightPowerRequest = Readonly<{
    protocolVersion: typeof POINT_LIGHT_COMMAND_PROTOCOL_VERSION;
    commandVersion: typeof POINT_LIGHT_COMMAND_VERSION;
    commandId: CommandId;
    correctedCommandId: CommandId;
    expectedRevision: number;
}>;
```

### `PointLightCommandContextInput`

Host-supplied identity, permissions, receipt time, and runtime identity before validation.

```ts
type PointLightCommandContextInput = Readonly<{
    principalId: string;
    permissions: readonly string[];
    receivedAt: string;
    runtimeInstanceId: string;
}>;
```

### `PointLightCommandContext`

Validated trusted authority and runtime context for command execution.

```ts
type PointLightCommandContext = Readonly<{
    principalId: string;
    permissions: readonly string[];
    receivedAt: string;
    runtimeInstanceId: string;
}>;
```

### `PointLightCommandResultCode`

Stable accepted, no-op, validation, authority, ordering, and capacity outcomes.

```ts
type PointLightCommandResultCode = 'ACCEPTED' | 'NO_OP' | 'INVALID_COMMAND' | 'WORLD_NOT_FOUND' | 'ENTITY_NOT_FOUND' | 'MISSING_PERMISSION' | 'DUPLICATE_COMMAND' | 'STALE_REVISION' | 'VALUE_OUT_OF_RANGE' | 'HISTORY_CAPACITY_REACHED' | 'EVENT_SEQUENCE_ERROR';
```

### `PointLightPowerSetFact`

Immutable accepted power change used for history, correction, and replay.

```ts
type PointLightPowerSetFact = Readonly<{
    schemaVersion: typeof POINT_LIGHT_FACT_SCHEMA_VERSION;
    type: typeof POINT_LIGHT_POWER_SET_FACT_TYPE;
    eventSequence: number;
    sourceCommandId: CommandId;
    worldId: WorldId;
    entityId: EntityId;
    oldPower: number;
    newPower: number;
    resultingRevision: number;
    receivedAt: string;
    correctionOf?: CommandId;
}>;
```

### `PointLightCommandResult`

Immutable decision record for one submitted or corrected command.

```ts
type PointLightCommandResult = Readonly<{
    schemaVersion: typeof POINT_LIGHT_RESULT_SCHEMA_VERSION;
    code: PointLightCommandResultCode;
    accepted: boolean;
    commandId: CommandId | null;
    worldId: WorldId | null;
    entityId: EntityId | null;
    currentRevision: number | null;
    resultingRevision: number | null;
    eventSequence: number | null;
    runtimeInstanceId: string | null;
    duplicateOfCode?: PointLightCommandResultCode;
    fact?: PointLightPowerSetFact;
}>;
```

### `PointLightCommandValidationError`

Thrown by command parsers; `code` and `path` identify invalid input.

```ts
class PointLightCommandValidationError extends Error {
    readonly code = 'INVALID_COMMAND';
    constructor(message: string, readonly path: string);
}
```

### `encodedJsonByteLength`

Returns an encoded JSON byte count, or `null` when the value cannot be serialized.

```ts
function encodedJsonByteLength(value: unknown): number | null;
```

### `parseSetPointLightPowerCommand`

Validates an unknown power-change command, including size, versions, IDs, and fields.

```ts
function parseSetPointLightPowerCommand(value: unknown): SetPointLightPowerCommand;
```

### `parseCorrectPointLightPowerRequest`

Validates an unknown correction request.

```ts
function parseCorrectPointLightPowerRequest(value: unknown): CorrectPointLightPowerRequest;
```

### `parsePointLightCommandContext`

Validates host-created command authority and runtime context.

```ts
function parsePointLightCommandContext(value: unknown): PointLightCommandContext;
```

### `parsePointLightCommandResult`

Validates an unknown command result received across a process boundary.

```ts
function parsePointLightCommandResult(value: unknown): PointLightCommandResult;
```

### `parsePointLightPowerSetFact`

Validates an unknown accepted fact for inspection or replay.

```ts
function parsePointLightPowerSetFact(value: unknown): PointLightPowerSetFact;
```
