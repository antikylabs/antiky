import { timingSafeEqual } from 'node:crypto';
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from 'node:http';

import {
  createInspectionSnapshot,
  InspectionValidationError,
  type InspectionSnapshot,
} from '@antiky/framework';

import {
  MAX_CAPTURE_ENVELOPE_BYTES,
  type BrowserDevelopmentAction,
  type CaptureActionInput,
} from './actions.ts';
import type {
  DevelopmentCaptureResult,
  DevelopmentReloadResult,
  DevelopmentSnapshot,
} from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';
import {
  MCP_HTTP_PATH,
  MCP_HTTP_PROTOCOL_VERSIONS,
  processMcpRequest,
} from '../mcp/server.ts';

const MAX_BROWSER_MESSAGE_BYTES = 256 * 1024;

type InspectionServerOptions = Readonly<{
  host: '127.0.0.1';
  port: number;
  developmentSessionId: string;
  gameUrl: string;
  credential: string;
  readDevelopmentSnapshot(): DevelopmentSnapshot;
  acceptInspection(snapshot: InspectionSnapshot, publicationSequence: number): number;
  disconnectRuntime(runtimeInstanceId: string, publicationSequence: number): void;
  touchRuntime(runtimeInstanceId: string): void;
  nextAction(runtimeInstanceId: string): BrowserDevelopmentAction | null;
  completeCapture(input: CaptureActionInput): Promise<void>;
  requestReload(): Promise<DevelopmentReloadResult>;
  captureFrame(): Promise<DevelopmentCaptureResult>;
}>;

export interface InspectionServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class InspectionServiceError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InspectionServiceError';
  }
}

type UnknownRecord = Record<string, unknown>;

function serviceError(status: number, code: string, message: string): never {
  throw new InspectionServiceError(status, code, message);
}

function hasCredential(header: string | undefined, credential: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(credential);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  allowedOrigin?: string,
): void {
  if (response.destroyed || response.writableEnded) return;
  const bodyText = JSON.stringify(body);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(bodyText),
    ...(allowedOrigin === undefined ? {} : {
      'access-control-allow-origin': allowedOrigin,
      vary: 'Origin',
    }),
  });
  response.end(bodyText);
}

function writeEmpty(
  response: ServerResponse,
  status: number,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'cache-control': 'no-store', ...headers });
  response.end();
}

function acceptsMcpResponse(header: string | undefined): boolean {
  const mediaTypes = new Set(
    header?.split(',').map((value) => value.split(';', 1)[0]!.trim().toLowerCase()),
  );
  return mediaTypes.has('application/json') && mediaTypes.has('text/event-stream');
}

function isMcpNotification(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as UnknownRecord;
  return record.jsonrpc === '2.0'
    && typeof record.method === 'string'
    && !Object.hasOwn(record, 'id');
}

function requireExactOrigin(request: IncomingMessage, expectedOrigin: string): void {
  if (request.headers.origin !== expectedOrigin) {
    serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
  }
}

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

function requireSession(record: UnknownRecord, developmentSessionId: string): void {
  if (record.schemaVersion !== 1) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid browser message version.');
  }
  if (record.developmentSessionId !== developmentSessionId) {
    serviceError(409, 'ANTIKY_SESSION_STALE', 'Development session is stale.');
  }
}

function readSequence(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Publication sequence must be a positive integer.');
  }
  return value as number;
}

function readBody(request: IncomingMessage, maximumBytes: number): Promise<string> {
  const declaredLength = Number(request.headers['content-length']);
  if (
    request.headers['content-length'] !== undefined
    && (!Number.isSafeInteger(declaredLength) || declaredLength < 0)
  ) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid Content-Length header.');
  if (declaredLength > maximumBytes) {
    serviceError(413, 'ANTIKY_MESSAGE_TOO_LARGE', 'Browser message is too large.');
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;
    request.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maximumBytes) {
        rejected = true;
        reject(new InspectionServiceError(
          413,
          'ANTIKY_MESSAGE_TOO_LARGE',
          'Browser message is too large.',
        ));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.once('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.once('error', reject);
  });
}

async function readJson(request: IncomingMessage, maximumBytes: number): Promise<unknown> {
  if (request.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/json') {
    serviceError(415, 'ANTIKY_CONTENT_TYPE_INVALID', 'Content-Type must be application/json.');
  }
  try {
    return JSON.parse(await readBody(request, maximumBytes));
  } catch (cause: unknown) {
    if (cause instanceof InspectionServiceError) throw cause;
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Malformed JSON message.');
  }
}

function readSnapshotEnvelope(
  value: unknown,
  developmentSessionId: string,
): { snapshot: InspectionSnapshot; publicationSequence: number } {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'publicationSequence',
    'snapshot',
  ])) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid browser message fields.');
  requireSession(record, developmentSessionId);
  try {
    return {
      snapshot: createInspectionSnapshot(record.snapshot),
      publicationSequence: readSequence(record.publicationSequence),
    };
  } catch (cause: unknown) {
    if (cause instanceof InspectionValidationError) {
      serviceError(400, cause.code, cause.message);
    }
    throw cause;
  }
}

function readDisconnectEnvelope(
  value: unknown,
  developmentSessionId: string,
): { runtimeInstanceId: string; publicationSequence: number } {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion',
    'developmentSessionId',
    'runtimeInstanceId',
    'publicationSequence',
  ])) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid disconnect message fields.');
  requireSession(record, developmentSessionId);
  if (typeof record.runtimeInstanceId !== 'string' || record.runtimeInstanceId.length > 128) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid runtime instance ID.');
  }
  return {
    runtimeInstanceId: record.runtimeInstanceId,
    publicationSequence: readSequence(record.publicationSequence),
  };
}

function readCaptureEnvelope(value: unknown, developmentSessionId: string): CaptureActionInput {
  const record = readObject(value);
  if (!hasExactKeys(record, [
    'schemaVersion', 'developmentSessionId', 'runtimeInstanceId', 'actionId', 'result',
  ])) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action result fields.');
  requireSession(record, developmentSessionId);
  const result = readObject(record.result);
  if (!hasExactKeys(result, [
    'kind', 'mimeType', 'canvasWidth', 'canvasHeight', 'dataBase64',
  ]) || result.kind !== 'capture' || result.mimeType !== 'image/png') {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid capture result fields.');
  }
  if (
    typeof record.actionId !== 'string'
    || typeof record.runtimeInstanceId !== 'string'
    || typeof result.dataBase64 !== 'string'
  ) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid capture result values.');
  return {
    actionId: record.actionId,
    runtimeInstanceId: record.runtimeInstanceId,
    mimeType: 'image/png',
    canvasWidth: result.canvasWidth as number,
    canvasHeight: result.canvasHeight as number,
    dataBase64: result.dataBase64,
  };
}

function readActionRequest(value: unknown): void {
  const record = readObject(value);
  if (!hasExactKeys(record, ['schemaVersion']) || record.schemaVersion !== 1) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid action request.');
  }
}

function actionStatus(cause: AntikyCliError): number {
  if (cause.code === 'ANTIKY_ACTION_TIMEOUT') return 504;
  if (cause.code === 'ANTIKY_RUNTIME_UNAVAILABLE') return 503;
  if (cause.code === 'ANTIKY_CAPTURE_INVALID') return 400;
  return 409;
}

export function createInspectionServer(options: InspectionServerOptions): InspectionServer {
  const gameOrigin = new URL(options.gameUrl).origin;
  const expectedHost = `${options.host}:${options.port}`;
  const mcpClient = Object.freeze({
    async readDevelopmentSnapshot() { return options.readDevelopmentSnapshot(); },
    requestReload: options.requestReload,
    captureFrame: options.captureFrame,
  });
  const server: HttpServer = createHttpServer((request, response) => {
    void (async () => {
      let browserRequest = false;
      try {
        if (request.headers.host !== expectedHost) {
          serviceError(400, 'ANTIKY_HOST_INVALID', 'Invalid Host header.');
        }
        const requestUrl = new URL(request.url ?? '/', `http://${expectedHost}`);
        browserRequest = requestUrl.pathname === '/v1/browser/bootstrap'
          || requestUrl.pathname.startsWith('/v1/runtime/');
        if (browserRequest) requireExactOrigin(request, gameOrigin);
        else if (request.headers.origin && request.headers.origin !== gameOrigin) {
          serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
        }

        // MCP clients need a stable URL across development sessions. This route relies on the
        // loopback bind plus the Host and Origin checks above; every inspection REST route below
        // remains protected by the per-session credential.
        if (requestUrl.pathname === MCP_HTTP_PATH) {
          if (request.method !== 'POST') {
            writeEmpty(response, 405, { allow: 'POST' });
            return;
          }
          if (!acceptsMcpResponse(request.headers.accept)) {
            serviceError(
              406,
              'ANTIKY_MCP_ACCEPT_INVALID',
              'MCP clients must accept application/json and text/event-stream.',
            );
          }
          const protocolVersion = request.headers['mcp-protocol-version'];
          if (
            protocolVersion !== undefined
            && (
              typeof protocolVersion !== 'string'
              || !MCP_HTTP_PROTOCOL_VERSIONS.includes(
                protocolVersion as typeof MCP_HTTP_PROTOCOL_VERSIONS[number],
              )
            )
          ) {
            serviceError(400, 'ANTIKY_MCP_VERSION_UNSUPPORTED', 'Unsupported MCP protocol version.');
          }
          const message = await readJson(request, MAX_BROWSER_MESSAGE_BYTES);
          const reply = await processMcpRequest(mcpClient, message);
          if (isMcpNotification(message)) {
            writeEmpty(response, 202);
          } else {
            writeJson(response, 200, reply);
          }
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
          writeJson(response, 200, options.readDevelopmentSnapshot());
          return;
        }
        if (request.method === 'POST' && requestUrl.pathname === '/v1/runtime/snapshot') {
          const envelope = readSnapshotEnvelope(
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
          const envelope = readDisconnectEnvelope(
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
          const capture = readCaptureEnvelope(
            await readJson(request, MAX_CAPTURE_ENVELOPE_BYTES),
            options.developmentSessionId,
          );
          await options.completeCapture(capture);
          writeJson(response, 202, { schemaVersion: 1, accepted: true }, gameOrigin);
          return;
        }
        if (
          request.method === 'POST'
          && (requestUrl.pathname === '/v1/actions/reload'
            || requestUrl.pathname === '/v1/actions/capture')
        ) {
          readActionRequest(await readJson(request, MAX_BROWSER_MESSAGE_BYTES));
          const result = requestUrl.pathname.endsWith('/reload')
            ? await options.requestReload()
            : await options.captureFrame();
          writeJson(response, 200, result);
          return;
        }
        serviceError(404, 'ANTIKY_NOT_FOUND', 'Resource does not exist.');
      } catch (cause: unknown) {
        if (cause instanceof InspectionServiceError) {
          writeJson(response, cause.status, {
            error: { code: cause.code, message: cause.message },
          }, browserRequest && request.headers.origin === gameOrigin ? gameOrigin : undefined);
          return;
        }
        if (cause instanceof AntikyCliError) {
          writeJson(response, actionStatus(cause), {
            error: { code: cause.code, message: cause.message },
          }, browserRequest && request.headers.origin === gameOrigin ? gameOrigin : undefined);
          return;
        }
        writeJson(response, 500, {
          error: { code: 'ANTIKY_INTERNAL_ERROR', message: 'Inspection service failed.' },
        });
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
