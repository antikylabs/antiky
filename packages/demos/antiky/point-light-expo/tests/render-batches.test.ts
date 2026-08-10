import assert from 'node:assert/strict';
import test from 'node:test';

import * as renderBatches from '../src/render-batches.ts';
import * as frameScratch from '../src/frame-scratch.ts';

type RetainedSurfaceData = Readonly<{
  offsets: Float32Array;
  scales: Float32Array;
  colors: Float32Array;
  materials: Float32Array;
  yaws: Float32Array;
  clear(): void;
  setValues(
    index: number,
    offsetX: number, offsetY: number, offsetZ: number,
    scaleX: number, scaleY: number, scaleZ: number,
    red: number, green: number, blue: number,
    roughness: number, metallic: number, emissive: number,
    yaw?: number,
  ): void;
}>;

test('dynamic surface projection mutates retained buffers through scalar setters', () => {
  const factory = (
    renderBatches as typeof renderBatches & {
      createSurfaceInstanceData?: (capacity: number) => RetainedSurfaceData;
    }
  ).createSurfaceInstanceData;
  assert.ok(factory);
  const data = factory(2);
  const references = [data.offsets, data.scales, data.colors, data.materials, data.yaws];
  data.setValues(0, 1, 2, 3, 4, 5, 6, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7);
  data.clear();
  data.setValues(1, 2, 3, 4, 5, 6, 7, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8);
  assert.deepEqual(
    [data.offsets, data.scales, data.colors, data.materials, data.yaws],
    references,
  );
  assert.deepEqual([...data.offsets.slice(3, 6)], [2, 3, 4]);
  assert.equal(data.yaws[1], Math.fround(0.8));
});

test('camera projection mutates one retained vector without tuple allocation', () => {
  const scratch = frameScratch.createRelayFrameScratch();
  const cameraPosition = scratch.cameraPosition;
  frameScratch.setCameraPosition(scratch, 1, 2, 3);
  frameScratch.setCameraPosition(scratch, 4, 5, 6);
  assert.equal(scratch.cameraPosition, cameraPosition);
  assert.deepEqual([...cameraPosition], [4, 5, 6]);
});
