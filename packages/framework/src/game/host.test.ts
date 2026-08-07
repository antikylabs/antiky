import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { createGameInspectionSnapshot } from './host.ts';

test('game inspection snapshots combine host-owned lifecycle and measurements', () => {
  const snapshot = createGameInspectionSnapshot({
    runtimeInstanceId: 'runtime-game-host-001',
    lifecycle: 'error',
    frameCount: 42,
    framesPerSecond: 59.5,
    canvasWidth: 1920,
    canvasHeight: 1080,
    measurements: {
      instances: 18,
      drawCalls: 3,
      uploadBytesPerFrame: 768,
      note: 'reference frame',
    },
    error: {
      code: 'ANTIKY_GAME_FRAME_FAILED',
      message: 'The game frame failed.',
    },
  });

  assert.deepEqual(snapshot.runtime, {
    instanceId: 'runtime-game-host-001',
    lifecycle: 'error',
  });
  assert.deepEqual(snapshot.measurements, {
    runtime: {
      owner: 'framework',
      frameCount: 42,
      framesPerSecond: 59.5,
    },
    render: {
      owner: 'framework',
      canvasWidth: 1920,
      canvasHeight: 1080,
      drawCalls: 3,
      instances: 18,
      uploadBytesPerFrame: 768,
    },
  });
  assert.equal(snapshot.diagnostics[0]?.code, 'ANTIKY_GAME_FRAME_FAILED');
  assert.equal(snapshot.diagnostics[0]?.message, 'The game frame failed.');
});
