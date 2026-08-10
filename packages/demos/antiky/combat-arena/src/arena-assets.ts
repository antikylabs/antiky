import {
  createProgram,
  createTexture,
  loadGlb,
  type BroMetalProgram,
  type BroMetalTexture,
  type Model,
  type Renderer,
} from 'brometal';

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
  upload(): void;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array): void;
  dispose(): void;
}>;

export type ArenaCatalogResources = Readonly<{
  room: ModelBatch;
  floorTiles: ModelBatch;
  cables: ModelBatch;
  targets: ModelBatch;
  grenades: ModelBatch;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array): void;
  dispose(): void;
}>;

async function createModelBatch(renderer: Renderer, model: Model, capacity: number): Promise<ModelBatch> {
  const mesh = model.meshes[0];
  if (mesh === undefined || mesh.normals === null || mesh.uvs === null || mesh.indices === null) {
    throw new Error('Combat catalog model requires indexed positions, normals, and UVs');
  }
  if (mesh.imageIndex === null || model.images[mesh.imageIndex] === undefined) {
    throw new Error('Combat catalog model requires an embedded base-color image');
  }
  const image = model.images[mesh.imageIndex]!;
  const bitmap = await createImageBitmap(new Blob(
    [image.data.slice() as unknown as BlobPart],
    { type: image.mimeType },
  ));
  const texture: BroMetalTexture = createTexture(renderer, bitmap, { flipY: false, anisotropy: 4 });
  bitmap.close();
  const program = createProgram(renderer, arenaModelShader);
  program.attributes.aPosition.set(mesh.positions);
  program.attributes.aNormal.set(mesh.normals);
  program.attributes.aUv.set(mesh.uvs);
  program.setIndices(mesh.indices);
  program.uniforms.uTex.set(texture);
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
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iTint.set(tints);
      program.instanceAttributes.iParams.set(params);
    },
    frame(viewProjection: Float32Array, cameraPosition: Float32Array): void {
      program.uniforms.uViewProj.set(viewProjection);
      program.uniforms.uCameraPosition.set(cameraPosition);
    },
    dispose(): void {
      texture.dispose();
      program.dispose();
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
): Promise<ArenaCatalogResources> {
  const models = await Promise.all([
    loadGlb(MODEL_URLS.room),
    loadGlb(MODEL_URLS.floor),
    loadGlb(MODEL_URLS.cables),
    loadGlb(MODEL_URLS.target),
    loadGlb(MODEL_URLS.grenade),
  ]);
  const resources: ModelBatch[] = [];
  try {
    const [room, floorTiles, cables, targets, grenades] = await Promise.all([
      createModelBatch(renderer, models[0]!, capacity.room),
      createModelBatch(renderer, models[1]!, capacity.floor),
      createModelBatch(renderer, models[2]!, capacity.cables),
      createModelBatch(renderer, models[3]!, capacity.targets),
      createModelBatch(renderer, models[4]!, capacity.grenades),
    ]);
    resources.push(room, floorTiles, cables, targets, grenades);

    room.set(0, [0, -0.24, 0], [1.42, 0.82, 1.42], [0.3, 0.32, 0.35], [0.04, 0, 0]);
    room.upload();
    floorTiles.clear();
    let floorIndex = 0;
    for (let zIndex = -1; zIndex <= 1; zIndex += 1) {
      for (let xIndex = -1; xIndex <= 1; xIndex += 1) {
        floorTiles.set(
          floorIndex,
          [xIndex * 4.34, -0.19, zIndex * 4.34],
          [1.04, 0.7, 1.04],
          [0.31, 0.34, 0.38],
          [0.03, 0, (xIndex + zIndex) % 2 === 0 ? 0 : Math.PI / 2],
        );
        floorIndex += 1;
      }
    }
    floorTiles.upload();
    cables.clear();
    for (let index = 0; index < capacity.cables; index += 1) {
      const angle = index / capacity.cables * Math.PI * 2 + Math.PI / 8;
      cables.set(
        index,
        [Math.cos(angle) * 6.15, -0.13, Math.sin(angle) * 6.15],
        [0.82, 0.82, 0.82],
        [0.32, 0.34, 0.38],
        [0.02, 0, angle],
      );
    }
    cables.upload();

    return Object.freeze({
      room,
      floorTiles,
      cables,
      targets,
      grenades,
      frame(viewProjection, cameraPosition): void {
        resources.forEach((batch) => batch.frame(viewProjection, cameraPosition));
      },
      dispose(): void {
        resources.reverse().forEach((batch) => batch.dispose());
      },
    });
  } catch (cause: unknown) {
    resources.reverse().forEach((batch) => batch.dispose());
    throw cause;
  }
}
