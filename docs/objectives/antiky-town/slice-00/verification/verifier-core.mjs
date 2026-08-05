import assert from 'node:assert/strict';
import { access, chmod, constants, copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

export {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  capturePageAtViewport,
  comparePageCaptures,
  copyTreeExclusive,
  createChromeArguments,
  parseWorkingTreePaths,
} from '../../../../../scripts/verification/browser.mjs';

async function exists(file) {
  return access(file).then(() => true, () => false);
}

function formatRunId(date) {
  return `s00-${date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')}`;
}

export async function copyBaselineArtifacts(source, destination) {
  await copyFile(
    path.join(source, 'baseline.md'),
    path.join(destination, 'baseline.md'),
    constants.COPYFILE_EXCL,
  );
  for (const file of ['baseline-town-ready.png', 'baseline-town.png']) {
    const target = path.join(destination, 'captures', file);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, 'captures', file), target, constants.COPYFILE_EXCL);
    await chmod(target, 0o600);
  }
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

export function assertSnapshotParity(direct, other, label) {
  assert.equal(other.developmentSessionId, direct.developmentSessionId, `${label} session differs`);
  assert.equal(other.acceptedBuildRevision, direct.acceptedBuildRevision, `${label} build differs`);
  assert.equal(other.inspection?.schemaVersion, direct.inspection?.schemaVersion, `${label} schema differs`);
  assert.deepEqual(other.inspection?.runtime, direct.inspection?.runtime, `${label} runtime differs`);
  assert.deepEqual(other.inspection?.diagnostics, direct.inspection?.diagnostics, `${label} diagnostics differ`);
  assert.deepEqual(other.inspection?.measurements.render, direct.inspection?.measurements.render, `${label} render facts differ`);
  assert.equal(other.inspection?.measurements.runtime.owner, 'framework', `${label} runtime owner differs`);
}
