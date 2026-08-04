import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

async function exists(file) {
  return access(file).then(() => true, () => false);
}

function formatRunId(date) {
  return `s00-${date.toISOString().replaceAll('-', '').replaceAll(':', '').replace('.000', '')}`;
}

export async function selectRunId(outputs, now = new Date()) {
  const entries = await readdir(outputs, { withFileTypes: true }).catch(() => []);
  const open = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^s00-\d{8}T\d{6}Z$/.test(entry.name)) continue;
    const directory = path.join(outputs, entry.name);
    if (await exists(path.join(directory, 'baseline.md')) && !await exists(path.join(directory, 'receipt.json'))) {
      open.push(entry.name);
    }
  }
  if (open.length > 1) throw new Error(`Found multiple open Slice 00 runs: ${open.join(', ')}.`);
  return open[0] ?? formatRunId(now);
}

export function assertReadySnapshot(snapshot) {
  assert.equal(snapshot.schemaVersion, 1, 'development schema must be version 1');
  assert.equal(snapshot.processes.game.state, 'running', 'game process must be running');
  assert.equal(snapshot.processes.shaders.state, 'running', 'shader process must be running');
  assert.equal(snapshot.connection.state, 'connected', 'runtime must be connected');
  assert.equal(snapshot.cleanup.state, 'active', 'cleanup ownership must be active');
  assert.equal(snapshot.acceptedBuildRevision, 1, 'initial accepted build revision must be 1');
  assert.equal(snapshot.inspection?.runtime.lifecycle, 'running', 'town must report a running lifecycle');
  assert.ok(snapshot.inspection.measurements.runtime.frameCount > 2, 'running town must advance frames');
  assert.ok(snapshot.inspection.measurements.runtime.framesPerSecond > 0, 'running town must report frame rate');
  assert.deepEqual(snapshot.inspection.measurements.render, {
    owner: 'framework',
    canvasWidth: 694,
    canvasHeight: 512,
    drawCalls: 16,
    instances: 1247,
    uploadBytesPerFrame: 1152,
  });
  assert.deepEqual(snapshot.diagnostics, []);
  assert.deepEqual(snapshot.inspection.diagnostics, []);
}

export function assertSnapshotParity(direct, other, label) {
  assert.equal(other.developmentSessionId, direct.developmentSessionId, `${label} session differs`);
  assert.equal(other.acceptedBuildRevision, direct.acceptedBuildRevision, `${label} build differs`);
  assert.equal(other.inspection?.schemaVersion, direct.inspection?.schemaVersion, `${label} schema differs`);
  assert.deepEqual(other.inspection?.runtime, direct.inspection?.runtime, `${label} runtime differs`);
  assert.deepEqual(other.inspection?.diagnostics, direct.inspection?.diagnostics, `${label} diagnostics differ`);
  assert.deepEqual(other.inspection?.measurements.render, direct.inspection?.measurements.render, `${label} render facts differ`);
  assert.equal(other.inspection?.measurements.runtime.owner, 'framework', `${label} runtime owner differs`);
}

export async function assertCaptureHasContent(file) {
  const metadata = await sharp(file).metadata();
  const statistics = await sharp(file).stats();
  const channelStandardDeviation = Math.max(...statistics.channels.slice(0, 3).map((channel) => channel.stdev));
  assert.ok(metadata.width > 0 && metadata.height > 0, 'capture dimensions must be positive');
  assert.ok(channelStandardDeviation >= 8, `capture is visually blank (${channelStandardDeviation.toFixed(3)} channel deviation)`);
  return { width: metadata.width, height: metadata.height, channelStandardDeviation };
}

export async function comparePageCaptures(referenceFile, resultFile) {
  const pixels = async (file) => sharp(file)
    .removeAlpha()
    .resize(96, 60, { fit: 'fill' })
    .raw()
    .toBuffer();
  const [reference, result] = await Promise.all([pixels(referenceFile), pixels(resultFile)]);
  assert.equal(result.length, reference.length, 'page capture sample sizes differ');
  let difference = 0;
  for (let index = 0; index < reference.length; index += 1) {
    difference += Math.abs(reference[index] - result[index]);
  }
  return { similarity: Number((1 - difference / (reference.length * 255)).toFixed(6)) };
}
