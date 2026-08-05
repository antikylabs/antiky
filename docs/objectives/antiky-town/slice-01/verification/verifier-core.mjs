import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

// Objective fixtures compose the general verification systems without entering product packages.

async function exists(file) {
  return access(file).then(() => true, () => false);
}

export async function selectOpenSlice01Run(outputRoot) {
  const entries = await readdir(outputRoot, { withFileTypes: true }).catch(() => []);
  const open = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^s01-\d{8}T\d{6}Z$/.test(entry.name)) continue;
    const directory = path.join(outputRoot, entry.name);
    if (
      await exists(path.join(directory, 'baseline.json'))
      && !await exists(path.join(directory, 'receipt.json'))
    ) {
      open.push(entry.name);
    }
  }
  if (open.length === 0) throw new Error('No open Slice 01 baseline run exists.');
  if (open.length > 1) throw new Error(`Found multiple open Slice 01 runs: ${open.join(', ')}.`);
  return open[0];
}

export function assertReadyDevelopmentSnapshot(snapshot) {
  assert.equal(snapshot.schemaVersion, 1, 'development schema must be version 1');
  assert.equal(snapshot.processes.game.state, 'running', 'game process must be running');
  assert.equal(snapshot.processes.shaders.state, 'running', 'shader process must be running');
  assert.equal(snapshot.connection.state, 'connected', 'runtime must be connected');
  assert.equal(snapshot.cleanup.state, 'active', 'cleanup ownership must be active');
  assert.equal(snapshot.acceptedBuildRevision, 1, 'initial accepted build revision must be 1');
  assert.equal(snapshot.inspection?.runtime.lifecycle, 'running', 'town must report a running lifecycle');
  assert.ok(snapshot.inspection.measurements.runtime.frameCount > 2, 'running town must advance frames');
  assert.ok(snapshot.inspection.measurements.runtime.framesPerSecond > 0, 'running town must report frame rate');
  const render = snapshot.inspection.measurements.render;
  assert.equal(render.owner, 'framework');
  assert.ok(render.canvasWidth > 0, 'running town must report a positive canvas width');
  assert.ok(render.canvasHeight > 0, 'running town must report a positive canvas height');
  assert.equal(render.drawCalls, 16, 'running town draw count differs');
  assert.equal(render.instances, 1247, 'running town instance count differs');
  assert.equal(render.uploadBytesPerFrame, 1152, 'running town upload count differs');
  assert.deepEqual(snapshot.diagnostics, []);
  assert.deepEqual(snapshot.inspection.diagnostics, []);
}

export function pointLightStateVector(snapshot, entityId) {
  const inspection = snapshot?.inspection?.pointLights;
  assert.ok(inspection, 'The runtime does not publish point-light inspection.');
  const authoring = inspection.authoring.find((candidate) => candidate.entityId === entityId);
  const runtime = inspection.runtime.pointLights.find((candidate) => candidate.entityId === entityId);
  const render = inspection.render.pointLights.find((candidate) => candidate.entityId === entityId);
  assert.ok(authoring, `Point-light authoring state is missing ${entityId}.`);
  assert.ok(runtime, `Point-light runtime state is missing ${entityId}.`);
  assert.ok(render, `Point-light render state is missing ${entityId}.`);
  return Object.freeze({
    authoringPower: authoring.pointLight.power,
    revision: authoring.revision,
    factCount: inspection.facts.filter((fact) => fact.entityId === entityId).length,
    runtimePower: runtime.power,
    renderPower: render.power,
    dirtyCount: inspection.render.dirtySlots.length,
  });
}

export function assertRejectedPointLightState({ before, after, result, expectedCode }) {
  assert.equal(result.code, expectedCode, `Expected ${expectedCode}; received ${result.code}.`);
  assert.equal(result.accepted, false, `${expectedCode} must not be accepted.`);
  assert.deepEqual(after, before, `${expectedCode} changed one of the six protected state values.`);
}

function diffRecord(before = {}, after = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const difference = (after[key] ?? 0) - (before[key] ?? 0);
    if (difference !== 0) result[key] = difference;
  }
  return result;
}

export function gpuCounterDelta(before, after) {
  const submissions = (after.submissions ?? []).filter((submission) => (
    submission.index > (before.queueSubmissions ?? 0)
  ));
  return Object.freeze({
    queueSubmissions: (after.queueSubmissions ?? 0) - (before.queueSubmissions ?? 0),
    drawCalls: submissions.reduce((sum, submission) => sum + (submission.drawCalls ?? 0), 0),
    writeBufferCalls: (after.writeBufferCalls ?? 0) - (before.writeBufferCalls ?? 0),
    writeBufferBytes: (after.writeBufferBytes ?? 0) - (before.writeBufferBytes ?? 0),
    writeTextureCalls: (after.writeTextureCalls ?? 0) - (before.writeTextureCalls ?? 0),
    resources: Object.freeze(diffRecord(before.resources, after.resources)),
    readbackOperations: Object.freeze(diffRecord(
      before.readbackOperations,
      after.readbackOperations,
    )),
  });
}

export function assertIdleGpuDelta(delta) {
  assert.equal(delta.queueSubmissions, 0, 'The paused command added GPU queue submissions.');
  assert.equal(delta.drawCalls, 0, 'The paused command added draw calls.');
  assert.equal(delta.writeBufferCalls, 0, 'The paused command wrote a GPU buffer.');
  assert.equal(delta.writeBufferBytes, 0, 'The paused command wrote GPU bytes.');
  assert.equal(delta.writeTextureCalls, 0, 'The paused command wrote a GPU texture.');
  assert.deepEqual(delta.resources, {}, `The paused command created GPU resources: ${JSON.stringify(delta.resources)}.`);
  assert.deepEqual(
    delta.readbackOperations,
    {},
    `The paused command performed GPU readback: ${JSON.stringify(delta.readbackOperations)}.`,
  );
}

export function assertSteadyGpuMatchesBaseline(current, baseline) {
  assert.equal(
    current.queueSubmissionsPerFrame,
    baseline.queueSubmissionsPerFrame,
    'Steady queue submissions differ from the baseline.',
  );
  assert.equal(
    current.commandBuffersPerFrame,
    baseline.commandBuffersPerFrame,
    'Steady command buffers differ from the baseline.',
  );
  assert.equal(
    current.drawCallsPerFrame,
    baseline.drawCallsPerFrame,
    'Steady draw calls differ from the baseline.',
  );
  assert.equal(
    current.affectedUniformBytesPerFrame,
    baseline.affectedUniformBytesPerFrame,
    'Affected full uniform-block bytes differ from the baseline.',
  );
  assert.deepEqual(
    current.writeBufferBytesPerFrame.uniform,
    baseline.writeBufferBytesPerFrame.uniform,
    'Complete uniform writes differ from the baseline.',
  );
  assert.equal(
    current.readbackOperationsPerFrame?.total?.maximum ?? 0,
    0,
    'Steady rendering performed a GPU readback.',
  );

  const baselineResources = baseline.resourceCreationsPerFrame ?? {};
  for (const [kind, sample] of Object.entries(current.resourceCreationsPerFrame ?? {})) {
    const expected = baselineResources[kind];
    if (!expected) {
      assert.equal(sample.maximum, 0, `Steady rendering added resource kind ${kind}.`);
      continue;
    }
    assert.ok(
      sample.maximum <= expected.maximum,
      `Steady ${kind} creation exceeded the baseline maximum.`,
    );
    assert.ok(
      sample.median <= expected.median,
      `Steady ${kind} creation exceeded the baseline median.`,
    );
  }
}
