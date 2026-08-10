import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  createManagedCaptureRuntime,
  isAllowedCaptureUrl,
  type ManagedBrowserLauncher,
} from '../src/host/managed-capture-runtime.ts';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('pinned Chromium encodes captured canvas PNG masters without hanging', async () => {
  let runtime: Readonly<{
    state: 'waiting' | 'connected';
    runtimeInstanceId: string | null;
    lifecycle: 'running' | null;
  }> = { state: 'waiting', runtimeInstanceId: null, lifecycle: null };
  const server = createServer((_request, response) => {
    runtime = {
      state: 'connected',
      runtimeInstanceId: 'runtime-real-encoder-001',
      lifecycle: 'running',
    };
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<canvas id="antiky-game" tabindex="0" width="1280" height="720"></canvas><script>const c=document.querySelector("#antiky-game");const x=c.getContext("2d");x.fillStyle="#102030";x.fillRect(0,0,c.width,c.height);x.fillStyle="#40e0ff";x.fillRect(240,180,800,360);window.addEventListener("keydown",event=>{if(document.activeElement===c&&event.target===c&&event.code==="KeyD"){x.fillStyle="#ff00ff";x.fillRect(0,0,120,120);}});</script>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;
  const managed = createManagedCaptureRuntime({
    gameUrl: origin,
    inspectionUrl: origin,
    configuredWidth: 1280,
    configuredHeight: 720,
    readRuntime: () => runtime,
    timeoutMilliseconds: 5_000,
    pollMilliseconds: 5,
  });

  try {
    const owned = await managed.ensureRuntime({ deviceScaleFactor: 1 });
    const frame = await managed.captureCanvasPng(owned.runtimeInstanceId);
    await managed.performPresentationAction(owned.runtimeInstanceId, {
      kind: 'key-press', code: 'KeyD',
    });
    await managed.performPresentationAction(owned.runtimeInstanceId, {
      kind: 'key-release', code: 'KeyD',
    });
    const keyboardFrame = await managed.captureCanvasPng(owned.runtimeInstanceId);
    assert.notDeepEqual(keyboardFrame, frame);
    let encoderDeadline: ReturnType<typeof setTimeout> | undefined;
    const encoded = await Promise.race([
      managed.encodePngSequence(owned.runtimeInstanceId, [frame, keyboardFrame, frame], 10),
      new Promise<never>((_resolve, reject) => {
        encoderDeadline = setTimeout(
          () => reject(new Error('real encoder did not settle')),
          5_000,
        );
      }),
    ]).finally(() => clearTimeout(encoderDeadline));
    assert.equal(encoded.bytes.subarray(0, 4).toString('hex'), '1a45dfa3');
    assert.equal(encoded.encoder.source, 'png-masters');
  } finally {
    await managed.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('managed capture runtime launches one isolated exact-origin browser and cleans it up', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'antiky-managed-runtime-test-'));
  let runtime: Readonly<{
    state: 'waiting' | 'connected' | 'unavailable';
    runtimeInstanceId: string | null;
    lifecycle: 'ready' | null;
  }> = { state: 'waiting', runtimeInstanceId: null, lifecycle: null };
  const launches: unknown[] = [];
  const presentation: unknown[] = [];
  let closed = 0;
  const launcher: ManagedBrowserLauncher = async (input) => {
    launches.push(input);
    return {
      browserVersion: '151.0.7922.34',
      async navigate(url) {
        assert.equal(url, 'http://127.0.0.1:3010/game');
        runtime = {
          state: 'connected',
          runtimeInstanceId: 'runtime-managed-001',
          lifecycle: 'ready',
        };
      },
      async probeWebGpu() { return true; },
      async captureCanvasPng() { return PNG; },
      async performPresentationAction(action) { presentation.push(action); },
      async waitForPresentationFrame() {},
      async encodePngSequence(frames, framesPerSecond) {
        assert.deepEqual(frames, [PNG]);
        assert.equal(framesPerSecond, 30);
        return {
          bytes: Buffer.from('webm'),
          encoder: {
            name: 'chromium-media-recorder',
            version: '151.0.7922.34',
            codec: 'vp9',
            mimeType: 'video/webm',
            videoBitsPerSecond: 8_000_000,
            source: 'png-masters',
            audio: 'none',
          },
        };
      },
      async close() { closed += 1; },
    };
  };
  const managed = createManagedCaptureRuntime({
    gameUrl: 'http://127.0.0.1:3010/game',
    inspectionUrl: 'http://127.0.0.1:3011',
    configuredWidth: 1280,
    configuredHeight: 720,
    readRuntime: () => runtime,
    launcher,
    profileRoot: temporaryRoot,
    timeoutMilliseconds: 100,
    pollMilliseconds: 1,
  });

  try {
    const result = await managed.ensureRuntime({ deviceScaleFactor: 1 });
    assert.deepEqual(result, {
      runtimeInstanceId: 'runtime-managed-001',
      webGpu: { status: 'available', unavailableReason: null },
    });
    assert.equal(managed.owns('runtime-managed-001'), true);
    assert.deepEqual(await managed.captureCanvasPng('runtime-managed-001'), PNG);
    await managed.performPresentationAction('runtime-managed-001', {
      kind: 'key-press', code: 'KeyD',
    });
    await managed.waitForPresentationFrame('runtime-managed-001');
    assert.deepEqual(presentation, [{ kind: 'key-press', code: 'KeyD' }]);
    const video = await managed.encodePngSequence('runtime-managed-001', [PNG], 30);
    assert.deepEqual(video.bytes, Buffer.from('webm'));
    await assert.rejects(
      () => managed.captureCanvasPng('runtime-other-001'),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'CAPTURE_RUNTIME_DISCONNECTED',
    );
    assert.equal(launches.length, 1);
    const launch = launches[0] as {
      profileDirectory: string;
      allowedOrigins: readonly string[];
      viewport: { width: number; height: number };
      deviceScaleFactor: number;
    };
    assert.deepEqual(launch.allowedOrigins, [
      'http://127.0.0.1:3010',
      'http://127.0.0.1:3011',
    ]);
    assert.deepEqual(launch.viewport, { width: 1280, height: 720 });
    assert.equal(launch.deviceScaleFactor, 1);
    assert.doesNotMatch(JSON.stringify(result), /\/private\/|profile|path|pid|userAgent/i);
    await access(launch.profileDirectory);
    await managed.stop();
    await assert.rejects(() => access(launch.profileDirectory));
    assert.equal(closed, 1);
  } finally {
    await managed.stop();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('managed capture runtime never replaces a connected interactive runtime', async () => {
  let launches = 0;
  const managed = createManagedCaptureRuntime({
    gameUrl: 'http://127.0.0.1:3010/game',
    inspectionUrl: 'http://127.0.0.1:3011',
    configuredWidth: 1,
    configuredHeight: 1,
    readRuntime: () => ({ state: 'connected', runtimeInstanceId: 'runtime-person-001' }),
    launcher: async () => {
      launches += 1;
      throw new Error('not reached');
    },
  });
  try {
    await assert.rejects(
      () => managed.ensureRuntime({ deviceScaleFactor: 1 }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'CAPTURE_RUNTIME_BUSY'
        && !cause.message.includes('runtime-person-001'),
    );
    assert.equal(launches, 0);
  } finally {
    await managed.stop();
  }
});

test('managed capture failures are stable, path-safe, and release partial resources', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'antiky-managed-failure-test-'));
  let closed = 0;
  const managed = createManagedCaptureRuntime({
    gameUrl: 'http://127.0.0.1:3010/game',
    inspectionUrl: 'http://127.0.0.1:3011',
    configuredWidth: 1,
    configuredHeight: 1,
    readRuntime: () => ({ state: 'waiting', runtimeInstanceId: null }),
    profileRoot: temporaryRoot,
    launcher: async () => ({
      browserVersion: '150.0.0.0',
      async navigate() {},
      async probeWebGpu() { return true; },
      async close() { closed += 1; },
    }),
  });
  try {
    await assert.rejects(
      () => managed.ensureRuntime({ deviceScaleFactor: 1 }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'CAPTURE_BROWSER_VERSION_MISMATCH'
        && !/\/private\/|antiky-managed-failure-test-/i.test(cause.message),
    );
    assert.equal(closed, 1);
  } finally {
    await managed.stop();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('managed capture rejects a runtime that publishes the framework error lifecycle', async () => {
  let connectionState: 'waiting' | 'connected' = 'waiting';
  let lifecycle: 'initializing' | 'error' = 'initializing';
  let closed = 0;
  const managed = createManagedCaptureRuntime({
    gameUrl: 'http://127.0.0.1:3010/game',
    inspectionUrl: 'http://127.0.0.1:3011',
    configuredWidth: 1,
    configuredHeight: 1,
    readRuntime: () => ({
      state: connectionState,
      runtimeInstanceId: connectionState === 'connected' ? 'runtime-managed-error-001' : null,
      lifecycle,
    }),
    launcher: async () => ({
      browserVersion: '151.0.7922.34',
      async navigate() {
        connectionState = 'connected';
        lifecycle = 'error';
      },
      async probeWebGpu() { return true; },
      async close() { closed += 1; },
    }),
    timeoutMilliseconds: 10,
    pollMilliseconds: 1,
  });
  try {
    await assert.rejects(
      () => managed.ensureRuntime({ deviceScaleFactor: 1 }),
      (cause: unknown) => cause instanceof AntikyCliError
        && cause.code === 'CAPTURE_RUNTIME_UNAVAILABLE',
    );
    assert.equal(closed, 1);
  } finally {
    await managed.stop();
  }
});

test('capture network policy allows only the two exact loopback origins', () => {
  const allowed = ['http://127.0.0.1:3010', 'http://127.0.0.1:3011'];
  assert.equal(isAllowedCaptureUrl('http://127.0.0.1:3010/game.js', allowed), true);
  assert.equal(isAllowedCaptureUrl('http://127.0.0.1:3011/v1/runtime/snapshot', allowed), true);
  assert.equal(isAllowedCaptureUrl('http://localhost:3010/game.js', allowed), false);
  assert.equal(isAllowedCaptureUrl('https://127.0.0.1:3010/game.js', allowed), false);
  assert.equal(isAllowedCaptureUrl('http://127.0.0.1:3012/game.js', allowed), false);
  assert.equal(isAllowedCaptureUrl('https://example.com/asset.png', allowed), false);
  assert.equal(isAllowedCaptureUrl('file:///private/secret', allowed), false);
});
