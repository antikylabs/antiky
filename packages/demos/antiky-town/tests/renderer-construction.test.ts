import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { register } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Regression guard for a failure no other test in this demo can see.
 *
 * Every other test here exercises one piece of the town through an injected seam; none of them
 * builds the whole renderer. So when the demo moved onto the framework's render driver, a fault in
 * construction or in a single frame's uniform names would have typechecked, passed the suite, and
 * shown up only as `CAPTURE_RUNTIME_TIMEOUT` from a browser whose error nothing surfaces. That is
 * exactly what happened to the sibling demo, twice, and it cost four sessions.
 *
 * This builds the entire town runtime and submits one real frame, with no GPU and no browser.
 * Everything construction does — registering pipelines, describing targets, declaring textures — is
 * data until the driver hands it to BroMetal, and the stub below is stricter than BroMetal about
 * what it accepts.
 */

const BROMETAL_STUB = new URL('./support/brometal-stub.ts', import.meta.url).href;

register(new URL('../../../tests/support/renderer-construction-loader.mjs', import.meta.url), {
  data: {
    brometalStub: BROMETAL_STUB,
    resolveVirtualModules: false,
  },
});

const ATLAS_WIDTH = 1_024;
const ATLAS_HEIGHT = 512;

/**
 * A wayfarer sheet with one opaque square in the middle of every 128px cell.
 *
 * The alpha contour of these squares is what `buildStandeeSideMesh` extrudes into the die-cut side
 * walls, so a fully transparent stand-in would leave that mesh empty and the draw that carries it
 * would be skipped — which is the one draw in the frame whose geometry travels with it.
 */
function actorAtlasPixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  for (let y = 0; y < ATLAS_HEIGHT; y += 1) {
    for (let x = 0; x < ATLAS_WIDTH; x += 1) {
      const insideCell = x % 128 >= 40 && x % 128 < 88 && y % 128 >= 40 && y % 128 < 88;
      if (!insideCell) continue;
      const offset = (y * ATLAS_WIDTH + x) * 4;
      pixels[offset] = 200;
      pixels[offset + 1] = 180;
      pixels[offset + 2] = 160;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

const canvasContext = {
  clearRect: () => undefined,
  drawImage: () => undefined,
  getImageData: () => ({ data: actorAtlasPixels() }),
};

globalThis.document = {
  createElement: (tag: string) => {
    if (tag !== 'canvas') throw new Error(`the town asked for an unexpected <${tag}>`);
    return { width: 0, height: 0, getContext: () => canvasContext };
  },
} as never;

// Decoding a PNG is the browser's job. Only the dimensions and the pixels above are read.
globalThis.Image = class {
  decoding = 'auto';
  src = '';
  naturalWidth = ATLAS_WIDTH;
  naturalHeight = ATLAS_HEIGHT;
  async decode(): Promise<void> {}
} as never;

const { calls } = await import('./support/brometal-stub.ts');
const { createTownRuntimeFactory } = await import('../src/town/index.ts');

function stubRenderer() {
  return {
    canvas: { width: 1_280, height: 720 },
    aspect: 1_280 / 720,
    present(draw: () => void): void {
      draw();
    },
    // Whatever the argument order, the callback is the function — run it so the pass's draws happen.
    drawTo(...args: readonly unknown[]): void {
      const callback = args.find((argument) => typeof argument === 'function');
      if (typeof callback === 'function') callback();
    },
    destroy(): void {},
  };
}

async function buildTown() {
  const measurements: unknown[] = [];
  const runtime = await createTownRuntimeFactory()({
    canvas: {} as never,
    runtimeInstanceId: 'town-construction-test',
    pointer: { x: 0, y: 0, down: false, active: false, dragX: 0, dragY: 0, clicked: false },
    movement: { x: 0, z: 0, active: false },
    mode: 'ambient',
    report: (value) => { measurements.push(value); },
    renderer: stubRenderer() as never,
  });
  return { runtime, measurements };
}

test('the town runtime can be constructed without throwing', async () => {
  const before = calls.length;
  const { runtime, measurements } = await buildTown();

  const programs = calls.slice(before).filter((call) => call.kind === 'program');
  assert.equal(programs.length, 16, `construction registered ${programs.length} pipelines`);
  assert.equal(measurements.length, 1, 'the runtime should report its measurements once');

  /**
   * Every texture the driver fetches must exist. A missing one rejects `loadTextures`, which rejects
   * construction, which publishes no frame at all — and the capture harness reports that as a bare
   * timeout with no clue which file is absent.
   */
  const fetched = calls.slice(before).filter((call) => call.kind === 'loaded').map((call) => call.label);
  assert.equal(fetched.length, 5, `the driver fetched ${fetched.length} textures`);

  // One of the five is an array texture: the material atlas arrives as twelve separate layer
  // images rather than one packed picture, and each layer is mipped on its own so no material can
  // pick up its neighbour. Every one of the twelve has to exist, or the array is built with a hole.
  const layered = fetched.filter((label) => label.startsWith('layers['));
  assert.equal(layered.length, 1, 'exactly one texture should be an array');
  assert.match(layered[0]!, /^layers\[12\]:/, 'the material atlas should carry twelve layers');

  const files = fetched.flatMap((label) => label.replace(/^layers\[\d+\]:/, '').split(' '));
  assert.equal(files.length, 16, `the driver fetched ${files.length} image files`);
  for (const url of files) {
    assert.ok(existsSync(fileURLToPath(url)), `the driver fetches a texture that does not exist: ${url}`);
  }
  runtime.dispose();
});

/**
 * Construction is only half the surface. Uniforms, instance rows and rebuilt geometry are bound when
 * a frame is *submitted*, so a frame naming a uniform its program does not declare throws at draw
 * time and the construction test above sails past it.
 */
test('one real frame submits without binding anything the programs lack', async () => {
  const { runtime } = await buildTown();
  runtime.update(1 / 60, { x: 1, z: 0, active: true });
  runtime.render();
  runtime.dispose();
});

test('the shadow map is point sampled and the scene target follows the canvas', async () => {
  // The town packs a depth into two channels of the shadow map as a whole part and a fraction.
  // Filtering it decodes to a depth belonging to neither texel, which fills every shadow edge with
  // acne — so this is correctness, not quality, and it is worth a test that reads the request.
  const before = calls.length;
  const { runtime } = await buildTown();
  runtime.render();
  const targets = calls.slice(before).filter((call) => call.kind === 'target').map((call) => call.label);
  assert.deepEqual(targets, ['2048x2048:nearest', '1280x720:nearest']);
  runtime.dispose();
});
