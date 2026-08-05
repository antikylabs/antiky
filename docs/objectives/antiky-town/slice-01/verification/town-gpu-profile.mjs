import spriteShader from '../../../../../packages/demos/src/demos/brometal-town/shaders/town-sprite.shader.gen.ts';
import voxelShader from '../../../../../packages/demos/src/demos/brometal-town/shaders/town-voxel.shader.gen.ts';
import waterShader from '../../../../../packages/demos/src/demos/brometal-town/shaders/town-water.shader.gen.ts';
import {
  selectCompleteGpuFrames,
  summarizeGpuFrames,
  webGpuProbeSource,
} from '../../../../../scripts/verification/webgpu-probe.mjs';

const townFrameDrawPattern = Object.freeze([6, 9, 1]);

export const affectedUniformBlocks = Object.freeze([
  Object.freeze({ program: 'world', bytes: voxelShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'actor-edges', bytes: voxelShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'actors', bytes: spriteShader.layout.uniformBlockSize }),
  Object.freeze({ program: 'water', bytes: waterShader.layout.uniformBlockSize }),
]);

function expectedAffectedWrites() {
  const writes = {};
  for (const block of affectedUniformBlocks) {
    writes[block.bytes] = (writes[block.bytes] ?? 0) + 1;
  }
  return writes;
}

export function summarizeGpuProbe(probe, maximumFrames = 20) {
  const frames = selectCompleteGpuFrames(probe, townFrameDrawPattern, maximumFrames);
  const expected = expectedAffectedWrites();
  for (const submissions of frames) {
    const sceneUniformWrites = submissions[1].writeBufferCallsByKindAndSize?.uniform ?? {};
    for (const [bytes, count] of Object.entries(expected)) {
      if (sceneUniformWrites[bytes] !== count) {
        throw new Error(
          `The scene submission wrote ${sceneUniformWrites[bytes] ?? 0} uniform blocks of ${bytes} bytes; expected ${count}.`,
        );
      }
    }
  }

  const summary = summarizeGpuFrames(probe, {
    drawPattern: townFrameDrawPattern,
    maximumFrames,
  });
  const affectedUniformBytesPerFrame = affectedUniformBlocks.reduce(
    (sum, block) => sum + block.bytes,
    0,
  );
  return Object.freeze({
    ...summary,
    affectedUniformBlocks,
    affectedUniformBytesPerFrame,
    affectedUniformWritesPerFrame: expected,
  });
}

export const gpuProbeSource = webGpuProbeSource;
