import { createPlane, createProgram, type BroMetalProgram, type Renderer } from 'brometal';

import { horizontalGeometry } from './render-batches.ts';
import spaceBackdropShader from './shaders/space-backdrop.shader.gen.ts';

export const SPACE_BACKDROP_INSTANCES = 1;
export const SPACE_BACKDROP_DRAWS = 1;
export const SPACE_BACKDROP_ENVIRONMENT_LAYERS = 1;

export type SpaceBackdrop = Readonly<{
  frame(viewProjection: Float32Array, time: number): void;
  draw(): void;
  dispose(): void;
}>;

type BackdropProgramFactory = (renderer: Renderer) => BroMetalProgram;

export function createSpaceBackdrop(
  renderer: Renderer,
  programFactory: BackdropProgramFactory = (target) => createProgram(target, spaceBackdropShader),
): SpaceBackdrop {
  const geometry = horizontalGeometry(createPlane({ width: 56, height: 56 }));
  const upwardIndices = new Uint16Array(geometry.indices);
  for (let index = 0; index < upwardIndices.length; index += 3) {
    const second = upwardIndices[index + 1]!;
    upwardIndices[index + 1] = upwardIndices[index + 2]!;
    upwardIndices[index + 2] = second;
  }
  const program = programFactory(renderer);
  try {
    program.attributes.aPosition!.set(geometry.positions);
    program.setIndices(upwardIndices);
  } catch (cause: unknown) {
    program.dispose();
    throw cause;
  }
  return Object.freeze({
    frame(viewProjection, time): void {
      program.uniforms.uViewProj!.set(viewProjection);
      program.uniforms.uTime!.set(time);
    },
    draw(): void {
      program.draw();
    },
    dispose(): void {
      program.dispose();
    },
  });
}
