import {
  createCamera,
  createPlane,
  createProgram,
  createRenderTarget,
  loadTexture,
  mat4,
  type RenderTarget,
} from 'brometal';
import type {
  GameHostMode,
  GameMovementInput,
} from '@antiky/framework/game';
import {
  FAR_DEPTH,
  WATER_LEVEL,
  buildTownWorld,
  samplePath,
  type TownWalker,
} from './art/town';
import {
  bindTownAwningGeometry,
  bindTownPropGeometry,
  buildTownAwningBatch,
  buildTownPropBatch,
  createTownAwningGeometry,
  createTownPropGeometry,
  uploadTownAwningBatch,
  uploadTownPropBatch,
} from './art/town-dynamic-props';
import {
  bindTownFoliageGeometry,
  buildTownFoliageRenderData,
  uploadTownFoliageInstances,
} from './art/town-foliage';
import { buildTownWaterFeatures } from './art/town-water-features';
import {
  SpriteBatch,
  billboardBasis,
  buildStandeeSideMesh,
  createStandeeFaceGeometry,
  loadSpriteSilhouetteAtlas,
  spriteAtlas,
  uploadSpriteBatch,
} from './art/sprite-batch';
import {
  CharacterQueryWorld,
  KinematicCharacterMotor,
  StaticCharacterWorldAdapter,
  createHeightFieldGroundSampler,
} from './physics';
import {
  commitTownSlotZeroPower,
  readTownSlotZeroPower,
  type TownDemoOptions,
} from './practical-light-input';
import type {
  TownGameFactory,
  TownGameSetup,
  TownRuntime,
  TownRuntimeFactory,
} from './town-runtime';
import postShader from './shaders/town-post.shader.gen';
import awningShadowShader from './shaders/town-awning-shadow.shader.gen';
import awningShader from './shaders/town-awning.shader.gen';
import foliageShadowShader from './shaders/town-foliage-shadow.shader.gen';
import foliageShader from './shaders/town-foliage.shader.gen';
import propShadowShader from './shaders/town-prop-shadow.shader.gen';
import propShader from './shaders/town-prop.shader.gen';
import shadowShader from './shaders/town-shadow.shader.gen';
import spriteShadowShader from './shaders/town-sprite-shadow.shader.gen';
import spriteShader from './shaders/town-sprite.shader.gen';
import voxelShader from './shaders/town-voxel.shader.gen';
import waterFeaturesShader from './shaders/town-water-features.shader.gen';
import waterShader from './shaders/town-water.shader.gen';

// Camera-right/front golden-hour key. The previous vector was almost pure
// screen-right, placing the visible plaza and façades behind their own skyline
// even though the post sun appeared upper-right.
const LIGHT_DIR = normalize3([0.88, 0.32, 0.18]);
const SUN_COLOR = [1, 0.55, 0.28] as const;
const SKY_COLOR = [0.24, 0.38, 0.68] as const;
const GROUND_COLOR = [0.56, 0.27, 0.15] as const;
const FOG_COLOR = [0.46, 0.36, 0.36] as const;
const SHADOW_CLEAR = [1, 1, 1, 1] as const;
const SCENE_CLEAR = [0.04, 0.05, 0.08, FAR_DEPTH] as const;
const MATERIAL_ATLAS_TEXEL = [1 / 1254, 1 / 1254] as const;
const HERO_SPEED = 3.8;
const STANDEE_THICKNESS = 0.1;
const NPC_COUNT = 8;
const NPC_WALKER_INDICES = [0, 1, 3, 4, 0, 1, 3, 4] as const;
const NPC_START_PROGRESS = [0.08, 0.38, 0.64, 0.82, 0.55, 0.76, 0.18, 0.43] as const;
const MATERIAL_ATLAS_URL = new URL(
  '../../assets/textures/town-material-atlas-v1.png',
  import.meta.url,
).href;
const PROP_ATLAS_URL = new URL(
  '../../assets/textures/town-prop-atlas-v2.png',
  import.meta.url,
).href;
const VEGETATION_ATLAS_URL = new URL(
  '../../assets/textures/town-vegetation-atlas-v2.png',
  import.meta.url,
).href;
const ACTOR_ATLAS_URL = new URL(
  '../../assets/sprites/antiky-wayfarer-cardinal-atlas.png',
  import.meta.url,
).href;

function orthographic(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number,
): Float32Array {
  const width = right - left;
  const height = top - bottom;
  const depth = far - near;
  if (width === 0 || height === 0 || depth === 0) {
    throw new Error('Orthographic projection requires a non-empty volume.');
  }
  const matrix = new Float32Array(16);
  matrix[0] = 2 / width;
  matrix[5] = 2 / height;
  matrix[10] = -2 / depth;
  matrix[12] = -(right + left) / width;
  matrix[13] = -(top + bottom) / height;
  matrix[14] = -(far + near) / depth;
  matrix[15] = 1;
  return matrix;
}

const PRACTICAL_LIGHTS = [
  { position: [-3.565, 4.237, 6.82], radius: 4, power: 1.05, color: [1, 0.52, 0.22] },
  { position: [3.565, 4.237, 6.82], radius: 4, power: 1.05, color: [1, 0.52, 0.22] },
  { position: [-3.565, 3.617, 11.16], radius: 4, power: 1.05, color: [1, 0.52, 0.22] },
  { position: [3.565, 3.617, 11.16], radius: 4, power: 1.05, color: [1, 0.52, 0.22] },
  { position: [-8.06, 3.1, 1.86], radius: 3.6, power: 0.85, color: [1, 0.48, 0.18] },
  { position: [7.44, 3.1, 2.48], radius: 3.6, power: 0.85, color: [1, 0.48, 0.18] },
  { position: [-6.2, 4.03, -15.75], radius: 5, power: 1, color: [1, 0.62, 0.34] },
  { position: [7.44, 4.96, -16.35], radius: 4.6, power: 0.9, color: [1, 0.58, 0.28] },
] as const;

type ActorState = {
  motor: KinematicCharacterMotor;
  walker?: TownWalker;
  progress: number;
  stride: number;
  tint: readonly [number, number, number];
  scale: number;
};

const FNV_32_OFFSET = 0x811c9dc5;
const FNV_32_PRIME = 0x01000193;
const TOWN_HASH_RIGHT_OFFSET = 0x9e3779b9;
const TOWN_HASH_RIGHT_PRIME = 0x5bd1e995;

function townStateDigest(
  simulationTime: number,
  hero: ActorState,
  npcs: readonly ActorState[],
): string {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  let leftHash = FNV_32_OFFSET;
  let rightHash = TOWN_HASH_RIGHT_OFFSET;
  const addNumber = (value: number): void => {
    view.setFloat64(0, value, false);
    for (const byte of bytes) {
      leftHash = Math.imul(leftHash ^ byte, FNV_32_PRIME) >>> 0;
      rightHash = Math.imul(rightHash ^ byte, TOWN_HASH_RIGHT_PRIME) >>> 0;
    }
  };
  const addActor = (actor: ActorState): void => {
    const state = actor.motor.state;
    for (const value of [
      actor.progress,
      actor.stride,
      state.tick,
      state.position.x,
      state.position.y,
      state.position.z,
      state.previousPosition.x,
      state.previousPosition.y,
      state.previousPosition.z,
      state.velocity.x,
      state.velocity.z,
      state.facing.x,
      state.facing.z,
      state.grounded ? 1 : 0,
    ]) addNumber(value);
  };
  addNumber(simulationTime);
  addActor(hero);
  for (const npc of npcs) addActor(npc);
  const left = leftHash.toString(16).padStart(8, '0');
  const right = rightHash.toString(16).padStart(8, '0');
  return `town-v1:${left}${right}`;
}

type ActorAtlasMetadata = {
  image: string;
  cell: { width: number; height: number };
  grid: { columns: number; rows: number };
  pivot: { x: number; y: number };
};

export type { TownDemoOptions } from './practical-light-input';

function normalize3(value: readonly [number, number, number]): readonly [number, number, number] {
  const length = Math.hypot(value[0], value[1], value[2]) || 1;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function cardinalTile(
  dx: number,
  dz: number,
  stride: number,
  moving: boolean,
  columns = 8,
): number {
  let row: number;
  if (Math.abs(dx) > Math.abs(dz)) row = dx < 0 ? 1 : 3;
  else row = dz < 0 ? 2 : 0;
  // Run frames advance at the authored cadence; idle frames breathe often
  // enough to remain visibly alive during the initial no-input presentation.
  const column = moving ? 2 + Math.floor(stride) % 6 : Math.floor(stride) % 2;
  return row * columns + column;
}

function cameraPose(mode: GameHostMode, aspect: number) {
  const mobile = aspect < 1.05;
  if (mode === 'interactive') {
    return {
      mobile,
      fovY: mobile ? 0.9 : 0.6,
      offset: mobile ? [12, 9.5, 13] as const : [20, 14, 20] as const,
    };
  }
  return {
    mobile,
    fovY: mobile ? 0.82 : 0.57,
    position: mobile ? [30, 20, 36] as const : [28, 19, 36] as const,
    target: mobile ? [-2.5, 3, -1] as const : [-1, 3, -4] as const,
  };
}

async function createTownRuntime(
  { renderer, mode, report }: TownGameSetup,
  options: TownDemoOptions,
): Promise<TownRuntime> {
  const world = buildTownWorld();
  const materialTexture = await loadTexture(
    renderer,
    MATERIAL_ATLAS_URL,
    { filter: 'smooth', wrap: 'clamp', anisotropy: 8 },
  );
  const propTexture = await loadTexture(
    renderer,
    PROP_ATLAS_URL,
    { filter: 'smooth', wrap: 'clamp', anisotropy: 8 },
  );
  const vegetationTexture = await loadTexture(
    renderer,
    VEGETATION_ATLAS_URL,
    { filter: 'smooth', wrap: 'clamp', anisotropy: 8 },
  );
  const shadowResolution = renderer.canvas.width < 700 ? 1024 : 2048;
  const shadowTarget = createRenderTarget(renderer, {
    width: shadowResolution,
    height: shadowResolution,
    depth: true,
  });
  const shadowTexel = [1 / shadowResolution, 1 / shadowResolution] as const;

  const lightTarget = [0, 4, -4] as const;
  const lightEye: [number, number, number] = [
    lightTarget[0] + LIGHT_DIR[0] * 102,
    lightTarget[1] + LIGHT_DIR[1] * 102,
    lightTarget[2] + LIGHT_DIR[2] * 102,
  ];
  const lightView = mat4.lookAt(lightEye, lightTarget);
  const lightProjection = orthographic(-54, 54, -50, 50, 0.5, 170);
  const lightViewProjection = mat4.multiply(lightProjection, lightView);

  const worldShadowProgram = createProgram(renderer, shadowShader);
  worldShadowProgram.attributes.aPosition.set(world.mesh.positions);
  worldShadowProgram.setIndices(world.mesh.indices);
  worldShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);

  const worldProgram = createProgram(renderer, voxelShader);
  worldProgram.attributes.aPosition.set(world.mesh.positions);
  worldProgram.attributes.aNormal.set(world.mesh.normals);
  worldProgram.attributes.aBaseColor.set(world.mesh.baseColors);
  worldProgram.attributes.aMaterial.set(world.mesh.materials);
  worldProgram.attributes.aMaterialId.set(world.mesh.materialIds);
  worldProgram.attributes.aLocalAo.set(world.mesh.localAo);
  worldProgram.attributes.aEmissive.set(world.mesh.emissive);
  worldProgram.setIndices(world.mesh.indices);
  worldProgram.uniforms.uLightViewProj.set(lightViewProjection);
  worldProgram.uniforms.uLightDir.set(LIGHT_DIR);
  worldProgram.uniforms.uSunColor.set(SUN_COLOR);
  worldProgram.uniforms.uSunIntensity.set(2.65);
  worldProgram.uniforms.uSkyColor.set(SKY_COLOR);
  worldProgram.uniforms.uSkyIntensity.set(0.46);
  worldProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  worldProgram.uniforms.uGroundIntensity.set(0.12);
  worldProgram.uniforms.uEmissiveIntensity.set(mode === 'ambient' ? 2.7 : 2);
  worldProgram.uniforms.uMaterialAtlasTexel.set(MATERIAL_ATLAS_TEXEL);
  worldProgram.uniforms.uFogColor.set(FOG_COLOR);
  worldProgram.uniforms.uFogStart.set(45);
  worldProgram.uniforms.uFogEnd.set(110);
  worldProgram.uniforms.uFogStrength.set(0.22);
  worldProgram.uniforms.uShadowTexel.set(shadowTexel);
  worldProgram.uniforms.uShadowBias.set(0.00042);
  worldProgram.uniforms.uShadowSlopeBias.set(0.00125);
  worldProgram.uniforms.uShadowStrength.set(0.7);

  const waterProgram = createProgram(renderer, waterShader);
  const water = buildWaterGrid(world.waterBounds, 112, 16);
  waterProgram.attributes.aPosition.set(water.positions);
  waterProgram.setIndices(water.indices);
  waterProgram.uniforms.uLightViewProj.set(lightViewProjection);
  waterProgram.uniforms.uLightDir.set(LIGHT_DIR);
  waterProgram.uniforms.uSunColor.set(SUN_COLOR);
  waterProgram.uniforms.uSunIntensity.set(2.25);
  waterProgram.uniforms.uSkyColor.set([0.2, 0.34, 0.58]);
  waterProgram.uniforms.uDeepColor.set([0.018, 0.07, 0.09]);
  waterProgram.uniforms.uShallowColor.set([0.055, 0.22, 0.22]);
  waterProgram.uniforms.uRoughness.set(0.24);
  waterProgram.uniforms.uCrestStrength.set(0.3);
  waterProgram.uniforms.uFogColor.set(FOG_COLOR);
  waterProgram.uniforms.uFogStart.set(45);
  waterProgram.uniforms.uFogEnd.set(110);
  waterProgram.uniforms.uFogStrength.set(0.2);
  waterProgram.uniforms.uWaterLevel.set(WATER_LEVEL);
  waterProgram.uniforms.uShadowTexel.set(shadowTexel);
  waterProgram.uniforms.uShadowBias.set(0.00085);
  waterProgram.uniforms.uShadowStrength.set(0.64);

  const waterFeatureMesh = buildTownWaterFeatures(world.waterfall, world.fountain);
  const waterFeatureProgram = createProgram(renderer, waterFeaturesShader);
  waterFeatureProgram.attributes.aPosition.set(waterFeatureMesh.positions);
  waterFeatureProgram.attributes.aNormal.set(waterFeatureMesh.normals);
  waterFeatureProgram.attributes.aUv.set(waterFeatureMesh.uvs);
  waterFeatureProgram.attributes.aFeature.set(waterFeatureMesh.featureData);
  waterFeatureProgram.setIndices(waterFeatureMesh.indices);
  waterFeatureProgram.uniforms.uLightViewProj.set(lightViewProjection);
  waterFeatureProgram.uniforms.uLightDir.set(LIGHT_DIR);
  waterFeatureProgram.uniforms.uSunColor.set(SUN_COLOR);
  waterFeatureProgram.uniforms.uSunIntensity.set(2.35);
  waterFeatureProgram.uniforms.uSkyColor.set([0.2, 0.34, 0.58]);
  waterFeatureProgram.uniforms.uDeepColor.set([0.018, 0.065, 0.085]);
  waterFeatureProgram.uniforms.uShallowColor.set([0.045, 0.24, 0.28]);
  waterFeatureProgram.uniforms.uFoamColor.set([0.5, 0.75, 0.78]);
  waterFeatureProgram.uniforms.uRoughness.set(0.22);
  waterFeatureProgram.uniforms.uFogColor.set(FOG_COLOR);
  waterFeatureProgram.uniforms.uFogStart.set(45);
  waterFeatureProgram.uniforms.uFogEnd.set(110);
  waterFeatureProgram.uniforms.uFogStrength.set(0.2);
  waterFeatureProgram.uniforms.uShadowTexel.set(shadowTexel);
  waterFeatureProgram.uniforms.uShadowBias.set(0.00085);
  waterFeatureProgram.uniforms.uShadowStrength.set(0.64);

  const awningGeometry = createTownAwningGeometry();
  const awningBatch = buildTownAwningBatch(world.awnings);
  const awningShadowProgram = createProgram(renderer, awningShadowShader);
  bindTownAwningGeometry(awningShadowProgram, awningGeometry, true);
  const awningShadowCount = uploadTownAwningBatch(awningShadowProgram, awningBatch);
  awningShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);

  const awningProgram = createProgram(renderer, awningShader);
  bindTownAwningGeometry(awningProgram, awningGeometry);
  const awningCount = uploadTownAwningBatch(awningProgram, awningBatch);
  awningProgram.uniforms.uLightViewProj.set(lightViewProjection);
  awningProgram.uniforms.uMaterialAtlasTexel.set(MATERIAL_ATLAS_TEXEL);
  awningProgram.uniforms.uLightDir.set(LIGHT_DIR);
  awningProgram.uniforms.uSunColor.set(SUN_COLOR);
  awningProgram.uniforms.uSunIntensity.set(2.65);
  awningProgram.uniforms.uSkyColor.set(SKY_COLOR);
  awningProgram.uniforms.uSkyIntensity.set(0.46);
  awningProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  awningProgram.uniforms.uGroundIntensity.set(0.12);
  awningProgram.uniforms.uFogColor.set(FOG_COLOR);
  awningProgram.uniforms.uFogStart.set(45);
  awningProgram.uniforms.uFogEnd.set(110);
  awningProgram.uniforms.uFogStrength.set(0.22);
  awningProgram.uniforms.uShadowTexel.set(shadowTexel);
  awningProgram.uniforms.uShadowBias.set(0.00055);
  awningProgram.uniforms.uShadowSlopeBias.set(0.0013);
  awningProgram.uniforms.uShadowStrength.set(0.72);

  const propGeometry = createTownPropGeometry();
  const propBatch = buildTownPropBatch(world.spriteProps);
  const propShadowProgram = createProgram(renderer, propShadowShader);
  bindTownPropGeometry(propShadowProgram, propGeometry);
  const propShadowCount = uploadTownPropBatch(propShadowProgram, propBatch);
  propShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);
  propShadowProgram.uniforms.uCutoff.set(0.44);

  const propProgram = createProgram(renderer, propShader);
  bindTownPropGeometry(propProgram, propGeometry);
  const propCount = uploadTownPropBatch(propProgram, propBatch);
  propProgram.uniforms.uLightViewProj.set(lightViewProjection);
  propProgram.uniforms.uCutoff.set(0.44);
  propProgram.uniforms.uLightDir.set(LIGHT_DIR);
  propProgram.uniforms.uSunColor.set(SUN_COLOR);
  propProgram.uniforms.uSunIntensity.set(2.65);
  propProgram.uniforms.uSkyColor.set(SKY_COLOR);
  propProgram.uniforms.uSkyIntensity.set(0.46);
  propProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  propProgram.uniforms.uGroundIntensity.set(0.12);
  propProgram.uniforms.uFogColor.set(FOG_COLOR);
  propProgram.uniforms.uFogStart.set(45);
  propProgram.uniforms.uFogEnd.set(110);
  propProgram.uniforms.uFogStrength.set(0.22);
  propProgram.uniforms.uShadowTexel.set(shadowTexel);
  propProgram.uniforms.uShadowBias.set(0.00055);
  propProgram.uniforms.uShadowSlopeBias.set(0.0013);
  propProgram.uniforms.uShadowStrength.set(0.72);

  const foliage = buildTownFoliageRenderData(world.vegetation);
  const foliageCardShadowProgram = createProgram(renderer, foliageShadowShader);
  bindTownFoliageGeometry(foliageCardShadowProgram, foliage.cardGeometry);
  const foliageCardShadowCount = uploadTownFoliageInstances(
    foliageCardShadowProgram,
    foliage.cards,
  );
  const foliageTrunkShadowProgram = createProgram(renderer, foliageShadowShader);
  bindTownFoliageGeometry(foliageTrunkShadowProgram, foliage.trunkGeometry);
  const foliageTrunkShadowCount = uploadTownFoliageInstances(
    foliageTrunkShadowProgram,
    foliage.trunks,
  );
  const foliageShadowPrograms = [foliageCardShadowProgram, foliageTrunkShadowProgram] as const;
  for (const program of foliageShadowPrograms) {
    program.uniforms.uLightViewProj.set(lightViewProjection);
    program.uniforms.uCutoff.set(0.35);
    program.uniforms.uWindDirection.set([0.92, 0.38]);
    program.uniforms.uWindSpeed.set(1.15);
  }

  const foliageCardProgram = createProgram(renderer, foliageShader);
  bindTownFoliageGeometry(foliageCardProgram, foliage.cardGeometry);
  const foliageCardCount = uploadTownFoliageInstances(foliageCardProgram, foliage.cards);
  const foliageTrunkProgram = createProgram(renderer, foliageShader);
  bindTownFoliageGeometry(foliageTrunkProgram, foliage.trunkGeometry);
  const foliageTrunkCount = uploadTownFoliageInstances(foliageTrunkProgram, foliage.trunks);
  const foliagePrograms = [foliageCardProgram, foliageTrunkProgram] as const;
  for (const program of foliagePrograms) {
    program.uniforms.uLightViewProj.set(lightViewProjection);
    program.uniforms.uLightDir.set(LIGHT_DIR);
    program.uniforms.uSunColor.set([1, 0.82, 0.58]);
    program.uniforms.uSunIntensity.set(1.05);
    program.uniforms.uSkyColor.set(SKY_COLOR);
    program.uniforms.uSkyIntensity.set(0.46);
    program.uniforms.uGroundColor.set(GROUND_COLOR);
    program.uniforms.uGroundIntensity.set(0.12);
    program.uniforms.uCutoff.set(0.35);
    program.uniforms.uWindDirection.set([0.92, 0.38]);
    program.uniforms.uWindSpeed.set(1.15);
    program.uniforms.uFogColor.set(FOG_COLOR);
    program.uniforms.uFogStart.set(45);
    program.uniforms.uFogEnd.set(110);
    program.uniforms.uFogStrength.set(0.22);
    program.uniforms.uShadowTexel.set(shadowTexel);
    program.uniforms.uShadowBias.set(0.00055);
    program.uniforms.uShadowSlopeBias.set(0.0013);
    program.uniforms.uShadowStrength.set(0.72);
  }

  const actorMetadata: ActorAtlasMetadata = {
    image: 'antiky-wayfarer-cardinal-atlas.png',
    cell: { width: 128, height: 128 },
    grid: { columns: 8, rows: 4 },
    pivot: { x: 64, y: 112 },
  };
  const actorImageUrl = ACTOR_ATLAS_URL;
  const actorTexture = await loadTexture(renderer, actorImageUrl, {
    filter: 'nearest',
    wrap: 'clamp',
  });
  const actorSilhouettes = await loadSpriteSilhouetteAtlas(
    actorImageUrl,
    {
      cols: actorMetadata.grid.columns,
      rows: actorMetadata.grid.rows,
      tileWidth: actorMetadata.cell.width,
      tileHeight: actorMetadata.cell.height,
      pivotY: actorMetadata.pivot.y,
      cutoff: 0.48,
    },
  );
  const actorAtlas = spriteAtlas(actorTexture, {
    cols: actorMetadata.grid.columns,
    rows: actorMetadata.grid.rows,
    tileWidth: actorMetadata.cell.width,
    tileHeight: actorMetadata.cell.height,
  });
  const standee = createStandeeFaceGeometry({
    tileHeight: actorMetadata.cell.height,
    pivotY: actorMetadata.pivot.y,
  });

  const actorShadowProgram = createProgram(renderer, spriteShadowShader);
  actorShadowProgram.attributes.aPosition.set(standee.positions);
  actorShadowProgram.attributes.aUv.set(standee.uvs);
  actorShadowProgram.attributes.aShell.set(standee.shells);
  actorShadowProgram.setIndices(standee.doubleSidedIndices);
  actorShadowProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorShadowProgram.uniforms.uCutoff.set(0.48);
  actorShadowProgram.uniforms.uColorKey.set([1, 0, 1]);
  actorShadowProgram.uniforms.uUseColorKey.set(0);
  actorShadowProgram.uniforms.uStandeeThickness.set(STANDEE_THICKNESS);

  const actorProgram = createProgram(renderer, spriteShader);
  actorProgram.attributes.aPosition.set(standee.positions);
  actorProgram.attributes.aUv.set(standee.uvs);
  actorProgram.attributes.aShell.set(standee.shells);
  actorProgram.setIndices(standee.indices);
  actorProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorProgram.uniforms.uLightDir.set(LIGHT_DIR);
  actorProgram.uniforms.uCutoff.set(0.48);
  actorProgram.uniforms.uColorKey.set([1, 0, 1]);
  actorProgram.uniforms.uUseColorKey.set(0);
  actorProgram.uniforms.uStandeeThickness.set(STANDEE_THICKNESS);
  actorProgram.uniforms.uAmbientLight.set([0.38, 0.44, 0.6]);
  actorProgram.uniforms.uFrontLight.set([1.28, 0.72, 0.38]);
  actorProgram.uniforms.uBackLight.set([0.12, 0.15, 0.23]);
  actorProgram.uniforms.uSideLight.set([0.34, 0.36, 0.43]);
  actorProgram.uniforms.uFogColor.set(FOG_COLOR);
  actorProgram.uniforms.uFogStart.set(45);
  actorProgram.uniforms.uFogEnd.set(110);
  actorProgram.uniforms.uFogStrength.set(0.22);
  actorProgram.uniforms.uShadowTexel.set(shadowTexel);
  actorProgram.uniforms.uShadowBias.set(0.00055);
  actorProgram.uniforms.uShadowSlopeBias.set(0.0013);
  actorProgram.uniforms.uShadowStrength.set(0.72);

  // A second instance of the town surface shader draws only the extruded
  // alpha-contour walls. Its warm paper stock is real scene geometry: it has
  // material response, depth, shadow reception, and no front-facing halo.
  const actorEdgeProgram = createProgram(renderer, voxelShader);
  actorEdgeProgram.uniforms.uLightViewProj.set(lightViewProjection);
  actorEdgeProgram.uniforms.uLightDir.set(LIGHT_DIR);
  actorEdgeProgram.uniforms.uSunColor.set(SUN_COLOR);
  actorEdgeProgram.uniforms.uSunIntensity.set(2.65);
  actorEdgeProgram.uniforms.uSkyColor.set(SKY_COLOR);
  actorEdgeProgram.uniforms.uSkyIntensity.set(0.46);
  actorEdgeProgram.uniforms.uGroundColor.set(GROUND_COLOR);
  actorEdgeProgram.uniforms.uGroundIntensity.set(0.12);
  actorEdgeProgram.uniforms.uEmissiveIntensity.set(0);
  actorEdgeProgram.uniforms.uMaterialAtlasTexel.set(MATERIAL_ATLAS_TEXEL);
  actorEdgeProgram.uniforms.uFogColor.set(FOG_COLOR);
  actorEdgeProgram.uniforms.uFogStart.set(45);
  actorEdgeProgram.uniforms.uFogEnd.set(110);
  actorEdgeProgram.uniforms.uFogStrength.set(0.22);
  actorEdgeProgram.uniforms.uShadowTexel.set(shadowTexel);
  actorEdgeProgram.uniforms.uShadowBias.set(0.00055);
  actorEdgeProgram.uniforms.uShadowSlopeBias.set(0.0013);
  actorEdgeProgram.uniforms.uShadowStrength.set(0.72);

  const practicalPositions = PRACTICAL_LIGHTS.map((light) => new Float32Array([
    light.position[0],
    light.position[1],
    light.position[2],
    1 / (light.radius * light.radius),
  ]));
  const practicalColors = PRACTICAL_LIGHTS.map(() => new Float32Array(4));
  const practicalPrograms = [worldProgram, actorEdgeProgram] as const;
  for (const program of practicalPrograms) {
    program.uniforms.uPracticalPosInvRangeSq0.set(practicalPositions[0]!);
    program.uniforms.uPracticalPosInvRangeSq1.set(practicalPositions[1]!);
    program.uniforms.uPracticalPosInvRangeSq2.set(practicalPositions[2]!);
    program.uniforms.uPracticalPosInvRangeSq3.set(practicalPositions[3]!);
    program.uniforms.uPracticalPosInvRangeSq4.set(practicalPositions[4]!);
    program.uniforms.uPracticalPosInvRangeSq5.set(practicalPositions[5]!);
    program.uniforms.uPracticalPosInvRangeSq6.set(practicalPositions[6]!);
    program.uniforms.uPracticalPosInvRangeSq7.set(practicalPositions[7]!);
  }
  actorProgram.uniforms.uPracticalPosInvRangeSq0.set(practicalPositions[0]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq1.set(practicalPositions[1]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq2.set(practicalPositions[2]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq3.set(practicalPositions[3]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq4.set(practicalPositions[4]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq5.set(practicalPositions[5]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq6.set(practicalPositions[6]!);
  actorProgram.uniforms.uPracticalPosInvRangeSq7.set(practicalPositions[7]!);
  waterProgram.uniforms.uPracticalPosInvRangeSq0.set(practicalPositions[0]!);
  waterProgram.uniforms.uPracticalPosInvRangeSq1.set(practicalPositions[1]!);
  waterProgram.uniforms.uPracticalPosInvRangeSq2.set(practicalPositions[2]!);
  waterProgram.uniforms.uPracticalPosInvRangeSq3.set(practicalPositions[3]!);

  let lastValidSlotZeroPower: number = PRACTICAL_LIGHTS[0].power;
  const updatePracticalLights = (time: number, mobile: boolean) => {
    const slotZeroPower = readTownSlotZeroPower(
      options.slotZeroPower,
      lastValidSlotZeroPower,
    );
    const count = mobile ? 4 : mode === 'ambient' ? 8 : 6;
    const strength = mobile ? 0.75 : mode === 'ambient' ? 1.15 : 0.8;
    const flickerAmount = mobile ? 0.025 : mode === 'ambient' ? 0.06 : 0.035;
    for (let index = 0; index < PRACTICAL_LIGHTS.length; index += 1) {
      const light = PRACTICAL_LIGHTS[index]!;
      const phase = index * 1.731;
      const flicker = 1 + flickerAmount * (
        Math.sin(time * 2.07 + phase) * 0.65 +
        Math.sin(time * 5.63 + phase * 1.31) * 0.35
      );
      practicalColors[index]!.set([
        light.color[0],
        light.color[1],
        light.color[2],
        (index === 0 ? slotZeroPower.basePower : light.power) * flicker,
      ]);
    }
    for (const program of practicalPrograms) {
      program.uniforms.uPracticalCount.set(count);
      program.uniforms.uPracticalStrength.set(strength);
      program.uniforms.uPracticalColorPower0.set(practicalColors[0]!);
      program.uniforms.uPracticalColorPower1.set(practicalColors[1]!);
      program.uniforms.uPracticalColorPower2.set(practicalColors[2]!);
      program.uniforms.uPracticalColorPower3.set(practicalColors[3]!);
      program.uniforms.uPracticalColorPower4.set(practicalColors[4]!);
      program.uniforms.uPracticalColorPower5.set(practicalColors[5]!);
      program.uniforms.uPracticalColorPower6.set(practicalColors[6]!);
      program.uniforms.uPracticalColorPower7.set(practicalColors[7]!);
    }
    actorProgram.uniforms.uPracticalCount.set(count);
    actorProgram.uniforms.uPracticalStrength.set(strength);
    actorProgram.uniforms.uPracticalColorPower0.set(practicalColors[0]!);
    actorProgram.uniforms.uPracticalColorPower1.set(practicalColors[1]!);
    actorProgram.uniforms.uPracticalColorPower2.set(practicalColors[2]!);
    actorProgram.uniforms.uPracticalColorPower3.set(practicalColors[3]!);
    actorProgram.uniforms.uPracticalColorPower4.set(practicalColors[4]!);
    actorProgram.uniforms.uPracticalColorPower5.set(practicalColors[5]!);
    actorProgram.uniforms.uPracticalColorPower6.set(practicalColors[6]!);
    actorProgram.uniforms.uPracticalColorPower7.set(practicalColors[7]!);
    waterProgram.uniforms.uPracticalCount.set(Math.min(count, 4));
    waterProgram.uniforms.uPracticalStrength.set(strength * 0.82);
    waterProgram.uniforms.uPracticalColorPower0.set(practicalColors[0]!);
    waterProgram.uniforms.uPracticalColorPower1.set(practicalColors[1]!);
    waterProgram.uniforms.uPracticalColorPower2.set(practicalColors[2]!);
    waterProgram.uniforms.uPracticalColorPower3.set(practicalColors[3]!);
    return slotZeroPower;
  };

  const fullscreen = createPlane({ width: 2, height: 2 });
  const postProgram = createProgram(renderer, postShader);
  postProgram.attributes.aPosition.set(fullscreen.positions);
  postProgram.setIndices(fullscreen.indices);
  postProgram.uniforms.uBloomRadius.set(1.35);
  postProgram.uniforms.uBloomThreshold.set(1.02);
  postProgram.uniforms.uBloomKnee.set(0.2);
  postProgram.uniforms.uBloomStrength.set(mode === 'ambient' ? 0.075 : 0.05);
  postProgram.uniforms.uBloomTint.set([1, 0.63, 0.34]);
  postProgram.uniforms.uExposure.set(1.1);
  postProgram.uniforms.uSaturation.set(1.07);
  postProgram.uniforms.uContrast.set(1.02);
  postProgram.uniforms.uGradeStrength.set(0.16);
  postProgram.uniforms.uShadowTint.set([0.88, 0.95, 1.08]);
  postProgram.uniforms.uHighlightTint.set([1.06, 0.96, 0.86]);
  postProgram.uniforms.uVignette.set(mode === 'ambient' ? 0.12 : 0.085);
  postProgram.uniforms.uAtmosphereColor.set([0.6, 0.32, 0.2]);
  postProgram.uniforms.uAtmosphereStart.set(40);
  postProgram.uniforms.uAtmosphereEnd.set(112);
  postProgram.uniforms.uAtmosphereStrength.set(0.21);
  postProgram.uniforms.uSkyZenith.set([0.038, 0.082, 0.19]);
  postProgram.uniforms.uSkyHorizon.set([1.08, 0.47, 0.2]);
  postProgram.uniforms.uSunColor.set([2.15, 1.02, 0.39]);
  postProgram.uniforms.uSunScreenPosition.set([0.82, 0.82]);
  postProgram.uniforms.uSunRadius.set(0.052);
  postProgram.uniforms.uFarDepth.set(FAR_DEPTH);

  const physicsWorld = new CharacterQueryWorld(
    new StaticCharacterWorldAdapter({
      colliders: world.physicsColliders,
      sampleGround: createHeightFieldGroundSampler({
        heightAt: (x, z) => world.canWalk(x, z) ? world.walkSurfaceHeight(x, z) : null,
        normalAt: (x, z) => {
          const normal = world.walkSurfaceNormal(x, z);
          return { x: normal[0], y: normal[1], z: normal[2] };
        },
      }),
    }),
  );
  const heroStart = world.spawn;
  const heroMotor = new KinematicCharacterMotor(
    physicsWorld,
    { x: heroStart[0], y: world.walkSurfaceHeight(heroStart[0], heroStart[1]), z: heroStart[1] },
    { maxSpeed: mode === 'interactive' ? HERO_SPEED : 2.05 },
  );
  const hero: ActorState = {
    motor: heroMotor,
    progress: 1 / world.heroPath.length,
    stride: 0,
    tint: [1.06, 1, 0.96],
    scale: mode === 'ambient' ? 2.96 : 3.1,
  };

  const npcTints = [
    [0.78, 0.94, 1.18],
    [1.14, 0.82, 0.72],
    [0.76, 1.08, 0.8],
    [1.16, 1.02, 0.7],
    [1.08, 0.76, 1.03],
    [0.72, 1.02, 1.1],
    [1.18, 0.9, 0.78],
    [0.84, 1.12, 0.72],
  ] as const;
  const npcs: ActorState[] = NPC_WALKER_INDICES.slice(0, NPC_COUNT).map((walkerIndex, index) => {
    const walker = world.walkers[walkerIndex]!;
    const progress = NPC_START_PROGRESS[index]!;
    const start = samplePath(walker.path, progress);
    const motor = new KinematicCharacterMotor(
      physicsWorld,
      { x: start.x, y: world.walkSurfaceHeight(start.x, start.z), z: start.z },
      { maxSpeed: 1.55 + index * 0.08 },
    );
    return {
      motor,
      walker,
      progress,
      stride: index * 1.7,
      tint: npcTints[index]!,
      scale: 2.46 + (index % 2) * 0.1,
    };
  });
  const actorBatch = new SpriteBatch(actorAtlas, 1 + npcs.length);

  const camera = createCamera({ fovY: 0.56, near: 0.32, far: FAR_DEPTH });
  const cameraPosition = new Float32Array(3);
  const billboardRight = new Float32Array(3);
  const billboardUp = new Float32Array(3);
  const texel = new Float32Array(2);
  let sceneTarget: RenderTarget | null = null;
  let simulationTime = 0;
  let pendingPresentationSeconds = 0;
  let heroRenderPosition = { ...hero.motor.state.position };

  const ensureSceneTarget = (): RenderTarget => {
    const width = Math.max(1, renderer.canvas.width);
    const height = Math.max(1, renderer.canvas.height);
    if (!sceneTarget || sceneTarget.width !== width || sceneTarget.height !== height) {
      sceneTarget?.dispose();
      sceneTarget = createRenderTarget(renderer, { width, height, depth: true });
    }
    return sceneTarget;
  };

  report({
    instances: 1 + npcs.length + awningCount + propCount + foliageCardCount + foliageTrunkCount,
    drawCalls: 16,
    uploadBytesPerFrame: (1 + npcs.length) * 16 * 4 * 2,
    note: `${world.mesh.stats.triangleCount.toLocaleString()} artifact-free town triangles; GPU-wind foliage, animated water, cloth and die-cut characters`,
  });

  return {
    update(dt: number, movement: GameMovementInput) {
      simulationTime += dt;
      pendingPresentationSeconds += dt;

      let heroInputX = movement.x;
      let heroInputZ = movement.z;
      if (mode !== 'interactive') {
        hero.progress = (hero.progress + dt * 0.012) % 1;
        const target = samplePath(world.heroPath, hero.progress + 0.018);
        const dx = target.x - hero.motor.state.position.x;
        const dz = target.z - hero.motor.state.position.z;
        const length = Math.hypot(dx, dz);
        heroInputX = length > 0.05 ? dx / length : 0;
        heroInputZ = length > 0.05 ? dz / length : 0;
      }
      const heroResult = hero.motor.advance(dt, { x: heroInputX, z: heroInputZ });
      heroRenderPosition = heroResult.renderPosition;
      const heroSpeed = Math.hypot(hero.motor.state.velocity.x, hero.motor.state.velocity.z);
      hero.stride += dt * (heroSpeed > 0.08 ? 7.5 : 1.4);

      for (const npc of npcs) {
        const walker = npc.walker!;
        npc.progress = (npc.progress + dt * walker.speed) % 1;
        const target = samplePath(walker.path, npc.progress + 0.012);
        const dx = target.x - npc.motor.state.position.x;
        const dz = target.z - npc.motor.state.position.z;
        const length = Math.hypot(dx, dz);
        npc.motor.advance(dt, {
          x: length > 0.05 ? dx / length : 0,
          z: length > 0.05 ? dz / length : 0,
        });
        const speed = Math.hypot(npc.motor.state.velocity.x, npc.motor.state.velocity.z);
        npc.stride += dt * (speed > 0.08 ? 6.8 : 1.2);
      }
    },

    render() {
      const dt = pendingPresentationSeconds;
      pendingPresentationSeconds = 0;
      const pose = cameraPose(mode, renderer.aspect);
      if (mode === 'interactive') {
        const offset = pose.offset!;
        const desiredX = hero.motor.state.position.x + offset[0];
        const desiredY = hero.motor.state.position.y + offset[1];
        const desiredZ = hero.motor.state.position.z + offset[2];
        if (cameraPosition[0] === 0 && cameraPosition[1] === 0 && cameraPosition[2] === 0) {
          cameraPosition.set([desiredX, desiredY, desiredZ]);
        } else {
          const easing = 1 - Math.exp(-4.5 * dt);
          cameraPosition[0] = cameraPosition[0]! + (desiredX - cameraPosition[0]!) * easing;
          cameraPosition[1] = cameraPosition[1]! + (desiredY - cameraPosition[1]!) * easing;
          cameraPosition[2] = cameraPosition[2]! + (desiredZ - cameraPosition[2]!) * easing;
        }
        camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
        camera.lookAt(
          hero.motor.state.position.x - (pose.mobile ? 4.5 : 3.8),
          hero.motor.state.position.y + (pose.mobile ? 2.5 : 2.8),
          hero.motor.state.position.z - (pose.mobile ? 6.5 : 7.5),
        );
      } else {
        cameraPosition.set(pose.position!);
        camera.setPosition(cameraPosition[0]!, cameraPosition[1]!, cameraPosition[2]!);
        camera.lookAt(pose.target![0], pose.target![1], pose.target![2]);
      }
      camera.setLens({ fovY: pose.fovY, near: 0.32, far: FAR_DEPTH });
      const viewProjection = camera.viewProjection(renderer.aspect);
      billboardBasis(camera.view(), billboardRight, billboardUp, 0.32);
      const slotZeroPower = updatePracticalLights(simulationTime, pose.mobile);

      actorBatch.clear();
      const heroFacing = hero.motor.state.facing;
      const heroSpeed = Math.hypot(hero.motor.state.velocity.x, hero.motor.state.velocity.z);
      actorBatch.push({
        x: heroRenderPosition.x,
        y: heroRenderPosition.y,
        z: heroRenderPosition.z,
        width: pose.mobile ? 4.1 : hero.scale,
        height: pose.mobile ? 4.1 : hero.scale,
        tile: cardinalTile(
          heroFacing.x,
          heroFacing.z,
          hero.stride,
          heroSpeed > 0.08,
          actorMetadata.grid.columns,
        ),
        tint: hero.tint,
        facingX: heroFacing.x,
        facingZ: heroFacing.z,
      });
      for (const npc of npcs) {
        const root = npc.motor.state.position;
        const facing = npc.motor.state.facing;
        const speed = Math.hypot(npc.motor.state.velocity.x, npc.motor.state.velocity.z);
        actorBatch.push({
          x: root.x,
          y: root.y,
          z: root.z,
          width: npc.scale,
          height: npc.scale,
          tile: cardinalTile(
            facing.x,
            facing.z,
            npc.stride,
            speed > 0.08,
            actorMetadata.grid.columns,
          ),
          tint: npc.tint,
          facingX: facing.x,
          facingZ: facing.z,
        });
      }
      const actorSides = buildStandeeSideMesh(
        actorBatch,
        actorSilhouettes,
        billboardRight,
        billboardUp,
        STANDEE_THICKNESS,
      );
      if (actorSides.indices.length > 0) {
        actorEdgeProgram.attributes.aPosition.set(actorSides.positions);
        actorEdgeProgram.attributes.aNormal.set(actorSides.normals);
        actorEdgeProgram.attributes.aBaseColor.set(actorSides.baseColors);
        actorEdgeProgram.attributes.aMaterial.set(actorSides.materials);
        actorEdgeProgram.attributes.aMaterialId.set(actorSides.materialIds);
        actorEdgeProgram.attributes.aLocalAo.set(actorSides.localAo);
        actorEdgeProgram.attributes.aEmissive.set(actorSides.emissive);
        actorEdgeProgram.setIndices(actorSides.indices);
      }
      const shadowActorCount = uploadSpriteBatch(actorShadowProgram, actorBatch);
      const visibleActorCount = uploadSpriteBatch(actorProgram, actorBatch);

      actorShadowProgram.uniforms.uRight.set(billboardRight);
      actorShadowProgram.uniforms.uUp.set(billboardUp);
      awningShadowProgram.uniforms.uTime.set(simulationTime);
      const windStrength = pose.mobile ? 0.62 : mode === 'ambient' ? 1 : 0.78;
      for (const program of foliageShadowPrograms) {
        program.uniforms.uTime.set(simulationTime);
        program.uniforms.uWindStrength.set(windStrength);
      }
      for (const program of foliagePrograms) {
        program.uniforms.uTime.set(simulationTime);
        program.uniforms.uWindStrength.set(windStrength);
      }
      renderer.drawTo(
        shadowTarget,
        () => {
          worldShadowProgram.draw();
          if (foliageTrunkShadowCount > 0) {
            foliageTrunkShadowProgram.uniforms.uAtlas.set(vegetationTexture);
            foliageTrunkShadowProgram.draw();
          }
          if (foliageCardShadowCount > 0) {
            foliageCardShadowProgram.uniforms.uAtlas.set(vegetationTexture);
            foliageCardShadowProgram.draw();
          }
          if (awningShadowCount > 0) {
            awningShadowProgram.draw();
          }
          if (propShadowCount > 0) {
            propShadowProgram.uniforms.uAtlas.set(propTexture);
            propShadowProgram.draw();
          }
          if (shadowActorCount > 0) {
            actorShadowProgram.uniforms.uAtlas.set(actorTexture);
            actorShadowProgram.draw();
          }
        },
        { clear: SHADOW_CLEAR },
      );

      const scene = ensureSceneTarget();
      renderer.drawTo(
        scene,
        () => {
          worldProgram.uniforms.uViewProj.set(viewProjection);
          worldProgram.uniforms.uCamPos.set(cameraPosition);
          worldProgram.uniforms.uMaterialAtlas.set(materialTexture);
          worldProgram.uniforms.uShadowMap.set(shadowTarget.texture);
          worldProgram.draw();

          if (foliageTrunkCount > 0) {
            foliageTrunkProgram.uniforms.uViewProj.set(viewProjection);
            foliageTrunkProgram.uniforms.uCamPos.set(cameraPosition);
            foliageTrunkProgram.uniforms.uAtlas.set(vegetationTexture);
            foliageTrunkProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            foliageTrunkProgram.draw();
          }
          if (foliageCardCount > 0) {
            foliageCardProgram.uniforms.uViewProj.set(viewProjection);
            foliageCardProgram.uniforms.uCamPos.set(cameraPosition);
            foliageCardProgram.uniforms.uAtlas.set(vegetationTexture);
            foliageCardProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            foliageCardProgram.draw();
          }

          waterProgram.uniforms.uViewProj.set(viewProjection);
          waterProgram.uniforms.uCamPos.set(cameraPosition);
          waterProgram.uniforms.uTime.set(simulationTime);
          waterProgram.uniforms.uShadowMap.set(shadowTarget.texture);
          waterProgram.draw();

          waterFeatureProgram.uniforms.uViewProj.set(viewProjection);
          waterFeatureProgram.uniforms.uCamPos.set(cameraPosition);
          waterFeatureProgram.uniforms.uTime.set(simulationTime);
          waterFeatureProgram.uniforms.uShadowMap.set(shadowTarget.texture);
          waterFeatureProgram.draw();

          if (awningCount > 0) {
            awningProgram.uniforms.uViewProj.set(viewProjection);
            awningProgram.uniforms.uCamPos.set(cameraPosition);
            awningProgram.uniforms.uTime.set(simulationTime);
            awningProgram.uniforms.uMaterialAtlas.set(materialTexture);
            awningProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            awningProgram.draw();
          }

          if (propCount > 0) {
            propProgram.uniforms.uViewProj.set(viewProjection);
            propProgram.uniforms.uCamPos.set(cameraPosition);
            propProgram.uniforms.uAtlas.set(propTexture);
            propProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            propProgram.draw();
          }

          if (actorSides.indices.length > 0) {
            actorEdgeProgram.uniforms.uViewProj.set(viewProjection);
            actorEdgeProgram.uniforms.uCamPos.set(cameraPosition);
            actorEdgeProgram.uniforms.uMaterialAtlas.set(materialTexture);
            actorEdgeProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            actorEdgeProgram.draw();
          }

          if (visibleActorCount > 0) {
            actorProgram.uniforms.uViewProj.set(viewProjection);
            actorProgram.uniforms.uRight.set(billboardRight);
            actorProgram.uniforms.uUp.set(billboardUp);
            actorProgram.uniforms.uCamPos.set(cameraPosition);
            actorProgram.uniforms.uAtlas.set(actorTexture);
            actorProgram.uniforms.uShadowMap.set(shadowTarget.texture);
            actorProgram.draw();
          }
        },
        { clear: SCENE_CLEAR },
      );

      texel[0] = 1 / scene.width;
      texel[1] = 1 / scene.height;
      const focusDistance = Math.hypot(
        cameraPosition[0]! - hero.motor.state.position.x,
        cameraPosition[1]! - (hero.motor.state.position.y + 1.05),
        cameraPosition[2]! - hero.motor.state.position.z,
      );
      const mobile = pose.mobile;
      postProgram.uniforms.uScene.set(scene.texture);
      postProgram.uniforms.uTexel.set(texel);
      postProgram.uniforms.uFocus.set(focusDistance);
      postProgram.uniforms.uNearFocusRange.set(mode === 'ambient' ? 20 : 12);
      postProgram.uniforms.uFarFocusRange.set(mode === 'ambient' ? 26 : 18);
      postProgram.uniforms.uDofTransition.set(7);
      postProgram.uniforms.uDofMaxRadius.set(mobile ? 0 : mode === 'ambient' ? 1.1 : 0.45);
      postProgram.uniforms.uDofStrength.set(mobile ? 0 : mode === 'ambient' ? 0.24 : 0.075);
      postProgram.uniforms.uDepthReject.set(3);
      postProgram.draw();
      lastValidSlotZeroPower = commitTownSlotZeroPower(options.slotZeroPower, slotZeroPower);
    },

    readStateDigest() {
      return townStateDigest(simulationTime, hero, npcs);
    },

    dispose() {
      sceneTarget?.dispose();
      shadowTarget.dispose();
      postProgram.dispose();
      actorEdgeProgram.dispose();
      actorProgram.dispose();
      actorShadowProgram.dispose();
      waterProgram.dispose();
      worldProgram.dispose();
      worldShadowProgram.dispose();
      materialTexture.dispose();
      actorTexture.dispose();
      vegetationTexture.dispose();
      foliageCardProgram.dispose();
      foliageTrunkProgram.dispose();
      foliageCardShadowProgram.dispose();
      foliageTrunkShadowProgram.dispose();
      propTexture.dispose();
      propProgram.dispose();
      propShadowProgram.dispose();
      awningProgram.dispose();
      awningShadowProgram.dispose();
      waterFeatureProgram.dispose();
    },
  };
}

export function createTownRuntimeFactory(options: TownDemoOptions = {}): TownRuntimeFactory {
  return (setup) => createTownRuntime(setup, options);
}

export function createTownGameFactory(options: TownDemoOptions = {}): TownGameFactory {
  const buildRuntime = createTownRuntimeFactory(options);
  return async (setup) => {
    const runtime = await buildRuntime(setup);
    let previousTime: number | null = null;
    let disposed = false;
    return Object.freeze({
      frame(time: number): void {
        if (disposed) return;
        const lastTime = previousTime;
        const resetOrFirst = lastTime === null || time <= lastTime;
        const deltaSeconds = resetOrFirst ? 1 / 60 : Math.min(time - lastTime, 0.05);
        previousTime = time;
        runtime.update(deltaSeconds, setup.movement);
        setup.renderer.present(() => runtime.render());
      },
      dispose(): void {
        if (disposed) return;
        disposed = true;
        runtime.dispose();
      },
    });
  };
}

const factory = createTownGameFactory();

function buildWaterGrid(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  segmentsX: number,
  segmentsZ: number,
): { positions: Float32Array; indices: Uint16Array } {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let z = 0; z <= segmentsZ; z += 1) {
    const pz = bounds.minZ + (bounds.maxZ - bounds.minZ) * (z / segmentsZ);
    for (let x = 0; x <= segmentsX; x += 1) {
      const px = bounds.minX + (bounds.maxX - bounds.minX) * (x / segmentsX);
      positions.push(px, 0, pz);
    }
  }
  const stride = segmentsX + 1;
  for (let z = 0; z < segmentsZ; z += 1) {
    for (let x = 0; x < segmentsX; x += 1) {
      const a = z * stride + x;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

export default factory;
