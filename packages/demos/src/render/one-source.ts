import { createPlane, createProgram } from 'brometal';
import auroraShader from '../shaders/aurora.shader.gen';
import type { DemoFactory } from '../runtime';

/* One TypeScript function, running as GLSL ES 3.00 or as WGSL depending on the
 * toggle. The demo page shows all three texts side by side; this file only has
 * to hand the shader a fullscreen quad and a clock. */

const factory: DemoFactory = ({ renderer, report }) => {
  const program = createProgram(renderer, auroraShader);
  const quad = createPlane({ width: 2, height: 2 });
  program.attributes.aPosition.set(quad.positions);
  program.attributes.aUv.set(quad.uvs);
  program.setIndices(quad.indices);

  report({
    drawCalls: 1,
    bytesPerFrame: 8,
    note: 'the same shader source, compiled to both languages at build time',
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
