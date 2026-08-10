import { randomUUID } from 'node:crypto';
import {
  createServer as createHttpServer,
  type Server as HttpServer,
} from 'node:http';

import {
  MAX_POINT_LIGHT_COMMAND_BYTES,
  PointLightCommandValidationError,
  encodedJsonByteLength,
  parseCorrectPointLightPowerRequest,
  parseSetPointLightPowerCommand,
  type CorrectPointLightPowerRequest,
  type InspectionSnapshot,
  type PointLightCommandResult,
  type SetPointLightPowerCommand,
} from '@antiky/framework';

import {
  MAX_CAPTURE_ENVELOPE_BYTES,
  type BrowserDevelopmentAction,
  type CaptureActionInput,
  type PointLightActionResultInput,
  type SessionControlActionResultInput,
} from './actions.ts';
import {
  BrowserEnvelopeError,
  readBrowserActionResultEnvelope,
  readBrowserDisconnectEnvelope,
  readBrowserSnapshotEnvelope,
} from './browser-envelope.ts';
import type {
  DevelopmentReloadResult,
  DevelopmentSessionControlResult,
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
} from '../development/types.ts';
import type {
  CaptureFrameRequestV2,
  CaptureFrameRequestV3,
  DevelopmentCaptureResultV2,
  DevelopmentCaptureResultV3,
} from '../development/capture.ts';
import type { EvidenceArtifactRefV1 } from '../development/evidence.ts';
import type { CaptureCapabilitiesV1 } from '../development/capture-capabilities.ts';
import type { EvidenceArtifact, EvidenceLookup } from './evidence-store.ts';
import { AntikyCliError } from '../errors.ts';
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticSink,
} from './diagnostics.ts';
import {
  projectDevelopmentEventHistory,
  projectDevelopmentWorldInspection,
} from '../development/inspection.ts';
import {
  projectDevelopmentPointLight,
  projectDevelopmentPointLightList,
} from '../development/point-lights.ts';
import { projectDevelopmentSessionStatus } from '../development/sessions.ts';
import {
  MCP_HTTP_PATH,
} from '../mcp/server.ts';
import { createMcpCallLog } from './mcp-call-log.ts';
import { handleMcpHttpRequest } from './inspection-mcp.ts';
import {
  InspectionServiceError,
  hasCredential,
  readDevelopmentOrigin,
  readJson,
  requireExactOrigin,
  serviceError,
  validateCorsPreflight,
  writeEmpty,
  writeBytes,
  writeJson,
} from './inspection-http.ts';

const MAX_BROWSER_MESSAGE_BYTES = 256 * 1024;

const DEVELOPMENT_GET_PATHS = new Set([
  '/v1/development',
  '/v2/development',
  '/v1/mcp-calls',
  '/v1/capture-capabilities',
]);

const DEVELOPMENT_POST_PATHS = new Set([
  '/v1/actions/reload',
  '/v1/actions/pause-simulation',
  '/v1/actions/resume-simulation',
  '/v1/actions/step-simulation',
  '/v1/actions/set-point-light-power',
  '/v1/actions/correct-point-light-power',
  '/v2/actions/capture',
  '/v3/actions/capture',
]);

type InspectionServerOptions = Readonly<{
  host: '127.0.0.1';
  port: number;
  developmentSessionId: string;
  gameUrl: string;
  credential: string;
  diagnosticSink?: CliDiagnosticSink;
  readDevelopmentSnapshot(): DevelopmentSnapshot;
  readDevelopmentSnapshotV2(): DevelopmentSnapshotV2;
  readCaptureCapabilities(): CaptureCapabilitiesV1;
  acceptInspection(snapshot: InspectionSnapshot, publicationSequence: number): number;
  disconnectRuntime(runtimeInstanceId: string, publicationSequence: number): void;
  touchRuntime(runtimeInstanceId: string): void;
  nextAction(runtimeInstanceId: string): BrowserDevelopmentAction | null;
  completeCapture(input: CaptureActionInput): Promise<void>;
  completePointLightCommand(input: PointLightActionResultInput): Promise<void>;
  completeSessionControl(input: SessionControlActionResultInput): Promise<void>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrameV2(request: CaptureFrameRequestV2): Promise<DevelopmentCaptureResultV2>;
  captureFrameV3(request: CaptureFrameRequestV3): Promise<DevelopmentCaptureResultV3>;
  readEvidence(lookup: EvidenceLookup): Promise<EvidenceArtifact>;
  setPointLightPower(command: SetPointLightPowerCommand): Promise<PointLightCommandResult>;
  correctPointLightPower(
    request: CorrectPointLightPowerRequest,
  ): Promise<PointLightCommandResult>;
  pauseSimulation(): Promise<DevelopmentSessionControlResult>;
  resumeSimulation(): Promise<DevelopmentSessionControlResult>;
  stepSimulation(expectedCompletedStepCount: number): Promise<DevelopmentSessionControlResult>;
}>;

export interface InspectionServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

type UnknownRecord = Record<string, unknown>;

function readObject(value: unknown): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Expected a message object.');
  }
  return value as UnknownRecord;
}

function hasExactKeys(record: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function readActionRequest(value: unknown): void {
  const record = readObject(value);
  if (!hasExactKeys(record, ['schemaVersion']) || record.schemaVersion !== 1) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action request.');
  }
}

function readStepActionRequest(value: unknown): number {
  const record = readObject(value);
  if (
    !hasExactKeys(record, ['schemaVersion', 'expectedCompletedStepCount'])
    || record.schemaVersion !== 1
    || !Number.isSafeInteger(record.expectedCompletedStepCount)
    || (record.expectedCompletedStepCount as number) < 0
  ) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid step-simulation request.');
  return record.expectedCompletedStepCount as number;
}

function readPointLightActionRequest(
  value: unknown,
  kind: 'set' | 'correct',
): SetPointLightPowerCommand | CorrectPointLightPowerRequest {
  const record = readObject(value);
  const field = kind === 'set' ? 'command' : 'request';
  if (
    !hasExactKeys(record, ['schemaVersion', field])
    || record.schemaVersion !== 1
  ) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid point-light action request.');
  const bytes = encodedJsonByteLength(record[field]);
  if (bytes === null || bytes > MAX_POINT_LIGHT_COMMAND_BYTES) {
    serviceError(413, 'ANTIKY_MESSAGE_TOO_LARGE', 'Point-light command is too large.');
  }
  try {
    return kind === 'set'
      ? parseSetPointLightPowerCommand(record.command)
      : parseCorrectPointLightPowerRequest(record.request);
  } catch (cause: unknown) {
    if (cause instanceof PointLightCommandValidationError) {
      serviceError(400, cause.code, cause.message);
    }
    throw cause;
  }
}

function actionStatus(cause: AntikyCliError): number {
  if (cause.code === 'ANTIKY_EVIDENCE_NOT_FOUND') return 404;
  if (cause.code === 'ANTIKY_ACTION_TIMEOUT') return 504;
  if (cause.code === 'ANTIKY_RUNTIME_UNAVAILABLE') return 503;
  if (cause.code === 'ANTIKY_CAPTURE_INVALID') return 400;
  if (cause.code === 'ANTIKY_CAPTURE_SAVE_FAILED') return 500;
  if (cause.code === 'CAPTURE_ARTIFACT_FAILED') return 500;
  if (cause.code === 'CAPTURE_RUNTIME_TIMEOUT') return 504;
  if (
    cause.code === 'CAPTURE_RUNTIME_UNAVAILABLE'
    || cause.code === 'CAPTURE_BROWSER_LAUNCH_FAILED'
    || cause.code === 'CAPTURE_BROWSER_VERSION_MISMATCH'
    || cause.code === 'CAPTURE_WEBGPU_UNAVAILABLE'
    || cause.code === 'CAPTURE_RUNTIME_DISCONNECTED'
  ) return 503;
  if (cause.code === 'CAPTURE_LIMIT_EXCEEDED') return 413;
  if (cause.code === 'CAPTURE_TRACE_INVALID') return 400;
  return 409;
}

function developmentRequestMethod(pathname: string): 'GET' | 'POST' | null {
  if (DEVELOPMENT_GET_PATHS.has(pathname)) return 'GET';
  if (/^\/v1\/evidence\/evidence-[a-z0-9][a-z0-9-]{7,126}\/artifact-[0-9a-f]{64}$/u.test(pathname)) {
    return 'GET';
  }
  if (DEVELOPMENT_POST_PATHS.has(pathname)) return 'POST';
  return null;
}

export function createInspectionServer(options: InspectionServerOptions): InspectionServer {
  const gameOrigin = new URL(options.gameUrl).origin;
  const expectedHost = `${options.host}:${options.port}`;
  const diagnosticSink = options.diagnosticSink ?? NOOP_CLI_DIAGNOSTIC_SINK;
  const mcpCallLog = createMcpCallLog(options.developmentSessionId);
  const mcpClient = Object.freeze({
    async readDevelopmentSnapshot() { return options.readDevelopmentSnapshot(); },
    async readDevelopmentSnapshotV2() { return options.readDevelopmentSnapshotV2(); },
    async getCaptureCapabilities() { return options.readCaptureCapabilities(); },
    requestReload: options.requestReload,
    captureFrameV2: options.captureFrameV2,
    captureFrameV3: options.captureFrameV3,
    async readEvidenceArtifact(artifact: EvidenceArtifactRefV1) {
      return (await options.readEvidence({
        evidenceId: artifact.evidenceId,
        artifactId: artifact.artifactId,
      })).bytes;
    },
    async listPointLights() {
      return projectDevelopmentPointLightList(options.readDevelopmentSnapshot());
    },
    async getPointLight(entityId: unknown) {
      return projectDevelopmentPointLight(options.readDevelopmentSnapshot(), entityId);
    },
    setPointLightPower: options.setPointLightPower,
    correctPointLightPower: options.correctPointLightPower,
    async getSessionStatus() {
      return projectDevelopmentSessionStatus(options.readDevelopmentSnapshot());
    },
    async getWorldInspection() {
      return projectDevelopmentWorldInspection(options.readDevelopmentSnapshot());
    },
    async getEventHistory() {
      return projectDevelopmentEventHistory(options.readDevelopmentSnapshot());
    },
    pauseSimulation: options.pauseSimulation,
    resumeSimulation: options.resumeSimulation,
    stepSimulation: options.stepSimulation,
  });
  const server: HttpServer = createHttpServer((request, response) => {
    const requestId = `request-${randomUUID()}`;
    void (async () => {
      let browserRequest = false;
      let allowedResponseOrigin: string | undefined;
      try {
        if (request.headers.host !== expectedHost) {
          serviceError(400, 'ANTIKY_HOST_INVALID', 'Invalid Host header.');
        }
        const requestUrl = new URL(request.url ?? '/', `http://${expectedHost}`);
        const developmentMethod = developmentRequestMethod(requestUrl.pathname);
        browserRequest = requestUrl.pathname === '/v1/browser/bootstrap'
          || requestUrl.pathname.startsWith('/v1/runtime/');
        if (browserRequest) {
          requireExactOrigin(request, gameOrigin);
          allowedResponseOrigin = gameOrigin;
        } else if (developmentMethod) {
          allowedResponseOrigin = readDevelopmentOrigin(request, gameOrigin);
        } else if (request.headers.origin && request.headers.origin !== gameOrigin) {
          serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
        }

        // MCP clients need a stable URL across development sessions. This route relies on the
        // loopback bind plus the Host and Origin checks above; every inspection REST route below
        // remains protected by the per-session credential.
        if (requestUrl.pathname === MCP_HTTP_PATH) {
          await handleMcpHttpRequest(
            request,
            response,
            mcpClient,
            mcpCallLog,
            MAX_BROWSER_MESSAGE_BYTES,
          );
          return;
        }

        if (request.method === 'OPTIONS' && browserRequest) {
          response.writeHead(204, {
            'access-control-allow-origin': gameOrigin,
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-max-age': '600',
            'cache-control': 'no-store',
            vary: 'Origin',
          });
          response.end();
          return;
        }

        if (request.method === 'OPTIONS' && developmentMethod) {
          if (!allowedResponseOrigin) {
            serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Origin is required for CORS preflight.');
          }
          validateCorsPreflight(request, developmentMethod);
          writeEmpty(response, 204, {
            'access-control-allow-origin': allowedResponseOrigin,
            'access-control-allow-methods': `${developmentMethod}, OPTIONS`,
            'access-control-allow-headers': 'Authorization, Content-Type',
            'access-control-max-age': '600',
            vary: 'Origin',
          });
          return;
        }

        if (request.method === 'GET' && requestUrl.pathname === '/v1/browser/bootstrap') {
          writeJson(response, 200, {
            schemaVersion: 1,
            developmentSessionId: options.developmentSessionId,
            gameUrl: options.gameUrl,
            credential: options.credential,
          }, gameOrigin);
          return;
        }
        if (!hasCredential(request.headers.authorization, options.credential)) {
          serviceError(401, 'ANTIKY_UNAUTHORIZED', 'Authorization is required.');
        }

        if (request.method === 'GET' && requestUrl.pathname === '/v1/development') {
          writeJson(response, 200, options.readDevelopmentSnapshot(), allowedResponseOrigin);
          return;
        }
        if (request.method === 'GET' && requestUrl.pathname === '/v2/development') {
          writeJson(response, 200, options.readDevelopmentSnapshotV2(), allowedResponseOrigin);
          return;
        }
        if (request.method === 'GET' && requestUrl.pathname === '/v1/mcp-calls') {
          writeJson(response, 200, mcpCallLog.read(), allowedResponseOrigin);
          return;
        }
        if (request.method === 'GET' && requestUrl.pathname === '/v1/capture-capabilities') {
          writeJson(response, 200, options.readCaptureCapabilities(), allowedResponseOrigin);
          return;
        }
        const evidenceMatch = requestUrl.pathname.match(
          /^\/v1\/evidence\/(evidence-[a-z0-9][a-z0-9-]{7,126})\/(artifact-[0-9a-f]{64})$/u,
        );
        if (request.method === 'GET' && evidenceMatch) {
          const evidence = await options.readEvidence({
            evidenceId: evidenceMatch[1]!,
            artifactId: evidenceMatch[2]!,
          });
          writeBytes(
            response,
            200,
            evidence.bytes,
            evidence.artifact.mimeType,
            allowedResponseOrigin,
          );
          return;
        }
        if (request.method === 'POST' && requestUrl.pathname === '/v1/runtime/snapshot') {
          const envelope = readBrowserSnapshotEnvelope(
            await readJson(request, MAX_BROWSER_MESSAGE_BYTES),
            options.developmentSessionId,
          );
          const acceptedBuildRevision = options.acceptInspection(
            envelope.snapshot,
            envelope.publicationSequence,
          );
          writeJson(response, 202, {
            schemaVersion: 1,
            accepted: true,
            developmentSessionId: options.developmentSessionId,
            runtimeInstanceId: envelope.snapshot.runtime.instanceId,
            acceptedBuildRevision,
          }, gameOrigin);
          return;
        }
        if (request.method === 'POST' && requestUrl.pathname === '/v1/runtime/disconnect') {
          const envelope = readBrowserDisconnectEnvelope(
            await readJson(request, MAX_BROWSER_MESSAGE_BYTES),
            options.developmentSessionId,
          );
          options.disconnectRuntime(envelope.runtimeInstanceId, envelope.publicationSequence);
          writeJson(response, 202, { schemaVersion: 1, accepted: true }, gameOrigin);
          return;
        }
        if (request.method === 'GET' && requestUrl.pathname === '/v1/runtime/action') {
          if ([...requestUrl.searchParams.keys()].some((key) => key !== 'runtimeInstanceId')) {
            serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action poll query.');
          }
          const runtimeInstanceId = requestUrl.searchParams.get('runtimeInstanceId');
          if (!runtimeInstanceId || runtimeInstanceId.length > 128) {
            serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid runtime instance ID.');
          }
          options.touchRuntime(runtimeInstanceId);
          const action = options.nextAction(runtimeInstanceId);
          if (!action) {
            response.writeHead(204, {
              'access-control-allow-origin': gameOrigin,
              'cache-control': 'no-store',
              vary: 'Origin',
            });
            response.end();
          } else {
            writeJson(response, 200, action, gameOrigin);
          }
          return;
        }
        if (request.method === 'POST' && requestUrl.pathname === '/v1/runtime/action-result') {
          const input = await readJson(request, MAX_CAPTURE_ENVELOPE_BYTES);
          const envelope = readBrowserActionResultEnvelope(
            input,
            options.developmentSessionId,
          );
          if (envelope.kind === 'capture') {
            if (envelope.snapshot && envelope.publicationSequence !== null) {
              options.acceptInspection(envelope.snapshot, envelope.publicationSequence);
            }
            await options.completeCapture(envelope.input);
          }
          else if (envelope.kind === 'point-light-command') {
            await options.completePointLightCommand(envelope.input);
          } else await options.completeSessionControl(envelope.input);
          writeJson(response, 202, { schemaVersion: 1, accepted: true }, gameOrigin);
          return;
        }
        if (
          request.method === 'POST'
          && (requestUrl.pathname === '/v2/actions/capture'
            || requestUrl.pathname === '/v3/actions/capture')
        ) {
          const input = await readJson(request, MAX_BROWSER_MESSAGE_BYTES);
          writeJson(
            response,
            200,
            requestUrl.pathname.includes('/v3/')
              ? await options.captureFrameV3(input as CaptureFrameRequestV3)
              : await options.captureFrameV2(input as CaptureFrameRequestV2),
            allowedResponseOrigin,
          );
          return;
        }
        if (
          request.method === 'POST'
          && (requestUrl.pathname === '/v1/actions/reload'
            || requestUrl.pathname === '/v1/actions/pause-simulation'
            || requestUrl.pathname === '/v1/actions/resume-simulation')
        ) {
          readActionRequest(await readJson(request, MAX_BROWSER_MESSAGE_BYTES));
          const result = requestUrl.pathname.endsWith('/reload')
            ? await options.requestReload()
            : requestUrl.pathname.endsWith('/pause-simulation')
                ? await options.pauseSimulation()
                : await options.resumeSimulation();
          writeJson(response, 200, result, allowedResponseOrigin);
          return;
        }
        if (
          request.method === 'POST'
          && requestUrl.pathname === '/v1/actions/step-simulation'
        ) {
          const expectedCompletedStepCount = readStepActionRequest(
            await readJson(request, MAX_BROWSER_MESSAGE_BYTES),
          );
          writeJson(
            response,
            200,
            await options.stepSimulation(expectedCompletedStepCount),
            allowedResponseOrigin,
          );
          return;
        }
        if (
          request.method === 'POST'
          && (requestUrl.pathname === '/v1/actions/set-point-light-power'
            || requestUrl.pathname === '/v1/actions/correct-point-light-power')
        ) {
          const kind = requestUrl.pathname.includes('/set-') ? 'set' : 'correct';
          const input = readPointLightActionRequest(
            await readJson(request, MAX_POINT_LIGHT_COMMAND_BYTES + 512),
            kind,
          );
          const result = kind === 'set'
            ? await options.setPointLightPower(input as SetPointLightPowerCommand)
            : await options.correctPointLightPower(input as CorrectPointLightPowerRequest);
          writeJson(response, 200, result, allowedResponseOrigin);
          return;
        }
        serviceError(404, 'ANTIKY_NOT_FOUND', 'Resource does not exist.');
      } catch (cause: unknown) {
        if (cause instanceof BrowserEnvelopeError) {
          writeJson(response, cause.status, {
            error: { code: cause.code, message: cause.message },
          }, allowedResponseOrigin);
          return;
        }
        if (cause instanceof InspectionServiceError) {
          writeJson(response, cause.status, {
            error: { code: cause.code, message: cause.message },
          }, allowedResponseOrigin);
          return;
        }
        if (cause instanceof AntikyCliError) {
          writeJson(response, actionStatus(cause), {
            error: { code: cause.code, message: cause.message },
          }, allowedResponseOrigin);
          return;
        }
        emitCliDiagnostic(diagnosticSink, {
          level: 'error',
          code: 'ANTIKY_REQUEST_FAILED',
          developmentSessionId: options.developmentSessionId,
          requestId,
          component: 'inspection-server',
        });
        writeJson(response, 500, {
          error: { code: 'ANTIKY_INTERNAL_ERROR', message: 'Inspection service failed.' },
        }, allowedResponseOrigin);
      }
    })();
  });

  return Object.freeze({
    async start(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen({ host: options.host, port: options.port, exclusive: true }, resolve);
      });
    },
    async stop(): Promise<void> {
      if (!server.listening) return;
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  });
}
