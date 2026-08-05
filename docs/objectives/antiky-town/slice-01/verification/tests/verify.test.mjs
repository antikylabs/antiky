import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertIdleGpuDelta,
  assertRejectedPointLightState,
  assertSteadyGpuMatchesBaseline,
  gpuCounterDelta,
  pointLightStateVector,
  selectOpenSlice01Run,
} from '../verifier-core.mjs';

const entityId = '018f0f3a-7b2c-7a1d-8e2f-123456789abd';

function snapshot({ power = 1.05, revision = 1, facts = [], dirtySlots = [] } = {}) {
  return {
    inspection: {
      pointLights: {
        authoring: [{ entityId, revision, pointLight: { power } }],
        runtime: { pointLights: [{ entityId, revision, power }] },
        render: { pointLights: [{ entityId, renderSlot: 0, revision, power }], dirtySlots },
        facts,
      },
    },
  };
}

function steady(overrides = {}) {
  return {
    queueSubmissionsPerFrame: 3,
    commandBuffersPerFrame: 3,
    drawCallsPerFrame: 16,
    affectedUniformBytesPerFrame: 2_112,
    writeBufferBytesPerFrame: { uniform: { minimum: 4_288, median: 4_288, maximum: 4_288 } },
    readbackOperationsPerFrame: { total: { minimum: 0, median: 0, maximum: 0 } },
    resourceCreationsPerFrame: {
      buffers: { minimum: 0, median: 0, maximum: 8 },
      bindGroups: { minimum: 14, median: 14, maximum: 14 },
    },
    ...overrides,
  };
}

test('the state vector compares all six no-change values required for a rejection', () => {
  const before = pointLightStateVector(snapshot(), entityId);
  assert.deepEqual(before, {
    authoringPower: 1.05,
    revision: 1,
    factCount: 0,
    runtimePower: 1.05,
    renderPower: 1.05,
    dirtyCount: 0,
  });
  assert.doesNotThrow(() => assertRejectedPointLightState({
    before,
    after: structuredClone(before),
    result: { code: 'STALE_REVISION', accepted: false },
    expectedCode: 'STALE_REVISION',
  }));

  assert.throws(() => assertRejectedPointLightState({
    before,
    after: { ...before, dirtyCount: 1 },
    result: { code: 'STALE_REVISION', accepted: false },
    expectedCode: 'STALE_REVISION',
  }), /dirtyCount/);
});

test('the paused command window must have no GPU work, resource creation, or readback', () => {
  const before = {
    queueSubmissions: 120,
    writeBufferCalls: 500,
    writeBufferBytes: 42_000,
    writeTextureCalls: 3,
    resources: { buffers: 20, bindGroups: 100 },
    readbackOperations: {},
    submissions: [],
  };
  assert.doesNotThrow(() => assertIdleGpuDelta(gpuCounterDelta(before, structuredClone(before))));

  const after = structuredClone(before);
  after.resources.textures = 1;
  assert.throws(() => assertIdleGpuDelta(gpuCounterDelta(before, after)), /textures/);
});

test('steady changed and corrected frames must match the baseline envelope', () => {
  assert.doesNotThrow(() => assertSteadyGpuMatchesBaseline(steady(), steady()));
  assert.throws(
    () => assertSteadyGpuMatchesBaseline(steady({ drawCallsPerFrame: 17 }), steady()),
    /draw calls/,
  );
  assert.throws(
    () => assertSteadyGpuMatchesBaseline(steady({
      resourceCreationsPerFrame: {
        buffers: { minimum: 0, median: 0, maximum: 8 },
        bindGroups: { minimum: 14, median: 14, maximum: 14 },
        textures: { minimum: 1, median: 1, maximum: 1 },
      },
    }), steady()),
    /resource kind textures/,
  );
  assert.throws(
    () => assertSteadyGpuMatchesBaseline(steady({
      readbackOperationsPerFrame: { total: { minimum: 0, median: 0, maximum: 1 } },
    }), steady()),
    /readback/,
  );
});

test('run selection resumes exactly one open Slice 01 baseline', async () => {
  const outputs = await mkdtemp(path.join(os.tmpdir(), 'antiky-s01-runs-'));
  const first = 's01-20260805T014602Z';
  await mkdir(path.join(outputs, first));
  await writeFile(path.join(outputs, first, 'baseline.json'), '{}\n');
  assert.equal(await selectOpenSlice01Run(outputs), first);

  const second = 's01-20260805T020000Z';
  await mkdir(path.join(outputs, second));
  await writeFile(path.join(outputs, second, 'baseline.json'), '{}\n');
  await assert.rejects(selectOpenSlice01Run(outputs), /multiple open Slice 01 runs/);
});

test('the complete verifier uses one Antiky dev start, tools-only MCP, and GPU evidence', async () => {
  const source = await readFile(new URL('../verify.mjs', import.meta.url), 'utf8');
  const packageJson = JSON.parse(await readFile(
    new URL('../../../../../../package.json', import.meta.url),
    'utf8',
  ));

  assert.match(
    packageJson.scripts['verify:slice-01'],
    /docs\/objectives\/antiky-town\/slice-01\/verification\/verify\.mjs/,
  );
  assert.match(source, /args: \['run', 'antiky', 'dev'\]/);
  assert.match(source, /set_point_light_power/);
  assert.match(source, /correct_point_light_power/);
  assert.match(source, /summarizeGpuProbe/);
  assert.match(source, /dev_reload/);
  assert.doesNotMatch(source, /resources\/(?:list|read)/);
});
