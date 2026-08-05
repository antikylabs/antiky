import type { AntikyConfig } from '../config.ts';
import { AntikyCliError } from '../errors.ts';
import { MCP_HTTP_PATH, MCP_PROTOCOL_VERSION } from './server.ts';

const MCP_ACCEPT = 'application/json, text/event-stream';
const MCP_REQUEST_TIMEOUT_MILLISECONDS = 15_000;

type UnknownRecord = Record<string, unknown>;

type JsonRpcResponse = Readonly<{
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: Readonly<{
    code?: unknown;
    message?: unknown;
  }>;
}>;

export type McpToolCallResult = Readonly<{
  structuredContent: unknown;
  isError: boolean;
}>;

function readRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function unavailable(message: string): never {
  throw new AntikyCliError('ANTIKY_SESSION_UNAVAILABLE', message);
}

function readResponse(value: unknown, expectedId: number): JsonRpcResponse {
  const response = readRecord(value);
  if (
    !response
    || response.jsonrpc !== '2.0'
    || response.id !== expectedId
    || (Object.hasOwn(response, 'result') === Object.hasOwn(response, 'error'))
  ) {
    unavailable('The Antiky MCP service returned an invalid response.');
  }
  return response as JsonRpcResponse;
}

function throwResponseError(response: JsonRpcResponse): never {
  const code = response.error?.code;
  const message = typeof response.error?.message === 'string'
    ? response.error.message
    : 'The Antiky MCP service rejected the request.';
  if (code === -32601 || code === -32602) {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', message);
  }
  unavailable(message);
}

async function postMcp(
  url: string,
  message: unknown,
  options: Readonly<{ protocolVersion?: string; notification?: boolean }> = {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: MCP_ACCEPT,
        'content-type': 'application/json',
        ...(options.protocolVersion
          ? { 'mcp-protocol-version': options.protocolVersion }
          : {}),
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(MCP_REQUEST_TIMEOUT_MILLISECONDS),
    });
  } catch {
    unavailable('The Antiky MCP service is unavailable. Start it with `antiky dev`.');
  }

  if (options.notification) {
    if (response.status !== 202) {
      unavailable(`The Antiky MCP service rejected initialization with status ${response.status}.`);
    }
    return null;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      error?: { message?: string };
    } | null;
    unavailable(
      body?.error?.message
        ?? `The Antiky MCP service rejected the request with status ${response.status}.`,
    );
  }

  try {
    return await response.json();
  } catch {
    unavailable('The Antiky MCP service returned invalid JSON.');
  }
}

export async function callMcpTool(
  config: AntikyConfig,
  name: string,
  argumentsValue: Readonly<Record<string, unknown>>,
): Promise<McpToolCallResult> {
  const url = `http://${config.network.host}:${config.network.inspectionPort}${MCP_HTTP_PATH}`;
  const initializeResponse = readResponse(await postMcp(url, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'antiky-cli', version: '0.0.0' },
    },
  }), 1);
  if (initializeResponse.error) throwResponseError(initializeResponse);

  const initialization = readRecord(initializeResponse.result);
  if (initialization?.protocolVersion !== MCP_PROTOCOL_VERSION) {
    unavailable('The Antiky MCP service uses an unsupported protocol version.');
  }

  await postMcp(url, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {},
  }, { protocolVersion: MCP_PROTOCOL_VERSION, notification: true });

  const callResponse = readResponse(await postMcp(url, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: argumentsValue },
  }, { protocolVersion: MCP_PROTOCOL_VERSION }), 2);
  if (callResponse.error) throwResponseError(callResponse);

  const result = readRecord(callResponse.result);
  if (!result || !Object.hasOwn(result, 'structuredContent')) {
    unavailable('The Antiky MCP service returned an invalid tool result.');
  }
  if (result.isError !== undefined && typeof result.isError !== 'boolean') {
    unavailable('The Antiky MCP service returned an invalid tool result.');
  }
  return Object.freeze({
    structuredContent: result.structuredContent,
    isError: result.isError === true,
  });
}
