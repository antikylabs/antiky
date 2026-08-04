import { createPlane, createProgram } from 'brometal';
import auroraShader from './shaders/aurora.shader.gen';
import type { DemoFactory } from '../../runtime';

/* One TypeScript function compiled ahead of time to WGSL. The demo page shows
 * the authored source and generated output; this file only has to hand the
 * shader a fullscreen quad and a clock. */

const factory: DemoFactory = ({ renderer, report }) => {
  const program = createProgram(renderer, auroraShader);
  const quad = createPlane({ width: 2, height: 2 });
  program.attributes.aPosition.set(quad.positions);
  program.attributes.aUv.set(quad.uvs);
  program.setIndices(quad.indices);

  report({
    drawCalls: 1,
    bytesPerFrame: 8,
    note: 'typed shader source compiled to WGSL at build time',
  });

  return {
    frame(t) {
      program.uniforms.uTime.set(t);
      program.uniforms.uAspect.set(renderer.aspect);
      program.draw();
    },
    dispose() {
      program.dispose();
    },
  };
};

export default factory;
