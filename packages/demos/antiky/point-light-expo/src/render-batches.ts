import {
  createProgram,
  type Geometry,
  type Renderer,
} from 'brometal';

import foundryGlowShader from './shaders/foundry-glow.shader.gen';
import foundryShader from './shaders/foundry.shader.gen';

export type Vec3 = readonly [number, number, number];

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

export function createSurfaceBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, foundryShader);
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const materials = new Float32Array(capacity * 3);
  const yaws = new Float32Array(capacity);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      colors.fill(0);
      materials.fill(0);
      yaws.fill(0);
    },
    set(
      index: number,
      offset: Vec3,
      scale: Vec3,
      color: Vec3,
      material: Vec3,
      yaw = 0,
    ): void {
      offsets.set(offset, index * 3);
      scales.set(scale, index * 3);
      colors.set(color, index * 3);
      materials.set(material, index * 3);
      yaws[index] = yaw;
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iBaseColor.set(colors);
      program.instanceAttributes.iMaterial.set(materials);
      program.instanceAttributes.iYaw.set(yaws);
    },
    draw(): void {
      program.draw();
    },
    dispose(): void {
      program.dispose();
    },
  });
}

export function createGlowBatch(renderer: Renderer, geometry: Geometry, capacity: number) {
  const program = createProgram(renderer, foundryGlowShader, { blend: 'additive' });
  program.attributes.aPosition.set(geometry.positions);
  program.attributes.aNormal.set(geometry.normals);
  program.setIndices(geometry.indices);
  const offsets = new Float32Array(capacity * 3);
  const scales = new Float32Array(capacity);
  const colors = new Float32Array(capacity * 3);
  const powers = new Float32Array(capacity);
  const phases = new Float32Array(capacity);
  const motions = new Float32Array(capacity);

  return Object.freeze({
    program,
    clear(): void {
      scales.fill(0);
      powers.fill(0);
      motions.fill(0);
    },
    set(
      index: number,
      offset: Vec3,
      scale: number,
      color: Vec3,
      power: number,
      phase = 0,
      motion = 0,
    ): void {
      offsets.set(offset, index * 3);
      scales[index] = scale;
      colors.set(color, index * 3);
      powers[index] = power;
      phases[index] = phase;
      motions[index] = motion;
    },
    upload(): void {
      program.instanceAttributes.iOffset.set(offsets);
      program.instanceAttributes.iScale.set(scales);
      program.instanceAttributes.iColor.set(colors);
      program.instanceAttributes.iPower.set(powers);
      program.instanceAttributes.iPhase.set(phases);
      program.instanceAttributes.iMotion.set(motions);
    },
    draw(): void {
      program.draw();
    },
    dispose(): void {
      program.dispose();
    },
  });
}
