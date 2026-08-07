import { createPlane, createProgram, createRenderer } from 'brometal';
import type { GameModuleEntry } from '@antiky/framework/game';
import auroraShader from './shaders/aurora.shader.gen';

/* One TypeScript function compiled ahead of time to WGSL. The demo page shows
 * the authored source and generated output; this file only has to hand the
 * shader a fullscreen quad and a clock. */

const game: GameModuleEntry = async ({ canvas, report }) => {
  const renderer = await createRenderer(canvas);
  const program = createProgram(renderer, auroraShader);
  const quad = createPlane({ width: 2, height: 2 });
  program.attributes.aPosition.set(quad.positions);
  program.attributes.aUv.set(quad.uvs);
  program.setIndices(quad.indices);

  report({
    drawCalls: 1,
    uploadBytesPerFrame: 8,
    note: 'typed shader source compiled to WGSL at build time',
  });

  return {
    frame(t) {
      renderer.present(() => {
        program.uniforms.uTime.set(t);
        program.uniforms.uAspect.set(renderer.aspect);
        program.draw();
      });
    },
    dispose() {
      try {
        program.dispose();
      } finally {
        renderer.destroy();
      }
    },
  };
};

export default game;
