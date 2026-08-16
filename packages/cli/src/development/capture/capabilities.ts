import { AntikyCliError } from '../../errors.ts';

export const CAPTURE_PLAYWRIGHT_VERSION = '1.62.1' as const;
export const CAPTURE_BROWSER_REVISION = '1234' as const;
export const CAPTURE_BROWSER_VERSION = '151.0.7922.34' as const;
export const CAPTURE_MAX_DURATION_SECONDS = 6;
export const CAPTURE_MAX_FRAMES_PER_SECOND = 30;
export const CAPTURE_MAX_SEQUENCE_FRAMES = 180;
export const CAPTURE_MAX_TRACE_ENTRIES = 512;
export const CAPTURE_MAX_SEQUENCE_BYTES = 256 * 1024 * 1024;
export const CAPTURE_MAX_RETAINED_EVIDENCE = 32;

export type CaptureManagedUnavailableReason =
  | 'playwright-version-mismatch'
  | 'browser-version-mismatch'
  | 'browser-not-installed';

export type CaptureWebGpuStatus = Readonly<{
  status: 'unknown-until-launch' | 'available' | 'unavailable';
  unavailableReason:
    | 'adapter-unavailable'
    | 'device-unavailable'
    | 'initialization-failed'
    | null;
}>;

export type CaptureCapabilitiesV1 = Readonly<{
  schemaVersion: 1;
  capabilityRevision: 'capture-v1';
  managedRuntime: Readonly<{
    available: boolean;
    unavailableReason: CaptureManagedUnavailableReason | null;
    provider: 'playwright-chromium';
    playwrightVersion: typeof CAPTURE_PLAYWRIGHT_VERSION;
    browserRevision: typeof CAPTURE_BROWSER_REVISION;
    browserVersion: typeof CAPTURE_BROWSER_VERSION;
  }>;
  webGpu: CaptureWebGpuStatus;
  target: Readonly<{
    kind: 'final-canvas';
    configuredWidth: number;
    configuredHeight: number;
  }>;
  formats: Readonly<{
    still: 'image/png';
    sequenceMaster: 'image/png';
    reviewDerivative: 'video/webm';
    audio: 'none';
  }>;
  limits: Readonly<{
    maximumWidth: 2560;
    maximumHeight: 1440;
    maximumDeviceScaleFactor: 2;
    maximumDurationSeconds: typeof CAPTURE_MAX_DURATION_SECONDS;
    maximumFramesPerSecond: typeof CAPTURE_MAX_FRAMES_PER_SECOND;
    maximumSequenceFrames: typeof CAPTURE_MAX_SEQUENCE_FRAMES;
    maximumTraceEntries: typeof CAPTURE_MAX_TRACE_ENTRIES;
    maximumArtifactBytes: typeof CAPTURE_MAX_SEQUENCE_BYTES;
    maximumRetainedEvidence: typeof CAPTURE_MAX_RETAINED_EVIDENCE;
    retentionScope: 'development-session';
    maximumRetentionAgeSeconds: null;
  }>;
  presentationInput: Readonly<{
    supported: true;
    kinds: readonly [
      'key-press',
      'key-release',
      'pointer-move',
      'pointer-press',
      'pointer-release',
      'presentation-frame-wait',
      'completed-step-wait',
    ];
  }>;
  interactiveRuntimeConnected: boolean;
}>;

type UnknownRecord = Record<string, unknown>;

function invalid(path: string): never {
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', 'Capture capabilities are incompatible.', path);
}

function object(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  return value as UnknownRecord;
}

function exact(record: UnknownRecord, fields: readonly string[], path: string): void {
  const keys = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    invalid(path);
  }
}

function positiveInteger(value: unknown, maximum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    invalid(path);
  }
  return value as number;
}

const INPUT_KINDS = Object.freeze([
  'key-press',
  'key-release',
  'pointer-move',
  'pointer-press',
  'pointer-release',
  'presentation-frame-wait',
  'completed-step-wait',
] as const);

export function parseCaptureCapabilitiesV1(value: unknown): CaptureCapabilitiesV1 {
  const record = object(value, '$');
  exact(record, [
    'schemaVersion', 'capabilityRevision', 'managedRuntime', 'webGpu', 'target', 'formats',
    'limits', 'presentationInput', 'interactiveRuntimeConnected',
  ], '$');
  if (record.schemaVersion !== 1 || record.capabilityRevision !== 'capture-v1') invalid('$');

  const managed = object(record.managedRuntime, '$.managedRuntime');
  exact(managed, [
    'available', 'unavailableReason', 'provider', 'playwrightVersion', 'browserRevision',
    'browserVersion',
  ], '$.managedRuntime');
  const reasons: readonly CaptureManagedUnavailableReason[] = [
    'playwright-version-mismatch', 'browser-version-mismatch', 'browser-not-installed',
  ];
  if (
    typeof managed.available !== 'boolean'
    || managed.provider !== 'playwright-chromium'
    || managed.playwrightVersion !== CAPTURE_PLAYWRIGHT_VERSION
    || managed.browserRevision !== CAPTURE_BROWSER_REVISION
    || managed.browserVersion !== CAPTURE_BROWSER_VERSION
    || (managed.available && managed.unavailableReason !== null)
    || (!managed.available && !reasons.includes(managed.unavailableReason as CaptureManagedUnavailableReason))
  ) invalid('$.managedRuntime');

  const webGpu = object(record.webGpu, '$.webGpu');
  exact(webGpu, ['status', 'unavailableReason'], '$.webGpu');
  const webGpuReasons = ['adapter-unavailable', 'device-unavailable', 'initialization-failed'];
  if (
    !['unknown-until-launch', 'available', 'unavailable'].includes(String(webGpu.status))
    || (webGpu.status === 'unavailable'
      ? !webGpuReasons.includes(String(webGpu.unavailableReason))
      : webGpu.unavailableReason !== null)
  ) invalid('$.webGpu');

  const target = object(record.target, '$.target');
  exact(target, ['kind', 'configuredWidth', 'configuredHeight'], '$.target');
  if (target.kind !== 'final-canvas') invalid('$.target.kind');
  const configuredWidth = positiveInteger(target.configuredWidth, 2560, '$.target.configuredWidth');
  const configuredHeight = positiveInteger(target.configuredHeight, 1440, '$.target.configuredHeight');

  const formats = object(record.formats, '$.formats');
  exact(formats, ['still', 'sequenceMaster', 'reviewDerivative', 'audio'], '$.formats');
  if (
    formats.still !== 'image/png'
    || formats.sequenceMaster !== 'image/png'
    || formats.reviewDerivative !== 'video/webm'
    || formats.audio !== 'none'
  ) invalid('$.formats');

  const limits = object(record.limits, '$.limits');
  exact(limits, [
    'maximumWidth', 'maximumHeight', 'maximumDeviceScaleFactor', 'maximumDurationSeconds',
    'maximumFramesPerSecond', 'maximumSequenceFrames', 'maximumTraceEntries',
    'maximumArtifactBytes', 'maximumRetainedEvidence', 'retentionScope',
    'maximumRetentionAgeSeconds',
  ], '$.limits');
  if (
    limits.maximumWidth !== 2560
    || limits.maximumHeight !== 1440
    || limits.maximumDeviceScaleFactor !== 2
    || limits.maximumDurationSeconds !== CAPTURE_MAX_DURATION_SECONDS
    || limits.maximumFramesPerSecond !== CAPTURE_MAX_FRAMES_PER_SECOND
    || limits.maximumSequenceFrames !== CAPTURE_MAX_SEQUENCE_FRAMES
    || limits.maximumTraceEntries !== CAPTURE_MAX_TRACE_ENTRIES
    || limits.maximumArtifactBytes !== CAPTURE_MAX_SEQUENCE_BYTES
    || limits.maximumRetainedEvidence !== CAPTURE_MAX_RETAINED_EVIDENCE
    || limits.retentionScope !== 'development-session'
    || limits.maximumRetentionAgeSeconds !== null
  ) invalid('$.limits');

  const input = object(record.presentationInput, '$.presentationInput');
  exact(input, ['supported', 'kinds'], '$.presentationInput');
  if (
    input.supported !== true
    || !Array.isArray(input.kinds)
    || input.kinds.length !== INPUT_KINDS.length
    || input.kinds.some((kind, index) => kind !== INPUT_KINDS[index])
    || typeof record.interactiveRuntimeConnected !== 'boolean'
  ) invalid('$.presentationInput');

  return Object.freeze({
    schemaVersion: 1,
    capabilityRevision: 'capture-v1',
    managedRuntime: Object.freeze({
      available: managed.available,
      unavailableReason: managed.unavailableReason as CaptureManagedUnavailableReason | null,
      provider: 'playwright-chromium',
      playwrightVersion: CAPTURE_PLAYWRIGHT_VERSION,
      browserRevision: CAPTURE_BROWSER_REVISION,
      browserVersion: CAPTURE_BROWSER_VERSION,
    }),
    webGpu: Object.freeze({
      status: webGpu.status as CaptureWebGpuStatus['status'],
      unavailableReason: webGpu.unavailableReason as CaptureWebGpuStatus['unavailableReason'],
    }),
    target: Object.freeze({ kind: 'final-canvas', configuredWidth, configuredHeight }),
    formats: Object.freeze({
      still: 'image/png', sequenceMaster: 'image/png', reviewDerivative: 'video/webm', audio: 'none',
    }),
    limits: Object.freeze({
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
    }),
    presentationInput: Object.freeze({ supported: true, kinds: INPUT_KINDS }),
    interactiveRuntimeConnected: record.interactiveRuntimeConnected,
  });
}
