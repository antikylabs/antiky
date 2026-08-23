import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelayOnboardingOverlay } from '../src/onboarding.ts';

function fakeCanvas() {
  return {
    canvas: {},
    context: {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      textAlign: '',
      textBaseline: '',
      font: '',
      shadowColor: '',
      shadowBlur: 0,
      fillRect() {},
      strokeRect() {},
      fillText() {},
      createRadialGradient() { return { addColorStop() {} }; },
    },
  };
}

function createFaultHarness(failureStage: string | null, disposalFailure: string | null = null) {
  const disposed: string[] = [];
  let textureIndex = 0;
  let programIndex = 0;
  let canvasIndex = 0;
  const fail = (stage: string): void => {
    if (failureStage === stage) throw new Error(`injected ${stage}`);
  };
  const disposable = (label: string) => ({
    dispose(): void {
      disposed.push(label);
      if (disposalFailure === label) throw new Error(`dispose ${label}`);
    },
  });
  const dependencies = {
    createCanvas() {
      const label = canvasIndex === 0 ? 'legend-canvas' : `status-canvas-${canvasIndex}`;
      canvasIndex += 1;
      fail(label);
      return fakeCanvas();
    },
    createTexture() {
      const labels = ['legend-texture', 'won-texture', 'lost-texture'];
      const label = labels[textureIndex++]!;
      fail(`create-${label}`);
      return disposable(label);
    },
    createProgram() {
      const label = programIndex++ === 0 ? 'legend-program' : 'status-program';
      fail(`create-${label}`);
      const uniform = (name: string) => ({ set() { fail(`setup-${label}-${name}`); } });
      return {
        ...disposable(label),
        attributes: {
          aPosition: uniform('position'),
          aUv: uniform('uv'),
        },
        uniforms: {
          uAtlas: uniform('atlas'),
          uScale: uniform('scale'),
          uOffset: uniform('offset'),
          uOpacity: uniform('opacity'),
        },
        setIndices() { fail(`setup-${label}-indices`); },
        draw() {},
      };
    },
  };
  return { dependencies, disposed };
}

/**
 * The overlay creates no GPU resource any more, so there is nothing here to roll back.
 *
 * It used to build two programs and three textures and own their disposal, and the three tests this
 * replaces injected fakes to prove a failed construction released what it had already made. That
 * responsibility moved to the render driver, which owns every program and texture and is asserted
 * against the same failures in `packages/framework/tests/render/brometal-driver.test.ts`.
 *
 * What is still this module's job, and what these assert: it paints its canvases and describes what
 * it needs. A canvas it fails to paint is a blank panel, and nothing else would catch that.
 */
test('the overlay paints a legend and two result plates, and describes them as textures', () => {
  const overlay = createRelayOnboardingOverlay({ createCanvas: () => fakeCanvas() as never });

  assert.deepEqual(
    Object.keys(overlay.textures).sort(),
    ['onboarding-legend', 'onboarding-lost', 'onboarding-won'],
  );
  for (const [key, source] of Object.entries(overlay.textures)) {
    assert.ok(source.source !== undefined, `${key} was described without a painted canvas`);
    assert.equal(source.url, undefined, `${key} is painted here, not fetched`);
  }
});

test('the overlay reports a fault from the canvas it cannot create', () => {
  // The one error this module still owns. A host with no 2D context gets a named failure rather
  // than a silently blank panel.
  assert.throws(
    () => createRelayOnboardingOverlay({
      createCanvas: (_width, _height, message) => { throw new Error(message); },
    }),
    /Unable to create the Blackout Relay control legend/,
  );
});

test('the result plate is hidden while playing and fades once the run ends', () => {
  const overlay = createRelayOnboardingOverlay({ createCanvas: () => fakeCanvas() as never });

  const playing = overlay.statusUniforms('playing', 3)!;
  assert.equal(playing.uOpacity, 0);
  // Bound even while invisible: an unbound sampler is a rejected draw, not a hidden panel.
  assert.deepEqual(playing.uAtlas, { texture: 'onboarding-won' });
  const won = overlay.statusUniforms('won', 3)!;
  assert.deepEqual(won.uAtlas, { texture: 'onboarding-won' });
  assert.ok((won.uOpacity as number) > 0.87);
  const lost = overlay.statusUniforms('lost', 3)!;
  assert.deepEqual(lost.uAtlas, { texture: 'onboarding-lost' });
});
