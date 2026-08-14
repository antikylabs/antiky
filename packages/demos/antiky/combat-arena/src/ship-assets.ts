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

import { COMBAT_PALETTE, enemyVisualProfile } from './combat-visuals.ts';
import {
  ENEMY_HULL_CONTRACTS,
  PLAYER_HULL_CONTRACT,
} from './combat-hulls.ts';
import type { CombatSnapshot } from './combat-state.ts';
import type { Vec3 } from './render-batches.ts';
import { loadDetailNormal } from './detail-normal.ts';
import { createDisposalScope } from '@antiky/framework';
import arenaDepthShader from './shaders/arena-depth.shader.gen.ts';
import shipModelShader from './shaders/ship-model.shader.gen.ts';

const SHIP_URLS = Object.freeze({
  player: new URL('../assets/quaternius/ultimate-spaceships/spitfire-blue.glb?no-inline', import.meta.url).href,
  rusher: new URL('../assets/quaternius/ultimate-spaceships/striker-red.glb?no-inline', import.meta.url).href,
  gunner: new URL('../assets/quaternius/ultimate-spaceships/omen-orange.glb?no-inline', import.meta.url).href,
  anchor: new URL('../assets/quaternius/ultimate-spaceships/imperial-red.glb?no-inline', import.meta.url).href,
  warden: new URL('../assets/quaternius/ultimate-spaceships/executioner-red.glb?no-inline', import.meta.url).href,
});

export const SHIP_CATALOG_ASSET_COUNT = Object.keys(SHIP_URLS).length;
export const SHIP_INSTANCE_CAPACITY = 6;

type ShipBatch = Readonly<{
  program: BroMetalProgram;
  clear(): void;
  setValues(
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
    tint: Vec3,
    emissive: number, hit: number, rotation: number,
  ): void;
  depthProgram: BroMetalProgram;
  upload(): void;
  drawDepth(): void;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void;
  dispose(): void;
}>;

export type ShipAssetDependencies = Readonly<{
  loadModel(url: string): Promise<Model>;
  createBitmap(image: ModelImage): Promise<ImageBitmap>;
  createTexture(renderer: Renderer, bitmap: ImageBitmap): BroMetalTexture;
  createProgram(renderer: Renderer): BroMetalProgram;
  /** The same hulls drawn from the sun, writing distance instead of colour. */
  createDepthProgram(renderer: Renderer): BroMetalProgram;
  /**
   * Loaded once for the whole fleet rather than per hull. Five ships share one detail normal, and
   * five uploads of the same 512x512 image is four wasted.
   */
  loadDetailNormal(renderer: Renderer): Promise<BroMetalTexture>;
}>;

const SHIP_ASSET_DEPENDENCIES: ShipAssetDependencies = Object.freeze({
  loadModel: loadGlb,
  createBitmap: async (image) => createImageBitmap(new Blob(
    [image.data.slice() as unknown as BlobPart],
    { type: image.mimeType },
  )),
  createTexture: (renderer, bitmap) => createTexture(renderer, bitmap, { flipY: false, anisotropy: 4 }),
  createProgram: (renderer) => createProgram(renderer, shipModelShader),
  createDepthProgram: (renderer) => createProgram(renderer, arenaDepthShader),
  loadDetailNormal,
});

async function createShipBatch(
  renderer: Renderer,
  model: Model,
  capacity: number,
  dependencies: ShipAssetDependencies,
  detailNormal: BroMetalTexture,
): Promise<ShipBatch> {
  const mesh = model.meshes[0];
  if (model.meshes.length !== 1 || mesh === undefined || mesh.normals === null || mesh.uvs === null || mesh.indices === null) {
    throw new Error('Ultimate Spaceships model requires one indexed mesh with positions, normals, and UVs');
  }
  if (mesh.imageIndex === null || model.images[mesh.imageIndex] === undefined) {
    throw new Error('Ultimate Spaceships model requires its embedded authored color texture');
  }

  const owned = createDisposalScope();
  const bitmap = await dependencies.createBitmap(model.images[mesh.imageIndex]!);
  let texture: BroMetalTexture;
  let program: BroMetalProgram;
  let depthProgram: BroMetalProgram;
  try {
    try {
      texture = owned.adopt(dependencies.createTexture(renderer, bitmap));
    } finally {
      bitmap.close();
    }
    program = owned.adopt(dependencies.createProgram(renderer));
    depthProgram = owned.adopt(dependencies.createDepthProgram(renderer));
    depthProgram.attributes.aPosition!.set(mesh.positions);
    depthProgram.setIndices(mesh.indices);
    program.attributes.aPosition!.set(mesh.positions);
    program.attributes.aNormal!.set(mesh.normals);
    program.attributes.aUv!.set(mesh.uvs);
    program.setIndices(mesh.indices);
    program.uniforms.uTex!.set(texture);
    program.uniforms.uDetailNormal!.set(detailNormal);
  } catch (cause: unknown) {
    owned.rollback();
    throw cause;
  }

  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const tints = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);
  const normalScales = new Float32Array(capacity * 3);

  return Object.freeze({
    program,
    depthProgram,
    clear(): void {
      scales.fill(0);
      params.fill(0);
    },
    setValues(index, offsetX, offsetY, offsetZ, scaleX, scaleY, scaleZ, tint, emissive, hit, rotation): void {
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = scaleX;
      scales[at + 1] = scaleY;
      scales[at + 2] = scaleZ;
      normalScales[at] = 1 / scaleX;
      normalScales[at + 1] = 1 / scaleY;
      normalScales[at + 2] = 1 / scaleZ;
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
      program.instanceAttributes.iNormalScale!.set(normalScales);
      program.instanceAttributes.iTint!.set(tints);
      program.instanceAttributes.iParams!.set(params);
      // Position only. `iNormalScale` exists to keep normals perpendicular under nonuniform scale,
      // and a depth pass has no normals.
      depthProgram.instanceAttributes.iOffset!.set(offsets);
      depthProgram.instanceAttributes.iScale!.set(scales);
      depthProgram.instanceAttributes.iParams!.set(params);
    },
    frame(viewProjection, cameraPosition, time): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uCameraPosition!.set(cameraPosition);
      program.uniforms.uTime!.set(time);
      depthProgram.uniforms.uTime!.set(time);
    },
    /** Draw into the shadow map. Call inside the depth pass, after `upload`. */
    drawDepth(): void { depthProgram.draw(); },
    dispose(): void {
      owned.dispose();
    },
  });
}

export type ShipFleet = Readonly<{
  project(state: CombatSnapshot): void;
  frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void;
  draw(): void;
  /** Every hull drawn from the sun. Call inside the shadow pass, before the scene. */
  drawDepth(): void;
  /**
   * The fleet's programs, so the renderer can point them all at one shadow map.
   *
   * Exposed as a list rather than by name because the fleet is four hull batches and which one a
   * ship uses is the fleet's business, not the renderer's.
   */
  programs: readonly Readonly<{ program: BroMetalProgram; depthProgram: BroMetalProgram }>[];
  dispose(): void;
}>;

export async function createShipFleet(
  renderer: Renderer,
  dependencies: ShipAssetDependencies = SHIP_ASSET_DEPENDENCIES,
): Promise<ShipFleet> {
  const models = await Promise.all(Object.values(SHIP_URLS).map((url) => dependencies.loadModel(url)));
  // The detail normal is owned by the fleet, not by any one hull, so it is registered first and
  // rolled back with the rest. A texture created before the failure point and not registered is a
  // leak that nothing reports.
  const resources = createDisposalScope();
  let player: ShipBatch;
  let rushers: ShipBatch;
  let gunner: ShipBatch;
  let anchor: ShipBatch;
  let warden: ShipBatch;
  try {
    const detailNormal = resources.adopt(await dependencies.loadDetailNormal(renderer));
    player = resources.adopt(await createShipBatch(renderer, models[0]!, 1, dependencies, detailNormal));
    rushers = resources.adopt(await createShipBatch(renderer, models[1]!, 2, dependencies, detailNormal));
    gunner = resources.adopt(await createShipBatch(renderer, models[2]!, 1, dependencies, detailNormal));
    anchor = resources.adopt(await createShipBatch(renderer, models[3]!, 1, dependencies, detailNormal));
    warden = resources.adopt(await createShipBatch(renderer, models[4]!, 1, dependencies, detailNormal));
  } catch (cause: unknown) {
    resources.rollback();
    throw cause;
  }
  // Per-frame work is only the hulls; disposal covers everything the fleet owns.
  const batches: readonly ShipBatch[] = [player, rushers, gunner, anchor, warden];

  const project = (state: CombatSnapshot): void => {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) batches[batchIndex]!.clear();
    const playerVisible = state.phase === 'defeat' ? 0.38 : 1;
    const playerScale = PLAYER_HULL_CONTRACT.presentation;
    player.setValues(
      0,
      state.player.x, playerScale.offsetY, state.player.z,
      playerScale.x * playerVisible, playerScale.y * playerVisible, playerScale.z * playerVisible,
      COMBAT_PALETTE.cyan,
      state.player.dash > 0 ? 0.82 : 0.28, state.player.invulnerable > 0 ? 0.18 : 0, -Math.atan2(state.player.facingX, state.player.facingZ),
    );

    let rusherCount = 0;
    for (let enemyIndex = 0; enemyIndex < state.enemies.length; enemyIndex += 1) {
      const enemy = state.enemies[enemyIndex]!;
      if (!enemy.active) continue;
      const profile = enemyVisualProfile(enemy);
      const rotation = -Math.atan2(state.player.x - enemy.x, state.player.z - enemy.z);
      const scale = ENEMY_HULL_CONTRACTS[enemy.role].presentation;
      const batch = enemy.role === 'rusher'
        ? rushers
        : enemy.role === 'gunner'
          ? gunner
          : enemy.role === 'shield-anchor'
            ? anchor
            : warden;
      const index = enemy.role === 'rusher' ? rusherCount : 0;
      if (enemy.role === 'rusher') rusherCount += 1;
      batch.setValues(
        index,
        enemy.x, scale.offsetY, enemy.z,
        scale.x, scale.y, scale.z,
        profile.tint,
        profile.emissive + (enemy.mark > 0 ? 0.18 : 0), enemy.hit, rotation,
      );
    }
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) batches[batchIndex]!.upload();
  };

  return Object.freeze({
    project,
    frame(viewProjection, cameraPosition, time): void {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        batches[batchIndex]!.frame(viewProjection, cameraPosition, time);
      }
    },
    draw(): void {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) batches[batchIndex]!.program.draw();
    },
    drawDepth(): void {
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) batches[batchIndex]!.drawDepth();
    },
    programs: batches,
    dispose(): void {
      // The scope, not `batches`: it also owns the shared detail normal, which the previous
      // `disposeResources(batches)` walked straight past and leaked. Reverse order releases the
      // hulls before the texture they sample.
      resources.dispose();
    },
  });
}
