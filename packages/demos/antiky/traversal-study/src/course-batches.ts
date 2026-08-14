/**
 * The instance batches the course is drawn with.
 *
 * Three factories, one per material family: flat-shaded surfaces, additive glows, and the GLB
 * catalog models. Each owns its program, its instance arrays and its disposal, so the renderer
 * builds them and then only writes rows.
 */
import {
  createProgram,
  createTexture,
  loadGlb,
  type BroMetalTexture,
  type BroMetalProgram,
  type Geometry,
  type Renderer,
} from 'brometal';

import { TRAVERSAL_ASSETS, type TraversalAssetId } from './asset-catalog.ts';
import { COURSE_SKY } from './ambient.ts';
import { acquireTransactional, createDisposalStack, type DisposalStack } from './resource-scope.ts';
import modelDepthShader from './shaders/model-depth.shader.gen.ts';
import surfaceDepthShader from './shaders/surface-depth.shader.gen.ts';
import contactShadowShader from './shaders/contact-shadow.shader.gen.ts';
import traversalGlowShader from './shaders/traversal-glow.shader.gen';
import traversalModelShader from './shaders/traversal-model.shader.gen';
import traversalSurfaceShader from './shaders/traversal-surface.shader.gen';

export type Vec3 = readonly [number, number, number];
export type CatalogProgram = BroMetalProgram<
  { aPosition: 'vec3'; aNormal: 'vec3'; aUv: 'vec2' },
  { iOffset: 'vec3'; iScale: 'vec3'; iParams: 'vec3' },
  {
    uViewProj: 'mat4';
    uCameraPosition: 'vec3';
    uTime: 'float';
    uTex: 'sampler2D';
  }
>;

export function writeVec3(target: Float32Array, index: number, x: number, y: number, z: number): void {
  const offset = index * 3;
  target[offset] = x;
  target[offset + 1] = y;
  target[offset + 2] = z;
}

export function rollbackAndRethrow(disposal: DisposalStack, cause: unknown): never {
  try {
    disposal.dispose();
  } catch (rollbackCause: unknown) {
    throw new AggregateError(
      [cause, rollbackCause],
      'Renderer construction and rollback both failed.',
      { cause },
    );
  }
  throw cause;
}

/** A unit quad lying flat on the ground, for the contact shadow. */
export const GROUND_QUAD: Geometry = Object.freeze({
  positions: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
  normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
  uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
  indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
}) as Geometry;

export function createSurfaceBatch(
  renderer: Renderer,
  geometry: Geometry,
  capacity: number,
  billboard: BroMetalTexture,
  /** The contact shadow passes the unlit shader, so no light, fog or tone-map acts on it. */
  shader: typeof traversalSurfaceShader | typeof contactShadowShader = traversalSurfaceShader,
  /**
   * The same instances drawn from the sun, writing distance instead of colour.
   *
   * Optional: the contact shadow casts nothing, and neither does anything drawn with the unlit
   * shader. A blob of darkness that casts its own shadow is not a thing.
   */
  castsShadows = false,
) {
  const disposal = createDisposalStack();
  const depthProgram = castsShadows
    ? disposal.adopt(createProgram(renderer, surfaceDepthShader))
    : undefined;
  const program = disposal.adopt(createProgram(renderer, shader as typeof traversalSurfaceShader, {
    // The blob depth-tests without writing depth; the lit surface is opaque and must keep writing.
    blend: shader === traversalSurfaceShader ? 'none' : 'alpha',
  }));
  program.uniforms.uBillboard.set(billboard);
  try {
    program.attributes.aPosition.set(geometry.positions);
    // The unlit shader has no normal: its shape is a radial falloff, not geometry.
    program.attributes.aNormal?.set(geometry.normals);
    depthProgram?.attributes.aPosition!.set(geometry.positions);
    depthProgram?.setIndices(geometry.indices);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const materials = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: 1,
    uploadBytes: offsets.byteLength + scales.byteLength + colors.byteLength + materials.byteLength,
    clear(): void { scales.fill(0); materials.fill(0); },
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: Vec3, m0: number, m1: number, m2: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(colors, index, color[0], color[1], color[2]);
      writeVec3(materials, index, m0, m1, m2);
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      // The unlit contact shader declares no material channel.
      program.instanceAttributes.iMaterial?.set(materials);
      // Position, scale and the rotation the surface shader keeps in `iMaterial.z`. Colour has no
      // bearing on where a shadow falls.
      depthProgram?.instanceAttributes.iOffset!.set(offsets);
      depthProgram?.instanceAttributes.iScale!.set(scales);
      depthProgram?.instanceAttributes.iMaterial!.set(materials);
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj.set(viewProjection);
      // The unlit shader declares neither: no view-dependent term and no clock.
      program.uniforms.uCameraPosition?.set(cameraPosition);
      program.uniforms.uTime?.set(time);
    },
    draw(): void { program.draw(); },
    /** Draw into the shadow map. Call inside the depth pass, after `upload`. */
    drawDepth(): void { depthProgram?.draw(); },
    dispose(): void { disposal.dispose(); },
  });
}

export function createGlowBatch(
  renderer: Renderer,
  geometry: Geometry,
  capacity: number,
  billboard: BroMetalTexture,
  // Goal 08: the emissive effects batch is additive so a checkpoint glow can exceed 1.0 and reach
  // the bloom pass; alpha-blended output caps at 1.0 and can never bloom whatever the post does.
  blend: 'alpha' | 'additive' = 'alpha',
) {
  const disposal = createDisposalStack();
  const program = disposal.adopt(createProgram(renderer, traversalGlowShader, { blend }));
  program.uniforms.uBillboard.set(billboard);
  try {
    program.attributes.aPosition.set(geometry.positions);
    program.attributes.aNormal.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const alphas = new Float32Array(capacity);
  const rotations = new Float32Array(capacity);
  const phases = new Float32Array(capacity);
  return Object.freeze({
    capacity,
    drawCalls: 1,
    uploadBytes: offsets.byteLength + scales.byteLength + colors.byteLength
      + alphas.byteLength + rotations.byteLength + phases.byteLength,
    clear(): void { scales.fill(0); alphas.fill(0); },
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, color: Vec3, alpha: number, rotation: number, phase: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(colors, index, color[0], color[1], color[2]);
      alphas[index] = alpha;
      rotations[index] = rotation;
      phases[index] = phase;
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      program.instanceAttributes.iAlpha.set(alphas);
      program.instanceAttributes.iRotation.set(rotations);
      program.instanceAttributes.iPhase.set(phases);
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj.set(viewProjection);
      // The unlit shader declares neither: no view-dependent term and no clock.
      program.uniforms.uCameraPosition?.set(cameraPosition);
      program.uniforms.uTime?.set(time);
    },
    draw(): void { program.draw(); },
    dispose(): void { disposal.dispose(); },
  });
}

/**
 * Filtering, decided by what the texture actually is rather than per call site.
 *
 * Two classes ship in this demo and they want opposite treatment:
 *
 * **Palette strips** — a row of solid swatches, one per source material. Quaternius' Ultimate
 * Platformer pack is flat-shaded low-poly with no source texture at all, so its colour is baked into
 * a strip this narrow: `cloud-large` is a single pixel because the model is a single colour. Linear
 * filtering and anisotropy average adjacent swatches wherever two meet, which turns a two-colour model
 * into a muddy gradient, and mips collapse the strip towards its own average. Nearest, no mips.
 *
 * **Real textures** — Kenney's platformer kit ships an authored 512x512 colormap with a genuine
 * unwrap. Those want trilinear and anisotropy, or every surface seen at a grazing angle is
 * simultaneously over-blurred across and aliased along.
 *
 * A palette is recognised by shape, not by filename: one texel tall and no wider than the number of
 * materials any of these kits produce. The widest today is `relay-tower` at 7.
 */
const PALETTE_MAX_WIDTH = 16;

function textureFiltering(width: number, height: number): { filter: 'smooth' | 'nearest'; anisotropy?: number } {
  const palette = height === 1 && width <= PALETTE_MAX_WIDTH;
  return palette ? { filter: 'nearest' } : { filter: 'smooth', anisotropy: 8 };
}

export async function createCatalogBatch(
  renderer: Renderer,
  assetId: TraversalAssetId,
  capacity: number,
  detailNormal: BroMetalTexture,
  ramp: BroMetalTexture,
  kitMaterials: BroMetalTexture,
  materialMaps: Readonly<{ diffuse: BroMetalTexture; roughness: BroMetalTexture }>,
  /** How much of the plywood material this batch is made of. A cloud is made of none. */
  materialStrength = 0,
  /** How far light wraps past the terminator. Clouds are volumes; everything else here is solid. */
  wrap = 0,
) {
  const asset = TRAVERSAL_ASSETS.find((entry) => entry.id === assetId)!;
  const model = await loadGlb(asset.url);
  if (model.images.length === 0) throw new Error(`${asset.fileName} has no embedded catalog image.`);
  const disposal = createDisposalStack();
  const textures: BroMetalTexture[] = [];
  const programs: CatalogProgram[] = [];
  const depthPrograms: BroMetalProgram[] = [];
  try {
    for (const image of model.images) {
      const ownedImageBuffer = new ArrayBuffer(image.data.byteLength);
      new Uint8Array(ownedImageBuffer).set(image.data);
      const bitmap = await createImageBitmap(new Blob([ownedImageBuffer], { type: image.mimeType }));
      try {
        textures.push(disposal.adopt(createTexture(renderer, bitmap, {
          flipY: false,
          ...textureFiltering(bitmap.width, bitmap.height),
        })));
      } finally {
        bitmap.close();
      }
    }
    for (const mesh of model.meshes) {
      if (mesh.indices === null || mesh.imageIndex === null) {
        throw new Error(`${asset.fileName} needs indexed, embedded-image geometry.`);
      }
      const program = disposal.adopt(createProgram(renderer, traversalModelShader));
      // The same mesh drawn from the sun. One depth program per catalog mesh, because each has its
      // own geometry; they share one set of instance arrays with the lit program below.
      const depthProgram = disposal.adopt(createProgram(renderer, modelDepthShader));
      depthProgram.attributes.aPosition!.set(mesh.positions);
      depthProgram.setIndices(mesh.indices);
      depthPrograms.push(depthProgram);
      programs.push(program);
      program.attributes.aPosition.set(mesh.positions);
      program.attributes.aNormal.set(mesh.normals ?? new Float32Array(mesh.positions.length));
      program.attributes.aUv.set(mesh.uvs ?? new Float32Array(mesh.positions.length / 3 * 2));
      program.setIndices(mesh.indices);
      program.uniforms.uTex.set(textures[mesh.imageIndex]!);
      program.uniforms.uDetailNormal.set(detailNormal);
      program.uniforms.uRamp.set(ramp);
      program.uniforms.uKitMaterials.set(kitMaterials);
      program.uniforms.uMaterialDiffuse.set(materialMaps.diffuse);
      program.uniforms.uMaterialRoughness.set(materialMaps.roughness);
      program.uniforms.uMaterialStrength.set(materialStrength);
      program.uniforms.uSh0.set(COURSE_SKY[0]!);
      program.uniforms.uSh1.set(COURSE_SKY[1]!);
      program.uniforms.uSh2.set(COURSE_SKY[2]!);
      program.uniforms.uSh3.set(COURSE_SKY[3]!);
      program.uniforms.uSh4.set(COURSE_SKY[4]!);
      program.uniforms.uSh5.set(COURSE_SKY[5]!);
      program.uniforms.uSh6.set(COURSE_SKY[6]!);
      program.uniforms.uSh7.set(COURSE_SKY[7]!);
      program.uniforms.uSh8.set(COURSE_SKY[8]!);
      program.uniforms.uWrap.set(wrap);
    }
  } catch (cause: unknown) {
    rollbackAndRethrow(disposal, cause);
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);
  return Object.freeze({
    capacity,
    drawCalls: programs.length,
    uploadBytes: (offsets.byteLength + scales.byteLength + params.byteLength) * programs.length,
    clear(): void { scales.fill(0); params.fill(0); },
    set(index: number, ox: number, oy: number, oz: number, sx: number, sy: number, sz: number, p0: number, p1: number, p2: number): void {
      writeVec3(offsets, index, ox, oy, oz);
      writeVec3(scales, index, sx, sy, sz);
      writeVec3(params, index, p0, p1, p2);
    },
    upload(): void {
      for (let index = 0; index < programs.length; index += 1) {
        const program = programs[index]!;
        depthPrograms[index]!.instanceAttributes.iOffset!.set(offsets);
        depthPrograms[index]!.instanceAttributes.iScale!.set(scales);
        depthPrograms[index]!.instanceAttributes.iParams!.set(params);
        program.instanceAttributes.iOffset.set(offsets);
        program.instanceAttributes.iScale.set(scales);
        program.instanceAttributes.iParams.set(params);
      }
    },
    setFrame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      for (let index = 0; index < programs.length; index += 1) {
        const program = programs[index]!;
        program.uniforms.uViewProj.set(viewProjection);
        program.uniforms.uCameraPosition.set(cameraPosition);
        program.uniforms.uTime.set(time);
        // The depth pass sways on the same clock, or a swaying caster's shadow stands still.
        depthPrograms[index]!.uniforms.uTime!.set(time);
      }
    },
    drawDepth(): void {
      for (let index = 0; index < depthPrograms.length; index += 1) depthPrograms[index]!.draw();
    },
    depthPrograms,
    programs,
    draw(): void {
      for (let index = 0; index < programs.length; index += 1) programs[index]!.draw();
    },
    dispose(): void {
      disposal.dispose();
    },
  });
}
