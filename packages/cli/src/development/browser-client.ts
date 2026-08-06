import { createInspectionSnapshot } from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import {
  projectDevelopmentEventHistory,
  projectDevelopmentWorldInspection,
} from './inspection.ts';
import {
  projectDevelopmentPointLight,
  projectDevelopmentPointLightList,
} from './point-lights.ts';
import { projectDevelopmentSessionStatus } from './sessions.ts';
import type {
  DevelopmentCaptureResult,
  DevelopmentCorrectPointLightPowerInput,
  DevelopmentEventHistory,
  DevelopmentPointLightCommandResult,
  DevelopmentPointLightDetails,
  DevelopmentPointLightList,
  DevelopmentReloadResult,
  DevelopmentSessionControlResult,
  DevelopmentSessionStatus,
  DevelopmentSetPointLightPowerInput,
  DevelopmentSnapshot,
  DevelopmentWorldInspection,
} from './types.ts';

const SNAPSHOT_TIMEOUT_MILLISECONDS = 2_000;
const ACTION_TIMEOUT_MILLISECONDS = 15_000;

type DevelopmentFetch = typeof globalThis.fetch;

export type DevelopmentConnection = Readonly<{
  inspectionUrl: string;
  developmentSessionId: string;
  credential: string;
}>;

export type DevelopmentClientOptions = Readonly<{
  fetch?: DevelopmentFetch;
  snapshotTimeoutMilliseconds?: number;
  actionTimeoutMilliseconds?: number;
}>;

export interface DevelopmentClient {
  readDevelopmentSnapshot(): Promise<DevelopmentSnapshot>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
  listPointLights(): Promise<DevelopmentPointLightList>;
  getPointLight(entityId: unknown): Promise<DevelopmentPointLightDetails>;
  getWorldInspection(): Promise<DevelopmentWorldInspection>;
  getEventHistory(): Promise<DevelopmentEventHistory>;
  setPointLightPower(
    command: DevelopmentSetPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
  correctPointLightPower(
    request: DevelopmentCorrectPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
  getSessionStatus(): Promise<DevelopmentSessionStatus>;
  pauseSimulation(): Promise<DevelopmentSessionControlResult>;
  resumeSimulation(): Promise<DevelopmentSessionControlResult>;
  stepSimulation(expectedCompletedStepCount: number): Promise<DevelopmentSessionControlResult>;
}

type ActionPath =
  | '/v1/actions/reload'
  | '/v1/actions/capture'
  | '/v1/actions/set-point-light-power'
  | '/v1/actions/correct-point-light-power'
  | '/v1/actions/pause-simulation'
  | '/v1/actions/resume-simulation'
  | '/v1/actions/step-simulation';

function argumentError(message: string): never {
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', message);
}

function readTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1 || value > 60_000) {
    argumentError('Development client timeouts must be whole milliseconds from 1 through 60000.');
  }
  return value;
}

function readConnection(input: DevelopmentConnection): DevelopmentConnection {
  let url: URL;
  try {
    url = new URL(input.inspectionUrl);
  } catch {
    argumentError('The development inspection URL is invalid.');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port.length === 0
    || url.username.length > 0
    || url.password.length > 0
    || url.pathname !== '/'
    || url.search.length > 0
    || url.hash.length > 0
  ) {
    argumentError('The development inspection URL must be an exact HTTP loopback origin.');
  }
  if (
    typeof input.developmentSessionId !== 'string'
    || input.developmentSessionId.length < 1
    || input.developmentSessionId.length > 128
  ) argumentError('The development session ID is invalid.');
  if (
    typeof input.credential !== 'string'
    || input.credential.length < 32
    || input.credential.length > 512
  ) argumentError('The development session credential is invalid.');
  return Object.freeze({
    inspectionUrl: url.origin,
    developmentSessionId: input.developmentSessionId,
    credential: input.credential,
  });
}

function parseSnapshot(input: unknown, developmentSessionId: string): DevelopmentSnapshot {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible snapshot.',
    );
  }
  const record = input as Record<string, unknown>;
  if (
    record.schemaVersion !== 1
    || record.developmentSessionId !== developmentSessionId
    || 'credential' in record
  ) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible snapshot.',
    );
  }
  try {
    const inspection = record.inspection === null
      ? null
      : createInspectionSnapshot(record.inspection);
    return Object.freeze({ ...record, inspection }) as DevelopmentSnapshot;
  } catch {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible snapshot.',
    );
  }
}

async function readErrorBody(response: Response): Promise<{
  error?: { code?: string; message?: string };
} | null> {
  try {
    const value: unknown = await response.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as { error?: { code?: string; message?: string } }
      : null;
  } catch {
    return null;
  }
}

function actionError(
  response: Response,
  body: Awaited<ReturnType<typeof readErrorBody>>,
): AntikyCliError {
  const code = body?.error?.code;
  const message = body?.error?.message;
  if (code === 'ANTIKY_RUNTIME_UNAVAILABLE') {
    return new AntikyCliError(code, message ?? 'The runtime is unavailable.');
  }
  if (
    code === 'ANTIKY_ACTION_BUSY'
    || code === 'ANTIKY_ACTION_TIMEOUT'
    || code === 'ANTIKY_CAPTURE_SAVE_FAILED'
  ) return new AntikyCliError(code, message ?? 'The action failed.');
  if (
    code === 'INVALID_COMMAND'
    || code === 'ANTIKY_MESSAGE_INVALID'
    || code === 'ANTIKY_MESSAGE_TOO_LARGE'
  ) {
    return new AntikyCliError(
      'ANTIKY_ARGUMENT_INVALID',
      message ?? 'The development action input is invalid.',
    );
  }
  return new AntikyCliError(
    'ANTIKY_SESSION_UNAVAILABLE',
    `The Antiky inspection service rejected the action with status ${response.status}.`,
  );
}

export function createDevelopmentClient(
  connectionInput: DevelopmentConnection,
  options: DevelopmentClientOptions = {},
): DevelopmentClient {
  const connection = readConnection(connectionInput);
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const snapshotTimeout = readTimeout(
    options.snapshotTimeoutMilliseconds,
    SNAPSHOT_TIMEOUT_MILLISECONDS,
  );
  const actionTimeout = readTimeout(
    options.actionTimeoutMilliseconds,
    ACTION_TIMEOUT_MILLISECONDS,
  );

  const requestAction = async <T>(
    path: ActionPath,
    body: unknown = { schemaVersion: 1 },
  ): Promise<T> => {
    let response: Response;
    try {
      response = await fetchRequest(`${connection.inspectionUrl}${path}`, {
        method: 'POST',
        headers: new Headers({
          authorization: `Bearer ${connection.credential}`,
          'content-type': 'application/json',
        }),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(actionTimeout),
      });
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service is unavailable.',
      );
    }
    if (!response.ok) throw actionError(response, await readErrorBody(response));
    try {
      return await response.json() as T;
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service returned an incompatible action result.',
      );
    }
  };

  const readDevelopmentSnapshot = async (): Promise<DevelopmentSnapshot> => {
    let response: Response;
    try {
      response = await fetchRequest(`${connection.inspectionUrl}/v1/development`, {
        headers: new Headers({ authorization: `Bearer ${connection.credential}` }),
        signal: AbortSignal.timeout(snapshotTimeout),
      });
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service is unavailable.',
      );
    }
    if (!response.ok) {
      throw new AntikyCliError(
        response.status === 401 ? 'ANTIKY_UNAUTHORIZED' : 'ANTIKY_SESSION_UNAVAILABLE',
        `The Antiky inspection service rejected the request with status ${response.status}.`,
      );
    }
    try {
      return parseSnapshot(await response.json(), connection.developmentSessionId);
    } catch (cause: unknown) {
      if (cause instanceof AntikyCliError) throw cause;
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service returned an incompatible snapshot.',
      );
    }
  };

  return Object.freeze({
    readDevelopmentSnapshot,
    requestReload: () => requestAction<DevelopmentReloadResult>('/v1/actions/reload'),
    captureFrame: () => requestAction<DevelopmentCaptureResult>('/v1/actions/capture'),
    async listPointLights() {
      return projectDevelopmentPointLightList(await readDevelopmentSnapshot());
    },
    async getPointLight(entityId: unknown) {
      return projectDevelopmentPointLight(await readDevelopmentSnapshot(), entityId);
    },
    async getWorldInspection() {
      return projectDevelopmentWorldInspection(await readDevelopmentSnapshot());
    },
    async getEventHistory() {
      return projectDevelopmentEventHistory(await readDevelopmentSnapshot());
    },
    setPointLightPower: (command: DevelopmentSetPointLightPowerInput) => (
      requestAction<DevelopmentPointLightCommandResult>(
        '/v1/actions/set-point-light-power',
        { schemaVersion: 1, command },
      )
    ),
    correctPointLightPower: (request: DevelopmentCorrectPointLightPowerInput) => (
      requestAction<DevelopmentPointLightCommandResult>(
        '/v1/actions/correct-point-light-power',
        { schemaVersion: 1, request },
      )
    ),
    async getSessionStatus() {
      return projectDevelopmentSessionStatus(await readDevelopmentSnapshot());
    },
    pauseSimulation: () => requestAction<DevelopmentSessionControlResult>(
      '/v1/actions/pause-simulation',
    ),
    resumeSimulation: () => requestAction<DevelopmentSessionControlResult>(
      '/v1/actions/resume-simulation',
    ),
    stepSimulation: (expectedCompletedStepCount: number) => (
      requestAction<DevelopmentSessionControlResult>(
        '/v1/actions/step-simulation',
        { schemaVersion: 1, expectedCompletedStepCount },
      )
    ),
  });
}
