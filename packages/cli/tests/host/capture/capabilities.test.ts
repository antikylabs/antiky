import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  parseCaptureCapabilitiesV1,
} from '../../../src/development/capture/capabilities.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  readCaptureCapabilities,
} from '../../../src/host/capture/capabilities.ts';

test('capture capabilities are strict, immutable, bounded, and launch-free', () => {
  let probeCount = 0;
  const capabilities = readCaptureCapabilities({
    configuredWidth: 1280,
    configuredHeight: 720,
    interactiveRuntimeConnected: false,
    probe: () => {
      probeCount += 1;
      return {
        playwrightVersion: '1.62.1',
        browserRevision: '1234',
        browserVersion: '151.0.7922.34',
        browserInstalled: true,
      };
    },
  });

  assert.equal(probeCount, 1);
  assert.equal(capabilities.managedRuntime.available, true);
  assert.equal(capabilities.webGpu.status, 'unknown-until-launch');
  assert.equal(capabilities.interactiveRuntimeConnected, false);
  assert.deepEqual(capabilities.target, {
    kind: 'final-canvas',
    configuredWidth: 1280,
    configuredHeight: 720,
  });
  assert.ok(Object.isFrozen(capabilities));
  assert.ok(Object.isFrozen(capabilities.limits));
  assert.deepEqual(parseCaptureCapabilitiesV1(structuredClone(capabilities)), capabilities);
  assert.throws(() => parseCaptureCapabilitiesV1({ ...capabilities, executablePath: '/private' }));
  assert.throws(() => parseCaptureCapabilitiesV1({
    ...capabilities,
    limits: { ...capabilities.limits, maximumDurationSeconds: 16 },
  }));
  assert.doesNotMatch(
    JSON.stringify(capabilities),
    /\/Users\/|\/private\/|profile|userAgent|pid|hostname|executablePath/i,
  );
});

test('capture capabilities report pinned dependency failures without raw paths', () => {
  const cases = [
    [{
      playwrightVersion: '1.62.0',
      browserRevision: '1234',
      browserVersion: '151.0.7922.34',
      browserInstalled: true,
    }, 'playwright-version-mismatch'],
    [{
      playwrightVersion: '1.62.1',
      browserRevision: '9999',
      browserVersion: '151.0.7922.34',
      browserInstalled: true,
    }, 'browser-version-mismatch'],
    [{
      playwrightVersion: '1.62.1',
      browserRevision: '1234',
      browserVersion: '151.0.7922.34',
      browserInstalled: false,
    }, 'browser-not-installed'],
  ] as const;

  for (const [probe, expectedReason] of cases) {
    const capabilities = readCaptureCapabilities({
      configuredWidth: 1,
      configuredHeight: 1,
      interactiveRuntimeConnected: true,
      probe: () => probe,
    });
    assert.equal(capabilities.managedRuntime.available, false);
    assert.equal(capabilities.managedRuntime.unavailableReason, expectedReason);
    assert.equal(capabilities.interactiveRuntimeConnected, true);
  }
});
