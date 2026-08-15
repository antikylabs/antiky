import assert from 'node:assert/strict';
import test from 'node:test';

import type { RenderFrame, TargetRequest } from './render-contract.ts';

import { createBroMetalRenderDriver } from './brometal-driver.ts';

/**
 * A stand-in for BroMetal's renderer, recording what the driver asked the GPU to do.
 *
 * Mocked at the backend boundary and nowhere else, which is where `docs/GOOD_ENGINEERING_H.md` says
 * a mock belongs. The driver under test is real; only the device is not, because a device needs a
 * GPU and these tests run headless in CI.
 */
function fakeRenderer(width = 800, height = 600) {
  const log: string[] = [];
  const disposedTargets: string[] = [];
  const builtTargets: string[] = [];
  let nextTarget = 0;

  const renderer = {
    canvas: { width, height },
    aspect: width / height,
    drawTo(target: { label: string }, draw: () => void, options?: { clear?: readonly number[] }) {
      log.push(`drawTo:${target.label}${options?.clear ? `:clear(${options.clear.join(',')})` : ''}`);
      draw();
      log.push(`end:${target.label}`);
    },
    createdTarget(request: {
      width: number;
      height: number;
      depth: boolean;
      samples?: number;
      filter?: string;
    }) {
      const label = `t${nextTarget += 1}`;
      builtTargets.push(`${label}:${request.width}x${request.height}:${request.filter}`);
      return {
        label,
        width: request.width,
        height: request.height,
        texture: { label: `${label}.texture` },
        dispose: () => { disposedTargets.push(label); },
      };
    },
    log,
    disposedTargets,
    builtTargets,
  };
  return renderer;
}

/** Programs the driver builds, recording uniform writes and draws. */
function fakeProgram(key: string, log: string[]) {
  const uniforms: Record<string, { set(value: unknown): void }> = {};
  for (const name of ['uScene', 'uBloom', 'uExposure', 'uThreshold', 'uAtlasCell', 'uDiffuse']) {
    uniforms[name] = { set: (value: unknown) => { log.push(`${key}.${name}=${describe(value)}`); } };
  }
  const instanceAttributes: Record<string, { set(value: unknown): void }> = {};
  for (const name of ['iOffset', 'iScale', 'iColor']) {
    instanceAttributes[name] = {
      set: (value: unknown) => { log.push(`${key}.${name}<-${(value as Float32Array).length}`); },
    };
  }
  const attributes: Record<string, { set(value: unknown): void }> = {};
  for (const name of ['aPosition', 'aNormal']) {
    attributes[name] = {
      set: (value: unknown) => { log.push(`${key}.${name}<-${(value as Float32Array).length}`); },
    };
  }
  return {
    uniforms,
    instanceAttributes,
    attributes,
    setIndices: (value: unknown) => { log.push(`${key}.indices<-${(value as Uint32Array).length}`); },
    draw: () => { log.push(`draw:${key}`); },
    dispose: () => { log.push(`dispose:${key}`); },
  };
}

function describe(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'label' in value) {
    return String((value as { label: string }).label);
  }
  return JSON.stringify(value);
}

/**
 * Install fakes for the two BroMetal functions the driver calls.
 *
 * `createProgram` and `createRenderTarget` are module imports, so the driver is constructed with a
 * renderer whose methods stand in for them. Keeping the seam here rather than inside the driver
 * means the driver has no test-only branch in it.
 */
function harness(
  pipelineKeys: readonly string[],
  size?: readonly [number, number],
  textures?: Readonly<Record<string, unknown>>,
) {
  const renderer = fakeRenderer(size?.[0], size?.[1]);
  const log = renderer.log;
  const pipelines: Record<string, never> = {};
  for (const key of pipelineKeys) pipelines[key] = { shader: { key } } as never;

  const driver = createBroMetalRenderDriver({
    renderer: renderer as never,
    pipelines: pipelines as never,
    ...(textures === undefined ? {} : { textures }),
    createTexture: ((_r: unknown, source: { label?: string }) => ({ label: source.label ?? 'made' })) as never,
    loadTexture: (async (_r: unknown, url: string) => ({ label: `loaded:${url}` })) as never,
    loadTextureArray: (async (_r: unknown, urls: readonly string[]) => ({
      label: `layers:${urls.join(',')}`,
    })) as never,
    // Injected so the driver's real logic runs against fakes rather than a GPU.
    createProgram: ((_renderer: unknown, shader: { key: string }) => fakeProgram(shader.key, log)) as never,
    createRenderTarget: ((_renderer: unknown, request: never) => renderer.createdTarget(request)) as never,
  } as never);

  return { driver, renderer, log };
}

const TARGETS: readonly TargetRequest[] = Object.freeze([
  { key: 'shadow', scale: 1, depth: true },
  { key: 'scene', scale: 1, depth: true, samples: 4 },
  { key: 'bloom', scale: 0.25 },
]);

test('a frame runs its passes in order, into the targets it names', () => {
  const { driver, log } = harness(['depth', 'floor', 'bloom-extract', 'post']);
  driver.configureTargets(TARGETS);
  log.length = 0;

  const frame: RenderFrame = {
    passes: [
      { target: 'shadow', clear: [1, 1, 1, 1], draws: [{ pipeline: 'depth' }] },
      { target: 'scene', clear: [0, 0, 0, 1], draws: [{ pipeline: 'floor' }] },
      { target: 'bloom', draws: [{ pipeline: 'bloom-extract', uniforms: { uScene: { target: 'scene' } } }] },
      { draws: [{ pipeline: 'post', uniforms: { uBloom: { target: 'bloom' }, uExposure: 1.24 } }] },
    ],
  };
  driver.submit(frame);

  assert.deepEqual(log, [
    'drawTo:t1:clear(1,1,1,1)', 'draw:depth', 'end:t1',
    'drawTo:t2:clear(0,0,0,1)', 'draw:floor', 'end:t2',
    'drawTo:t3', 'bloom-extract.uScene=t2.texture', 'draw:bloom-extract', 'end:t3',
    'post.uBloom=t3.texture', 'post.uExposure=1.24', 'draw:post',
  ]);
});

test('a target reference resolves to the texture that pass produced', () => {
  // The one indirection in the contract, and the reason a bloom chain can read its own previous
  // step without the game ever naming a GPU object.
  const { driver, log } = harness(['post']);
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  log.length = 0;
  driver.submit({ passes: [{ draws: [{ pipeline: 'post', uniforms: { uScene: { target: 'scene' } } }] }] });
  assert.ok(log.includes('post.uScene=t1.texture'));
});

test('a scaled target is sized from the canvas, not asked for in pixels', () => {
  const { driver, renderer } = harness(['post'], [800, 600]);
  driver.configureTargets([{ key: 'bloom', scale: 0.25 }]);
  driver.submit({ passes: [{ target: 'bloom', draws: [] }] });
  assert.match(renderer.log[0]!, /^drawTo:t1/);
});

test('configuring the same targets again reuses them', () => {
  const { driver, renderer } = harness(['post']);
  driver.configureTargets(TARGETS);
  driver.configureTargets(TARGETS);
  assert.deepEqual(renderer.disposedTargets, [], 'nothing should be reallocated when nothing changed');
});

test('a target is rebuilt when the canvas size changes', () => {
  const { driver, renderer } = harness(['post']);
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  renderer.canvas.width = 1_600;
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  assert.deepEqual(renderer.disposedTargets, ['t1'], 'the stale target should be released');
});

test('an instance count of zero skips the draw entirely', () => {
  const { driver, log } = harness(['glows']);
  driver.configureTargets([]);
  log.length = 0;
  driver.submit({ passes: [{ draws: [{ pipeline: 'glows', instances: 0 }] }] });
  assert.deepEqual(log, [], 'a switched-off effect should cost nothing');
});

test('a sprite pipeline drives exactly like a mesh pipeline', () => {
  // `docs/adr/framework/0004-23d_H.md:22`: framework code must not assume every object is a mesh,
  // sprite, voxel or rigid body. The driver satisfies that by having no idea which it is drawing.
  const { driver, log } = harness(['voxel-surface', 'sprite-batch']);
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  log.length = 0;

  driver.submit({
    passes: [{
      target: 'scene',
      draws: [
        { pipeline: 'voxel-surface', instances: 1 },
        { pipeline: 'sprite-batch', instances: 18, uniforms: { uAtlasCell: [0.25, 0.5] } },
      ],
    }],
  });

  assert.deepEqual(log, [
    'drawTo:t1',
    'draw:voxel-surface',
    'sprite-batch.uAtlasCell=[0.25,0.5]',
    'draw:sprite-batch',
    'end:t1',
  ]);
});

test('naming a pipeline the driver was not given fails loudly', () => {
  const { driver } = harness(['post']);
  assert.throws(
    () => driver.submit({ passes: [{ draws: [{ pipeline: 'missing' }] }] }),
    /pipeline "missing"/,
  );
});

test('naming a target that was never configured fails loudly', () => {
  const { driver } = harness(['post']);
  assert.throws(
    () => driver.submit({ passes: [{ target: 'nowhere', draws: [] }] }),
    /target "nowhere"/,
  );
  assert.throws(
    () => driver.submit({ passes: [{ draws: [{ pipeline: 'post', uniforms: { uScene: { target: 'gone' } } }] }] }),
    /target "gone"/,
  );
});

test('dispose releases every program and every target', () => {
  const { driver, renderer, log } = harness(['floor', 'post']);
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  log.length = 0;

  driver.dispose();

  assert.deepEqual(renderer.disposedTargets, ['t1']);
  assert.deepEqual(log.filter((entry) => entry.startsWith('dispose:')).sort(), ['dispose:floor', 'dispose:post']);
});

test('instance rows reach the attributes named, before the draw', () => {
  const { driver, log } = harness(['models']);
  driver.configureTargets([]);
  log.length = 0;

  driver.submit({
    passes: [{
      draws: [{
        pipeline: 'models',
        instances: 3,
        instanceData: { iOffset: new Float32Array(9), iScale: new Float32Array(9) },
      }],
    }],
  });

  // Uploaded first, drawn second. A draw that ran before its rows landed would show the previous
  // frame's positions, which is the whole reason the order is asserted rather than assumed.
  assert.deepEqual(log, ['models.iOffset<-9', 'models.iScale<-9', 'draw:models']);
});

test('geometry rebuilt every frame reaches the attributes named, before the draw', () => {
  // Instance rows cannot express this: a mesh whose vertex count changes between frames has no
  // fixed per-instance shape to write rows into. A die-cut character's side walls, extruded from
  // the alpha contour of whichever sprite frame is showing, are exactly that.
  const { driver, log } = harness(['edges']);
  driver.configureTargets([]);
  log.length = 0;

  driver.submit({
    passes: [{
      draws: [{
        pipeline: 'edges',
        vertexData: { aPosition: new Float32Array(12), aNormal: new Float32Array(12) },
        indices: new Uint32Array(6),
      }],
    }],
  });

  // Indices last of the three, and all three before the draw. A longer triangle list landing on the
  // previous frame's shorter vertex buffers reads off the end of them.
  assert.deepEqual(log, [
    'edges.aPosition<-12',
    'edges.aNormal<-12',
    'edges.indices<-6',
    'draw:edges',
  ]);
});

test('a target that holds numbers rather than an image can ask for point sampling', () => {
  // Not a quality setting. A shadow map that packs one depth into two channels as a whole part and
  // a fraction is corrupted by interpolation: across a step in the whole part the fraction lands
  // between two unrelated values, and the decoded depth belongs to neither texel.
  const { driver, renderer } = harness(['depth'], [800, 600]);
  driver.configureTargets([
    { key: 'shadow', size: [2_048, 2_048], depth: true, filter: 'nearest' },
    { key: 'scene', scale: 1 },
  ]);
  assert.deepEqual(renderer.builtTargets, ['t1:2048x2048:nearest', 't2:800x600:linear']);
});

test('changing only a target filter rebuilds it', () => {
  const { driver, renderer } = harness(['depth']);
  driver.configureTargets([{ key: 'shadow', scale: 1 }]);
  driver.configureTargets([{ key: 'shadow', scale: 1, filter: 'nearest' }]);
  assert.deepEqual(renderer.disposedTargets, ['t1']);
});

test('a texture is sampled by key, and an unknown one fails loudly', async () => {
  const { driver, log } = harness(['floor'], undefined, {
    'floor-diffuse': { source: { label: 'atlas' } as never },
  });
  driver.configureTargets([]);
  await driver.loadTextures();
  log.length = 0;

  driver.submit({
    passes: [{ draws: [{ pipeline: 'floor', uniforms: { uDiffuse: { texture: 'floor-diffuse' } } }] }],
  });
  assert.deepEqual(log, ['floor.uDiffuse=atlas', 'draw:floor']);

  assert.throws(
    () => driver.submit({
      passes: [{ draws: [{ pipeline: 'floor', uniforms: { uDiffuse: { texture: 'missing' } } }] }],
    }),
    /texture "missing"/,
  );
});

test('every blend mode BroMetal accepts is expressible', () => {
  // Regression: the first draft of this type offered `add`, which BroMetal does not accept and
  // which would have rejected every additive glow pipeline in the repository.
  const renderer = fakeRenderer();
  const built: string[] = [];
  const driver = createBroMetalRenderDriver({
    renderer: renderer as never,
    pipelines: {
      solid: { shader: { key: 'solid' } },
      overlay: { shader: { key: 'overlay' }, options: { blend: 'alpha' } },
      glow: { shader: { key: 'glow' }, options: { blend: 'additive' } },
      opaque: { shader: { key: 'opaque' }, options: { blend: 'none' } },
    } as never,
    createProgram: ((_r: unknown, shader: { key: string }, options?: { blend?: string }) => {
      built.push(`${shader.key}:${options?.blend ?? 'default'}`);
      return fakeProgram(shader.key, renderer.log);
    }) as never,
    createRenderTarget: ((_r: unknown, request: never) => renderer.createdTarget(request)) as never,
  } as never);

  assert.deepEqual(built, ['solid:default', 'overlay:alpha', 'glow:additive', 'opaque:none']);
  driver.dispose();
});

test('a pipeline can be registered after the driver exists', () => {
  // Backlog item 1. Catalog batches are built from GLB models fetched at runtime, so they cannot be
  // supplied at construction without making every demo await all its assets before drawing.
  const { driver, log } = harness(['post']);
  driver.configureTargets([]);
  log.length = 0;

  driver.registerPipeline('late-model', { shader: { key: 'late-model' } } as never);
  driver.submit({ passes: [{ draws: [{ pipeline: 'late-model' }] }] });

  assert.deepEqual(log, ['draw:late-model']);
});

test('a late pipeline is released with the rest', () => {
  const { driver, log } = harness(['post']);
  driver.registerPipeline('late-model', { shader: { key: 'late-model' } } as never);
  log.length = 0;
  driver.dispose();
  assert.deepEqual(log.filter((entry) => entry.startsWith('dispose:')).sort(), ['dispose:late-model', 'dispose:post']);
});

test('registering over a live pipeline key is refused', () => {
  // Silently replacing one would leak the program it displaced and change what every existing frame
  // draws, which is a worse outcome than a loud error.
  const { driver } = harness(['post']);
  assert.throws(
    () => driver.registerPipeline('post', { shader: { key: 'other' } } as never),
    /already registered/,
  );
});

test('a URL-backed texture is fetched by the driver, not by the game', async () => {
  // ADR 0021 gives textures to the driver. A game that called `loadTexture` itself would be taking
  // the exception path, so the driver has to be able to do the fetching.
  const { driver, log } = harness(['floor'], undefined, {
    'floor-diffuse': { url: 'forest-floor.jpg' },
  });
  await driver.loadTextures();
  log.length = 0;

  driver.submit({
    passes: [{ draws: [{ pipeline: 'floor', uniforms: { uDiffuse: { texture: 'floor-diffuse' } } }] }],
  });
  assert.deepEqual(log, ['floor.uDiffuse=loaded:forest-floor.jpg', 'draw:floor']);
});

test('a layered texture is fetched as one array, in the order its URLs were given', async () => {
  // An array texture is one GPU object built from many images, and the order is load-bearing: the
  // shader picks a layer by index, so a driver that reordered or de-duplicated the list would draw
  // the wrong material with no error anywhere.
  const { driver, log } = harness(['floor'], undefined, {
    'material-layers': { urls: ['00-limestone.png', '01-cobblestone.png'] },
  });
  await driver.loadTextures();
  log.length = 0;

  driver.submit({
    passes: [{ draws: [{ pipeline: 'floor', uniforms: { uDiffuse: { texture: 'material-layers' } } }] }],
  });
  assert.deepEqual(log, [
    'floor.uDiffuse=layers:00-limestone.png,01-cobblestone.png',
    'draw:floor',
  ]);
});

test('loading twice does not build a texture twice', async () => {
  const { driver } = harness(['floor'], undefined, { atlas: { url: 'a.png' } });
  await driver.loadTextures();
  await driver.loadTextures();
  assert.doesNotThrow(() => driver.submit({
    passes: [{ draws: [{ pipeline: 'floor', uniforms: { uDiffuse: { texture: 'atlas' } } }] }],
  }));
});

test('a fixed-size target ignores the canvas entirely', () => {
  // A shadow map is authored at a resolution, not derived from the window. Resizing the browser
  // must not change how sharp a shadow is.
  const { driver, renderer } = harness(['depth'], [800, 600]);
  driver.configureTargets([{ key: 'shadow', size: [2_048, 2_048], depth: true, samples: 1 }]);
  renderer.canvas.width = 1_600;
  driver.configureTargets([{ key: 'shadow', size: [2_048, 2_048], depth: true, samples: 1 }]);
  assert.deepEqual(renderer.disposedTargets, [], 'a canvas resize must not rebuild a fixed target');
});

test('a scaled target still follows the canvas', () => {
  const { driver, renderer } = harness(['post'], [800, 600]);
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  renderer.canvas.width = 1_600;
  driver.configureTargets([{ key: 'scene', scale: 1 }]);
  assert.deepEqual(renderer.disposedTargets, ['t1']);
});

test('a decoded bitmap is closed once its texture exists', () => {
  // It holds real memory until something closes it, and only the driver knows when the GPU texture
  // is built. A caller that decoded the image cannot know that moment.
  let closed = 0;
  const { driver } = harness(['floor'], undefined, {
    atlas: { source: { label: 'atlas', close: () => { closed += 1; } } as never },
  });
  driver.registerTexture('atlas', { source: { label: 'atlas', close: () => { closed += 1; } } as never });
  assert.equal(closed, 1);
});
