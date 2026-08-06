import type {
  DevelopmentMcpCall,
  DevelopmentMcpCallLog,
  DevelopmentMcpCallOutcome,
  DevelopmentMcpLogValue,
} from './types.ts';

const MAX_CALLS = 100;
const MAX_VALUE_BYTES = 16 * 1024;
const MAX_DEPTH = 8;
const MAX_ITEMS = 65;
const MAX_PATHS = 32;
const MAX_STRING_CHARACTERS = 2_064;
const CORRELATION_FIELDS = new Set([
  'actionId',
  'captureId',
  'commandId',
  'correctedCommandId',
  'developmentSessionId',
  'entityId',
  'runtimeInstanceId',
  'sessionId',
  'worldId',
]);

class McpCallLogValidationError extends Error {}

function fail(message: string): never {
  throw new McpCallLogValidationError(message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`Expected an object at ${path}.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    fail(`Unexpected fields at ${path}.`);
  }
}

function safeCount(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`Expected a non-negative safe integer at ${path}.`);
  }
  return value as number;
}

function boundedString(value: unknown, path: string, maximum = 256): string {
  if (
    typeof value !== 'string'
    || value.length < 1
    || value.length > maximum
    || [...value].some((character) => character < ' ')
  ) fail(`Expected a bounded string at ${path}.`);
  return value;
}

function readJsonValue(
  value: unknown,
  path: string,
  depth: number,
  ancestors: WeakSet<object>,
): DevelopmentMcpLogValue {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`Expected a finite number at ${path}.`);
    return value;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_STRING_CHARACTERS) fail(`String is too large at ${path}.`);
    return value;
  }
  if (typeof value !== 'object' || depth >= MAX_DEPTH || ancestors.has(value)) {
    fail(`Expected bounded acyclic JSON at ${path}.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_ITEMS) fail(`Array is too large at ${path}.`);
      return Object.freeze(value.map((item, index) => (
        readJsonValue(item, `${path}[${index}]`, depth + 1, ancestors)
      )));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) fail(`Expected plain JSON at ${path}.`);
    const source = value as Record<string, unknown>;
    if (Object.keys(source).length > MAX_ITEMS) fail(`Object is too large at ${path}.`);
    const output: Record<string, DevelopmentMcpLogValue> = {};
    for (const key of Object.keys(source).sort()) {
      if (key.length < 1 || key.length > 128) fail(`Invalid field at ${path}.`);
      output[key] = readJsonValue(source[key], `${path}.${key}`, depth + 1, ancestors);
    }
    return Object.freeze(output);
  } finally {
    ancestors.delete(value);
  }
}

function boundedJson(value: unknown, path: string): DevelopmentMcpLogValue {
  const result = readJsonValue(value, path, 0, new WeakSet());
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_VALUE_BYTES) {
    fail(`JSON value is too large at ${path}.`);
  }
  return result;
}

function readMarkers(value: unknown, path: string): DevelopmentMcpCall['redaction'] {
  const markers = record(value, path);
  exactKeys(markers, ['applied', 'paths'], path);
  if (typeof markers.applied !== 'boolean' || !Array.isArray(markers.paths)) {
    fail(`Invalid markers at ${path}.`);
  }
  if (markers.paths.length > MAX_PATHS) fail(`Too many marker paths at ${path}.`);
  const paths = Object.freeze(markers.paths.map((item, index) => (
    boundedString(item, `${path}.paths[${index}]`, 2_048)
  )));
  if (markers.applied !== (paths.length > 0)) fail(`Marker state disagrees at ${path}.`);
  return Object.freeze({ applied: markers.applied, paths });
}

function readCorrelationIds(value: unknown, path: string): DevelopmentMcpCall['correlationIds'] {
  const source = record(value, path);
  const output: Record<string, string> = {};
  for (const key of Object.keys(source).sort()) {
    if (!CORRELATION_FIELDS.has(key)) fail(`Unknown correlation ID at ${path}.${key}.`);
    output[key] = boundedString(source[key], `${path}.${key}`);
  }
  return Object.freeze(output);
}

function readOutcome(value: unknown, path: string): DevelopmentMcpCallOutcome {
  if (value === 'success' || value === 'tool-error' || value === 'protocol-error') return value;
  fail(`Invalid outcome at ${path}.`);
}

function readCall(value: unknown, path: string): DevelopmentMcpCall {
  const call = record(value, path);
  const outcome = readOutcome(call.outcome, `${path}.outcome`);
  const responseField = outcome === 'success' ? 'result' : 'error';
  exactKeys(call, [
    'sequence',
    'callId',
    'jsonRpcId',
    'receivedAt',
    'durationMilliseconds',
    'toolName',
    'arguments',
    'outcome',
    responseField,
    'correlationIds',
    'redaction',
    'truncation',
  ], path);
  const sequence = safeCount(call.sequence, `${path}.sequence`);
  if (sequence < 1) fail(`Invalid sequence at ${path}.sequence.`);
  const receivedAt = boundedString(call.receivedAt, `${path}.receivedAt`, 64);
  if (!Number.isFinite(Date.parse(receivedAt))) fail(`Invalid time at ${path}.receivedAt.`);
  const jsonRpcId = call.jsonRpcId;
  if (!(jsonRpcId === null
    || (typeof jsonRpcId === 'string' && jsonRpcId.length <= 128)
    || (typeof jsonRpcId === 'number' && Number.isFinite(jsonRpcId)))) {
    fail(`Invalid JSON-RPC ID at ${path}.jsonRpcId.`);
  }
  return Object.freeze({
    sequence,
    callId: boundedString(call.callId, `${path}.callId`, 160),
    jsonRpcId,
    receivedAt,
    durationMilliseconds: safeCount(call.durationMilliseconds, `${path}.durationMilliseconds`),
    toolName: boundedString(call.toolName, `${path}.toolName`, 128),
    arguments: boundedJson(call.arguments, `${path}.arguments`),
    outcome,
    [responseField]: boundedJson(call[responseField], `${path}.${responseField}`),
    correlationIds: readCorrelationIds(call.correlationIds, `${path}.correlationIds`),
    redaction: readMarkers(call.redaction, `${path}.redaction`),
    truncation: readMarkers(call.truncation, `${path}.truncation`),
  });
}

export function parseDevelopmentMcpCallLog(
  input: unknown,
  developmentSessionId: string,
): DevelopmentMcpCallLog {
  const log = record(input, '$');
  exactKeys(log, [
    'schemaVersion',
    'developmentSessionId',
    'owner',
    'retention',
    'calls',
  ], '$');
  if (
    log.schemaVersion !== 1
    || log.developmentSessionId !== developmentSessionId
    || log.owner !== 'cli'
    || !Array.isArray(log.calls)
    || log.calls.length > MAX_CALLS
  ) fail('Incompatible MCP call log.');
  const calls = Object.freeze(log.calls.map((call, index) => readCall(call, `$.calls[${index}]`)));
  for (let index = 1; index < calls.length; index += 1) {
    if (calls[index - 1]!.sequence >= calls[index]!.sequence) fail('Call sequence is not ordered.');
  }

  const retention = record(log.retention, '$.retention');
  exactKeys(retention, [
    'scope',
    'capacity',
    'retainedCount',
    'droppedCount',
    'firstSequence',
    'lastSequence',
  ], '$.retention');
  const capacity = safeCount(retention.capacity, '$.retention.capacity');
  const retainedCount = safeCount(retention.retainedCount, '$.retention.retainedCount');
  const droppedCount = safeCount(retention.droppedCount, '$.retention.droppedCount');
  const firstSequence = retention.firstSequence === null
    ? null
    : safeCount(retention.firstSequence, '$.retention.firstSequence');
  const lastSequence = retention.lastSequence === null
    ? null
    : safeCount(retention.lastSequence, '$.retention.lastSequence');
  if (
    retention.scope !== 'development-session'
    || capacity < 1
    || capacity > MAX_CALLS
    || calls.length > capacity
    || retainedCount !== calls.length
    || firstSequence !== (calls[0]?.sequence ?? null)
    || lastSequence !== (calls.at(-1)?.sequence ?? null)
  ) fail('Invalid MCP call-log retention.');

  return Object.freeze({
    schemaVersion: 1,
    developmentSessionId,
    owner: 'cli',
    retention: Object.freeze({
      scope: 'development-session',
      capacity,
      retainedCount,
      droppedCount,
      firstSequence,
      lastSequence,
    }),
    calls,
  });
}
