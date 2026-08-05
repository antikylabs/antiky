import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';

import {
  affectedUniformBlocks,
  gpuProbeSource,
  summarizeGpuProbe,
} from '../scripts/slice-01-gpu-probe.mjs';
import {
  describeProbeProgress,
  extractReferencePointLight,
  formatSlice01RunId,
} from '../scripts/capture-slice-01-baseline.mjs';

function submission(index, drawCalls, uniformWrites, extra = {}) {
  const uniformBytes = Object.entries(uniformWrites)
    .reduce((sum, [bytes, count]) => sum + Number(bytes) * count, 0);
  return {
    index,
    commandBuffers: 1,
    drawCalls,
    writeBufferBytesByKind: { uniform: uniformBytes, vertex: extra.vertexBytes ?? 0 },
    writeBufferCallsByKindAndSize: { uniform: uniformWrites },
    resourcesCreated: extra.resourcesCreated ?? {},
  };
}

function frame(firstIndex) {
  return [
    submission(firstIndex, 6, { 64: 1, 80: 2, 96: 2, 128: 1 }, { vertexBytes: 1152 }),
    submission(firstIndex + 1, 9, {
      256: 1,
      272: 1,
      288: 2,
      304: 1,
      416: 1,
      544: 2,
      608: 1,
    }, { resourcesCreated: { bindGroups: 4 } }),
    submission(firstIndex + 2, 1, { 224: 1 }),
  ];
}

test('the source-derived affected uniform blocks total 2,112 bytes', () => {
  assert.deepEqual(affectedUniformBlocks, [
    { program: 'world', bytes: 544 },
    { program: 'actor-edges', bytes: 544 },
    { program: 'actors', bytes: 608 },
    { program: 'water', bytes: 416 },
  ]);
  assert.equal(affectedUniformBlocks.reduce((sum, block) => sum + block.bytes, 0), 2_112);
});

test('the probe summarizes only complete steady town frames', () => {
  const probe = {
    version: 1,
    installError: null,
    submissions: [submission(10, 3, {}), ...frame(11), ...frame(14)],
  };

  assert.deepEqual(summarizeGpuProbe(probe), {
    observedFrames: 2,
    firstSubmission: 11,
    lastSubmission: 16,
    queueSubmissionsPerFrame: 3,
    commandBuffersPerFrame: 3,
    drawCallsPerFrame: 16,
    writeBufferBytesPerFrame: {
      uniform: { minimum: 4_288, median: 4_288, maximum: 4_288 },
      vertex: { minimum: 1_152, median: 1_152, maximum: 1_152 },
      total: { minimum: 5_440, median: 5_440, maximum: 5_440 },
    },
    uniformWriteCallsBySize: {
      64: 1,
      80: 2,
      96: 2,
      128: 1,
      224: 1,
      256: 1,
      272: 1,
      288: 2,
      304: 1,
      416: 1,
      544: 2,
      608: 1,
    },
    affectedUniformBlocks,
    affectedUniformBytesPerFrame: 2_112,
    affectedUniformWritesPerFrame: { 416: 1, 544: 2, 608: 1 },
    resourceCreationsPerFrame: {
      bindGroups: { minimum: 4, median: 4, maximum: 4 },
    },
    resourcesCreatedDuringWindow: { bindGroups: 8 },
  });
});

test('the probe rejects an incomplete or wrong affected-program sample', () => {
  assert.throws(
    () => summarizeGpuProbe({ version: 1, submissions: [submission(1, 6, {})] }),
    /no complete/i,
  );
  assert.throws(
    () => summarizeGpuProbe({
      version: 1,
      submissions: [
        submission(1, 6, {}),
        submission(2, 9, { 416: 1, 544: 1, 608: 1 }),
        submission(3, 1, {}),
      ],
    }),
    /544 bytes; expected 2/,
  );
});

test('the browser probe installs before the game asks for a WebGPU adapter', () => {
  assert.match(gpuProbeSource, /__antikyGpuProbe/);
  assert.match(gpuProbeSource, /requestAdapter/);
  assert.match(gpuProbeSource, /writeBuffer/);
  assert.match(gpuProbeSource, /beginRenderPass/);
  assert.match(gpuProbeSource, /Object\.defineProperty\(requestAdapterOwner, 'requestAdapter'/);
  assert.doesNotMatch(gpuProbeSource, /Object\.defineProperty\(navigator, 'gpu'/);
});

test('the browser probe installs when navigator.gpu is read-only', async () => {
  const gpuPrototype = {
    async requestAdapter() {
      return null;
    },
  };
  const gpu = Object.create(gpuPrototype);
  const navigator = {};
  Object.defineProperty(navigator, 'gpu', {
    configurable: false,
    enumerable: true,
    value: gpu,
  });
  const context = vm.createContext({ navigator });

  vm.runInContext(gpuProbeSource, context);
  await gpu.requestAdapter();

  assert.equal(context.__antikyGpuProbe.installError, null);
  assert.equal(context.__antikyGpuProbe.adapterRequests, 1);
});

test('the browser probe preserves WebIDL adapter and device identity', async () => {
  const queue = {};
  const device = { queue };
  const adapter = {
    async requestDevice() {
      return device;
    },
  };
  const gpuPrototype = {
    async requestAdapter() {
      return adapter;
    },
  };
  const gpu = Object.create(gpuPrototype);
  const context = vm.createContext({ navigator: { gpu } });

  vm.runInContext(gpuProbeSource, context);
  const measuredAdapter = await gpu.requestAdapter();
  const measuredDevice = await measuredAdapter.requestDevice();

  assert.equal(measuredAdapter, adapter);
  assert.equal(measuredDevice, device);
  assert.equal(measuredDevice.queue, queue);
  assert.equal(context.__antikyGpuProbe.deviceRequests, 1);
});

test('the baseline uses an immutable run ID and reads practical-light slot zero', () => {
  assert.equal(
    formatSlice01RunId(new Date('2026-08-05T02:03:04.567Z')),
    's01-20260805T020304Z',
  );
  assert.deepEqual(extractReferencePointLight(`
    const PRACTICAL_LIGHTS = [
      { position: [-3.565, 4.237, 6.82], radius: 4, power: 1.05, color: [1, 0.52, 0.22] },
    ];
  `), {
    renderSlot: 0,
    position: [-3.565, 4.237, 6.82],
    radius: 4,
    power: 1.05,
    color: [1, 0.52, 0.22],
  });
});

test('a baseline timeout reports the browser and GPU boundary that stalled', () => {
  assert.equal(describeProbeProgress({
    phase: 'error',
    stageError: 'Device setup failed.',
    probe: {
      installError: null,
      adapterRequests: 1,
      deviceRequests: 0,
      queueSubmissions: 0,
    },
  }), 'phase=error; stageError=Device setup failed.; probeInstallError=none; adapterRequests=1; deviceRequests=0; queueSubmissions=0');
});
