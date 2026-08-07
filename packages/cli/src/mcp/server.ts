import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';

import {
  POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
  POINT_LIGHT_COMMAND_VERSION,
  SET_POINT_LIGHT_POWER_COMMAND_TYPE,
  parseCommandId,
  parseEntityId,
  parseWorldId,
  type CorrectPointLightPowerRequest,
  type SetPointLightPowerCommand,
} from '@antiky/framework';

import type { DevelopmentClient } from '../development/client.ts';
import { AntikyCliError } from '../errors.ts';
import {
  MCP_TOOL_DEFINITIONS,
  isMcpSnapshotReadToolName,
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

type McpDevelopmentClient = Pick<DevelopmentClient,
  | 'readDevelopmentSnapshot'
  | 'requestReload'
  | 'captureFrame'
  | 'listPointLights'
  | 'getPointLight'
  | 'setPointLightPower'
  | 'correctPointLightPower'
  | 'getSessionStatus'
  | 'getWorldInspection'
  | 'getEventHistory'
  | 'pauseSimulation'
  | 'resumeSimulation'
  | 'stepSimulation'
>;

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

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function readRevision(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;
}

function readStepSimulationArguments(
  value: unknown,
): { expectedCompletedStepCount: number } | null {
  const record = readRecord(value);
  if (!record || !hasExactKeys(record, ['expectedCompletedStepCount'])) return null;
  const expectedCompletedStepCount = readRevision(record.expectedCompletedStepCount);
  return expectedCompletedStepCount === null ? null : { expectedCompletedStepCount };
}

function readGetPointLightArguments(value: unknown): { entityId: string } | null {
  const record = readRecord(value);
  if (!record || !hasExactKeys(record, ['entityId'])) return null;
  try {
    return { entityId: parseEntityId(record.entityId) };
  } catch {
    return null;
  }
}

function readSetPointLightPowerArguments(value: unknown): SetPointLightPowerCommand | null {
  const record = readRecord(value);
  if (!record || !hasExactKeys(record, [
    'commandId',
    'worldId',
    'entityId',
    'expectedRevision',
    'power',
  ])) return null;
  const expectedRevision = readRevision(record.expectedRevision);
  if (
    expectedRevision === null
    || typeof record.power !== 'number'
    || !Number.isFinite(record.power)
    || record.power < 0
    || record.power > 4
  ) return null;
  try {
    return Object.freeze({
      protocolVersion: POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
      commandVersion: POINT_LIGHT_COMMAND_VERSION,
      type: SET_POINT_LIGHT_POWER_COMMAND_TYPE,
      commandId: parseCommandId(record.commandId),
      worldId: parseWorldId(record.worldId),
      entityId: parseEntityId(record.entityId),
      expectedRevision,
      data: Object.freeze({ power: record.power }),
    });
  } catch {
    return null;
  }
}

function readCorrectPointLightPowerArguments(
  value: unknown,
): CorrectPointLightPowerRequest | null {
  const record = readRecord(value);
  if (!record || !hasExactKeys(record, [
    'commandId',
    'correctedCommandId',
    'expectedRevision',
  ])) return null;
  const expectedRevision = readRevision(record.expectedRevision);
  if (expectedRevision === null) return null;
  try {
    return Object.freeze({
      protocolVersion: POINT_LIGHT_COMMAND_PROTOCOL_VERSION,
      commandVersion: POINT_LIGHT_COMMAND_VERSION,
      commandId: parseCommandId(record.commandId),
      correctedCommandId: parseCommandId(record.correctedCommandId),
      expectedRevision,
    });
  } catch {
    return null;
  }
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
    ) {
      return errorResponse(id, -32602, 'Invalid tool call.');
    }
    if (isMcpSnapshotReadToolName(params.name)) {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        const snapshot = await client.readDevelopmentSnapshot();
        return response(id, toolResult(projectMcpReadTool(params.name, snapshot)));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'list_point_lights') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.listPointLights()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'get_session_status') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.getSessionStatus()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'get_world_inspection' || params.name === 'get_event_log') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(
          params.name === 'get_world_inspection'
            ? await client.getWorldInspection()
            : await client.getEventHistory(),
        ));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'get_point_light') {
      const argumentsValue = readGetPointLightArguments(params.arguments);
      if (!argumentsValue) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.getPointLight(argumentsValue.entityId)));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'dev_reload') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.requestReload()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'capture_frame') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.captureFrame()));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'pause_simulation' || params.name === 'resume_simulation') {
      if (!emptyArguments(params.arguments)) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(
          params.name === 'pause_simulation'
            ? await client.pauseSimulation()
            : await client.resumeSimulation(),
        ));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'step_simulation') {
      const argumentsValue = readStepSimulationArguments(params.arguments);
      if (!argumentsValue) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.stepSimulation(
          argumentsValue.expectedCompletedStepCount,
        )));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'set_point_light_power') {
      const command = readSetPointLightPowerArguments(params.arguments);
      if (!command) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.setPointLightPower(command)));
      } catch (cause: unknown) {
        return response(id, toolFailure(cause));
      }
    }
    if (params.name === 'correct_point_light_power') {
      const correction = readCorrectPointLightPowerArguments(params.arguments);
      if (!correction) return errorResponse(id, -32602, 'Invalid tool call.');
      try {
        return response(id, toolResult(await client.correctPointLightPower(correction)));
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
