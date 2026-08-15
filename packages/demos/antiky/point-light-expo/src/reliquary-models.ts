import { loadGlb, type Model, type ModelImage } from 'brometal';
import type { PipelineDefinition, TextureSource } from '@antiky/framework/render-driver';
import modelDepthShader from './shaders/model-depth.shader.gen.ts';
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
}>;

const MODEL_DEPENDENCIES: ReliquaryModelDependencies = Object.freeze({
  loadModel: loadGlb,
  createBitmap: async (image) => createImageBitmap(new Blob(
    [image.data.slice() as unknown as BlobPart],
    { type: image.mimeType },
  )),
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
  /** Textures the driver should own, keyed by this batch's name. */
  textures: Record<string, TextureSource>;
  pipeline: PipelineDefinition;
  /** The same geometry drawn from the sun. */
  depthPipeline: PipelineDefinition;
  uniforms: Record<string, { texture: string }>;
  instanceData: Record<string, Float32Array>;
  depthInstanceData: Record<string, Float32Array>;
  clear(): void;
  setValues(
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scale: number,
    rotationX: number, rotationY: number, rotationZ: number,
    tintRed: number, tintGreen: number, tintBlue: number,
    roughnessBias: number, emissive: number,
  ): void;
}>;

async function createCatalogModelBatch(
  key: string,
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

  const bitmapFor = async (name: string): Promise<ImageBitmap> => (
    dependencies.createBitmap(modelImage(model, name, descriptor.label))
  );
  const diffuse = await bitmapFor(descriptor.diffuseImage);
  const material = await bitmapFor(descriptor.materialImage);
  const normalMap = await bitmapFor(descriptor.normalImage);

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

  const textureOptions = { flipY: false, anisotropy: 8 } as const;

  return Object.freeze({
    /** Textures for the driver to own, keyed by this batch's name. */
    textures: {
      [`${key}-diffuse`]: { source: diffuse, options: textureOptions },
      [`${key}-material`]: { source: material, options: textureOptions },
      [`${key}-normal`]: { source: normalMap, options: textureOptions },
    } as Record<string, TextureSource>,
    pipeline: {
      shader: reliquaryModelShader,
      setup(program) {
        program.attributes.aPosition!.set(mesh.positions);
        program.attributes.aNormal!.set(mesh.normals!);
        program.attributes.aUv!.set(mesh.uvs!);
        program.setIndices(mesh.indices!);
        // Full strength. The scans are 1K and their detail is the whole reason they were chosen.
        program.uniforms.uNormalStrength!.set(1 as never);
        program.uniforms.uMaterialLayout!.set(descriptor.materialLayout as never);
      },
    } satisfies PipelineDefinition,
    depthPipeline: {
      shader: modelDepthShader,
      setup(program) {
        program.attributes.aPosition!.set(mesh.positions);
        program.setIndices(mesh.indices!);
      },
    } satisfies PipelineDefinition,
    /** Set on the lit pipeline every frame, naming the textures the driver holds. */
    uniforms: {
      uDiffuse: { texture: `${key}-diffuse` },
      uArm: { texture: `${key}-material` },
      uNormalMap: { texture: `${key}-normal` },
    },
    instanceData: {
      iOffset: offsets,
      iScale: scales,
      iRotation: rotations,
      iTint: tints,
      iMaterial: materials,
    },
    // The same three arrays the lit pipeline gets, so the caster cannot drift from the caster.
    depthInstanceData: { iOffset: offsets, iScale: scales, iRotation: rotations },
    clear,
    setValues,
  });
}

export function createReliquaryModelBatch(
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch('organic', capacity, DEAD_TREE, dependencies);
}

export function createRockModelBatch(
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch('rocks', capacity, ROCK_MOSS, dependencies);
}

export function createStumpModelBatch(
  capacity: number,
  dependencies: ReliquaryModelDependencies = MODEL_DEPENDENCIES,
): Promise<ReliquaryModelBatch> {
  return createCatalogModelBatch('stumps', capacity, TREE_STUMP, dependencies);
}
