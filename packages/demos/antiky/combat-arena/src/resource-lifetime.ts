export type DisposableResource = Readonly<{ dispose(): void }>;

export function registerResource<T extends DisposableResource>(resources: DisposableResource[], resource: T): T {
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
    // Preserve the construction error; rollback still attempts every registered resource.
  }
}
