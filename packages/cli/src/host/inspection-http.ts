import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const STUDIO_DEVELOPMENT_ORIGINS = new Set([
  'tauri://localhost',
  'http://tauri.localhost',
  'http://127.0.0.1:1420',
]);

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

export function serviceError(status: number, code: string, message: string): never {
  throw new InspectionServiceError(status, code, message);
}

export function hasCredential(header: string | undefined, credential: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(credential);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function writeJson(
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

export function writeEmpty(
  response: ServerResponse,
  status: number,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'cache-control': 'no-store', ...headers });
  response.end();
}

export function writeBytes(
  response: ServerResponse,
  status: number,
  bytes: Uint8Array,
  contentType: string,
  allowedOrigin?: string,
): void {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': contentType,
    'content-length': bytes.byteLength,
    'x-content-type-options': 'nosniff',
    ...(allowedOrigin === undefined ? {} : {
      'access-control-allow-origin': allowedOrigin,
      vary: 'Origin',
    }),
  });
  response.end(bytes);
}

export function requireExactOrigin(request: IncomingMessage, expectedOrigin: string): void {
  if (request.headers.origin !== expectedOrigin) {
    serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
  }
}

export function readDevelopmentOrigin(
  request: IncomingMessage,
  gameOrigin: string,
): string | undefined {
  const origin = request.headers.origin;
  if (origin === undefined) return undefined;
  if (origin === gameOrigin || STUDIO_DEVELOPMENT_ORIGINS.has(origin)) return origin;
  serviceError(403, 'ANTIKY_ORIGIN_INVALID', 'Invalid Origin header.');
}

export function validateCorsPreflight(
  request: IncomingMessage,
  expectedMethod: 'GET' | 'POST',
): void {
  if (request.headers['access-control-request-method'] !== expectedMethod) {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid CORS request method.');
  }
  const requestedHeaders = request.headers['access-control-request-headers'];
  if (typeof requestedHeaders !== 'string') {
    serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid CORS request headers.');
  }
  const headers = requestedHeaders
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter((header) => header.length > 0);
  if (
    headers.length === 0
    || headers.some((header) => header !== 'authorization' && header !== 'content-type')
    || !headers.includes('authorization')
  ) serviceError(400, 'ANTIKY_MESSAGE_INVALID', 'Invalid CORS request headers.');
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

export async function readJson(
  request: IncomingMessage,
  maximumBytes: number,
): Promise<unknown> {
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
