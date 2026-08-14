import assert from 'node:assert/strict';
import test from 'node:test';

import { createRelayOnboardingOverlay } from '../src/onboarding.ts';

type DisposableOverlay = Readonly<{ dispose(): void }>;

const createOverlay = createRelayOnboardingOverlay as unknown as (
  renderer: unknown,
  dependencies: unknown,
) => DisposableOverlay;

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

test('onboarding construction faults roll back every created nested resource in reverse order', () => {
  const cases = [
    ['create-legend-program', ['legend-texture']],
    ['setup-legend-program-position', ['legend-program', 'legend-texture']],
    ['status-canvas-1', ['legend-program', 'legend-texture']],
    ['create-won-texture', ['legend-program', 'legend-texture']],
    ['create-lost-texture', ['won-texture', 'legend-program', 'legend-texture']],
    ['create-status-program', ['lost-texture', 'won-texture', 'legend-program', 'legend-texture']],
    ['setup-status-program-opacity', [
      'status-program',
      'lost-texture',
      'won-texture',
      'legend-program',
      'legend-texture',
    ]],
  ] as const;

  for (const [failureStage, expectedDisposals] of cases) {
    const harness = createFaultHarness(failureStage);
    assert.throws(
      () => createOverlay({} as never, harness.dependencies),
      new RegExp(`injected ${failureStage}`),
    );
    assert.deepEqual(harness.disposed, expectedDisposals, failureStage);
  }
});

test('onboarding disposal attempts every nested resource once when one disposer throws', () => {
  const harness = createFaultHarness(null, 'status-program');
  const overlay = createOverlay({} as never, harness.dependencies);

  assert.throws(() => overlay.dispose(), /dispose status-program/);
  assert.deepEqual(harness.disposed, [
    'status-program',
    'lost-texture',
    'won-texture',
    'legend-program',
    'legend-texture',
  ]);
  overlay.dispose();
  assert.equal(harness.disposed.length, 5);
});

test('onboarding rollback preserves construction failure while attempting every disposer', () => {
  const harness = createFaultHarness('create-status-program', 'won-texture');
  assert.throws(
    () => createOverlay({} as never, harness.dependencies),
    /injected create-status-program/,
  );
  assert.deepEqual(harness.disposed, [
    'lost-texture',
    'won-texture',
    'legend-program',
    'legend-texture',
  ]);
});
