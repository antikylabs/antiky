import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

/**
 * `renderer.ts` imports its floor textures from Vite virtual modules, which Node cannot resolve.
 * That — not a deliberate choice — is why nothing in this folder had ever imported the renderer.
 * Each one resolves to a URL string at build time, so a stub string is a faithful stand-in.
 */
const BROMETAL_STUB = new URL('./support/brometal-stub.ts', import.meta.url).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('virtual:')) {
      return { url: `data:text/javascript,export default ${JSON.stringify(specifier)}`, shortCircuit: true };
    }
    // The stub re-exports the real package, so it must not be redirected into itself.
    if (specifier === 'brometal' && context.parentURL !== BROMETAL_STUB) {
      return { url: BROMETAL_STUB, shortCircuit: true };
    }
    return next(specifier, context);
  },
});

/**
 * The renderer fetches its GLB models by URL. Node's `fetch` refuses `file:`, so serve the real
 * bytes off disk — the models parse for real, which is the point: a stub model would not exercise
 * the pipelines built from one.
 */
const browserFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL) => {
  const url = new URL(String(input));
  if (url.protocol !== 'file:') return browserFetch(input as never);
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  return new Response(await readFile(fileURLToPath(url)));
}) as typeof fetch;

// Decoding an embedded image is the browser's job. Only the dimensions reach the driver.
globalThis.createImageBitmap = (async () => ({ width: 512, height: 512, close(): void {} })) as never;

/**
 * The onboarding overlay paints its text into a 2D canvas and hands the result to the driver as a
 * texture source. Every call on that context is a drawing instruction with no return value the
 * renderer inspects, so a recording no-op is enough — except `measureText`, which is read.
 */
const canvasContext = new Proxy({}, {
  get: (_target, property) => {
    if (property === 'measureText') return () => ({ width: 64, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
    if (property === 'canvas') return { width: 512, height: 512 };
    if (String(property).startsWith('create')) return () => ({ addColorStop: () => undefined });
    return () => undefined;
  },
  set: () => true,
});
globalThis.document = {
  createElement: (tag: string) => {
    if (tag !== 'canvas') throw new Error(`the renderer asked for an unexpected <${tag}>`);
    return { width: 512, height: 512, getContext: () => canvasContext };
  },
} as never;

const { calls } = await import('./support/brometal-stub.ts');
const { createRelayRenderer } = await import('../src/renderer.ts');

/**
 * Regression guard for a failure that no other test in this demo could see.
 *
 * When the demo moved onto the framework's render driver it built, typechecked and passed all 86 of
 * its tests, then failed to render at all — the capture harness reported only
 * `CAPTURE_RUNTIME_TIMEOUT`, because the renderer threw while being constructed and the module entry
 * rejected before a single frame was published.
 *
 * Nothing here reached that path. Every other test in this folder exercises a piece of the renderer
 * through an injected seam; none of them builds the whole thing. So a construction failure was
 * invisible to the suite and only observable through a browser the harness does not surface.
 *
 * This test builds the entire renderer against a recording stub. It needs no GPU and no browser,
 * because everything construction does — registering pipelines, describing targets, declaring
 * textures — is data until the driver hands it to BroMetal.
 */

interface Recorded {
  readonly programs: string[];
  readonly targets: string[];
  readonly textures: string[];
}

function stubRenderer(recorded: Recorded) {
  const uniformHandle = { set(): void {} };
  const attributeHandle = { set(): void {} };
  const program = {
    // A BroMetal program answers any uniform or attribute name; the driver looks up whatever the
    // frame asks for, so a stub that refuses unknown names would fail for the wrong reason.
    uniforms: new Proxy({}, { get: () => uniformHandle }),
    attributes: new Proxy({}, { get: () => attributeHandle }),
    instanceAttributes: new Proxy({}, { get: () => attributeHandle }),
    setIndices(): void {},
    draw(): void {},
    dispose(): void {},
  };
  const target = { texture: {}, width: 1_024, height: 1_024, dispose(): void {} };
  return {
    canvas: { width: 1_280, height: 720 },
    aspect: 1_280 / 720,
    createProgram(options: { readonly label?: string }) {
      recorded.programs.push(options?.label ?? 'unlabelled');
      return program;
    },
    createRenderTarget(options: { readonly label?: string }) {
      recorded.targets.push(options?.label ?? 'unlabelled');
      return target;
    },
    createTexture(options: { readonly label?: string }) {
      recorded.textures.push(options?.label ?? 'unlabelled');
      return { dispose(): void {} };
    },
    async loadTexture(url: string) {
      recorded.textures.push(url);
      return { dispose(): void {} };
    },
    present(draw: () => void): void {
      draw();
    },
    destroy(): void {},
  };
}

test('the relay renderer can be constructed without throwing', async () => {
  const recorded: Recorded = { programs: [], targets: [], textures: [] };
  const lights = ['ember', 'ion', 'violet'].map((id, index) => ({
    entityId: id,
    transform: { position: [index * 2, 1, 0] as const },
    pointLight: { color: [1, 0.5, 0.25] as const, radius: 6, power: 1 },
  }));

  // The assertion is that this resolves at all. Construction throwing is the whole bug.
  const renderer = await createRelayRenderer(
    stubRenderer(recorded) as never,
    lights as never,
  );

  const programs = calls.filter((call) => call.kind === 'program');
  assert.ok(programs.length > 15, `construction registered only ${programs.length} pipelines`);
  renderer.dispose();
});
