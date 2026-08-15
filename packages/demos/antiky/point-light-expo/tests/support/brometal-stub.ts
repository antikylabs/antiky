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
export * from '../../../../../../node_modules/brometal/dist/index.js';

export interface StubCall {
  readonly kind: 'program' | 'target' | 'texture' | 'loaded';
  readonly label: string;
}

export const calls: StubCall[] = [];

/** Answers any uniform, attribute or instance-attribute name the driver looks up. */
function bindingRecord() {
  return new Proxy({}, { get: () => ({ set: () => undefined }) });
}

export function createProgram(_renderer: unknown, compiled: { readonly label?: string }) {
  calls.push({ kind: 'program', label: compiled?.label ?? 'unlabelled' });
  return {
    uniforms: bindingRecord(),
    attributes: bindingRecord(),
    instanceAttributes: bindingRecord(),
    setIndices: () => undefined,
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
