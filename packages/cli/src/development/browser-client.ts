import { createInspectionSnapshot } from '@antiky/framework';

import { AntikyCliError } from '../errors.ts';
import {
  parseCaptureCapabilitiesV1,
  type CaptureCapabilitiesV1,
} from './capture-capabilities.ts';
import { parseDevelopmentMcpCallLog } from './mcp-calls.ts';
import {
  projectDevelopmentEventHistory,
  projectDevelopmentEventHistoryV2,
  projectDevelopmentWorldInspection,
  projectDevelopmentWorldInspectionV2,
} from './inspection.ts';
import { parseObservationRefV1 } from './observation.ts';
import {
  parseCaptureFrameRequestV2,
  parseCaptureFrameRequestV3,
  parseDevelopmentCaptureResultV2,
  parseDevelopmentCaptureResultV3,
  type CaptureFrameRequestV2,
  type CaptureFrameRequestV3,
  type DevelopmentCaptureResultV2,
  type DevelopmentCaptureResultV3,
} from './capture.ts';
import {
  parseCaptureGameplaySequenceRequestV1,
  parseCaptureGameplaySequenceResultV1,
  type CaptureGameplaySequenceRequestV1,
  type CaptureGameplaySequenceResultV1,
} from './capture-sequence.ts';
import {
  parseEvidenceArtifactRefV1,
  parseRenderEvidenceQueryV1,
  parseRenderEvidenceResultV1,
  type EvidenceArtifactRefV1,
  type RenderEvidenceQueryV1,
  type RenderEvidenceResultV1,
} from './evidence.ts';
import {
  projectDevelopmentPointLight,
  projectDevelopmentPointLightListV2,
  projectDevelopmentPointLightV2,
  projectDevelopmentPointLightList,
} from './point-lights.ts';
import {
  projectDevelopmentSessionStatus,
  projectDevelopmentSessionStatusV2,
} from './sessions.ts';
import type {
  DevelopmentCorrectPointLightPowerInput,
  DevelopmentEventHistory,
  DevelopmentEventHistoryV2,
  DevelopmentMcpCallLog,
  DevelopmentPointLightCommandResult,
  DevelopmentPointLightDetails,
  DevelopmentPointLightDetailsV2,
  DevelopmentPointLightList,
  DevelopmentPointLightListV2,
  DevelopmentReloadResult,
  DevelopmentSessionControlResult,
  DevelopmentSessionStatus,
  DevelopmentSessionStatusV2,
  DevelopmentSetPointLightPowerInput,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
  DevelopmentWorldInspection,
  DevelopmentWorldInspectionV2,
} from './types.ts';

const SNAPSHOT_TIMEOUT_MILLISECONDS = 2_000;
const ACTION_TIMEOUT_MILLISECONDS = 30_000;

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
  readDevelopmentSnapshotV2(): Promise<DevelopmentSnapshotV2>;
  getCaptureCapabilities(): Promise<CaptureCapabilitiesV1>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrameV2(request: CaptureFrameRequestV2): Promise<DevelopmentCaptureResultV2>;
  captureFrameV3(request: CaptureFrameRequestV3): Promise<DevelopmentCaptureResultV3>;
  captureGameplaySequence(
    request: CaptureGameplaySequenceRequestV1,
  ): Promise<CaptureGameplaySequenceResultV1>;
  readEvidenceArtifact(artifact: EvidenceArtifactRefV1): Promise<Uint8Array>;
  getRenderEvidence(query: RenderEvidenceQueryV1): Promise<RenderEvidenceResultV1>;
  listPointLights(): Promise<DevelopmentPointLightList>;
  listPointLightsV2(): Promise<DevelopmentPointLightListV2>;
  getPointLight(entityId: unknown): Promise<DevelopmentPointLightDetails>;
  getPointLightV2(entityId: unknown): Promise<DevelopmentPointLightDetailsV2>;
  getWorldInspection(): Promise<DevelopmentWorldInspection>;
  getWorldInspectionV2(): Promise<DevelopmentWorldInspectionV2>;
  getEventHistory(): Promise<DevelopmentEventHistory>;
  getEventHistoryV2(): Promise<DevelopmentEventHistoryV2>;
  getMcpCallLog(): Promise<DevelopmentMcpCallLog>;
  setPointLightPower(
    command: DevelopmentSetPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
  correctPointLightPower(
    request: DevelopmentCorrectPointLightPowerInput,
  ): Promise<DevelopmentPointLightCommandResult>;
  getSessionStatus(): Promise<DevelopmentSessionStatus>;
  getSessionStatusV2(): Promise<DevelopmentSessionStatusV2>;
  pauseSimulation(): Promise<DevelopmentSessionControlResult>;
  resumeSimulation(): Promise<DevelopmentSessionControlResult>;
  stepSimulation(expectedCompletedStepCount: number): Promise<DevelopmentSessionControlResult>;
}

function parseSnapshotV2(input: unknown, developmentSessionId: string): DevelopmentSnapshotV2 {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible snapshot.',
    );
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== 2 || !Object.hasOwn(record, 'observation')) {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible snapshot.',
    );
  }
  const { observation: observationInput, ...legacyInput } = record;
  const legacy = parseSnapshot(
    { ...legacyInput, schemaVersion: 1 },
    developmentSessionId,
  );
  try {
    const observation = observationInput === null
      ? null
      : parseObservationRefV1(observationInput);
    if (observation && observation.developmentSessionId !== developmentSessionId) {
      throw new Error('Observation belongs to another development session.');
    }
    return Object.freeze({
      ...legacy,
      schemaVersion: 2,
      observation,
    });
  } catch {
    throw new AntikyCliError(
      'ANTIKY_SESSION_UNAVAILABLE',
      'The Antiky inspection service returned an incompatible observation.',
    );
  }
}

type ActionPath =
  | '/v1/actions/reload'
  | '/v1/actions/set-point-light-power'
  | '/v1/actions/correct-point-light-power'
  | '/v1/actions/pause-simulation'
  | '/v1/actions/resume-simulation'
  | '/v1/actions/step-simulation'
  | '/v2/actions/capture'
  | '/v3/actions/capture'
  | '/v1/actions/capture-gameplay-sequence'
  | '/v1/render-evidence';

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

  const readDevelopmentSnapshotV2 = async (): Promise<DevelopmentSnapshotV2> => {
    let response: Response;
    try {
      response = await fetchRequest(`${connection.inspectionUrl}/v2/development`, {
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
      return parseSnapshotV2(await response.json(), connection.developmentSessionId);
    } catch (cause: unknown) {
      if (cause instanceof AntikyCliError) throw cause;
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service returned an incompatible snapshot.',
      );
    }
  };

  const getMcpCallLog = async (): Promise<DevelopmentMcpCallLog> => {
    let response: Response;
    try {
      response = await fetchRequest(`${connection.inspectionUrl}/v1/mcp-calls`, {
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
      return parseDevelopmentMcpCallLog(
        await response.json(),
        connection.developmentSessionId,
      );
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky inspection service returned incompatible MCP call history.',
      );
    }
  };

  const getCaptureCapabilities = async (): Promise<CaptureCapabilitiesV1> => {
    let response: Response;
    try {
      response = await fetchRequest(`${connection.inspectionUrl}/v1/capture-capabilities`, {
        headers: new Headers({ authorization: `Bearer ${connection.credential}` }),
        signal: AbortSignal.timeout(snapshotTimeout),
      });
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky capture capability service is unavailable.',
      );
    }
    if (!response.ok) {
      throw new AntikyCliError(
        response.status === 401 ? 'ANTIKY_UNAUTHORIZED' : 'ANTIKY_SESSION_UNAVAILABLE',
        `The Antiky capture capability service rejected the request with status ${response.status}.`,
      );
    }
    try {
      return parseCaptureCapabilitiesV1(await response.json());
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky capture capability service returned an incompatible descriptor.',
      );
    }
  };

  const readEvidenceArtifact = async (
    artifactInput: EvidenceArtifactRefV1,
  ): Promise<Uint8Array> => {
    const artifact = parseEvidenceArtifactRefV1(artifactInput);
    if (artifact.observation.developmentSessionId !== connection.developmentSessionId) {
      argumentError('The evidence artifact belongs to another development session.');
    }
    let response: Response;
    try {
      response = await fetchRequest(
        `${connection.inspectionUrl}/v1/evidence/${artifact.evidenceId}/${artifact.artifactId}`,
        {
          headers: new Headers({ authorization: `Bearer ${connection.credential}` }),
          signal: AbortSignal.timeout(actionTimeout),
        },
      );
    } catch {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky evidence service is unavailable.',
      );
    }
    if (!response.ok) throw actionError(response, await readErrorBody(response));
    if (response.headers.get('content-type')?.split(';', 1)[0] !== artifact.mimeType) {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky evidence service returned an incompatible media type.',
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== artifact.byteLength) {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky evidence service returned an incompatible artifact.',
      );
    }
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    const sha256 = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    if (sha256 !== artifact.sha256) {
      throw new AntikyCliError(
        'ANTIKY_SESSION_UNAVAILABLE',
        'The Antiky evidence service returned an incompatible artifact.',
      );
    }
    return bytes;
  };

  return Object.freeze({
    readDevelopmentSnapshot,
    readDevelopmentSnapshotV2,
    getCaptureCapabilities,
    getMcpCallLog,
    requestReload: () => requestAction<DevelopmentReloadResult>('/v1/actions/reload'),
    async captureFrameV2(requestInput: CaptureFrameRequestV2) {
      const request = parseCaptureFrameRequestV2(requestInput);
      return parseDevelopmentCaptureResultV2(await requestAction<unknown>(
        '/v2/actions/capture',
        request,
      ));
    },
    async captureFrameV3(requestInput: CaptureFrameRequestV3) {
      const request = parseCaptureFrameRequestV3(requestInput);
      return parseDevelopmentCaptureResultV3(await requestAction<unknown>(
        '/v3/actions/capture',
        request,
      ));
    },
    async captureGameplaySequence(requestInput: CaptureGameplaySequenceRequestV1) {
      const request = parseCaptureGameplaySequenceRequestV1(requestInput);
      return parseCaptureGameplaySequenceResultV1(await requestAction<unknown>(
        '/v1/actions/capture-gameplay-sequence',
        request,
      ));
    },
    async getRenderEvidence(queryInput: RenderEvidenceQueryV1) {
      const query = parseRenderEvidenceQueryV1(queryInput);
      return parseRenderEvidenceResultV1(
        await requestAction<unknown>('/v1/render-evidence', query),
        connection.developmentSessionId,
      );
    },
    readEvidenceArtifact,
    async listPointLights() {
      return projectDevelopmentPointLightList(await readDevelopmentSnapshot());
    },
    async listPointLightsV2() {
      return projectDevelopmentPointLightListV2(await readDevelopmentSnapshotV2());
    },
    async getPointLight(entityId: unknown) {
      return projectDevelopmentPointLight(await readDevelopmentSnapshot(), entityId);
    },
    async getPointLightV2(entityId: unknown) {
      return projectDevelopmentPointLightV2(await readDevelopmentSnapshotV2(), entityId);
    },
    async getWorldInspection() {
      return projectDevelopmentWorldInspection(await readDevelopmentSnapshot());
    },
    async getWorldInspectionV2() {
      return projectDevelopmentWorldInspectionV2(await readDevelopmentSnapshotV2());
    },
    async getEventHistory() {
      return projectDevelopmentEventHistory(await readDevelopmentSnapshot());
    },
    async getEventHistoryV2() {
      return projectDevelopmentEventHistoryV2(await readDevelopmentSnapshotV2());
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
    async getSessionStatusV2() {
      return projectDevelopmentSessionStatusV2(await readDevelopmentSnapshotV2());
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
