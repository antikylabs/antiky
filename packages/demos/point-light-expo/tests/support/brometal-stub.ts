/**
 * A stand-in for the four BroMetal resource constructors the render driver calls.
 *
 * The driver imports them as free functions — `createProgram(renderer, ...)` rather than
 * `renderer.createProgram(...)` — and each one looks the renderer up in a private WeakMap that only
 * a real WebGPU renderer appears in. So a stub *renderer* is not enough to construct the driver
 * outside a browser; the module itself has to be stood in for.
 *
 * Everything else BroMetal exports is re-exported untouched, so geometry helpers, the GLB parser and
 * every compiled shader behave exactly as they do in production. Explicit named exports below win
 * over the `export *`, which is the ESM rule this file relies on.
 */
export * from '../../../../../node_modules/brometal/dist/index.js';

export interface StubCall {
  readonly kind: 'program' | 'target' | 'texture' | 'loaded';
  readonly label: string;
}

export const calls: StubCall[] = [];

/**
 * Answers only the names the compiled shader declares, and throws on anything else.
 *
 * This strictness is the entire point. A real BroMetal program rejects a binding its shader never
 * declared, so a permissive stub would pass while the browser threw — which is exactly how the
 * driver migration reached a green suite and a blank screen. The common shape it catches is a
 * `setup` callback shared between a lit pipeline and its depth-only twin: the twin's shader declares
 * `aPosition` alone, so binding `aUv` or `aNormal` on it is a GPU error and nothing else.
 */
function bindingRecord(declared: Readonly<Record<string, unknown>>, kind: string, label: string) {
  return new Proxy({}, {
    get(_target, property) {
      const name = String(property);
      if (!(name in declared)) {
        throw new Error(`BroMetal: program "${label}" has no ${kind} named "${name}"`);
      }
      // A real binding rejects data it cannot upload. Empty or absent data is the case that matters:
      // it means a batch was built with no geometry, which a permissive stub hides completely.
      return {
        set(value: unknown) {
          if (value === undefined || value === null) {
            throw new Error(`BroMetal: ${kind} "${name}" on "${label}" was set to ${String(value)}`);
          }
          const length = (value as { length?: number }).length;
          if (typeof length === 'number' && length === 0) {
            throw new Error(`BroMetal: ${kind} "${name}" on "${label}" was set to empty data`);
          }
        },
      };
    },
  });
}

interface CompiledLike {
  readonly label?: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly instanceAttributes?: Readonly<Record<string, unknown>>;
  readonly uniforms?: Readonly<Record<string, unknown>>;
}

export function createProgram(_renderer: unknown, compiled: CompiledLike) {
  const label = compiled?.label ?? 'unlabelled';
  calls.push({ kind: 'program', label });
  return {
    uniforms: bindingRecord(compiled?.uniforms ?? {}, 'uniform', label),
    attributes: bindingRecord(compiled?.attributes ?? {}, 'attribute', label),
    instanceAttributes: bindingRecord(compiled?.instanceAttributes ?? {}, 'instance attribute', label),
    setIndices(indices: unknown) {
      const length = (indices as { length?: number } | undefined)?.length;
      if (indices === undefined || length === 0) {
        throw new Error(`BroMetal: program "${label}" was given no indices`);
      }
    },
    draw: () => undefined,
    dispose: () => undefined,
  };
}

export function createRenderTarget(_renderer: unknown, width: number, height: number) {
  calls.push({ kind: 'target', label: `${width}x${height}` });
  return { texture: {}, width, height, dispose: () => undefined };
}

export function createTexture(_renderer: unknown, options: { readonly label?: string } = {}) {
  calls.push({ kind: 'texture', label: options?.label ?? 'unlabelled' });
  return { dispose: () => undefined };
}

export async function loadTexture(_renderer: unknown, url: string) {
  calls.push({ kind: 'loaded', label: url });
  return { dispose: () => undefined };
}
