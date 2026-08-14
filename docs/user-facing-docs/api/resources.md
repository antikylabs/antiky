---
generated: packages/framework/scripts/generate-api-reference.mjs
frameworkSource: sha256:310cd7bfd5129d99
---

# Resource disposal API

Own a set of resources and release them in reverse order, reporting every failure rather than the first.

Use one scope wherever construction acquires several things that must be released together, especially when a partial construction has to be unwound.

For the task-first workflow, read [Run a fixed-step game session](../framework/engine-sessions.md). Import every API on this page from `@antiky/framework`.

## Example

`loadTexture` and `createProgram` each acquire something that must be released. If the program fails to link, the texture is still released and the construction fault is what the caller sees.

```ts
import { createDisposalScope } from '@antiky/framework';

const scope = createDisposalScope();
try {
  const texture = scope.adopt(loadTexture(source));
  const program = scope.adopt(createProgram(texture));
  return { program, dispose: () => scope.dispose() };
} catch (cause) {
  scope.rollback(cause);
}
```

## Disposal scope

Adopt resources as they are acquired, release them newest first, and unwind a failed construction without losing the fault that caused it.

### `DisposableResource`

Anything that can be released. The only shape a disposal scope requires.

```ts
type DisposableResource = Readonly<{
    dispose(): void;
}>;
```

### `DisposalScope`

Owns adopted resources and releases them newest first, collecting every failure.

```ts
type DisposalScope = Readonly<{
    adopt<T extends DisposableResource>(resource: T): T;
    dispose(): void;
    rollback(): void;
    rollback(cause: unknown): never;
}>;
```

### `createDisposalScope`

Create a scope that adopts resources and releases them in reverse order.

```ts
function createDisposalScope(): DisposalScope;
```

### `ResourceTransaction`

A completed all-or-nothing acquisition and the handle that releases it.

```ts
type ResourceTransaction<T extends DisposableResource> = Readonly<{
    resources: readonly T[];
    dispose(): void;
}>;
```

### `acquireTransactional`

Acquire every resource in order, or release what was acquired and rethrow.

```ts
async function acquireTransactional<T extends DisposableResource>(factories: readonly (() => Promise<T>)[]): Promise<ResourceTransaction<T>>;
```

### `RendererResourceLifetime`

A disposal scope that also owns the renderer, destroyed last and exactly once.

```ts
type RendererResourceLifetime = Readonly<{
    resources: DisposalScope;
    dispose(): void;
    rollback(cause: unknown): never;
}>;
```

### `createRendererResourceLifetime`

Create a scope whose renderer is destroyed after the resources borrowed from it.

```ts
function createRendererResourceLifetime(destroyRenderer: () => void): RendererResourceLifetime;
```
