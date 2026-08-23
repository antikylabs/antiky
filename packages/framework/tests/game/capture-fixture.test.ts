import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  CaptureFixtureValidationError,
  createCaptureFixtureController,
  parseCaptureFixtureRequest,
  parseCaptureFixtureResult,
} from '../../src/game/capture-fixture.ts';

const controls = [
  { kind: 'scene-visibility', group: 'effects', visible: false },
  { kind: 'camera-translation', delta: { x: 1, y: 0, z: -1 } },
  { kind: 'variant', name: 'bloom', enabled: true },
] as const;

test('capture fixture requests are semantic, bounded, exact, and deeply immutable', () => {
  const request = parseCaptureFixtureRequest({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls,
  });

  assert.deepEqual(request, { schemaVersion: 1, fixtureName: 'goal-19-evidence', controls });
  assert.ok(Object.isFrozen(request));
  assert.ok(Object.isFrozen(request.controls));
  assert.ok(request.controls.every(Object.isFrozen));
  assert.ok(Object.isFrozen(request.controls[1]!.delta));

  for (const invalid of [
    { ...request, script: 'renderer.draw()' },
    { ...request, controls: [{ kind: 'renderer-call', name: 'draw' }] },
    { ...request, controls: [{ kind: 'camera-translation', delta: { x: 101, y: 0, z: 0 } }] },
    { ...request, controls: [{ kind: 'variant', name: '../bloom', enabled: true }] },
    { ...request, controls: [] },
    { ...request, controls: Array.from({ length: 9 }, () => controls[0]) },
  ]) assert.throws(
    () => parseCaptureFixtureRequest(invalid),
    (cause: unknown) => cause instanceof CaptureFixtureValidationError,
  );
});

test('a game declaration owns fixture names, camera bounds, and presentation state', () => {
  const controller = createCaptureFixtureController({
    fixtureName: 'goal-19-evidence',
    sceneGroups: { effects: true },
    variants: { bloom: true },
    maximumCameraTranslation: 0.5,
  });
  controller.apply(parseCaptureFixtureRequest({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [
      { kind: 'scene-visibility', group: 'effects', visible: false },
      { kind: 'camera-translation', delta: { x: 0.5, y: 0, z: 0 } },
      { kind: 'variant', name: 'bloom', enabled: false },
    ],
  }));
  assert.deepEqual(controller.read(), {
    sceneVisibility: { effects: false },
    variants: { bloom: false },
    cameraTranslation: { x: 0.5, y: 0, z: 0 },
  });
  assert.throws(() => controller.apply(parseCaptureFixtureRequest({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'camera-translation', delta: { x: 0.51, y: 0, z: 0 } }],
  })));
  assert.throws(() => controller.apply(parseCaptureFixtureRequest({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls: [{ kind: 'variant', name: 'unknown', enabled: true }],
  })));
});

test('capture fixture results must exactly echo an applied request', () => {
  const request = parseCaptureFixtureRequest({
    schemaVersion: 1,
    fixtureName: 'goal-19-evidence',
    controls,
  });
  const result = parseCaptureFixtureResult({
    schemaVersion: 1,
    fixtureName: request.fixtureName,
    appliedControls: request.controls,
  }, request);
  assert.deepEqual(result.appliedControls, request.controls);
  assert.ok(Object.isFrozen(result));
  assert.throws(() => parseCaptureFixtureResult({
    ...result,
    appliedControls: result.appliedControls.slice(1),
  }, request));
  assert.throws(() => parseCaptureFixtureResult({ ...result, simulationState: {} }, request));
});
