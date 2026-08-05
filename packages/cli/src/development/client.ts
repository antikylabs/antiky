import { loadAntikyConfig } from '../config.ts';
import type {
  DevelopmentCaptureResult,
  DevelopmentCorrectPointLightPowerInput,
  DevelopmentPointLightCommandResult,
  DevelopmentPointLightDetails,
  DevelopmentPointLightList,
  DevelopmentReloadResult,
  DevelopmentSetPointLightPowerInput,
  DevelopmentSnapshot,
} from './types.ts';
import { AntikyCliError } from '../errors.ts';
import { readSessionDescriptor } from '../host/session-descriptor.ts';
import {
  projectDevelopmentPointLight,
  projectDevelopmentPointLightList,
} from './point-lights.ts';

export interface DevelopmentClient {
  readDevelopmentSnapshot(): Promise<DevelopmentSnapshot>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
  listPointLights(): Promise<DevelopmentPointLightList>;
  getPointLight(entityId: unknown): Promise<DevelopmentPointLightDetails>;
  setPointLightPower(
    command: DevelopmentSetPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
  correctPointLightPower(
    request: DevelopmentCorrectPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
}

export async function connectDevelopmentClient(
  configPath = 'antiky.config.json',
): Promise<DevelopmentClient> {
  const config = await loadAntikyConfig(configPath);
  const descriptor = await readSessionDescriptor(config);

  const requestAction = async <T>(
    path:
      | '/v1/actions/reload'
      | '/v1/actions/capture'
      | '/v1/actions/set-point-light-power'
      | '/v1/actions/correct-point-light-power',
    body: unknown = { schemaVersion: 1 },
  ): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${descriptor.inspectionUrl}${path}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${descriptor.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service is unavailable.',
      );
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as {
        error?: { code?: string; message?: string };
      } | null;
      const code = body?.error?.code;
      if (code === 'ANTIKY_RUNTIME_UNAVAILABLE') {
        throw new AntikyCliError(code, body?.error?.message ?? 'The runtime is unavailable.');
      }
      if (code === 'ANTIKY_ACTION_BUSY' || code === 'ANTIKY_ACTION_TIMEOUT') {
        throw new AntikyCliError(code, body?.error?.message ?? 'The action failed.');
      }
      if (
        code === 'INVALID_COMMAND'
        || code === 'ANTIKY_MESSAGE_INVALID'
        || code === 'ANTIKY_MESSAGE_TOO_LARGE'
      ) {
        throw new AntikyCliError(
          'ANTIKY_ARGUMENT_INVALID',
          body?.error?.message ?? 'The development action input is invalid.',
        );
      }
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        `The Antiky inspection service rejected the action with status ${response.status}.`,
      );
    }
    return await response.json() as T;
  };

  const readDevelopmentSnapshot = async (): Promise<DevelopmentSnapshot> => {
    let response: Response;
    try {
      response = await fetch(`${descriptor.inspectionUrl}/v1/development`, {
        headers: { authorization: `Bearer ${descriptor.credential}` },
        signal: AbortSignal.timeout(2000),
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
    const snapshot = await response.json() as DevelopmentSnapshot;
    if (
      snapshot.schemaVersion !== 1
      || snapshot.developmentSessionId !== descriptor.developmentSessionId
    ) {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service returned an incompatible snapshot.',
      );
    }
    return snapshot;
  };

  return Object.freeze({
    readDevelopmentSnapshot,
    requestReload: () => requestAction<DevelopmentReloadResult>('/v1/actions/reload'),
    captureFrame: () => requestAction<DevelopmentCaptureResult>('/v1/actions/capture'),
    async listPointLights(): Promise<DevelopmentPointLightList> {
      return projectDevelopmentPointLightList(await readDevelopmentSnapshot());
    },
    async getPointLight(entityId: unknown): Promise<DevelopmentPointLightDetails> {
      return projectDevelopmentPointLight(await readDevelopmentSnapshot(), entityId);
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
  });
}

export async function inspectDevelopmentSession(
  configPath = 'antiky.config.json',
): Promise<DevelopmentSnapshot> {
  const client = await connectDevelopmentClient(configPath);
  return client.readDevelopmentSnapshot();
}
