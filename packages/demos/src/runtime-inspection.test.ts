import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { createDemoInspectionSnapshot } from './runtime-inspection.ts';

test('demo inspection maps real runtime and render facts into the framework contract', () => {
  const snapshot = createDemoInspectionSnapshot({
    runtimeInstanceId: 'runtime-demo-001',
    phase: 'running',
    frameCount: 120,
    framesPerSecond: 60,
    canvasWidth: 1280,
    canvasHeight: 720,
    stats: {
      instances: 1247,
      drawCalls: 16,
      bytesPerFrame: 320,
    },
    error: null,
  });

  assert.equal(snapshot.runtime.lifecycle, 'running');
  assert.deepEqual(snapshot.diagnostics, []);
  assert.deepEqual(snapshot.measurements.runtime, {
    owner: 'framework',
    frameCount: 120,
    framesPerSecond: 60,
  });
  assert.deepEqual(snapshot.measurements.render, {
    owner: 'framework',
    canvasWidth: 1280,
    canvasHeight: 720,
    drawCalls: 16,
    instances: 1247,
    uploadBytesPerFrame: 320,
  });
});

test('demo inspection reports a structured runtime diagnostic without inventing measurements', () => {
  const snapshot = createDemoInspectionSnapshot({
    runtimeInstanceId: 'runtime-demo-error',
    phase: 'error',
    frameCount: 0,
    framesPerSecond: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    stats: {},
    error: 'WebGPU adapter unavailable.',
  });

  assert.equal(snapshot.runtime.lifecycle, 'error');
  assert.deepEqual(snapshot.diagnostics, [{
    id: 'runtime-demo-error:error',
    owner: 'framework',
    source: 'runtime',
    code: 'ANTIKY_RUNTIME_ERROR',
    severity: 'error',
    message: 'WebGPU adapter unavailable.',
    relatedIds: ['runtime-demo-error'],
  }]);
  assert.deepEqual(snapshot.measurements.render, { owner: 'framework' });
});
