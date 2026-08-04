import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

import type { DevelopmentSnapshot } from './development-types.ts';
import { AntikyCliError } from './errors.ts';

const MCP_PROTOCOL_VERSION = '2025-11-25';
const MAX_MCP_LINE_BYTES = 256 * 1024;

export const MCP_RESOURCE_URIS = Object.freeze([
  'antiky://dev/status',
  'antiky://build/latest',
  'antiky://runtime/status',
  'antiky://render/stats',
  'antiky://diagnostics',
] as const);

type McpResourceUri = typeof MCP_RESOURCE_URIS[number];

type McpDevelopmentClient = Readonly<{
  readDevelopmentSnapshot(): Promise<DevelopmentSnapshot>;
  requestReload(): Promise<unknown>;
  captureFrame(): Promise<unknown>;
}>;

type JsonRpcRequest = Readonly<{
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}>;

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  // MCP values are validated before construction. The open JSON shape is the protocol boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any;
};

const resources = Object.freeze([
  {
    uri: 'antiky://dev/status',
    name: 'Antiky development status',
    description: 'Development session, config, service health, and CLI measurements.',
    mimeType: 'application/json',
  },
  {
    uri: 'antiky://build/latest',
    name: 'Latest Antiky build',
    description: 'Accepted revision and the latest build attempt.',
    mimeType: 'application/json',
  },
  {
    uri: 'antiky://runtime/status',
    name: 'Antiky runtime status',
    description: 'Runtime connection and the exact framework inspection snapshot.',
    mimeType: 'application/json',
  },
  {
    uri: 'antiky://render/stats',
    name: 'Antiky render statistics',
    description: 'Available framework-owned frame, canvas, draw, instance, and upload facts.',
    mimeType: 'application/json',
  },
  {
    uri: 'antiky://diagnostics',
    name: 'Antiky diagnostics',
    description: 'Bounded CLI-development and framework-runtime diagnostics.',
    mimeType: 'application/json',
  },
] as const);

const tools = Object.freeze([
  {
    name: 'dev_reload',
    description: 'Reload the connected browser runtime without starting a new development session.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'capture_frame',
    description: 'Capture the connected game canvas as a PNG with related session and revision IDs.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
] as const);

function response(
  id: string | number | null,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function emptyArguments(value: unknown): boolean {
  const record = readRecord(value);
  return record !== null && Object.keys(record).length === 0;
}

function resourceValue(uri: McpResourceUri, snapshot: DevelopmentSnapshot): unknown {
  switch (uri) {
    case 'antiky://dev/status':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        startedAt: snapshot.startedAt,
        config: snapshot.config,
        processes: snapshot.processes,
        connection: snapshot.connection,
        cleanup: snapshot.cleanup,
        measurements: snapshot.measurements,
      };
    case 'antiky://build/latest':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        build: snapshot.build,
      };
    case 'antiky://runtime/status':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        connection: snapshot.connection,
        inspection: snapshot.inspection,
      };
    case 'antiky://render/stats':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        runtimeInstanceId: snapshot.inspection?.runtime.instanceId ?? null,
        runtime: snapshot.inspection?.measurements.runtime ?? null,
        render: snapshot.inspection?.measurements.render ?? null,
      };
    case 'antiky://diagnostics':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        development: snapshot.diagnostics,
        framework: snapshot.inspection?.diagnostics ?? [],
      };
  }
}

function readResourceUri(params: unknown): McpResourceUri | null {
  const record = readRecord(params);
  if (!record || Object.keys(record).length !== 1 || typeof record.uri !== 'string') return null;
  return MCP_RESOURCE_URIS.includes(record.uri as McpResourceUri)
    ? record.uri as McpResourceUri
    : null;
}

function toolResult(value: unknown): unknown {
  const text = JSON.stringify(value);
  return {
    content: [{ type: 'text', text }],
    structuredContent: value,
  };
}

function toolFailure(cause: unknown): unknown {
  const error = cause instanceof AntikyCliError
    ? { code: cause.code, message: cause.message }
    : { code: 'ANTIKY_INTERNAL_ERROR', message: 'The development action failed.' };
  const structuredContent = { schemaVersion: 1, error };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true,
  };
}

export async function processMcpRequest(
  client: McpDevelopmentClient,
  input: unknown,
): Promise<JsonRpcResponse> {
  const request = readRecord(input) as JsonRpcRequest | null;
  const id = request?.id ?? null;
  if (
    !request
    || request.jsonrpc !== '2.0'
    || typeof request.method !== 'string'
    || (request.id !== undefined
      && request.id !== null
      && typeof request.id !== 'string'
      && typeof request.id !== 'number')
  ) {
    return errorResponse(id, -32600, 'Invalid Request');
  }

  if (request.method === 'initialize') {
    return response(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { resources: {}, tools: {} },
      serverInfo: { name: 'antiky', version: '0.0.0' },
    });
  }
  if (request.method === 'ping') return response(id, {});
  if (request.method === 'resources/list') return response(id, { resources });
  if (request.method === 'resources/read') {
    const uri = readResourceUri(request.params);
    if (!uri) return errorResponse(id, -32602, 'Unknown or invalid resource URI.');
    const snapshot = await client.readDevelopmentSnapshot();
    return response(id, {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(resourceValue(uri, snapshot)),
      }],
    });
  }
  if (request.method === 'tools/list') return response(id, { tools });
  if (request.method === 'tools/call') {
    const params = readRecord(request.params);
    if (
      !params
      || Object.keys(params).some((key) => key !== 'name' && key !== 'arguments')
      || typeof params.name !== 'string'
      || !emptyArguments(params.arguments)
    ) {
      return errorResponse(id, -32602, 'Invalid tool call.');
    }
    if (params.name === 'dev_reload') {
      try {
        return response(id, toolResult(await client.requestReload()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'capture_frame') {
      try {
        return response(id, toolResult(await client.captureFrame()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    return errorResponse(id, -32602, 'Unknown tool.');
  }
  if (request.method === 'notifications/initialized' && request.id === undefined) {
    return response(null, {});
  }
  return errorResponse(id, -32601, 'Method not found.');
}

export async function runMcpServer(
  client: McpDevelopmentClient,
  input: Readable = process.stdin,
  write: (line: string) => void = (line) => process.stdout.write(line),
): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
  for await (const line of lines) {
    let reply: JsonRpcResponse;
    if (Buffer.byteLength(line) > MAX_MCP_LINE_BYTES) {
      reply = errorResponse(null, -32600, 'Request is too large.');
    } else {
      try {
        reply = await processMcpRequest(client, JSON.parse(line));
      } catch {
        reply = errorResponse(null, -32700, 'Parse error.');
      }
    }
    if (reply.id !== null || reply.error) write(`${JSON.stringify(reply)}\n`);
  }
}
