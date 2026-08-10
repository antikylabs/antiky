export type DisposableResource = Readonly<{ dispose(): void }>;

export function registerResource<T extends DisposableResource>(
  resources: DisposableResource[],
  resource: T,
): T {
  resources.push(resource);
  return resource;
}

export function disposeResources(resources: readonly DisposableResource[]): void {
  let firstFailure: unknown;
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    try {
      resources[index]!.dispose();
    } catch (cause: unknown) {
      firstFailure ??= cause;
    }
  }
  if (firstFailure !== undefined) throw firstFailure;
}

export function rollbackResources(resources: readonly DisposableResource[]): void {
  try {
    disposeResources(resources);
  } catch {
    // Preserve the construction failure while still attempting every cleanup.
  }
}

export type ResourceScope = Readonly<{
  register<T extends DisposableResource>(resource: T): T;
  rollback(): void;
  dispose(): void;
}>;

export function createResourceScope(): ResourceScope {
  const resources: DisposableResource[] = [];
  let closed = false;
  return Object.freeze({
    register<T extends DisposableResource>(resource: T): T {
      if (closed) throw new Error('Cannot register a resource after its scope has closed.');
      return registerResource(resources, resource);
    },
    rollback(): void {
      if (closed) return;
      closed = true;
      rollbackResources(resources);
    },
    dispose(): void {
      if (closed) return;
      closed = true;
      disposeResources(resources);
    },
  });
}
