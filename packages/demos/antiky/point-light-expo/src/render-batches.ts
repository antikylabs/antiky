import {
  createProgram,
  type Geometry,
  type Renderer,
} from 'brometal';

import contactShadowShader from './shaders/contact-shadow.shader.gen.ts';
import foundryGlowShader from './shaders/foundry-glow.shader.gen.ts';
import foundryShader from './shaders/foundry.shader.gen.ts';

export type Vec3 = readonly [number, number, number];

function assertIndex(index: number, capacity: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= capacity) {
    throw new RangeError(`Instance ${index} is outside a batch capacity of ${capacity}.`);
  }
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

export function createSurfaceInstanceData(capacity: number) {
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const materials = new Float32Array(capacity * 3);
  const yaws = new Float32Array(capacity);
  const setValues = (
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
    red: number, green: number, blue: number,
    roughness: number, metallic: number, emissive: number,
    yaw = 0,
  ): void => {
    assertIndex(index, capacity);
    const at = index * 3;
    offsets[at] = offsetX;
    offsets[at + 1] = offsetY;
    offsets[at + 2] = offsetZ;
    scales[at] = scaleX;
    scales[at + 1] = scaleY;
    scales[at + 2] = scaleZ;
    colors[at] = red;
    colors[at + 1] = green;
    colors[at + 2] = blue;
    materials[at] = roughness;
    materials[at + 1] = metallic;
    materials[at + 2] = emissive;
    yaws[index] = yaw;
  };
  return Object.freeze({
    offsets, scales, colors, materials, yaws,
    clear(): void {
      scales.fill(0);
      colors.fill(0);
      materials.fill(0);
      yaws.fill(0);
    },
    setValues,
  });
}

/**
 * A single flat quad on the ground plane, spanning -1..1 so the shadow shader's radial falloff
 * reaches zero exactly at the inscribed circle.
 *
 * The old shadows were boxes. A box drawn with alpha blending paints its top face and its bottom
 * face over the same pixels, darkening every blob twice with geometry nobody can see.
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
 * Contact shadows. Separate from the surface batch because they are the one thing in the relay that
 * must not be lit, and because alpha blending has to run after the opaque pass.
 */
export function createContactShadowBatch(
  renderer: Renderer,
  capacity: number,
  createShadowProgram = () => createProgram(renderer, contactShadowShader, { blend: 'alpha' }),
) {
  const program = createShadowProgram();
  const geometry = groundQuad();
  try {
    program.attributes.aPosition.set(geometry.positions);
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
      radiusX: number, yaw: number, radiusZ: number,
      colorR: number, colorG: number, colorB: number,
    ): void {
      assertIndex(index, capacity);
      const at = index * 3;
      offsets[at] = offsetX;
      offsets[at + 1] = offsetY;
      offsets[at + 2] = offsetZ;
      scales[at] = radiusX;
      scales[at + 1] = yaw;
      scales[at + 2] = radiusZ;
      colors[at] = colorR;
      colors[at + 1] = colorG;
      colors[at + 2] = colorB;
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
    },
    draw(): void { program.draw(); },
    dispose(): void { program.dispose(); },
  });
}

export function createSurfaceBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, foundryShader);
  try {
    program.attributes.aPosition.set(geometry.positions);
    program.attributes.aNormal.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  const data = createSurfaceInstanceData(capacity);

  return Object.freeze({
    program,
    clear: data.clear,
    setValues: data.setValues,
    upload(): void {
      program.instanceAttributes.iOffset.set(data.offsets);
      program.instanceAttributes.iScale.set(data.scales);
      program.instanceAttributes.iBaseColor.set(data.colors);
      program.instanceAttributes.iMaterial.set(data.materials);
      program.instanceAttributes.iYaw.set(data.yaws);
    },
    draw(): void { program.draw(); },
    dispose(): void { program.dispose(); },
  });
}

export function createGlowInstanceData(capacity: number) {
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity);
  const colors = new Float32Array(capacity * 3);
  const powers = new Float32Array(capacity);
  const phases = new Float32Array(capacity);
  const motions = new Float32Array(capacity);
  const setValues = (
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scale: number,
    red: number, green: number, blue: number,
    power: number,
    phase = 0,
    motion = 0,
  ): void => {
    assertIndex(index, capacity);
    const at = index * 3;
    offsets[at] = offsetX;
    offsets[at + 1] = offsetY;
    offsets[at + 2] = offsetZ;
    scales[index] = scale;
    colors[at] = red;
    colors[at + 1] = green;
    colors[at + 2] = blue;
    powers[index] = power;
    phases[index] = phase;
    motions[index] = motion;
  };
  return Object.freeze({
    offsets, scales, colors, powers, phases, motions,
    clear(): void {
      scales.fill(0);
      powers.fill(0);
      motions.fill(0);
    },
    setValues,
  });
}

export function createGlowBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, foundryGlowShader, { blend: 'additive' });
  try {
    program.attributes.aPosition.set(geometry.positions);
    program.attributes.aNormal.set(geometry.normals);
    program.setIndices(geometry.indices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  const data = createGlowInstanceData(capacity);

  return Object.freeze({
    program,
    clear: data.clear,
    setValues: data.setValues,
    upload(): void {
      program.instanceAttributes.iOffset.set(data.offsets);
      program.instanceAttributes.iScale.set(data.scales);
      program.instanceAttributes.iColor.set(data.colors);
      program.instanceAttributes.iPower.set(data.powers);
      program.instanceAttributes.iPhase.set(data.phases);
      program.instanceAttributes.iMotion.set(data.motions);
    },
    draw(): void { program.draw(); },
    dispose(): void { program.dispose(); },
  });
}
