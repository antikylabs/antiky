import {
  createProgram,
  createTexture,
  loadGlb,
  type BroMetalProgram,
  type BroMetalTexture,
  type Model,
  type ModelImage,
  type Renderer,
} from 'brometal';

import { loadKitMaterialMaps } from './kit-material-maps.ts';
import { createKitMaterialLookup } from './kit-materials.ts';
import { loadDetailNormal } from './detail-normal.ts';
import { disposeResources, registerResource, rollbackResources } from './resource-lifetime.ts';
import arenaModelShader from './shaders/arena-model.shader.gen.ts';

type Vec3 = readonly [number, number, number];

const MODEL_URLS = Object.freeze({
  room: new URL('../assets/kenney/modular-space-kit/room-small.glb?no-inline', import.meta.url).href,
  floor: new URL('../assets/kenney/modular-space-kit/template-floor-layer.glb?no-inline', import.meta.url).href,
  cables: new URL('../assets/kenney/modular-space-kit/cables.glb?no-inline', import.meta.url).href,
  target: new URL('../assets/kenney/blaster-kit/target-detail.glb?no-inline', import.meta.url).href,
  grenade: new URL('../assets/kenney/blaster-kit/grenade-a.glb?no-inline', import.meta.url).href,
});

export const CATALOG_ASSET_COUNT = Object.keys(MODEL_URLS).length;

export type ModelBatch = Readonly<{
  program: BroMetalProgram;
  clear(): void;
  set(index: number, offset: Vec3, scale: Vec3, tint: Vec3, material: Vec3): void;
  setValues(
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
    tint: Vec3,
    emissive: number, hit: number, rotation: number,
  ): void;
  upload(): void;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void;
  dispose(): void;
}>;

export type ArenaCatalogResources = Readonly<{
  room: ModelBatch;
  floorTiles: ModelBatch;
  cables: ModelBatch;
  targets: ModelBatch;
  grenades: ModelBatch;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void;
  dispose(): void;
}>;

export type ArenaAssetDependencies = Readonly<{
  loadModel(url: string): Promise<Model>;
  createBitmap(image: ModelImage): Promise<ImageBitmap>;
  createTexture(renderer: Renderer, bitmap: ImageBitmap): BroMetalTexture;
  createProgram(renderer: Renderer): BroMetalProgram;
  /**
   * Loaded once for the whole catalog rather than per batch. Five models share one detail normal,
   * and five uploads of the same 512² image is four wasted.
   */
  loadDetailNormal(renderer: Renderer): Promise<BroMetalTexture>;
  createKitMaterialLookup(renderer: Renderer): BroMetalTexture;
  loadKitMaterialMaps(renderer: Renderer): Promise<Readonly<{ diffuse: BroMetalTexture; roughness: BroMetalTexture }>>;
}>;

const ARENA_ASSET_DEPENDENCIES: ArenaAssetDependencies = Object.freeze({
  loadModel: loadGlb,
  createBitmap: async (image) => createImageBitmap(new Blob(
    [image.data.slice() as unknown as BlobPart],
    { type: image.mimeType },
  )),
  createTexture: (renderer, bitmap) => createTexture(renderer, bitmap, { flipY: false, anisotropy: 4 }),
  createProgram: (renderer) => createProgram(renderer, arenaModelShader),
  loadDetailNormal,
  createKitMaterialLookup,
  loadKitMaterialMaps,
});

async function createModelBatch(
  renderer: Renderer,
  model: Model,
  capacity: number,
  dependencies: ArenaAssetDependencies,
  detailNormal: BroMetalTexture,
  kitMaterials: BroMetalTexture,
  plating: BroMetalTexture,
  /** The deck and structure are plated; cables and blaster-kit props are not. */
  platingStrength: number,
): Promise<ModelBatch> {
  const mesh = model.meshes[0];
  if (mesh === undefined || mesh.normals === null || mesh.uvs === null || mesh.indices === null) {
    throw new Error('Combat catalog model requires indexed positions, normals, and UVs');
  }
  if (mesh.imageIndex === null || model.images[mesh.imageIndex] === undefined) {
    throw new Error('Combat catalog model requires an embedded base-color image');
  }
  const image = model.images[mesh.imageIndex]!;
  const owned: { dispose(): void }[] = [];
  const bitmap = await dependencies.createBitmap(image);
  let texture: BroMetalTexture;
  let program: BroMetalProgram;
  try {
    try {
      texture = registerResource(owned, dependencies.createTexture(renderer, bitmap));
    } finally {
      bitmap.close();
    }
    program = registerResource(owned, dependencies.createProgram(renderer));
    program.attributes.aPosition!.set(mesh.positions);
    program.attributes.aNormal!.set(mesh.normals);
    program.attributes.aUv!.set(mesh.uvs);
    program.setIndices(mesh.indices);
    program.uniforms.uTex!.set(texture);
    program.uniforms.uDetailNormal!.set(detailNormal);
    program.uniforms.uKitMaterials!.set(kitMaterials);
    program.uniforms.uMaterialDiffuse!.set(plating);
    program.uniforms.uMaterialStrength!.set(platingStrength);
  } catch (cause: unknown) {
    rollbackResources(owned);
    throw cause;
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const tints = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      tints.fill(0);
      params.fill(0);
    },
    set(index: number, offset: Vec3, scale: Vec3, tint: Vec3, material: Vec3): void {
      offsets.set(offset, index * 3);
      scales.set(scale, index * 3);
      tints.set(tint, index * 3);
      params.set(material, index * 3);
    },
    setValues(index, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, tint, emissive, hit, rotation): void {
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = scaleX;
      scales[at + 1] = scaleY;
      scales[at + 2] = scaleZ;
      tints[at] = tint[0];
      tints[at + 1] = tint[1];
      tints[at + 2] = tint[2];
      params[at] = emissive;
      params[at + 1] = hit;
      params[at + 2] = rotation;
    },
    upload(): void {
      program.instanceAttributes.iOffset!.set(offsets);
      program.instanceAttributes.iScale!.set(scales);
      program.instanceAttributes.iTint!.set(tints);
      program.instanceAttributes.iParams!.set(params);
    },
    frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uCameraPosition!.set(cameraPosition);
      program.uniforms.uTime!.set(time);
    },
    dispose(): void {
      disposeResources(owned);
    },
  });
}

export async function createArenaCatalogResources(
  renderer: Renderer,
  capacity: Readonly<{
    room: number;
    floor: number;
    cables: number;
    targets: number;
    grenades: number;
  }>,
  dependencies: ArenaAssetDependencies = ARENA_ASSET_DEPENDENCIES,
): Promise<ArenaCatalogResources> {
  const models = await Promise.all([
    dependencies.loadModel(MODEL_URLS.room),
    dependencies.loadModel(MODEL_URLS.floor),
    dependencies.loadModel(MODEL_URLS.cables),
    dependencies.loadModel(MODEL_URLS.target),
    dependencies.loadModel(MODEL_URLS.grenade),
  ]);
  // The detail normal is owned by the catalog, not by any one batch, so it is registered first and
  // rolled back with the rest. A texture created before the failure point and not registered is a
  // leak that nothing reports.
  const resources: { dispose(): void }[] = [];
  try {
    const detailNormal = registerResource(resources, await dependencies.loadDetailNormal(renderer));
    const kitMaterials = registerResource(resources, dependencies.createKitMaterialLookup(renderer));
    const materialMaps = await dependencies.loadKitMaterialMaps(renderer);
    registerResource(resources, materialMaps.diffuse);
    registerResource(resources, materialMaps.roughness);
    const room = registerResource(resources, await createModelBatch(renderer, models[0]!, capacity.room, dependencies, detailNormal, kitMaterials, materialMaps.diffuse, 1));
    const floorTiles = registerResource(resources, await createModelBatch(renderer, models[1]!, capacity.floor, dependencies, detailNormal, kitMaterials, materialMaps.diffuse, 1));
    const cables = registerResource(resources, await createModelBatch(renderer, models[2]!, capacity.cables, dependencies, detailNormal, kitMaterials, materialMaps.diffuse, 0));
    const targets = registerResource(resources, await createModelBatch(renderer, models[3]!, capacity.targets, dependencies, detailNormal, kitMaterials, materialMaps.diffuse, 0.35));
    const grenades = registerResource(resources, await createModelBatch(renderer, models[4]!, capacity.grenades, dependencies, detailNormal, kitMaterials, materialMaps.diffuse, 0));

    // Disposal covers everything the catalog owns; per-frame work is only the batches. Iterating
    // `resources` here would call `frame` on a texture.
    const batches: ModelBatch[] = [room, floorTiles, cables, targets, grenades];

    return Object.freeze({
      room,
      floorTiles,
      cables,
      targets,
      grenades,
      frame(viewProjection, cameraPosition, time): void {
        for (let index = 0; index < batches.length; index += 1) {
          batches[index]!.frame(viewProjection, cameraPosition, time);
        }
      },
      dispose(): void {
        disposeResources(resources);
      },
    });
  } catch (cause: unknown) {
    rollbackResources(resources);
    throw cause;
  }
}
