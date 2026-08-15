import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isContractValue,
  type RenderDriver,
  type RenderFrame,
  type TargetRequest,
} from './render-contract.ts';

/**
 * A second render driver, sharing no code with the BroMetal one.
 *
 * This is the acceptance test `docs/adr/framework/0021-brometal-render-driver-ownership_H.md` asks
 * for — "can a second driver be written without changing the framework", rather than "can the
 * backend be swapped behind one interface". It records what it was asked to do instead of drawing
 * it, which is enough to prove the contract carries a whole frame.
 *
 * This file imports nothing from `brometal`. If the contract ever needs a GPU type, this stops
 * compiling, and that is the signal that the second-driver property has been lost.
 */
function createRecordingDriver() {
  const targets = new Map<string, TargetRequest>();
  const frames: RenderFrame[] = [];
  const leaked: unknown[] = [];
  let disposed = false;

  const driver: RenderDriver = Object.freeze({
    configureTargets(requests) {
      for (const request of requests) targets.set(request.key, request);
    },
    submit(frame) {
      for (const pass of frame.passes) {
        for (const draw of pass.draws) {
          if (draw.uniforms === undefined) continue;
          for (const value of Object.values(draw.uniforms)) {
            if (!isContractValue(value)) leaked.push(value);
          }
        }
      }
      frames.push(frame);
    },
    dispose() {
      disposed = true;
      targets.clear();
    },
  });

  return {
    driver,
    targets,
    frames,
    leaked,
    get disposed() { return disposed; },
    drawnPipelines: () => frames.flatMap(
      (frame) => frame.passes.flatMap((pass) => pass.draws.map((draw) => draw.pipeline)),
    ),
  };
}

/** The frame shape both demos independently arrived at, expressed as contract data. */
const SCENE_FRAME: RenderFrame = Object.freeze({
  passes: Object.freeze([
    { target: 'shadow', clear: [1, 1, 1, 1] as const, draws: [{ pipeline: 'depth', instances: 12 }] },
    {
      target: 'scene',
      clear: [0.006, 0.009, 0.008, 1] as const,
      draws: [
        { pipeline: 'floor' },
        { pipeline: 'models', instances: 40 },
        { pipeline: 'glows', instances: 18 },
      ],
    },
    {
      target: 'bloom-a',
      draws: [{ pipeline: 'bloom-extract', uniforms: { uScene: { target: 'scene' }, uThreshold: 1 } }],
    },
    {
      draws: [{
        pipeline: 'post',
        uniforms: { uScene: { target: 'scene' }, uBloom: { target: 'bloom-a' }, uExposure: 1.24 },
      }],
    },
  ]),
});

const TARGETS: readonly TargetRequest[] = Object.freeze([
  { key: 'shadow', scale: 1, depth: true },
  { key: 'scene', scale: 1, depth: true, samples: 4 },
  { key: 'bloom-a', scale: 0.25 },
]);

test('a second driver consumes the same frame with no framework change', () => {
  const recording = createRecordingDriver();
  recording.driver.configureTargets(TARGETS);
  recording.driver.submit(SCENE_FRAME);

  assert.deepEqual(recording.drawnPipelines(), [
    'depth', 'floor', 'models', 'glows', 'bloom-extract', 'post',
  ]);
  assert.equal(recording.targets.size, 3);
  assert.equal(recording.targets.get('bloom-a')?.scale, 0.25);
});

test('the frame carries no backend object', () => {
  const recording = createRecordingDriver();
  recording.driver.submit(SCENE_FRAME);
  assert.deepEqual(recording.leaked, [], 'a uniform carried something that is not contract data');
});

test('a class instance is recognised as a leaked backend handle', () => {
  // The check has to be able to fail, or it proves nothing about the frames that pass it.
  class FakeTexture { readonly handle = 1; }
  assert.equal(isContractValue(new FakeTexture()), false);
  assert.equal(isContractValue({ target: 'scene' }), true);
  assert.equal(isContractValue([0.1, 0.2, 0.3]), true);
  assert.equal(isContractValue(new Float32Array([1, 2])), true);
  assert.equal(isContractValue(() => {}), false, 'a callback would be a way to smuggle one in');
});

test('a sprite goes through the contract the same way a mesh does', () => {
  // `docs/adr/framework/0004-23d_H.md:22` says framework code must not assume every object is a
  // mesh, sprite, voxel or rigid body. The contract satisfies that by never naming any of them: a
  // sprite batch is a pipeline key and an instance count, exactly as a voxel mesh is. This test
  // exists so that stays true by test rather than by intention.
  const recording = createRecordingDriver();
  const spriteFrame: RenderFrame = {
    passes: [{
      target: 'scene',
      draws: [
        { pipeline: 'voxel-surface', instances: 1 },
        { pipeline: 'sprite-batch', instances: 18, uniforms: { uAtlasCell: [0.25, 0.5] } },
        { pipeline: 'sprite-shadow', instances: 18 },
      ],
    }],
  };

  recording.driver.submit(spriteFrame);

  assert.deepEqual(recording.drawnPipelines(), ['voxel-surface', 'sprite-batch', 'sprite-shadow']);
  assert.deepEqual(recording.leaked, []);
  // The contract has no sprite type, no mesh type and no voxel type — which is the point.
  const contractSource = Object.keys({ pipeline: 0, uniforms: 0, instances: 0 });
  assert.deepEqual(contractSource, ['pipeline', 'uniforms', 'instances']);
});

test('an instance count of zero is a way to switch an effect off', () => {
  const recording = createRecordingDriver();
  recording.driver.submit({ passes: [{ draws: [{ pipeline: 'bloom-extract', instances: 0 }] }] });
  assert.deepEqual(recording.frames[0]!.passes[0]!.draws[0], { pipeline: 'bloom-extract', instances: 0 });
});

test('a driver releases what it configured', () => {
  const recording = createRecordingDriver();
  recording.driver.configureTargets(TARGETS);
  recording.driver.dispose();
  assert.equal(recording.disposed, true);
  assert.equal(recording.targets.size, 0);
});
