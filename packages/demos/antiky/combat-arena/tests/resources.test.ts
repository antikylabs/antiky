import assert from 'node:assert/strict';
import test from 'node:test';

import { createCube, type Model } from 'brometal';

import { createArenaCatalogResources } from '../src/arena-assets.ts';
import { createCombatProjection } from '../src/combat-projection.ts';
import { createCombatRendererWith } from '../src/renderer.ts';
import { createContactShadowBatch, createSurfaceBatch, groundQuad } from '../src/render-batches.ts';
import { createShipFleet } from '../src/ship-assets.ts';
import shipModelShader from '../src/shaders/ship-model.shader.gen.ts';
import { createCombatSimulation } from '../src/simulation.ts';
import { createSpaceBackdrop } from '../src/space-backdrop.ts';

const fakeModel: Model = {
  meshes: [{
    name: 'mesh',
    positions: new Float32Array(12),
    normals: new Float32Array(12),
    uvs: new Float32Array(8),
    indices: new Uint16Array([0, 1, 2]),
    imageIndex: 0,
  }],
  images: [{ name: 'image', mimeType: 'image/png', data: new Uint8Array([1]) }],
};

function fakeProgram(disposed: number[], failAttribute = false) {
  const set = (): void => {
    if (failAttribute) throw new Error('injected attribute failure');
  };
  return {
    attributes: { aPosition: { set }, aNormal: { set }, aUv: { set }, aColor: { set }, aAccent: { set } },
    // Any instance attribute and any uniform, answered generically. These tests are about disposal
    // order when construction throws; which attributes and uniforms exist is
    // `shader-output-parity.test.mjs`'s job, and hand-listing them here meant every new one broke a
    // test about something else. The instance attributes were a plain `{}` until W B.3 gave each
    // batch a depth program that uploads its own subset.
    instanceAttributes: new Proxy({}, { get: () => ({ set() {} }) }),
    uniforms: new Proxy({}, { get: () => ({ set() {} }) }),
    setIndices() {},
    draw() {},
    dispose() { disposed.push(1); },
  };
}

test('arena catalog rolls back completed batches and the in-flight texture on construction failure', async () => {
  let detailDisposed = 0;
  const bitmaps: number[] = [];
  const textures: number[] = [];
  const programs: number[] = [];
  let programCount = 0;
  await assert.rejects(createArenaCatalogResources({} as never, {
    room: 1, walls: 1, wallDetails: 1, floor: 1, targets: 1, grenades: 1,
  }, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() { bitmaps.push(1); } }) as never,
    createTexture: () => ({ dispose() { textures.push(1); } }),
    createProgram: () => fakeProgram(programs, ++programCount === 2) as never,
    // W B.3 gives every catalog batch a second program that draws it from the sun.
    createDepthProgram: () => fakeProgram(programs) as never,
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
    createKitMaterialLookup: () => ({ dispose() {} }),
    loadKitMaterialMaps: async () => ({ diffuse: { dispose() {} }, roughness: { dispose() {} } }),
  }), /injected attribute failure/);
  assert.equal(bitmaps.length, 2);
  assert.equal(textures.length, 2);
  // Four, not two: W B.3 gives every batch a second program that draws it from the sun, so the
  // completed batch rolls back two and the failing one rolls back the two it had registered before
  // it threw. A depth program leaked here would be invisible — it draws into a target nobody looks
  // at directly — which is exactly why it is counted.
  assert.equal(programs.length, 4);
  // Same reasoning as the fleet: catalog-owned, created first, easy to leak on the error path.
  assert.equal(detailDisposed, 1);
});

test('surface batch disposes its in-flight program when attribute setup throws', () => {
  const disposed: number[] = [];
  const program = fakeProgram(disposed, true);
  assert.throws(() => createSurfaceBatch(
    {} as never,
    createCube(),
    1,
    () => program as never,
  ), /injected attribute failure/);
  assert.equal(disposed.length, 1);
});

test('arena catalog disposes a created texture even if bitmap close fails during handoff', async () => {
  let detailDisposed = 0;
  let texturesDisposed = 0;
  await assert.rejects(createArenaCatalogResources({} as never, {
    room: 1, walls: 1, wallDetails: 1, floor: 1, targets: 1, grenades: 1,
  }, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() { throw new Error('injected close failure'); } }) as never,
    createTexture: () => ({ dispose() { texturesDisposed += 1; } }),
    createProgram: () => fakeProgram([]) as never,
    createDepthProgram: () => fakeProgram([]) as never,
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
    createKitMaterialLookup: () => ({ dispose() {} }),
    loadKitMaterialMaps: async () => ({ diffuse: { dispose() {} }, roughness: { dispose() {} } }),
  }), /injected close failure/);
  assert.equal(texturesDisposed, 1);
  assert.equal(detailDisposed, 1);
});

test('ship fleet rolls back earlier and in-flight programs on batch setup failure', async () => {
  let detailDisposed = 0;
  const programs: number[] = [];
  const textures: number[] = [];
  const bitmaps: number[] = [];
  let programCount = 0;
  await assert.rejects(createShipFleet({} as never, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() { bitmaps.push(1); } }) as never,
    createTexture: () => ({ dispose() { textures.push(1); } }),
    createProgram: () => fakeProgram(programs, ++programCount === 2) as never,
    // W B.3 gives every catalog batch a second program that draws it from the sun.
    createDepthProgram: () => fakeProgram(programs) as never,
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
  }), /injected attribute failure/);
  assert.equal(bitmaps.length, 2);
  assert.equal(textures.length, 2);
  // Four for the same reason as the catalog: a lit program and a depth program per batch.
  assert.equal(programs.length, 4);
  // The detail normal is created before any batch, so a failure partway through the fleet has to
  // take it down too. It belongs to the fleet rather than to a hull, which is exactly the shape of
  // resource that gets forgotten on the error path.
  assert.equal(detailDisposed, 1);
});

test('ship fleet uploads inverse scale for correct nonuniform normal transformation', async () => {
  let batchIndex = 0;
  let scale = new Float32Array();
  let normalScale = new Float32Array();
  const noOp = { set() {} };
  const fleet = await createShipFleet({} as never, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() {} }) as never,
    createTexture: () => ({ dispose() {} }),
    loadDetailNormal: async () => ({ dispose() {} }),
    // W B.3: every hull batch also draws itself from the sun.
    createDepthProgram: () => fakeProgram([]) as never,
    createProgram: () => {
      const capture = batchIndex === 0;
      batchIndex += 1;
      return {
        ...fakeProgram([]),
        instanceAttributes: {
          iOffset: noOp,
          iScale: { set(values: Float32Array) { if (capture) scale = new Float32Array(values); } },
          iNormalScale: { set(values: Float32Array) { if (capture) normalScale = new Float32Array(values); } },
          iTint: noOp,
          iParams: noOp,
        },
      } as never;
    },
  });
  fleet.project(createCombatSimulation(() => {}).read());
  assert.equal(shipModelShader.instanceAttributes.iNormalScale, 'vec3');
  assert.ok(Math.abs(normalScale[0]! - 1 / scale[0]!) < 0.000_001);
  assert.ok(Math.abs(normalScale[1]! - 1 / scale[1]!) < 0.000_001);
  assert.ok(Math.abs(normalScale[2]! - 1 / scale[2]!) < 0.000_001);

  const tangent = [1, -1, 0] as const;
  const normal = [0.5, 0.5, Math.SQRT1_2] as const;
  const transformedTangent = [tangent[0] * scale[0]!, tangent[1] * scale[1]!, tangent[2] * scale[2]!] as const;
  const transformedNormal = [normal[0] * normalScale[0]!, normal[1] * normalScale[1]!, normal[2] * normalScale[2]!] as const;
  const dot = transformedTangent[0] * transformedNormal[0]
    + transformedTangent[1] * transformedNormal[1]
    + transformedTangent[2] * transformedNormal[2];
  assert.ok(Math.abs(dot) < 0.000_001);
  fleet.dispose();
});

test('space backdrop disposes its in-flight program when geometry setup throws', async () => {
  const disposed: number[] = [];
  await assert.rejects(() => createSpaceBackdrop(
    {} as never,
    () => fakeProgram(disposed, true) as never,
    undefined,
    async () => ({
      starMap: { dispose() { disposed.push(1); } },
      earthAlbedo: { dispose() { disposed.push(1); } },
      earthClouds: { dispose() { disposed.push(1); } },
    }),
  ), /injected attribute failure/);
  // Only the program was created before the throw — the textures load after it, so nothing else
  // exists to roll back. This is the assertion that would catch a leak if that order ever changed.
  assert.equal(disposed.length, 1);
});

test('the sky sphere faces inward so the camera inside it is not culled away', async () => {
  let positions: Float32Array<ArrayBufferLike> = new Float32Array();
  let indices: Uint16Array<ArrayBufferLike> = new Uint16Array();
  const fakeProgram = () => ({
    attributes: {
      aPosition: { set(values: Float32Array) { positions = values; } },
      aNormal: { set() {} },
    },
    uniforms: {
      uStarMap: { set() {} }, uAlbedo: { set() {} }, uClouds: { set() {} },
      uCenter: { set() {} }, uRadius: { set() {} }, uViewProj: { set() {} }, uTime: { set() {} },
    },
    setIndices(values: Uint16Array) { indices = values; },
    draw() {},
    dispose() {},
  }) as never;
  // Only the backdrop plane's winding is under test here, so the globe's own program keeps its
  // separate capture and the sky textures are stubbed — `loadTexture` needs a DOM.
  let planeCaptured = false;
  const backdrop = await createSpaceBackdrop(
    {} as never,
    () => { planeCaptured = true; return fakeProgram(); },
    () => ({
      attributes: { aPosition: { set() {} }, aNormal: { set() {} } },
      uniforms: {
        uAlbedo: { set() {} }, uClouds: { set() {} }, uCenter: { set() {} },
        uRadius: { set() {} }, uViewProj: { set() {} }, uTime: { set() {} },
      },
      setIndices() {}, draw() {}, dispose() {},
    }) as never,
    async () => ({
      starMap: { dispose() {} },
      earthAlbedo: { dispose() {} },
      earthClouds: { dispose() {} },
    }),
  );
  assert.ok(planeCaptured);
  // The sky is a sphere the camera sits inside, so every triangle must wind toward the centre. The
  // demo culls back faces, and an outward-wound sky sphere is invisible from within — which looks
  // exactly like the texture failing to load, so it is worth asserting rather than eyeballing.
  //
  // Checked across many triangles, not just the first: a sphere generator can wind its polar caps
  // differently from its bands, and one sampled triangle would not notice.
  let inward = 0;
  let outward = 0;
  for (let triangle = 0; triangle + 2 < indices.length; triangle += 3 * 37) {
    const a = indices[triangle]! * 3;
    const b = indices[triangle + 1]! * 3;
    const c = indices[triangle + 2]! * 3;
    const edgeB = [positions[b]! - positions[a]!, positions[b + 1]! - positions[a + 1]!, positions[b + 2]! - positions[a + 2]!];
    const edgeC = [positions[c]! - positions[a]!, positions[c + 1]! - positions[a + 1]!, positions[c + 2]! - positions[a + 2]!];
    const face = [
      edgeB[1]! * edgeC[2]! - edgeB[2]! * edgeC[1]!,
      edgeB[2]! * edgeC[0]! - edgeB[0]! * edgeC[2]!,
      edgeB[0]! * edgeC[1]! - edgeB[1]! * edgeC[0]!,
    ];
    // Against the outward radius at that vertex: negative means the face looks back at the centre.
    const towardCentre = face[0]! * positions[a]! + face[1]! * positions[a + 1]! + face[2]! * positions[a + 2]!;
    if (towardCentre < 0) inward += 1;
    else if (towardCentre > 0) outward += 1;
  }
  assert.ok(inward > 8, `expected to sample many triangles, found ${inward} inward`);
  assert.equal(outward, 0, `${outward} sky triangles face outward and would be culled`);
  backdrop.dispose();
});

test('combat projection rolls back surface and glow batches if ring construction fails', () => {
  const disposed: string[] = [];
  let glowCount = 0;
  // Enough of a batch for initializeArenaCatalog to run against: it lays out the wall ring and the
  // floor grid before the renderer reaches the failure this test injects.
  const batch = (name: string) => ({
    clear() {}, set() {}, setValues() {}, upload() {}, frame() {}, draw() {},
    dispose() { disposed.push(name); },
  });
  assert.throws(() => createCombatProjection({} as never, { dispose() {} } as never, {
    createSurfaceBatch: () => batch('surface') as never,
    createContactShadowBatch: () => batch('shadow') as never,
    createHudBatch: () => ({ clear() {}, set() {}, upload() {}, draw() {}, dispose() {} }) as never,
    createGlowBatch: () => {
      glowCount += 1;
      if (glowCount === 2) throw new Error('injected ring failure');
      return batch('glow') as never;
    },
  }), /injected ring failure/);
  assert.deepEqual(disposed, ['glow', 'shadow', 'surface']);
});

test('steady combat projection uses numeric instance writers instead of tuple writes', () => {
  let tupleWrites = 0;
  let numericWrites = 0;
  const batch = () => ({
    clear() {},
    set() { tupleWrites += 1; },
    setValues() { numericWrites += 1; },
    upload() {},
    frame() {},
    program: { draw() {} },
    dispose() {},
  });
  const projection = createCombatProjection({} as never, { dispose() {} } as never, {
    createSurfaceBatch: () => batch() as never,
    createContactShadowBatch: () => batch() as never,
    createGlowBatch: () => batch() as never,
    createHudBatch: () => ({ clear() {}, set() {}, upload() {}, draw() {}, dispose() {} }) as never,
  });
  projection.project(createCombatSimulation(() => {}).read());
  assert.equal(tupleWrites, 0);
  assert.ok(numericWrites > 60);
  projection.dispose();
});

test('renderer destroys its context and catalog if the next top-level resource fails', async () => {
  const disposed: string[] = [];
  const renderer = { destroy() { disposed.push('renderer'); } };
  await assert.rejects(createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => renderer as never,
    createCatalog: async () => ({ dispose() { disposed.push('catalog'); } }) as never,
    createShips: async () => { throw new Error('injected fleet failure'); },
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => { throw new Error('must not reach projection'); },
    createBackdrop: () => { throw new Error('must not reach backdrop'); },
    // W B.2's GPU owners. Unreached in this case, but the shape has to satisfy the contract.
    createSceneTarget: () => { throw new Error('must not reach the scene target'); },
    createPostProgram: () => { throw new Error('must not reach the post program'); },
    createShadowPass: () => { throw new Error('must not reach the shadow pass'); },
    createBloomTarget: () => { throw new Error('must not reach the bloom chain'); },
    createBloomProgram: () => { throw new Error('must not reach the bloom chain'); },
    createReflectionTarget: () => { throw new Error('must not reach the reflection target'); },
  }), /injected fleet failure/);
  assert.deepEqual(disposed, ['catalog', 'renderer']);
});

test('renderer rolls back ships and catalog when top-level projection creation fails', async () => {
  const disposed: string[] = [];
  const renderer = { destroy() { disposed.push('renderer'); } };
  const batch = {
    // `setValues` too: `initializeArenaCatalog` lays out the wall ring through it before the
    // renderer reaches the failure these tests inject.
    clear() {}, set() {}, setValues() {}, upload() {}, frame() {}, dispose() {},
    program: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    depthProgram: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    drawDepth() {},
  };
  await assert.rejects(createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => renderer as never,
    createCatalog: async () => ({
      room: batch, walls: batch, wallDetails: batch, floorTiles: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposed.push('catalog'); },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, drawDepth() {}, programs: [],
      dispose() { disposed.push('ships'); },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => { throw new Error('injected projection failure'); },
    createBackdrop: () => { throw new Error('must not reach backdrop'); },
    // W B.2's GPU owners. Unreached in this case, but the shape has to satisfy the contract.
    createSceneTarget: () => { throw new Error('must not reach the scene target'); },
    createPostProgram: () => { throw new Error('must not reach the post program'); },
    createShadowPass: () => { throw new Error('must not reach the shadow pass'); },
    createBloomTarget: () => { throw new Error('must not reach the bloom chain'); },
    createBloomProgram: () => { throw new Error('must not reach the bloom chain'); },
    createReflectionTarget: () => { throw new Error('must not reach the reflection target'); },
  }), /injected projection failure/);
  assert.deepEqual(disposed, ['ships', 'catalog', 'renderer']);
});

test('renderer rolls back projection, ships, and catalog when backdrop creation fails', async () => {
  const disposed: string[] = [];
  const batch = {
    // `setValues` too: `initializeArenaCatalog` lays out the wall ring through it before the
    // renderer reaches the failure these tests inject.
    clear() {}, set() {}, setValues() {}, upload() {}, frame() {}, dispose() {},
    program: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    depthProgram: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    drawDepth() {},
  };
  await assert.rejects(createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => ({ destroy() { disposed.push('renderer'); } }) as never,
    createCatalog: async () => ({
      room: batch, walls: batch, wallDetails: batch, floorTiles: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposed.push('catalog'); },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, drawDepth() {}, programs: [],
      dispose() { disposed.push('ships'); },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => ({
      project() {}, frame() {}, drawSurface() {}, drawSurfaceDepth() {},
      drawShadows() {}, drawEnergy() {}, drawHud() {},
      surfaceProgram: {} as never, surfaceDepthProgram: {} as never,
      dispose() { disposed.push('projection'); },
    }),
    createBackdrop: () => { throw new Error('injected backdrop failure'); },
    // W B.2's GPU owners. Unreached in this case, but the shape has to satisfy the contract.
    createSceneTarget: () => { throw new Error('must not reach the scene target'); },
    createPostProgram: () => { throw new Error('must not reach the post program'); },
    createShadowPass: () => { throw new Error('must not reach the shadow pass'); },
    createBloomTarget: () => { throw new Error('must not reach the bloom chain'); },
    createBloomProgram: () => { throw new Error('must not reach the bloom chain'); },
    createReflectionTarget: () => { throw new Error('must not reach the reflection target'); },
  }), /injected backdrop failure/);
  assert.deepEqual(disposed, ['projection', 'ships', 'catalog', 'renderer']);
});

test('renderer disposal is idempotent and destroys every GPU owner once', async () => {
  const disposals = {
    catalog: 0, ships: 0, projection: 0, backdrop: 0, renderer: 0, sceneTarget: 0, postProgram: 0,
    shadowPass: 0, bloomTarget: 0, bloomProgram: 0, reflectionTarget: 0,
  };
  const batch = {
    // `setValues` too: `initializeArenaCatalog` lays out the wall ring through it before the
    // renderer reaches the failure these tests inject.
    clear() {}, set() {}, setValues() {}, upload() {}, frame() {}, dispose() {},
    program: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    depthProgram: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }), draw() {} },
    drawDepth() {},
  };
  const renderer = {
    aspect: 16 / 9,
    // The post pass needs a canvas size to build its target from, and `drawTo` is what the frame
    // calls instead of drawing straight to the screen.
    canvas: { width: 8, height: 8 },
    present(draw: () => void) { draw(); },
    drawTo(_target: unknown, draw: () => void) { draw(); },
    destroy() { disposals.renderer += 1; },
  };
  const combatRenderer = await createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => renderer as never,
    createCatalog: async () => ({
      room: batch, walls: batch, wallDetails: batch, floorTiles: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposals.catalog += 1; },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, drawDepth() {}, programs: [],
      dispose() { disposals.ships += 1; },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => ({
      project() {}, frame() {}, drawSurface() {}, drawSurfaceDepth() {},
      drawShadows() {}, drawEnergy() {}, drawHud() {},
      surfaceProgram: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }) } as never,
      surfaceDepthProgram: { uniforms: new Proxy({}, { get: () => ({ set() {} }) }) } as never,
      dispose() { disposals.projection += 1; },
    }),
    createBackdrop: async () => ({
      frame() {}, draw() {}, dispose() { disposals.backdrop += 1; },
    }),
    // W B.2's two GPU owners. The scene target is rebuilt on canvas resize so it is not in the
    // resource scope, which makes "is it disposed exactly once" a real question rather than a
    // formality — that is what this test is for.
    createSceneTarget: () => ({
      width: 1, height: 1, texture: {}, depth: true,
      dispose() { disposals.sceneTarget += 1; },
    }) as never,
    createPostProgram: () => ({
      attributes: { aPosition: { set() {} } },
      uniforms: new Proxy({}, { get: () => ({ set() {} }) }),
      setIndices() {}, draw() {},
      dispose() { disposals.postProgram += 1; },
    }) as never,
    // W B.3's shadow map. Another GPU owner, so another thing that must be disposed exactly once.
    createShadowPass: () => ({
      bind() {}, render(draw: () => void) { draw(); },
      dispose() { disposals.shadowPass += 1; },
    }) as never,
    // W B.5's bloom chain: two targets and two programs, all four GPU owners.
    createBloomTarget: () => ({
      width: 1, height: 1, texture: {}, depth: false,
      dispose() { disposals.bloomTarget += 1; },
    }) as never,
    createBloomProgram: () => ({
      attributes: { aPosition: { set() {} } },
      uniforms: new Proxy({}, { get: () => ({ set() {} }) }),
      setIndices() {}, draw() {},
      dispose() { disposals.bloomProgram += 1; },
    }) as never,
    // Goal 08's planar reflection: one more lazily built, resize-rebuilt GPU owner.
    createReflectionTarget: () => ({
      width: 1, height: 1, texture: {}, depth: true,
      dispose() { disposals.reflectionTarget += 1; },
    }) as never,
  });
  // One frame first, because the scene target is built lazily on the first draw. Disposing without
  // rendering would leave nothing to dispose and the assertion below would be checking that a
  // resource which never existed was cleaned up.
  combatRenderer.render(createCombatSimulation(() => {}).read(), { x: 0, y: 0 });
  combatRenderer.dispose();
  combatRenderer.dispose();
  assert.deepEqual(disposals, {
    catalog: 1, ships: 1, projection: 1, backdrop: 1, renderer: 1, sceneTarget: 1, postProgram: 1,
    shadowPass: 1, bloomTarget: 2, bloomProgram: 2, reflectionTarget: 1,
  });
});

test('contact shadows are unlit, soft, and blended without writing depth', async () => {
  const shader = (await import('../src/shaders/contact-shadow.shader.gen.ts')).default;
  const source = shader.wgslSrc;

  // The defect this replaces: shadow blobs drawn through `arena-surface`, so the key light, the
  // fog and the tone-mapper all acted on them. A shadow that brightens under a light is not a
  // shadow. None of those terms may appear here.
  for (const banned of ['tonemap', 'uCameraPosition', 'normalize', 'smoothstep(17']) {
    assert.ok(!source.includes(banned), `contact shadow shader must not reference ${banned}`);
  }

  // Soft, not a rectangle: the alpha has to vary across the quad.
  assert.match(source, /smoothstep/);
  assert.equal(shader.uniforms.uViewProj, 'mat4');
  // Named rather than counted. The count stood in for "unlit", and it did that job until a
  // texture arrived that carries no light — so this says which two belong, which still keeps a
  // third from slipping in while letting the sprite through.
  assert.deepEqual(Object.keys(shader.uniforms).sort(), ['uBillboard', 'uViewProj']);
});

test('a cleared contact shadow slot paints nothing', () => {
  const uploads: Record<string, Float32Array> = {};
  const program = {
    attributes: { aPosition: { set() {} } },
    instanceAttributes: {
      iOffset: { set(v: Float32Array) { uploads.offsets = v; } },
      iScale: { set(v: Float32Array) { uploads.scales = v; } },
      iColor: { set(v: Float32Array) { uploads.colors = v; } },
    },
    uniforms: { uViewProj: { set() {} }, uBillboard: { set() {} } },
    setIndices() {}, draw() {}, dispose() {},
  };
  const batch = createContactShadowBatch({} as never, 3, { dispose() {} }, () => program as never);
  batch.setValues(0, 1, 2, 3, 0.5, 0, 0.5, 0.1, 0.1, 0.1);
  batch.clear();
  batch.upload();

  // `clear` zeroes the radius, and the shader gates on it. Without that gate a zero-size quad
  // still covers the pixel its vertices collapse onto, painting a dot at the world origin.
  assert.equal(uploads.scales!.every((value) => value === 0), true);
  assert.equal(uploads.colors!.every((value) => value === 0), true);
  batch.dispose();
});

test('the shadow quad is a single flat surface, so alpha is not applied twice', () => {
  const geometry = groundQuad();
  for (let index = 1; index < geometry.positions.length; index += 3) {
    assert.equal(geometry.positions[index], 0, 'every shadow vertex must sit on the ground plane');
  }
  // Two triangles, one facing up. A cube here would blend its top and bottom faces over the same
  // pixels and darken every blob twice.
  assert.equal(geometry.indices.length, 6);
});
