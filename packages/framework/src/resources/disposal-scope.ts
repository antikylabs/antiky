/**
 * Owning a list of things that need releasing, and releasing them in the right order.
 *
 * Seven implementations of this existed before it lived here: three in the Antiky demos, two
 * two-array patterns in the Three.js demos, one hand-ordered list of twenty-two `dispose()` calls,
 * and the framework's own — which was the worst of them, because `EngineSessionDisposalError`
 * counted its failures and threw every cause away. This is `traversal-study`'s version, which had
 * already got it right, moved rather than redesigned.
 *
 * It types on `{ dispose(): void }` and nothing else. One of the consumers holds five unrelated
 * Three.js types in a single stack, so anything narrower would not fit, and nothing here needs to
 * know what a resource *is* to release it.
 *
 * Two rules the copies disagreed on, settled here:
 *
 * - **Reverse adoption order.** A program built from a texture must be released before the texture.
 * - **Every resource is released even when one throws.** Two of the copies stopped at the first
 *   failure, which leaks everything adopted before it. Causes are collected and thrown together.
 */

export type DisposableResource = Readonly<{ dispose(): void }>;

export type DisposalScope = Readonly<{
  /** Take ownership. Returns the resource so it can be adopted inline at the point of construction. */
  adopt<T extends DisposableResource>(resource: T): T;
  /**
   * Release everything, newest first.
   *
   * Idempotent: a scope disposed twice releases once. Throws the single cause when one resource
   * fails, or an `AggregateError` carrying every cause when several do.
   */
  dispose(): void;
  /** Release everything, discarding any disposal failure. For unwinding a construction already failing. */
  rollback(): void;
  /**
   * Release everything, then rethrow `cause`.
   *
   * The construction fault is what the caller needs to see, so it is preserved exactly. If the
   * release also fails, both are thrown together with `cause` still reachable as `.cause`.
   */
  rollback(cause: unknown): never;
}>;

/** Distinguishes `rollback()` from `rollback(undefined)`, which mean different things. */
const NO_CAUSE = Symbol('antiky.disposal-scope.no-cause');

export function createDisposalScope(): DisposalScope {
  const resources: DisposableResource[] = [];
  let disposed = false;

  const releaseAll = (): void => {
    if (disposed) return;
    disposed = true;
    const causes: unknown[] = [];
    for (let index = resources.length - 1; index >= 0; index -= 1) {
      try {
        resources[index]!.dispose();
      } catch (cause: unknown) {
        causes.push(cause);
      }
    }
    resources.length = 0;
    if (causes.length === 1) throw causes[0];
    if (causes.length > 1) throw new AggregateError(causes, 'Multiple resources failed to dispose.');
  };

  function rollback(cause: unknown = NO_CAUSE): void {
    let releaseCause: unknown = NO_CAUSE;
    try {
      releaseAll();
    } catch (thrown: unknown) {
      releaseCause = thrown;
    }
    if (cause === NO_CAUSE) return;
    if (releaseCause !== NO_CAUSE) {
      throw new AggregateError(
        [cause, releaseCause],
        'Construction and rollback both failed.',
        { cause },
      );
    }
    throw cause;
  }

  return Object.freeze({
    adopt<T extends DisposableResource>(resource: T): T {
      // A scope that has already closed still owns what it is handed, or the resource leaks in
      // exactly the error path where leaking matters most.
      if (disposed) {
        resource.dispose();
        return resource;
      }
      resources.push(resource);
      return resource;
    },
    dispose: releaseAll,
    rollback,
  } as DisposalScope);
}

export type ResourceTransaction<T extends DisposableResource> = Readonly<{
  resources: readonly T[];
  dispose(): void;
}>;

/**
 * Acquire a list of resources, or none of them.
 *
 * Factories run in order and stop at the first rejection, so a failure at step three never starts
 * step four. Everything already acquired is released before the fault propagates.
 */
export async function acquireTransactional<T extends DisposableResource>(
  factories: readonly (() => Promise<T>)[],
): Promise<ResourceTransaction<T>> {
  const scope = createDisposalScope();
  const resources: T[] = [];
  try {
    for (let index = 0; index < factories.length; index += 1) {
      resources.push(scope.adopt(await factories[index]!()));
    }
  } catch (cause: unknown) {
    scope.rollback(cause);
  }

  return Object.freeze({
    resources: Object.freeze(resources),
    dispose: () => { scope.dispose(); },
  });
}

export type RendererResourceLifetime = Readonly<{
  resources: DisposalScope;
  dispose(): void;
  rollback(cause: unknown): never;
}>;

/**
 * A disposal scope that also owns the renderer itself, destroyed last and exactly once.
 *
 * The renderer outlives every resource borrowed from it, so it cannot simply be adopted into the
 * same stack — it has to be released after the stack has finished, not somewhere inside it.
 */
export function createRendererResourceLifetime(destroyRenderer: () => void): RendererResourceLifetime {
  const resources = createDisposalScope();
  let rendererDestroyed = false;

  const dispose = (): void => {
    const causes: unknown[] = [];
    try {
      resources.dispose();
    } catch (cause: unknown) {
      causes.push(cause);
    }
    if (!rendererDestroyed) {
      rendererDestroyed = true;
      try {
        destroyRenderer();
      } catch (cause: unknown) {
        causes.push(cause);
      }
    }
    if (causes.length === 1) throw causes[0];
    if (causes.length > 1) throw new AggregateError(causes, 'Renderer resources failed to dispose.');
  };

  return Object.freeze({
    resources,
    dispose,
    rollback(cause: unknown): never {
      try {
        dispose();
      } catch (releaseCause: unknown) {
        throw new AggregateError(
          [cause, releaseCause],
          'Renderer construction and rollback both failed.',
          { cause },
        );
      }
      throw cause;
    },
  });
}
