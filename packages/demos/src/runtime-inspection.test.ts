import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEngineSession,
  createPointLightAuthoringService,
  inspectPointLightService,
  parseSessionId,
  parseWorldId,
} from '@antiky/framework';

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
    errorCode: 'gpu-device-lost',
  });

  assert.equal(snapshot.runtime.lifecycle, 'error');
  assert.deepEqual(snapshot.diagnostics, [{
    id: 'runtime-demo-error:error',
    owner: 'framework',
    source: 'runtime',
    code: 'ANTIKY_BROMETAL_GPU_DEVICE_LOST',
    severity: 'error',
    message: 'WebGPU adapter unavailable.',
    relatedIds: ['runtime-demo-error'],
  }]);
  assert.deepEqual(snapshot.measurements.render, { owner: 'framework' });
});

test('demo inspection publishes point lights through the semantic world and event views', () => {
  const service = createPointLightAuthoringService({
    worldId: '018f0f3a-7b2c-7a1d-8e2f-123456789abc',
    pointLights: [{
      entityId: '018f0f3a-7b2c-7a1d-8e2f-123456789abd',
      label: 'Harbor Lamp',
      revision: 1,
      transform: { schemaVersion: 1 },
      pointLight: { schemaVersion: 1 },
    }],
    runtimeInstanceId: 'runtime-demo-lights',
    renderBindings: [],
  });
  const pointLights = inspectPointLightService(service);
  const snapshot = createDemoInspectionSnapshot({
    runtimeInstanceId: 'runtime-demo-lights',
    phase: 'running',
    frameCount: 1,
    framesPerSecond: 0,
    canvasWidth: 1,
    canvasHeight: 1,
    stats: {},
    error: null,
    pointLights,
  });

  assert.deepEqual(snapshot.pointLights, pointLights);
  assert.equal(snapshot.world?.worldId, pointLights.worldId);
  assert.deepEqual(
    snapshot.world?.entities.map((entity) => entity.entityId),
    ['018f0f3a-7b2c-7a1d-8e2f-123456789abd'],
  );
  assert.deepEqual(
    new Set(snapshot.world?.stores.map((store) => store.kind)),
    new Set(['authoring', 'runtime', 'render']),
  );
  assert.equal(snapshot.events?.sourceId, 'antiky.point-light-authoring');
  assert.deepEqual(snapshot.events?.events, []);
  service.dispose();
});

test('demo inspection publishes an available session status unchanged', () => {
  const session = createEngineSession({
    sessionId: parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0'),
    worldId: parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc'),
    runtimeInstanceId: 'runtime-demo-session',
    systems: [{ id: 'town-update', run: () => undefined }],
    captureInput: () => Object.freeze({}),
  });
  session.pause('tool');
  const status = session.readStatus();
  const snapshot = createDemoInspectionSnapshot({
    runtimeInstanceId: 'runtime-demo-session',
    phase: 'paused',
    frameCount: 3,
    framesPerSecond: 0,
    canvasWidth: 1,
    canvasHeight: 1,
    stats: {},
    error: null,
    session: status,
  });

  assert.deepEqual(snapshot.session, status);
  session.dispose();
});
