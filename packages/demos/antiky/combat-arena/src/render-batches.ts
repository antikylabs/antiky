import { createProgram, type BroMetalProgram, type BroMetalTexture, type Geometry, type Renderer } from 'brometal';

import arenaGlowShader from './shaders/arena-glow.shader.gen.ts';
import arenaSurfaceShader from './shaders/arena-surface.shader.gen.ts';
import contactShadowShader from './shaders/contact-shadow.shader.gen.ts';

export type Vec3 = readonly [number, number, number];
export type SurfaceBatch = ReturnType<typeof createSurfaceBatch>;
export type GlowBatch = ReturnType<typeof createGlowBatch>;
export type ContactShadowBatch = ReturnType<typeof createContactShadowBatch>;

/**
 * A single flat quad on the ground plane, spanning -1..1 so the shadow shader's radial falloff
 * reaches zero exactly at the inscribed circle.
 *
 * The old shadows used `createCube`. A box drawn with alpha blending paints its top face and its
 * bottom face over the same pixels, so every blob was darkened twice by geometry nobody could see.
 */
export function groundQuad(): Geometry {
  return Object.freeze({
    positions: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 2, 1, 0, 3, 2]),
  }) as Geometry;
}

/**
 * Contact shadows. Separate from the surface batch because they are the one thing in the arena that
 * must not be lit, and because alpha blending has to run after the opaque pass.
 */
export function createContactShadowBatch(
  renderer: Renderer,
  capacity: number,
  programFactory: BatchProgramFactory = (target) => createProgram(target, contactShadowShader, { blend: 'alpha' }),
) {
  const program = programFactory(renderer);
  const geometry = groundQuad();
  try {
    program.attributes.aPosition!.set(geometry.positions);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      colors.fill(0);
    },
    setValues(
      index: number,
      offsetX: number, offsetY: number, offsetZ: number,
      radiusX: number, rotation: number, radiusZ: number,
      colorR: number, colorG: number, colorB: number,
    ): void {
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = radiusX;
      scales[at + 1] = rotation;
      scales[at + 2] = radiusZ;
      colors[at] = colorR;
      colors[at + 1] = colorG;
      colors[at + 2] = colorB;
    },
    upload(): void {
      program.instanceAttributes.iOffset!.set(offsets);
      program.instanceAttributes.iScale!.set(scales);
      program.instanceAttributes.iColor!.set(colors);
    },
    frame(viewProjection: Float32Array): void {
      program.uniforms.uViewProj!.set(viewProjection);
    },
    dispose(): void {
      program.dispose();
    },
  });
}

export function horizontalGeometry(geometry: Geometry): Geometry {
  const positions = new Float32Array(geometry.positions);
  const normals = new Float32Array(geometry.normals);
  for (let index = 0; index < positions.length; index += 3) {
    const y = positions[index + 1]!;
    positions[index + 1] = -positions[index + 2]!;
    positions[index + 2] = y;
    const normalY = normals[index + 1]!;
    normals[index + 1] = -normals[index + 2]!;
    normals[index + 2] = normalY;
  }
  return Object.freeze({ ...geometry, positions, normals });
}

type BatchProgramFactory = (renderer: Renderer) => BroMetalProgram;

export function createSurfaceBatch(
  renderer: Renderer,
  geometry: Geometry,
  capacity: number,
  programFactory: BatchProgramFactory = (target) => createProgram(target, arenaSurfaceShader),
) {
  const program = programFactory(renderer);
  try {
    program.attributes.aPosition!.set(geometry.positions);
    program.attributes.aNormal!.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const params = new Float32Array(capacity * 3);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      colors.fill(0);
      params.fill(0);
    },
    setValues(
      index: number,
      offsetX: number, offsetY: number, offsetZ: number,
      scaleX: number, scaleY: number, scaleZ: number,
      colorR: number, colorG: number, colorB: number,
      emissive: number, hit: number, rotation: number,
    ): void {
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = scaleX;
      scales[at + 1] = scaleY;
      scales[at + 2] = scaleZ;
      colors[at] = colorR;
      colors[at + 1] = colorG;
      colors[at + 2] = colorB;
      params[at] = emissive;
      params[at + 1] = hit;
      params[at + 2] = rotation;
    },
    upload(): void {
      program.instanceAttributes.iOffset!.set(offsets);
      program.instanceAttributes.iScale!.set(scales);
      program.instanceAttributes.iColor!.set(colors);
      program.instanceAttributes.iParams!.set(params);
    },
    frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uCameraPosition!.set(cameraPosition);
      program.uniforms.uTime!.set(time);
    },
    dispose(): void {
      program.dispose();
    },
  });
}

export function createGlowBatch(
  renderer: Renderer,
  geometry: Geometry,
  capacity: number,
  billboard: BroMetalTexture,
  programFactory: BatchProgramFactory = (target) => createProgram(target, arenaGlowShader, { blend: 'additive' }),
) {
  const program = programFactory(renderer);
  program.uniforms.uBillboard!.set(billboard);
  try {
    program.attributes.aPosition!.set(geometry.positions);
    program.attributes.aNormal!.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const alphas = new Float32Array(capacity);
  const rotations = new Float32Array(capacity);
  const phases = new Float32Array(capacity);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      alphas.fill(0);
    },
    setValues(
      index: number,
      offsetX: number, offsetY: number, offsetZ: number,
      scaleX: number, scaleY: number, scaleZ: number,
      colorR: number, colorG: number, colorB: number,
      alpha: number, rotation: number, phase: number,
    ): void {
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = scaleX;
      scales[at + 1] = scaleY;
      scales[at + 2] = scaleZ;
      colors[at] = colorR;
      colors[at + 1] = colorG;
      colors[at + 2] = colorB;
      alphas[index] = alpha;
      rotations[index] = rotation;
      phases[index] = phase;
    },
    upload(): void {
      program.instanceAttributes.iOffset!.set(offsets);
      program.instanceAttributes.iScale!.set(scales);
      program.instanceAttributes.iColor!.set(colors);
      program.instanceAttributes.iAlpha!.set(alphas);
      program.instanceAttributes.iRotation!.set(rotations);
      program.instanceAttributes.iPhase!.set(phases);
    },
    frame(viewProjection: Float32Array, cameraPosition: Float32Array, time: number): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uCameraPosition!.set(cameraPosition);
      program.uniforms.uTime!.set(time);
    },
    dispose(): void {
      program.dispose();
    },
  });
}
