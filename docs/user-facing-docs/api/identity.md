---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:611ae942b71fd3d4
---

# Identity API

Create and validate stable UUIDv7 identities for worlds, entities, commands, and sessions.

Use branded IDs at storage and command boundaries so different identity kinds cannot be mixed accidentally.

For the task-first workflow, read [Point lights: Keep IDs stable](../framework/point-lights.md#keep-ids-stable). Import every API on this page from `@antiky/framework`.

## Example

`savedWorldId` is an unknown value read from persisted game data. Create an ID for a new record; parse an ID that already exists.

```ts
import { createEntityId, parseWorldId } from '@antiky/framework';

const entityId = createEntityId();
const worldId = parseWorldId(savedWorldId);
```

## Stable IDs

Create IDs for new records and parse unknown values when they cross a file, network, or tool boundary.

### `WorldId`

A branded UUIDv7 for one authored world.

```ts
type WorldId = string & {
    readonly [worldIdBrand]: 'WorldId';
};
```

### `EntityId`

A branded UUIDv7 for one stable world entity.

```ts
type EntityId = string & {
    readonly [entityIdBrand]: 'EntityId';
};
```

### `CommandId`

A branded UUIDv7 used to deduplicate and trace an authoring command.

```ts
type CommandId = string & {
    readonly [commandIdBrand]: 'CommandId';
};
```

### `SessionId`

A branded UUIDv7 for one engine-session lifetime.

```ts
type SessionId = string & {
    readonly [sessionIdBrand]: 'SessionId';
};
```

### `ID_KINDS`

The identity kinds accepted by `generateId`.

```ts
const ID_KINDS = ['world', 'entity', 'command', 'session'] as const;
```

### `IdKind`

The union of supported identity-kind names.

```ts
type IdKind = typeof ID_KINDS[number];
```

### `IdForKind`

Maps an `IdKind` to its branded string type.

```ts
type IdForKind<Kind extends IdKind> = Kind extends 'world' ? WorldId : Kind extends 'entity' ? EntityId : Kind extends 'command' ? CommandId : SessionId;
```

### `UuidV7CreationSource`

Deterministic timestamp and random bytes for tests or controlled ID generation.

```ts
type UuidV7CreationSource = Readonly<{
    timestampMilliseconds: number;
    randomBytes: readonly number[];
}>;
```

### `IdValidationError`

Thrown when UUIDv7 creation or parsing receives an invalid value; `code` is stable.

```ts
class IdValidationError extends Error {
    readonly code = 'ANTIKY_INVALID_UUID_V7';
    constructor(message: string);
}
```

### `isUuidV7`

Checks whether an unknown value is a canonical lowercase UUIDv7 string without throwing.

```ts
function isUuidV7(value: unknown): value is string;
```

### `createWorldId`

Creates a new world ID, using secure platform randomness unless a source is supplied.

```ts
function createWorldId(source?: UuidV7CreationSource): WorldId;
```

### `createEntityId`

Creates a new entity ID, using secure platform randomness unless a source is supplied.

```ts
function createEntityId(source?: UuidV7CreationSource): EntityId;
```

### `createCommandId`

Creates a new command ID, using secure platform randomness unless a source is supplied.

```ts
function createCommandId(source?: UuidV7CreationSource): CommandId;
```

### `createSessionId`

Creates a new session ID, using secure platform randomness unless a source is supplied.

```ts
function createSessionId(source?: UuidV7CreationSource): SessionId;
```

### `generateId`

Creates the branded ID selected by an `IdKind`.

```ts
function generateId<Kind extends IdKind>(kind: Kind, source?: UuidV7CreationSource): IdForKind<Kind>;
```

### `parseWorldId`

Validates unknown input and returns it as a `WorldId`.

```ts
function parseWorldId(value: unknown): WorldId;
```

### `parseEntityId`

Validates unknown input and returns it as an `EntityId`.

```ts
function parseEntityId(value: unknown): EntityId;
```

### `parseCommandId`

Validates unknown input and returns it as a `CommandId`.

```ts
function parseCommandId(value: unknown): CommandId;
```

### `parseSessionId`

Validates unknown input and returns it as a `SessionId`.

```ts
function parseSessionId(value: unknown): SessionId;
```
