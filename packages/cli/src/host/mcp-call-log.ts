import { randomUUID } from 'node:crypto';

import type {
  DevelopmentMcpCall,
  DevelopmentMcpCallLog,
  DevelopmentMcpLogValue,
} from '../development/types.ts';

export const MAX_MCP_CALL_LOG_ENTRIES = 100;
export const MAX_MCP_CALL_LOG_VALUE_BYTES = 16 * 1024;

const MAX_DEPTH = 8;
const MAX_ITEMS = 64;
const MAX_PATHS = 32;
const MAX_STRING_CHARACTERS = 2_048;
const REDACTED = '[REDACTED]';
const SECRET_FIELD = /authorization|credential|password|secret|token|api[-_]?key|path|directory|hostname|username|pid/i;
const CORRELATION_FIELDS = [
  'actionId',
  'captureId',
  'commandId',
  'correctedCommandId',
  'developmentSessionId',
  'entityId',
  'runtimeInstanceId',
  'sessionId',
  'worldId',
] as const;

type LogOptions = Readonly<{
  capacity?: number;
  nowMilliseconds?: () => number;
  createId?: () => string;
}>;

type JsonRpcResponse = Readonly<{
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: unknown;
}>;

type Markers = {
  redactionPaths: string[];
  truncationPaths: string[];
};

export type McpCallObservation = Readonly<{
  sequence: number;
  callId: string;
  jsonRpcId: string | number | null;
  receivedAt: string;
  startedAtMilliseconds: number;
  toolName: string;
  argumentsValue: unknown;
}>;

export interface McpCallLog {
  begin(input: unknown): McpCallObservation | null;
  complete(observation: McpCallObservation, response: JsonRpcResponse): void;
  read(): DevelopmentMcpCallLog;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function mark(paths: string[], path: string): void {
  if (paths.length < MAX_PATHS && !paths.includes(path)) paths.push(path);
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value);
}

function sanitize(
  value: unknown,
  path: string,
  depth: number,
  ancestors: WeakSet<object>,
  markers: Markers,
): DevelopmentMcpLogValue {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value;
    mark(markers.truncationPaths, path);
    return '[Non-finite number]';
  }
  if (typeof value === 'string') {
    if (value.length <= MAX_STRING_CHARACTERS) return value;
    mark(markers.truncationPaths, path);
    return `${value.slice(0, MAX_STRING_CHARACTERS)}…`;
  }
  if (typeof value !== 'object') {
    mark(markers.truncationPaths, path);
    return '[Unsupported value]';
  }
  if (depth >= MAX_DEPTH || ancestors.has(value)) {
    mark(markers.truncationPaths, path);
    return depth >= MAX_DEPTH ? '[Depth limit]' : '[Circular value]';
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ITEMS).map((item, index) => (
        sanitize(item, `${path}[${index}]`, depth + 1, ancestors, markers)
      ));
      if (value.length > MAX_ITEMS) {
        mark(markers.truncationPaths, path);
        items.push(`[${value.length - MAX_ITEMS} items omitted]`);
      }
      return Object.freeze(items);
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      mark(markers.truncationPaths, path);
      return '[Unsupported object]';
    }
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort().slice(0, MAX_ITEMS);
    const output: Record<string, DevelopmentMcpLogValue> = {};
    for (const [index, key] of keys.entries()) {
      const outputKey = key.length <= 128 ? key : `${key.slice(0, 116)}…${index}`;
      const childPath = `${path}.${outputKey}`;
      if (outputKey !== key) mark(markers.truncationPaths, childPath);
      if (SECRET_FIELD.test(key)) {
        output[outputKey] = REDACTED;
        mark(markers.redactionPaths, childPath);
      } else {
        output[outputKey] = sanitize(
          source[key],
          childPath,
          depth + 1,
          ancestors,
          markers,
        );
      }
    }
    if (Object.keys(source).length > MAX_ITEMS) mark(markers.truncationPaths, path);
    return Object.freeze(output);
  } finally {
    ancestors.delete(value);
  }
}

function boundedValue(value: unknown, path: string, markers: Markers): DevelopmentMcpLogValue {
  const sanitized = sanitize(value, path, 0, new WeakSet(), markers);
  const encoded = JSON.stringify(sanitized);
  if (utf8Bytes(encoded) <= MAX_MCP_CALL_LOG_VALUE_BYTES) return sanitized;
  mark(markers.truncationPaths, path);
  return Object.freeze({
    truncated: true,
    originalByteLength: utf8Bytes(encoded),
  });
}

function readRpcId(value: unknown): string | number | null {
  if (typeof value === 'string') return value.slice(0, 128);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function findCorrelationIds(...values: unknown[]): DevelopmentMcpCall['correlationIds'] {
  const found: Record<string, string> = {};
  const seen = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (depth >= MAX_DEPTH || value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_ITEMS)) visit(item, depth + 1);
      return;
    }
    const valueRecord = value as Record<string, unknown>;
    for (const field of CORRELATION_FIELDS) {
      const candidate = valueRecord[field];
      if (
        !(field in found)
        && typeof candidate === 'string'
        && candidate.length > 0
        && candidate.length <= 256
        && !candidate.split('').some((character) => character < ' ')
      ) found[field] = candidate;
    }
    for (const child of Object.values(valueRecord).slice(0, MAX_ITEMS)) visit(child, depth + 1);
  };
  for (const value of values) visit(value, 0);
  return Object.freeze(found);
}

function projectedResponse(response: JsonRpcResponse): {
  outcome: DevelopmentMcpCall['outcome'];
  field: 'result' | 'error';
  value: unknown;
} {
  if (response.error !== undefined) {
    return { outcome: 'protocol-error', field: 'error', value: response.error };
  }
  const result = record(response.result);
  const value = result && 'structuredContent' in result
    ? result.structuredContent
    : response.result ?? null;
  return result?.isError === true
    ? { outcome: 'tool-error', field: 'error', value }
    : { outcome: 'success', field: 'result', value };
}

function readCapacity(value: number | undefined): number {
  if (value === undefined) return MAX_MCP_CALL_LOG_ENTRIES;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MCP_CALL_LOG_ENTRIES) {
    throw new RangeError(`MCP call-log capacity must be from 1 through ${MAX_MCP_CALL_LOG_ENTRIES}.`);
  }
  return value;
}

export function createMcpCallLog(
  developmentSessionId: string,
  options: LogOptions = {},
): McpCallLog {
  const capacity = readCapacity(options.capacity);
  const now = options.nowMilliseconds ?? Date.now;
  const createId = options.createId ?? (() => `mcp-call-${randomUUID()}`);
  const calls: DevelopmentMcpCall[] = [];
  let nextSequence = 1;
  let droppedCount = 0;

  return Object.freeze({
    begin(input: unknown): McpCallObservation | null {
      const request = record(input);
      if (request?.method !== 'tools/call') return null;
      const params = record(request.params);
      const startedAtMilliseconds = now();
      const name = typeof params?.name === 'string' ? params.name : '<invalid>';
      return Object.freeze({
        sequence: nextSequence++,
        callId: createId(),
        jsonRpcId: readRpcId(request.id),
        receivedAt: new Date(startedAtMilliseconds).toISOString(),
        startedAtMilliseconds,
        toolName: name.length <= 128 ? name : `${name.slice(0, 127)}…`,
        argumentsValue: params && 'arguments' in params ? params.arguments : {},
      });
    },

    complete(observation: McpCallObservation, response: JsonRpcResponse): void {
      const markers: Markers = { redactionPaths: [], truncationPaths: [] };
      const argumentsValue = boundedValue(
        observation.argumentsValue,
        '$.arguments',
        markers,
      );
      const projected = projectedResponse(response);
      const responseValue = boundedValue(
        projected.value,
        projected.field === 'result' ? '$.result' : '$.error',
        markers,
      );
      const duration = Math.max(0, Math.round(now() - observation.startedAtMilliseconds));
      const call: DevelopmentMcpCall = Object.freeze({
        sequence: observation.sequence,
        callId: observation.callId,
        jsonRpcId: observation.jsonRpcId,
        receivedAt: observation.receivedAt,
        durationMilliseconds: Number.isSafeInteger(duration) ? duration : Number.MAX_SAFE_INTEGER,
        toolName: observation.toolName,
        arguments: argumentsValue,
        outcome: projected.outcome,
        [projected.field]: responseValue,
        correlationIds: findCorrelationIds(observation.argumentsValue, projected.value),
        redaction: Object.freeze({
          applied: markers.redactionPaths.length > 0,
          paths: Object.freeze(markers.redactionPaths),
        }),
        truncation: Object.freeze({
          applied: markers.truncationPaths.length > 0,
          paths: Object.freeze(markers.truncationPaths),
        }),
      });
      calls.push(call);
      calls.sort((left, right) => left.sequence - right.sequence);
      while (calls.length > capacity) {
        calls.shift();
        droppedCount += 1;
      }
    },

    read(): DevelopmentMcpCallLog {
      return Object.freeze({
        schemaVersion: 1,
        developmentSessionId,
        owner: 'cli',
        retention: Object.freeze({
          scope: 'development-session',
          capacity,
          retainedCount: calls.length,
          droppedCount,
          firstSequence: calls[0]?.sequence ?? null,
          lastSequence: calls.at(-1)?.sequence ?? null,
        }),
        calls: Object.freeze([...calls]),
      });
    },
  });
}
