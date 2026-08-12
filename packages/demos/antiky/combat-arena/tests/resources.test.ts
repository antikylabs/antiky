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
    instanceAttributes: {},
    uniforms: { uTex: { set() {} }, uDetailNormal: { set() {} }, uKitMaterials: { set() {} } },
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
    room: 1, floor: 1, cables: 1, targets: 1, grenades: 1,
  }, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() { bitmaps.push(1); } }) as never,
    createTexture: () => ({ dispose() { textures.push(1); } }),
    createProgram: () => fakeProgram(programs, ++programCount === 2) as never,
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
    createKitMaterialLookup: () => ({ dispose() {} }),
  }), /injected attribute failure/);
  assert.equal(bitmaps.length, 2);
  assert.equal(textures.length, 2);
  assert.equal(programs.length, 2);
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
    room: 1, floor: 1, cables: 1, targets: 1, grenades: 1,
  }, {
    loadModel: async () => fakeModel,
    createBitmap: async () => ({ close() { throw new Error('injected close failure'); } }) as never,
    createTexture: () => ({ dispose() { texturesDisposed += 1; } }),
    createProgram: () => fakeProgram([]) as never,
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
    createKitMaterialLookup: () => ({ dispose() {} }),
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
    loadDetailNormal: async () => ({ dispose() { detailDisposed += 1; } }),
  }), /injected attribute failure/);
  assert.equal(bitmaps.length, 2);
  assert.equal(textures.length, 2);
  assert.equal(programs.length, 2);
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

test('space backdrop disposes its in-flight program when geometry setup throws', () => {
  const disposed: number[] = [];
  assert.throws(() => createSpaceBackdrop(
    {} as never,
    () => fakeProgram(disposed, true) as never,
  ), /injected attribute failure/);
  assert.equal(disposed.length, 1);
});

test('space backdrop submits upward-facing geometry for the renderer back-face policy', () => {
  let positions: Float32Array<ArrayBufferLike> = new Float32Array();
  let indices: Uint16Array<ArrayBufferLike> = new Uint16Array();
  const backdrop = createSpaceBackdrop({} as never, () => ({
    attributes: { aPosition: { set(values: Float32Array) { positions = values; } } },
    uniforms: {},
    setIndices(values: Uint16Array) { indices = values; },
    draw() {},
    dispose() {},
  }) as never);
  const a = indices[0]! * 3;
  const b = indices[1]! * 3;
  const c = indices[2]! * 3;
  const edgeBX = positions[b]! - positions[a]!;
  const edgeBZ = positions[b + 2]! - positions[a + 2]!;
  const edgeCX = positions[c]! - positions[a]!;
  const edgeCZ = positions[c + 2]! - positions[a + 2]!;
  const normalY = edgeBZ * edgeCX - edgeBX * edgeCZ;
  assert.ok(normalY > 0);
  backdrop.dispose();
});

test('combat projection rolls back surface and glow batches if ring construction fails', () => {
  const disposed: string[] = [];
  let glowCount = 0;
  const batch = (name: string) => ({ dispose() { disposed.push(name); } });
  assert.throws(() => createCombatProjection({} as never, { dispose() {} } as never, {
    createSurfaceBatch: () => batch('surface') as never,
    createContactShadowBatch: () => batch('shadow') as never,
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
  }), /injected fleet failure/);
  assert.deepEqual(disposed, ['catalog', 'renderer']);
});

test('renderer rolls back ships and catalog when top-level projection creation fails', async () => {
  const disposed: string[] = [];
  const renderer = { destroy() { disposed.push('renderer'); } };
  const batch = {
    clear() {}, set() {}, upload() {}, frame() {}, dispose() {}, program: { draw() {} },
  };
  await assert.rejects(createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => renderer as never,
    createCatalog: async () => ({
      room: batch, floorTiles: batch, cables: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposed.push('catalog'); },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, dispose() { disposed.push('ships'); },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => { throw new Error('injected projection failure'); },
    createBackdrop: () => { throw new Error('must not reach backdrop'); },
  }), /injected projection failure/);
  assert.deepEqual(disposed, ['ships', 'catalog', 'renderer']);
});

test('renderer rolls back projection, ships, and catalog when backdrop creation fails', async () => {
  const disposed: string[] = [];
  const batch = {
    clear() {}, set() {}, upload() {}, frame() {}, dispose() {}, program: { draw() {} },
  };
  await assert.rejects(createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => ({ destroy() { disposed.push('renderer'); } }) as never,
    createCatalog: async () => ({
      room: batch, floorTiles: batch, cables: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposed.push('catalog'); },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, dispose() { disposed.push('ships'); },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => ({
      project() {}, frame() {}, drawSurface() {}, drawShadows() {}, drawEnergy() {},
      dispose() { disposed.push('projection'); },
    }),
    createBackdrop: () => { throw new Error('injected backdrop failure'); },
  }), /injected backdrop failure/);
  assert.deepEqual(disposed, ['projection', 'ships', 'catalog', 'renderer']);
});

test('renderer disposal is idempotent and destroys every GPU owner once', async () => {
  const disposals = { catalog: 0, ships: 0, projection: 0, backdrop: 0, renderer: 0 };
  const batch = {
    clear() {}, set() {}, upload() {}, frame() {}, dispose() {}, program: { draw() {} },
  };
  const renderer = {
    aspect: 16 / 9,
    present() {},
    destroy() { disposals.renderer += 1; },
  };
  const combatRenderer = await createCombatRendererWith({} as HTMLCanvasElement, {
    createRenderer: async () => renderer as never,
    createCatalog: async () => ({
      room: batch, floorTiles: batch, cables: batch, targets: batch, grenades: batch,
      frame() {}, dispose() { disposals.catalog += 1; },
    }) as never,
    createShips: async () => ({
      project() {}, frame() {}, draw() {}, dispose() { disposals.ships += 1; },
    }),
    loadVfxBillboard: async () => ({ dispose() {} }),
    createProjection: () => ({
      project() {}, frame() {}, drawSurface() {}, drawShadows() {}, drawEnergy() {},
      dispose() { disposals.projection += 1; },
    }),
    createBackdrop: () => ({
      frame() {}, draw() {}, dispose() { disposals.backdrop += 1; },
    }),
  });
  combatRenderer.dispose();
  combatRenderer.dispose();
  assert.deepEqual(disposals, { catalog: 1, ships: 1, projection: 1, backdrop: 1, renderer: 1 });
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
