import assert from 'node:assert/strict';
import test from 'node:test';

// @ts-ignore direct TypeScript source import for the Node strip-types runner
import {
  MAX_MCP_CALL_LOG_ENTRIES,
  createMcpCallLog,
} from '../../../src/host/inspection/mcp-call-log.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { parseDevelopmentMcpCallLog } from '../../../src/development/mcp-calls.ts';

function toolCall(id: string | number, name: string, argumentsValue: unknown = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: argumentsValue },
  };
}

test('MCP call history is source-ordered, bounded, redacted, and correlation-aware', () => {
  let now = Date.parse('2026-08-05T12:00:00.000Z');
  let id = 0;
  const log = createMcpCallLog('development-call-log-001', {
    capacity: 2,
    nowMilliseconds: () => now,
    createId: () => `call-${++id}`,
  });

  const first = log.begin(toolCall(10, 'set_point_light_power', {
    commandId: 'command-001',
    credential: 'must-not-appear',
  }));
  assert.ok(first);
  now += 8;
  log.complete(first, {
    jsonrpc: '2.0',
    id: 10,
    result: {
      structuredContent: {
        actionId: 'action-001',
        runtimeInstanceId: 'runtime-001',
        value: 'x'.repeat(4_000),
      },
    },
  });

  const second = log.begin(toolCall(11, 'get_world_inspection'));
  const third = log.begin(toolCall(12, 'unknown_tool'));
  assert.ok(second && third);
  now += 3;
  log.complete(third, {
    jsonrpc: '2.0', id: 12, error: { code: -32602, message: 'Unknown tool.' },
  });
  now += 2;
  log.complete(second, { jsonrpc: '2.0', id: 11, result: { structuredContent: { ok: true } } });

  const history = log.read();
  assert.equal(MAX_MCP_CALL_LOG_ENTRIES >= 2, true);
  assert.equal(history.developmentSessionId, 'development-call-log-001');
  assert.equal(history.retention.scope, 'development-session');
  assert.equal(history.retention.capacity, 2);
  assert.equal(history.retention.droppedCount, 1);
  assert.deepEqual(history.calls.map((call) => call.sequence), [2, 3]);
  assert.deepEqual(history.calls.map((call) => call.toolName), [
    'get_world_inspection',
    'unknown_tool',
  ]);
  assert.equal(history.calls[1]?.outcome, 'protocol-error');
  assert.ok(Object.isFrozen(history));
  assert.ok(Object.isFrozen(history.calls));

  const serializedFirst = JSON.stringify(log.read()).toLowerCase();
  assert.doesNotMatch(serializedFirst, /must-not-appear/);
});

test('MCP call history marks redaction and truncation without logging its own reads', () => {
  let now = 100;
  const log = createMcpCallLog('development-call-log-002', {
    nowMilliseconds: () => now,
    createId: () => 'call-fixed',
  });
  assert.equal(log.begin({ jsonrpc: '2.0', id: 1, method: 'tools/list' }), null);

  const pending = log.begin(toolCall('rpc-1', 'capture_frame', {
    nested: { authorization: 'Bearer secret', note: 'y'.repeat(4_000) },
  }));
  assert.ok(pending);
  now = 107;
  log.complete(pending, {
    jsonrpc: '2.0',
    id: 'rpc-1',
    result: { structuredContent: { captureId: 'capture-001', path: '/local/capture.png' } },
  });

  const call = log.read().calls[0]!;
  assert.equal(call.durationMilliseconds, 7);
  assert.equal(call.redaction.applied, true);
  assert.ok(call.redaction.paths.includes('$.arguments.nested.authorization'));
  assert.ok(call.redaction.paths.includes('$.result.path'));
  assert.equal(call.truncation.applied, true);
  assert.ok(call.truncation.paths.includes('$.arguments.nested.note'));
  assert.deepEqual(call.correlationIds, {
    captureId: 'capture-001',
  });
  assert.doesNotMatch(JSON.stringify(call), /Bearer secret/);
  assert.doesNotMatch(JSON.stringify(call), /\/local\/capture\.png/);
});

test('every host-produced redaction path remains valid at the shared client boundary', () => {
  const key = 'a'.repeat(128);
  let value: unknown = { credential: 'must-not-appear' };
  for (let depth = 0; depth < 8; depth += 1) value = { [key]: value };
  const log = createMcpCallLog('development-call-log-003', {
    createId: () => 'call-deep',
  });
  const pending = log.begin(toolCall(1, 'deep_tool', value));
  assert.ok(pending);
  log.complete(pending, { result: { structuredContent: { ok: true } } });

  const history = log.read();
  assert.ok(history.calls[0]!.truncation.paths.some((path) => path.length > 512));
  assert.deepEqual(
    parseDevelopmentMcpCallLog(JSON.parse(JSON.stringify(history)), history.developmentSessionId),
    history,
  );
});
