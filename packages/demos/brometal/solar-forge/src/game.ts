import { createPlane, createProgram, createRenderer } from 'brometal';
import type { StudioGameEntry } from './studio-game.ts';
import solarForgeShader from './shaders/solar-forge.shader.gen';

const game: StudioGameEntry = async ({ canvas, pointer, report }) => {
  const renderer = await createRenderer(canvas);
  const program = createProgram(renderer, solarForgeShader);
  const quad = createPlane({ width: 2, height: 2 });
  program.attributes.aPosition.set(quad.positions);
  program.attributes.aUv.set(quad.uvs);
  program.setIndices(quad.indices);
  report({ drawCalls: 1, instances: 1, uploadBytesPerFrame: 16, note: 'pure BroMetal solar shader' });
  return Object.freeze({
    frame(time: number): void {
      renderer.present(() => {
        program.uniforms.uTime.set(time);
        program.uniforms.uAspect.set(renderer.aspect);
        program.uniforms.uPointer.set([pointer.x, pointer.y]);
        program.draw();
      });
    },
    dispose(): void {
      try { program.dispose(); } finally { renderer.destroy(); }
    },
  });
};

export default game;
