export type DisposableResource = Readonly<{ dispose(): void }>;

export type DisposalStack = Readonly<{
  adopt<T extends DisposableResource>(resource: T): T;
  dispose(): void;
}>;

export function createDisposalStack(): DisposalStack {
  const resources: DisposableResource[] = [];
  let disposed = false;

  return Object.freeze({
    adopt<T extends DisposableResource>(resource: T): T {
      if (disposed) {
        resource.dispose();
        return resource;
      }
      resources.push(resource);
      return resource;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (let index = resources.length - 1; index >= 0; index -= 1) {
        try {
          resources[index]!.dispose();
        } catch (cause: unknown) {
          errors.push(cause);
        }
      }
      resources.length = 0;
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'Multiple resources failed to dispose.');
    },
  });
}

export type ResourceTransaction<T extends DisposableResource> = Readonly<{
  resources: readonly T[];
  dispose(): void;
}>;

export async function acquireTransactional<T extends DisposableResource>(
  factories: readonly (() => Promise<T>)[],
): Promise<ResourceTransaction<T>> {
  const disposal = createDisposalStack();
  const resources: T[] = [];
  try {
    for (let index = 0; index < factories.length; index += 1) {
      const resource = disposal.adopt(await factories[index]!());
      resources.push(resource);
    }
  } catch (cause: unknown) {
    try {
      disposal.dispose();
    } catch (rollbackCause: unknown) {
      throw new AggregateError(
        [cause, rollbackCause],
        'Resource acquisition and rollback both failed.',
        { cause },
      );
    }
    throw cause;
  }

  return Object.freeze({
    resources: Object.freeze(resources),
    dispose: () => disposal.dispose(),
  });
}

export type RendererResourceLifetime = Readonly<{
  resources: DisposalStack;
  dispose(): void;
  rollback(cause: unknown): never;
}>;

export function createRendererResourceLifetime(destroyRenderer: () => void): RendererResourceLifetime {
  const resources = createDisposalStack();
  let rendererDestroyed = false;

  const dispose = (): void => {
    const errors: unknown[] = [];
    try {
      resources.dispose();
    } catch (cause: unknown) {
      errors.push(cause);
    }
    if (!rendererDestroyed) {
      rendererDestroyed = true;
      try {
        destroyRenderer();
      } catch (cause: unknown) {
        errors.push(cause);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Renderer resources failed to dispose.');
  };

  return Object.freeze({
    resources,
    dispose,
    rollback(cause: unknown): never {
      try {
        dispose();
      } catch (rollbackCause: unknown) {
        throw new AggregateError(
          [cause, rollbackCause],
          'Renderer construction and rollback both failed.',
          { cause },
        );
      }
      throw cause;
    },
  });
}
