import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

import type { DevelopmentSnapshot } from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';
import {
  MCP_TOOL_DEFINITIONS,
  isMcpReadToolName,
  projectMcpReadTool,
} from './tools.ts';

export const MCP_PROTOCOL_VERSION = '2025-11-25';
export const MCP_HTTP_PATH = '/mcp';
export const MCP_HTTP_PROTOCOL_VERSIONS = Object.freeze([
  '2025-03-26',
  '2025-06-18',
  MCP_PROTOCOL_VERSION,
] as const);
const MAX_MCP_LINE_BYTES = 256 * 1024;

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
  if (value === undefined) return true;
  const record = readRecord(value);
  return record !== null && Object.keys(record).length === 0;
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
      capabilities: { tools: {} },
      serverInfo: { name: 'antiky', version: '0.0.0' },
    });
  }
  if (request.method === 'ping') return response(id, {});
  if (request.method === 'tools/list') return response(id, { tools: MCP_TOOL_DEFINITIONS });
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
    if (isMcpReadToolName(params.name)) {
      try {
        const snapshot = await client.readDevelopmentSnapshot();
        return response(id, toolResult(projectMcpReadTool(params.name, snapshot)));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
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
