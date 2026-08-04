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

import type { DevelopmentSnapshot } from './development-types.ts';

const MAX_BROWSER_MESSAGE_BYTES = 256 * 1024;

type InspectionServerOptions = Readonly<{
  host: '127.0.0.1';
  port: number;
  developmentSessionId: string;
  gameUrl: string;
  credential: string;
  readDevelopmentSnapshot(): DevelopmentSnapshot;
  acceptInspection(snapshot: InspectionSnapshot): number;
}>;

export interface InspectionServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

class BrowserMessageError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
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

function requireExactOrigin(request: IncomingMessage, expectedOrigin: string): void {
  if (request.headers.origin !== expectedOrigin) {
    throw new BrowserMessageError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  const declaredLength = Number(request.headers['content-length']);
  if (
    request.headers['content-length'] !== undefined
    && (!Number.isSafeInteger(declaredLength) || declaredLength < 0)
  ) {
    throw new BrowserMessageError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid Content-Length header.');
  }
  if (declaredLength > MAX_BROWSER_MESSAGE_BYTES) {
    throw new BrowserMessageError(413, 'ANTIKY_MESSAGE_TOO_LARGE', 'Browser message is too large.');
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BROWSER_MESSAGE_BYTES) {
        reject(new BrowserMessageError(
          413,
          'ANTIKY_MESSAGE_TOO_LARGE',
          'Browser message is too large.',
        ));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.once('error', reject);
  });
}

function readSnapshotEnvelope(
  value: unknown,
  developmentSessionId: string,
): InspectionSnapshot {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BrowserMessageError(400, 'ANTIKY_MESSAGE_INVALID', 'Expected a message object.');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (
    keys.length !== 3
    || keys[0] !== 'developmentSessionId'
    || keys[1] !== 'schemaVersion'
    || keys[2] !== 'snapshot'
    || record.schemaVersion !== 1
  ) {
    throw new BrowserMessageError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid browser message fields.');
  }
  if (record.developmentSessionId !== developmentSessionId) {
    throw new BrowserMessageError(409, 'ANTIKY_SESSION_STALE', 'Development session is stale.');
  }
  try {
    return createInspectionSnapshot(record.snapshot);
  } catch (cause: unknown) {
    if (cause instanceof InspectionValidationError) {
      throw new BrowserMessageError(400, cause.code, cause.message);
    }
    throw cause;
  }
}

export function createInspectionServer(options: InspectionServerOptions): InspectionServer {
  const gameOrigin = new URL(options.gameUrl).origin;
  const expectedHost = `${options.host}:${options.port}`;
  const server: HttpServer = createHttpServer((request, response) => {
    void (async () => {
      try {
        if (request.headers.host !== expectedHost) {
          throw new BrowserMessageError(400, 'ANTIKY_HOST_INVALID', 'Invalid Host header.');
        }

        const isBrowserRoute = request.url === '/v1/browser/bootstrap'
          || request.url === '/v1/runtime/snapshot';
        if (isBrowserRoute) requireExactOrigin(request, gameOrigin);
        else if (request.headers.origin && request.headers.origin !== gameOrigin) {
          throw new BrowserMessageError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
        }

        if (request.method === 'OPTIONS' && isBrowserRoute) {
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

        if (request.method === 'GET' && request.url === '/v1/browser/bootstrap') {
          writeJson(response, 200, {
            schemaVersion: 1,
            developmentSessionId: options.developmentSessionId,
            gameUrl: options.gameUrl,
            credential: options.credential,
          }, gameOrigin);
          return;
        }

        if (!hasCredential(request.headers.authorization, options.credential)) {
          throw new BrowserMessageError(401, 'ANTIKY_UNAUTHORIZED', 'Authorization is required.');
        }
        if (request.method === 'GET' && request.url === '/v1/development') {
          writeJson(response, 200, options.readDevelopmentSnapshot());
          return;
        }
        if (request.method === 'POST' && request.url === '/v1/runtime/snapshot') {
          if (request.headers['content-type']?.split(';', 1)[0]?.trim() !== 'application/json') {
            throw new BrowserMessageError(
              415,
              'ANTIKY_CONTENT_TYPE_INVALID',
              'Content-Type must be application/json.',
            );
          }
          let message: unknown;
          try {
            message = JSON.parse(await readBody(request));
          } catch (cause: unknown) {
            if (cause instanceof BrowserMessageError) throw cause;
            throw new BrowserMessageError(400, 'ANTIKY_MESSAGE_INVALID', 'Malformed JSON message.');
          }
          const snapshot = readSnapshotEnvelope(message, options.developmentSessionId);
          const acceptedBuildRevision = options.acceptInspection(snapshot);
          writeJson(response, 202, {
            schemaVersion: 1,
            accepted: true,
            developmentSessionId: options.developmentSessionId,
            runtimeInstanceId: snapshot.runtime.instanceId,
            acceptedBuildRevision,
          }, gameOrigin);
          return;
        }
        throw new BrowserMessageError(404, 'ANTIKY_NOT_FOUND', 'Resource does not exist.');
      } catch (cause: unknown) {
        if (cause instanceof BrowserMessageError) {
          writeJson(response, cause.status, {
            error: { code: cause.code, message: cause.message },
          }, request.headers.origin === gameOrigin ? gameOrigin : undefined);
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
