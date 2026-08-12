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

import { disposeResources, registerResource, rollbackResources } from './resource-lifetime.ts';
import reliquaryModelShader from './shaders/reliquary-model.shader.gen.ts';

export const DEAD_TREE_RUNTIME_URL = new URL(
  '../assets/derived/dead-tree-trunk-runtime.glb?no-inline', import.meta.url,
).href;
export const ROCK_MOSS_RUNTIME_URL = new URL(
  '../assets/derived/rock-moss-set-01-runtime.glb?no-inline', import.meta.url,
).href;
export const TREE_STUMP_RUNTIME_URL = new URL(
  '../assets/derived/tree-stump-01-runtime.glb?no-inline', import.meta.url,
).href;

type TextureRole = 'diffuse' | 'material' | 'normal';

export type ReliquaryModelDependencies = Readonly<{
  loadModel(url: string): Promise<Model>;
  createBitmap(image: ModelImage): Promise<ImageBitmap>;
  createTexture(renderer: Renderer, bitmap: ImageBitmap, role: TextureRole): BroMetalTexture;
  createProgram(renderer: Renderer): BroMetalProgram;
}>;

const MODEL_DEPENDENCIES: ReliquaryModelDependencies = Object.freeze({
  loadModel: loadGlb,
  createBitmap: async (image) => createImageBitmap(new Blob(
    [image.data.slice() as unknown as BlobPart],
    { type: image.mimeType },
  )),
  createTexture: (renderer, bitmap) => createTexture(renderer, bitmap, {
    flipY: false,
    anisotropy: 8,
  }),
  createProgram: (renderer) => createProgram(renderer, reliquaryModelShader),
});

type ModelBatchDescriptor = Readonly<{
  label: string;
  url: string;
  diffuseImage: string;
  materialImage: string;
  normalImage: string;
  materialLayout: 0 | 1;
}>;

const DEAD_TREE = Object.freeze({
  label: 'Dead Tree Trunk',
  url: DEAD_TREE_RUNTIME_URL,
  diffuseImage: 'dead_tree_trunk_diff',
  materialImage: 'dead_tree_trunk_arm',
  normalImage: 'dead_tree_trunk_nor',
  materialLayout: 0 as const,
});
const ROCK_MOSS = Object.freeze({
  label: 'Rock Moss Set 01',
  url: ROCK_MOSS_RUNTIME_URL,
  diffuseImage: 'catalog_diff',
  materialImage: 'catalog_material',
  normalImage: 'catalog_normal',
  materialLayout: 1 as const,
});
const TREE_STUMP = Object.freeze({
  label: 'Tree Stump 01',
  url: TREE_STUMP_RUNTIME_URL,
  diffuseImage: 'catalog_diff',
  materialImage: 'catalog_material',
  normalImage: 'catalog_normal',
  materialLayout: 0 as const,
});

function modelImage(model: Model, name: string, label: string): ModelImage {
  const image = model.images.find((candidate) => candidate.name === name);
  if (image === undefined) throw new Error(`${label} runtime model is missing ${name}.`);
  return image;
}

export type ReliquaryModelBatch = Readonly<{
  program: BroMetalProgram;
  clear(): void;
  setValues(
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scale: number,
    rotationX: number, rotationY: number, rotationZ: number,
    tintRed: number, tintGreen: number, tintBlue: number,
    roughnessBias: number, emissive: number,
  ): void;
  upload(): void;
  draw(): void;
  dispose(): void;
}>;

async function createCatalogModelBatch(
  renderer: Renderer,
  capacity: number,
  descriptor: ModelBatchDescriptor,
  dependencies: ReliquaryModelDependencies,
): Promise<ReliquaryModelBatch> {
  const model = await dependencies.loadModel(descriptor.url);
  const mesh = model.meshes[0];
  if (
    model.meshes.length !== 1
    || mesh === undefined
    || mesh.normals === null
    || mesh.uvs === null
    || mesh.indices === null
  ) throw new Error(`${descriptor.label} runtime model requires one indexed mesh with normals and UVs.`);

  const owned: { dispose(): void }[] = [];
  try {
    const loadTexture = async (name: string, role: TextureRole) => {
      const bitmap = await dependencies.createBitmap(modelImage(model, name, descriptor.label));
      try {
        return registerResource(owned, dependencies.createTexture(renderer, bitmap, role));
      } finally {
        bitmap.close();
      }
    };
    const diffuse = await loadTexture(descriptor.diffuseImage, 'diffuse');
    const material = await loadTexture(descriptor.materialImage, 'material');
    const normalMap = await loadTexture(descriptor.normalImage, 'normal');
    const program = registerResource(owned, dependencies.createProgram(renderer));
    program.attributes.aPosition!.set(mesh.positions);
    program.attributes.aNormal!.set(mesh.normals);
    program.attributes.aUv!.set(mesh.uvs);
    program.setIndices(mesh.indices);
    program.uniforms.uDiffuse!.set(diffuse);
    program.uniforms.uArm!.set(material);
    program.uniforms.uNormalMap!.set(normalMap);
    // Full strength. The scans are 1K and their detail is the whole reason they were chosen.
    program.uniforms.uNormalStrength!.set(1);
    program.uniforms.uMaterialLayout!.set(descriptor.materialLayout);

    const offsets = new Float32Array(capacity * 3);
    const scales = new Float32Array(capacity);
    const rotations = new Float32Array(capacity * 3);
    const tints = new Float32Array(capacity * 3);
    const materials = new Float32Array(capacity * 2);
    const clear = (): void => {
      scales.fill(0);
      materials.fill(0);
    };
    const setValues: ReliquaryModelBatch['setValues'] = (
      index,
      offsetX, offsetY, offsetZ,
      scale,
      rotationX, rotationY, rotationZ,
      tintRed, tintGreen, tintBlue,
      roughnessBias, emissive,
    ) => {
      if (!Number.isInteger(index) || index < 0 || index >= capacity) {
        throw new RangeError(`${descriptor.label} instance ${index} exceeds capacity ${capacity}.`);
      }
      const vectorAt = index * 3;
      const materialAt = index * 2;
      offsets[vectorAt] = offsetX;
      offsets[vectorAt + 1] = offsetY;
      offsets[vectorAt + 2] = offsetZ;
      scales[index] = scale;
      rotations[vectorAt] = rotationX;
      rotations[vectorAt + 1] = rotationY;
      rotations[vectorAt + 2] = rotationZ;
      tints[vectorAt] = tintRed;
      tints[vectorAt + 1] = tintGreen;
      tints[vectorAt + 2] = tintBlue;
      materials[materialAt] = roughnessBias;
      materials[materialAt + 1] = emissive;
    };
    clear();

    return Object.freeze({
      program,
      clear,
      setValues,
      upload(): void {
        program.instanceAttributes.iOffset!.set(offsets);
        program.instanceAttributes.iScale!.set(scales);
        program.instanceAttributes.iRotation!.set(rotations);
        program.instanceAttributes.iTint!.set(tints);
        program.instanceAttributes.iMaterial!.set(materials);
      },
      draw(): void { program.draw(); },
      dispose(): void { disposeResources(owned); },
    });
  } catch (cause: unknown) {
    rollbackResources(owned);
    throw cause;
  }
}

export function createReliquaryModelBatch(
  renderer: Renderer,
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch(renderer, capacity, DEAD_TREE, dependencies);
}

export function createRockModelBatch(
  renderer: Renderer,
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch(renderer, capacity, ROCK_MOSS, dependencies);
}

export function createStumpModelBatch(
  renderer: Renderer,
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch(renderer, capacity, TREE_STUMP, dependencies);
}
