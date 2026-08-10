import { randomUUID } from 'node:crypto';
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CaptureFrameRequestV2 } from '../development/capture.ts';
import type { ObservationRefV1 } from '../development/observation.ts';
import { AntikyCliError } from '../errors.ts';

export const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
export const MAX_CAPTURE_ENVELOPE_BYTES = Math.ceil(MAX_CAPTURE_BYTES / 3) * 4 + 64 * 1024;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export type CaptureRuntimeContext = Readonly<{
  runtimeInstanceId: string | null;
  buildRevision: number;
  connected: boolean;
  observation?: ObservationRefV1 | null;
}>;

type CaptureFailureCode =
  | 'CAPTURE_RUNTIME_UNAVAILABLE'
  | 'CAPTURE_BUILD_STALE'
  | 'CAPTURE_OBSERVATION_STALE'
  | 'CAPTURE_STEP_UNAVAILABLE'
  | 'CAPTURE_DIMENSIONS_MISMATCH'
  | 'CAPTURE_ARTIFACT_FAILED';

export function captureFailure(code: CaptureFailureCode, message: string): AntikyCliError {
  return new AntikyCliError(code, message);
}

export function validateCaptureObservation(
  request: CaptureFrameRequestV2,
  context: CaptureRuntimeContext,
  source: 'interactive-runtime' | 'managed-runtime' = 'interactive-runtime',
): ObservationRefV1 {
  const observation = context.observation;
  if (!context.connected || !observation || observation.freshness !== 'current') {
    throw captureFailure(
      'CAPTURE_RUNTIME_UNAVAILABLE',
      'Read a current runtime observation before retrying capture.',
    );
  }
  if (request.runtimePolicy === 'managed-only' && source !== 'managed-runtime') {
    throw captureFailure(
      'CAPTURE_RUNTIME_UNAVAILABLE',
      'This capture path is attached to the current interactive runtime.',
    );
  }
  if (request.expected.developmentSessionId !== observation.developmentSessionId) {
    throw captureFailure('CAPTURE_OBSERVATION_STALE', 'The development session changed.');
  }
  if (request.expected.acceptedBuildRevision !== observation.acceptedBuildRevision) {
    throw captureFailure('CAPTURE_BUILD_STALE', 'Read the accepted build and retry capture.');
  }
  if (request.expected.runtimeInstanceId !== observation.runtimeInstanceId) {
    throw captureFailure('CAPTURE_OBSERVATION_STALE', 'The runtime instance changed.');
  }
  if (request.expected.sessionId !== undefined) {
    if (!observation.session || observation.session.sessionId !== request.expected.sessionId) {
      throw captureFailure('CAPTURE_OBSERVATION_STALE', 'The engine session changed.');
    }
  }
  if (request.expected.completedStepCount !== undefined) {
    if (!observation.session || observation.session.mode !== 'paused') {
      throw captureFailure(
        'CAPTURE_STEP_UNAVAILABLE',
        'Pause the engine session before requesting an exact completed step.',
      );
    }
    if (observation.session.completedStepCount !== request.expected.completedStepCount) {
      throw captureFailure('CAPTURE_OBSERVATION_STALE', 'The completed simulation step changed.');
    }
    if (
      request.expected.stateDigest !== undefined
      && observation.session.stateDigest !== request.expected.stateDigest
    ) throw captureFailure('CAPTURE_OBSERVATION_STALE', 'The simulation state digest changed.');
  }
  return observation;
}

export function staleCaptureError(): AntikyCliError {
  return new AntikyCliError('ANTIKY_ACTION_STALE', 'The capture action is stale.');
}

export function decodePng(value: string): Buffer {
  if (value.length === 0 || value.length > Math.ceil(MAX_CAPTURE_BYTES / 3) * 4 + 4) {
    throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture is empty or too large.');
  }
  const bytes = Buffer.from(value, 'base64');
  if (
    bytes.length === 0
    || bytes.length > MAX_CAPTURE_BYTES
    || bytes.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')
    || bytes.subarray(0, PNG_SIGNATURE.length).compare(PNG_SIGNATURE) !== 0
  ) {
    throw new AntikyCliError(
      'ANTIKY_CAPTURE_INVALID',
      'The frame capture is not a valid PNG payload.',
    );
  }
  return bytes;
}

export function readPngDimensions(
  bytes: Buffer,
): Readonly<{ width: number; height: number }> {
  if (
    bytes.length < 33
    || bytes.readUInt32BE(8) !== 13
    || bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture has no valid PNG header.');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 2560 || height > 1440) {
    throw new AntikyCliError('ANTIKY_CAPTURE_INVALID', 'The frame capture dimensions are invalid.');
  }
  return Object.freeze({ width, height });
}

export async function persistLegacyCapture(
  rootDirectory: string,
  captureId: string,
  bytes: Buffer,
): Promise<string> {
  const directory = join(rootDirectory, '.antiky', 'captures');
  const path = join(directory, `${captureId}.png`);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let committed = false;
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    await writeFile(temporaryPath, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
    committed = true;
    return path;
  } finally {
    await Promise.allSettled([
      rm(temporaryPath, { force: true }),
      ...(committed ? [] : [rm(path, { force: true })]),
    ]);
  }
}
