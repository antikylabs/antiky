import assert from 'node:assert/strict';
import { access, mkdtemp, rm } from 'node:fs/promises';
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

test('managed capture runtime launches one isolated exact-origin browser and cleans it up', async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'antiky-managed-runtime-test-'));
  let runtime: Readonly<{
    state: 'waiting' | 'connected' | 'unavailable';
    runtimeInstanceId: string | null;
    lifecycle: 'ready' | null;
  }> = { state: 'waiting', runtimeInstanceId: null, lifecycle: null };
  const launches: unknown[] = [];
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
