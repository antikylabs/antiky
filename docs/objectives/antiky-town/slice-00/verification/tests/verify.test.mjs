import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

import { copyBaselineArtifacts } from '../verifier-core.mjs';

import {
  assertCaptureHasContent,
  assertChromeNetworkIsolation,
  assertReadySnapshot,
  assertSnapshotParity,
  capturePageAtViewport,
  comparePageCaptures,
  createChromeArguments,
  parseWorkingTreePaths,
  selectRunId,
} from '../verify.mjs';

function readySnapshot(runtimeInstanceId = 'runtime-001') {
  return {
    schemaVersion: 1,
    developmentSessionId: 'development-001',
    acceptedBuildRevision: 1,
    processes: {
      game: { state: 'running', pid: 101 },
      shaders: { state: 'running', pid: 102 },
    },
    connection: { state: 'connected' },
    cleanup: { state: 'active' },
    diagnostics: [],
    inspection: {
      schemaVersion: 1,
      runtime: { instanceId: runtimeInstanceId, lifecycle: 'running' },
      diagnostics: [],
      measurements: {
        runtime: { owner: 'framework', frameCount: 120, framesPerSecond: 60 },
        render: {
          owner: 'framework',
          canvasWidth: 1280,
          canvasHeight: 720,
          drawCalls: 16,
          instances: 1247,
          uploadBytesPerFrame: 1152,
        },
      },
    },
  };
}

test('ready-state validation requires the running town and exact reference measurements', () => {
  assert.doesNotThrow(() => assertReadySnapshot(readySnapshot()));
  const blankPreview = structuredClone(readySnapshot());
  blankPreview.inspection.runtime.lifecycle = 'ready';
  blankPreview.inspection.measurements.runtime.frameCount = 2;
  blankPreview.inspection.measurements.runtime.framesPerSecond = 0;

  assert.throws(
    () => assertReadySnapshot(blankPreview),
    /running lifecycle/,
  );
});

test('the complete verifier uses the focused host and tools-only HTTP MCP surface', async () => {
  const source = await readFile(new URL('../verify.mjs', import.meta.url), 'utf8');

  assert.match(source, /const gameUrl = 'http:\/\/127\.0\.0\.1:3010\/'/);
  assert.match(source, /packages\/cli\/src\/development\/client\.ts/);
  assert.match(source, /name: 'get_runtime_status'/);
  assert.match(source, /mcpUrl/);
  assert.doesNotMatch(source, /packages\/cli\/src\/client\.ts/);
  assert.doesNotMatch(source, /resources\/(?:list|read)|requiredResources|antiky:\/\//);
  assert.doesNotMatch(source, /\/demos\/town-study/);
});

test('client parity compares the shared identities and complete inspection snapshot', () => {
  const direct = readySnapshot();
  assert.doesNotThrow(() => assertSnapshotParity(direct, structuredClone(direct), 'CLI'));
  const stale = structuredClone(direct);
  stale.acceptedBuildRevision = 2;
  assert.throws(() => assertSnapshotParity(direct, stale, 'MCP'), /MCP/);
});

test('capture validation rejects a valid but visually blank PNG', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'antiky-capture-test-'));
  const blank = path.join(directory, 'blank.png');
  const varied = path.join(directory, 'varied.png');
  await sharp({
    create: { width: 32, height: 32, channels: 4, background: '#0d0a0cff' },
  }).png().toFile(blank);
  const pixels = Buffer.alloc(32 * 32 * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    const value = (index / 4) % 2 === 0 ? 20 : 230;
    pixels[index] = value;
    pixels[index + 1] = 120;
    pixels[index + 2] = 255 - value;
    pixels[index + 3] = 255;
  }
  await sharp(pixels, { raw: { width: 32, height: 32, channels: 4 } }).png().toFile(varied);

  await assert.rejects(assertCaptureHasContent(blank), /visually blank/);
  await assert.doesNotReject(assertCaptureHasContent(varied));
});

test('page comparison reports identical captures as one and unrelated captures below threshold', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'antiky-page-test-'));
  const dark = path.join(directory, 'dark.png');
  const light = path.join(directory, 'light.png');
  await sharp({ create: { width: 64, height: 40, channels: 3, background: '#101010' } }).png().toFile(dark);
  await sharp({ create: { width: 64, height: 40, channels: 3, background: '#f0f0f0' } }).png().toFile(light);

  assert.equal((await comparePageCaptures(dark, dark)).similarity, 1);
  assert.ok((await comparePageCaptures(dark, light)).similarity < 0.2);
});

test('run selection resumes one open baseline and rejects ambiguous open runs', async () => {
  const outputs = await mkdtemp(path.join(os.tmpdir(), 'antiky-runs-'));
  const first = 's00-20260804T185103Z';
  await mkdir(path.join(outputs, first));
  await writeFile(path.join(outputs, first, 'baseline.md'), '# baseline\n');
  assert.equal(await selectRunId(outputs, new Date('2026-08-04T21:00:00Z')), first);

  const second = 's00-20260804T190000Z';
  await mkdir(path.join(outputs, second));
  await writeFile(path.join(outputs, second, 'baseline.md'), '# baseline\n');
  await assert.rejects(selectRunId(outputs, new Date()), /multiple open Slice 00 runs/);
});

test('new run IDs discard timestamp milliseconds', async () => {
  const outputs = await mkdtemp(path.join(os.tmpdir(), 'antiky-run-id-'));

  assert.equal(
    await selectRunId(outputs, new Date('2026-08-04T21:00:00.321Z')),
    's00-20260804T210000Z',
  );
});

test('Git porcelain parsing preserves the leading worktree status column', () => {
  assert.deepEqual(
    parseWorkingTreePaths(' M docs/adr/UNDER_REVIEW_A.md\n?? docs/user-facing-docs/studio/.gitkeep\n'),
    ['docs/adr/UNDER_REVIEW_A.md', 'docs/user-facing-docs/studio/.gitkeep'],
  );
});

test('page capture requests an explicit baseline-sized CDP clip', async () => {
  const calls = [];
  const cdp = {
    async send(method, params) {
      calls.push({ method, params });
      return { data: 'fixture-base64' };
    },
  };

  assert.equal(await capturePageAtViewport(cdp, 756, 469), 'fixture-base64');
  assert.deepEqual(calls, [{
    method: 'Page.captureScreenshot',
    params: {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 756, height: 469, scale: 1 },
    },
  }]);
});

test('Chrome is constrained to loopback and a successful external response fails evidence', () => {
  const args = createChromeArguments({
    profile: '/tmp/antiky-s00-chrome-fixture',
    gameUrl: 'http://127.0.0.1:3010/demos/town-study',
  });
  assert.ok(args.includes('--proxy-server=http://127.0.0.1:9'));
  assert.ok(args.includes('--proxy-bypass-list=127.0.0.1'));
  assert.ok(args.includes('--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1'));
  assert.doesNotThrow(() => assertChromeNetworkIsolation('net::ERR_PROXY_CONNECTION_FAILED'));
  assert.throws(
    () => assertChromeNetworkIsolation('Registration response error message: DEPRECATED_ENDPOINT'),
    /external endpoint response/,
  );
});

test('a replacement run receives immutable copies of the canonical baseline', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'antiky-baseline-copy-'));
  const source = path.join(directory, 'source');
  const destination = path.join(directory, 'destination');
  await mkdir(path.join(source, 'captures'), { recursive: true });
  await mkdir(path.join(destination, 'captures'), { recursive: true });
  await writeFile(path.join(source, 'baseline.md'), '# baseline\n');
  await writeFile(path.join(source, 'captures/baseline-town-ready.png'), 'ready');
  await writeFile(path.join(source, 'captures/baseline-town.png'), 'town');

  await copyBaselineArtifacts(source, destination);

  assert.equal(await readFile(path.join(destination, 'baseline.md'), 'utf8'), '# baseline\n');
  assert.equal(await readFile(path.join(destination, 'captures/baseline-town-ready.png'), 'utf8'), 'ready');
  await assert.rejects(copyBaselineArtifacts(source, destination), { code: 'EEXIST' });
});
