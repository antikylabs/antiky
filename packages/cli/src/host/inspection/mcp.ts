import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  MCP_HTTP_PROTOCOL_VERSIONS,
  processMcpRequest,
} from '../../mcp/server.ts';
import type { McpCallLog } from './mcp-call-log.ts';
import {
  readJson,
  serviceError,
  writeEmpty,
  writeJson,
} from './http.ts';

type McpDevelopmentClient = Parameters<typeof processMcpRequest>[0];

function acceptsMcpResponse(header: string | undefined): boolean {
  const mediaTypes = new Set(
    header?.split(',').map((value) => value.split(';', 1)[0]!.trim().toLowerCase()),
  );
  return mediaTypes.has('application/json') && mediaTypes.has('text/event-stream');
}

function isMcpNotification(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.jsonrpc === '2.0'
    && typeof record.method === 'string'
    && !Object.hasOwn(record, 'id');
}

export async function handleMcpHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  client: McpDevelopmentClient,
  callLog: McpCallLog,
  maximumMessageBytes: number,
): Promise<void> {
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
  ) serviceError(400, 'ANTIKY_MCP_VERSION_UNSUPPORTED', 'Unsupported MCP protocol version.');

  const message = await readJson(request, maximumMessageBytes);
  const observation = callLog.begin(message);
  let reply: Awaited<ReturnType<typeof processMcpRequest>>;
  try {
    reply = await processMcpRequest(client, message);
  } catch (cause: unknown) {
    if (observation) {
      callLog.complete(observation, {
        error: { code: 'ANTIKY_INTERNAL_ERROR', message: 'MCP Tool call failed.' },
      });
    }
    throw cause;
  }
  if (observation) callLog.complete(observation, reply);
  if (isMcpNotification(message)) writeEmpty(response, 202);
  else writeJson(response, 200, reply);
}
