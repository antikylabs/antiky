import { createCamera, createCube, createProgram } from 'brometal';
import { forgeVoxelModel, type VoxelModel } from '../art/voxel-forge';
import type { DemoFactory } from '../runtime';
import voxelShader from '../shaders/voxel.shader.gen';

/* The output of a deterministic voxel compiler, drawn as instanced cubes.
 *
 * Click to compile a new seed. The counters show the two numbers that matter to
 * an asset pipeline: how many voxels the primitives authored, and how many
 * survive interior culling to become instances. */

const FOG: [number, number, number] = [0.045, 0.052, 0.075];

const factory: DemoFactory = ({ renderer, pointer, report }) => {
  const program = createProgram(renderer, voxelShader);
  const cube = createCube();
  program.attributes.aPosition.set(cube.positions);
  program.attributes.aNormal.set(cube.normals);
  program.setIndices(cube.indices);
  program.uniforms.uLightDir.set([0.45, 0.8, 0.35]);
  program.uniforms.uFog.set(FOG);
  program.uniforms.uFogDist.set(90);

  const scale = new Float32Array(0);
  let scaleBuffer = scale;

  const upload = (model: VoxelModel) => {
    const count = model.drawn;
    if (scaleBuffer.length !== count * 3) {
      scaleBuffer = new Float32Array(count * 3).fill(1);
    }
    program.instanceAttributes.iOffset.set(model.offsets);
    program.instanceAttributes.iColor.set(model.colors);
    program.instanceAttributes.iScale.set(scaleBuffer);
    report({
      instances: model.drawn,
      drawCalls: 1,
      bytesPerFrame: 64 + 3 * 4 + 3 * 4 + 3 * 4 + 4,
      note: `${model.name} — ${model.authored.toLocaleString()} voxels authored, ${(model.authored - model.drawn).toLocaleString()} culled as interior`,
    });
  };

  let seed = 0x51ed;
  upload(forgeVoxelModel(seed));

  const camera = createCamera({ position: [0, 14, 26] });

  return {
    frame(t) {
      if (pointer.clicked) {
        pointer.clicked = false;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        upload(forgeVoxelModel(seed));
      }

      const spin = t * 0.16 + pointer.dragX * 5;
      const height = 15 + Math.sin(t * 0.21) * 3.5 + pointer.dragY * 16;
      const x = Math.sin(spin) * 38;
      const z = Math.cos(spin) * 38;
      camera.setPosition(x, Math.max(3, height), z);
      camera.lookAt(0, 8, 0);
      program.uniforms.uViewProj.set(camera.viewProjection(renderer.aspect));
      program.uniforms.uCamPos.set([x, Math.max(3, height), z]);
      program.draw();
    },
    dispose() {
      program.dispose();
    },
  };
};

export default factory;
