import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isContractValue,
  type RenderDriver,
  type RenderFrame,
  type TargetRequest,
} from './render-contract.ts';

/**
 * Proof that the contract can express a real demo's whole frame, before that demo moves onto it.
 *
 * The frame below is transcribed from the reference demo's renderer — its five passes, its eleven
 * scene draws in their authored order, its two blur directions and its overlay drawn deliberately
 * *after* the post pass. It is not a simplified sketch.
 *
 * The point is to separate two questions that are easy to confuse. "Can the driver do this?" is a
 * design question and this file answers it. "Has the demo been rewritten to use it?" is a
 * transcription question and this file says nothing about it. When the migration lands, this test
 * is what says the shape it lands on was already agreed.
 *
 * Pipeline keys here are names, not imports. Nothing in this file touches a graphics library, which
 * is the same property that lets a second driver exist.
 */

/** Every target the reference frame reads or writes. */
const TARGETS: readonly TargetRequest[] = Object.freeze([
  // Authored at a fixed resolution, deliberately not multisampled: averaging distance across a
  // silhouette gives a value belonging to neither the caster nor what is behind it.
  { key: 'shadow', size: [2_048, 2_048] as const, depth: true, samples: 1 },
  // Depth-sorted geometry, and multisampled because the canvas is — an off-screen target is not by
  // default, and moving the scene into one silently costs its anti-aliasing.
  { key: 'scene', scale: 1, depth: true, samples: 4 },
  { key: 'bloom-a', scale: 0.25 },
  { key: 'bloom-b', scale: 0.25 },
]);

/** Everything that blocks the sun. The floor is absent: it is the receiver, not a caster. */
const CASTERS = ['organic', 'rocks', 'stumps', 'forms', 'creatures', 'orbs'] as const;

/**
 * The scene, in its authored order.
 *
 * The order is load-bearing and the demo's comments say why: the blended passes run once every
 * opaque surface has written depth, the rings sit between the contact shadows and the glows so a
 * light reads as sitting on top of its shadow rather than under it.
 */
const SCENE = [
  'backdrop', 'floor',
  'organic', 'rocks', 'stumps',
  'forms', 'creatures', 'orbs',
  'contacts', 'rings', 'glows',
] as const;

function referenceFrame(exposure: number, bloomStrength: number): RenderFrame {
  return {
    passes: [
      // Clearing to "nothing occluding". Clearing to zero instead would say every texel holds
      // something at the light's own eye, and the whole scene would fall into shadow.
      { target: 'shadow', clear: [1, 1, 1, 1], draws: CASTERS.map((pipeline) => ({ pipeline })) },
      // Cleared to the authored void colour in linear light, not to transparent black. Missing this
      // turned every pixel outside the floor pure black.
      { target: 'scene', clear: [0.006355, 0.009128, 0.008313, 1], draws: SCENE.map((pipeline) => ({ pipeline })) },
      {
        target: 'bloom-a',
        draws: [{ pipeline: 'bloom-extract', uniforms: { uScene: { target: 'scene' }, uThreshold: 1 } }],
      },
      // Across, then down. The step is in uv and comes from the bloom target's size, not the
      // canvas's — a whole-radius step printed bright singles as a lattice of boxes.
      {
        target: 'bloom-b',
        draws: [{ pipeline: 'bloom-blur', uniforms: { uSource: { target: 'bloom-a' }, uDirection: [0.0052, 0] } }],
      },
      {
        target: 'bloom-a',
        draws: [{ pipeline: 'bloom-blur', uniforms: { uSource: { target: 'bloom-b' }, uDirection: [0, 0.0093] } }],
      },
      {
        draws: [
          {
            pipeline: 'post',
            uniforms: {
              uScene: { target: 'scene' },
              uBloom: { target: 'bloom-a' },
              uBloomStrength: bloomStrength,
              uExposure: exposure,
            },
          },
          // After the post pass, on purpose: the overlay is authored display-space text, and inside
          // the target it would be exposed and tone-mapped along with the scene.
          { pipeline: 'onboarding' },
          { pipeline: 'onboarding-status' },
        ],
      },
    ],
  };
}

function recordingDriver() {
  const order: string[] = [];
  const configured: TargetRequest[] = [];
  const driver: RenderDriver = Object.freeze({
    configureTargets(requests) { configured.push(...requests); },
    submit(frame) {
      for (const pass of frame.passes) {
        order.push(`>${pass.target ?? 'canvas'}${pass.clear ? '!' : ''}`);
        for (const draw of pass.draws) order.push(draw.pipeline);
      }
    },
    dispose() {},
  });
  return { driver, order, configured };
}

test('the contract expresses the reference demo frame, pass for pass', () => {
  const { driver, order, configured } = recordingDriver();
  driver.configureTargets(TARGETS);
  driver.submit(referenceFrame(1.24, 1.35));

  assert.deepEqual(order, [
    '>shadow!', 'organic', 'rocks', 'stumps', 'forms', 'creatures', 'orbs',
    '>scene!', 'backdrop', 'floor', 'organic', 'rocks', 'stumps', 'forms', 'creatures', 'orbs',
    'contacts', 'rings', 'glows',
    '>bloom-a', 'bloom-extract',
    '>bloom-b', 'bloom-blur',
    '>bloom-a', 'bloom-blur',
    '>canvas', 'post', 'onboarding', 'onboarding-status',
  ]);
  assert.equal(configured.length, 4);
});

test('the shadow map is fixed and the bloom chain is not', () => {
  const shadow = TARGETS.find((target) => target.key === 'shadow');
  const bloom = TARGETS.find((target) => target.key === 'bloom-a');
  assert.deepEqual(shadow?.size, [2_048, 2_048]);
  assert.equal(shadow?.scale, undefined, 'a shadow map must not follow the canvas');
  assert.equal(bloom?.scale, 0.25);
  assert.equal(bloom?.size, undefined);
});

test('every caster is also drawn in the scene, and the floor is only a receiver', () => {
  // The one asymmetry in the frame that a careless transcription would flatten.
  for (const caster of CASTERS) {
    assert.ok(SCENE.includes(caster as never), `${caster} casts but is never drawn`);
  }
  assert.ok(SCENE.includes('floor'), 'the floor is drawn');
  assert.ok(!CASTERS.includes('floor' as never), 'the floor receives shadow and must not cast it');
});

test('the whole frame is contract data, with no graphics object anywhere in it', () => {
  const frame = referenceFrame(1.24, 1.35);
  assert.ok(isContractValue(frame), 'the frame carries something that is not contract data');
  assert.ok(isContractValue(TARGETS));
});
