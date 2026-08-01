import { createCamera, createCube, createProgram } from 'brometal';
import type { DemoFactory } from '../runtime';
import stormShader from '../shaders/storm.shader.gen';

/* Residency, demonstrated. 120,000 cubes, one geometry, one draw call, and a
 * per-instance seed uploaded exactly once. Every frame after the first sends a
 * mat4 and two floats — 72 bytes — no matter how many instances there are. */

const COUNT = 120_000;

const factory: DemoFactory = ({ renderer, pointer, report }) => {
  const program = createProgram(renderer, stormShader);
  const cube = createCube();
  program.attributes.aPosition.set(cube.positions);
  program.attributes.aNormal.set(cube.normals);
  program.setIndices(cube.indices);

  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  program.instanceAttributes.iSeed.set(seeds);
  program.uniforms.uSpread.set(9);

  report({
    instances: COUNT,
    drawCalls: 1,
    bytesPerFrame: 72,
    note: `${((seeds.byteLength / 1024 / 1024) * 1).toFixed(1)} MB of instance data uploaded once, at startup`,
  });

  const camera = createCamera({ position: [0, 3, 22] });

  return {
    frame(t) {
      const spin = t * 0.07 + pointer.dragX * 5;
      const height = 2.5 + Math.sin(t * 0.13) * 2.5 + pointer.dragY * 12;
      const x = Math.sin(spin) * 21;
      const z = Math.cos(spin) * 21;
      camera.setPosition(x, height, z);
      camera.lookAt(0, 0, 0);
      program.uniforms.uViewProj.set(camera.viewProjection(renderer.aspect));
      program.uniforms.uTime.set(t);
      program.draw();
    },
    dispose() {
      program.dispose();
    },
  };
};

export default factory;
