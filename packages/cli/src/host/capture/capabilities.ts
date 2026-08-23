import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { chromium } from 'playwright';

import {
  CAPTURE_BROWSER_REVISION,
  CAPTURE_BROWSER_VERSION,
  CAPTURE_MAX_DURATION_SECONDS,
  CAPTURE_MAX_FRAMES_PER_SECOND,
  CAPTURE_MAX_RETAINED_EVIDENCE,
  CAPTURE_MAX_SEQUENCE_BYTES,
  CAPTURE_MAX_SEQUENCE_FRAMES,
  CAPTURE_MAX_TRACE_ENTRIES,
  CAPTURE_PLAYWRIGHT_VERSION,
  parseCaptureCapabilitiesV1,
  type CaptureCapabilitiesV1,
  type CaptureManagedUnavailableReason,
  type CaptureWebGpuStatus,
} from '../../development/capture/capabilities.ts';

type CaptureDependencyProbe = Readonly<{
  playwrightVersion: string;
  browserRevision: string;
  browserVersion: string;
  browserInstalled: boolean;
}>;

type CaptureCapabilityOptions = Readonly<{
  configuredWidth: number;
  configuredHeight: number;
  interactiveRuntimeConnected: boolean;
  webGpu?: CaptureWebGpuStatus;
  probe?: () => CaptureDependencyProbe;
}>;

const require = createRequire(import.meta.url);

function defaultProbe(): CaptureDependencyProbe {
  const playwrightVersion = (require('playwright/package.json') as { version?: unknown }).version;
  const corePackagePath = require.resolve('playwright-core/package.json');
  const browserManifest = JSON.parse(
    readFileSync(join(dirname(corePackagePath), 'browsers.json'), 'utf8'),
  ) as { browsers?: readonly Readonly<Record<string, unknown>>[] };
  const browser = browserManifest.browsers?.find((entry) => entry.name === 'chromium');
  let browserInstalled = false;
  try {
    browserInstalled = existsSync(chromium.executablePath());
  } catch {
    browserInstalled = false;
  }
  return Object.freeze({
    playwrightVersion: typeof playwrightVersion === 'string' ? playwrightVersion : 'unknown',
    browserRevision: typeof browser?.revision === 'string' ? browser.revision : 'unknown',
    browserVersion: typeof browser?.browserVersion === 'string' ? browser.browserVersion : 'unknown',
    browserInstalled,
  });
}

function unavailableReason(probe: CaptureDependencyProbe): CaptureManagedUnavailableReason | null {
  if (probe.playwrightVersion !== CAPTURE_PLAYWRIGHT_VERSION) return 'playwright-version-mismatch';
  if (
    probe.browserRevision !== CAPTURE_BROWSER_REVISION
    || probe.browserVersion !== CAPTURE_BROWSER_VERSION
  ) return 'browser-version-mismatch';
  if (!probe.browserInstalled) return 'browser-not-installed';
  return null;
}

export function readCaptureCapabilities(options: CaptureCapabilityOptions): CaptureCapabilitiesV1 {
  const probe = (options.probe ?? defaultProbe)();
  const reason = unavailableReason(probe);
  return parseCaptureCapabilitiesV1({
    schemaVersion: 1,
    capabilityRevision: 'capture-v1',
    managedRuntime: {
      available: reason === null,
      unavailableReason: reason,
      provider: 'playwright-chromium',
      playwrightVersion: CAPTURE_PLAYWRIGHT_VERSION,
      browserRevision: CAPTURE_BROWSER_REVISION,
      browserVersion: CAPTURE_BROWSER_VERSION,
    },
    webGpu: options.webGpu ?? { status: 'unknown-until-launch', unavailableReason: null },
    target: {
      kind: 'final-canvas',
      configuredWidth: options.configuredWidth,
      configuredHeight: options.configuredHeight,
    },
    formats: {
      still: 'image/png', sequenceMaster: 'image/png', reviewDerivative: 'video/webm', audio: 'none',
    },
    limits: {
      maximumWidth: 2560,
      maximumHeight: 1440,
      maximumDeviceScaleFactor: 2,
      maximumDurationSeconds: CAPTURE_MAX_DURATION_SECONDS,
      maximumFramesPerSecond: CAPTURE_MAX_FRAMES_PER_SECOND,
      maximumSequenceFrames: CAPTURE_MAX_SEQUENCE_FRAMES,
      maximumTraceEntries: CAPTURE_MAX_TRACE_ENTRIES,
      maximumArtifactBytes: CAPTURE_MAX_SEQUENCE_BYTES,
      maximumRetainedEvidence: CAPTURE_MAX_RETAINED_EVIDENCE,
      retentionScope: 'development-session',
      maximumRetentionAgeSeconds: null,
    },
    presentationInput: {
      supported: true,
      kinds: [
        'key-press', 'key-release', 'pointer-move', 'pointer-press', 'pointer-release',
        'presentation-frame-wait', 'completed-step-wait',
      ],
    },
    interactiveRuntimeConnected: options.interactiveRuntimeConnected,
  });
}
