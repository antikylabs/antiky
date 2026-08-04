import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { AntikyCliError } from '../src/errors.ts';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { MCP_RESOURCE_URIS, processMcpRequest, runMcpServer } from '../src/mcp-server.ts';

const frameworkInspection = {
  schemaVersion: 1,
  runtime: { instanceId: 'runtime-mcp-001', lifecycle: 'running' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 42, framesPerSecond: 60 },
    render: { owner: 'framework', canvasWidth: 640, canvasHeight: 480, drawCalls: 16 },
  },
} as const;

const developmentSnapshot = {
  schemaVersion: 1,
  developmentSessionId: 'development-mcp-001',
  acceptedBuildRevision: 3,
  startedAt: '2026-08-04T00:00:00.000Z',
  config: {
    path: '/project/antiky.config.json',
    gameUrl: 'http://127.0.0.1:3010/demos/town-study',
    host: '127.0.0.1',
    gamePort: 3010,
    inspectionPort: 3011,
  },
  processes: { game: { state: 'running' }, shaders: { state: 'running' } },
  connection: { state: 'connected' },
  cleanup: { state: 'active' },
  build: {
    owner: 'cli',
    revision: 3,
    changeKind: 'source',
    result: 'ready',
    durationMilliseconds: 118,
    changedPath: 'packages/demos/src/react/LiveDemoStage.tsx',
  },
  diagnostics: [{
    id: 'development-mcp-001:notice',
    owner: 'cli',
    source: 'build',
    revision: 3,
    code: 'ANTIKY_BUILD_NOTICE',
    severity: 'info',
    message: 'Build ready.',
    relatedIds: ['development-mcp-001'],
  }],
  measurements: { owner: 'cli', launchMilliseconds: 12 },
  inspection: frameworkInspection,
} as const;

test('MCP discovers and reads every Slice 00 resource from one typed client', async () => {
  const calls: string[] = [];
  const client = {
    async readDevelopmentSnapshot() {
      calls.push('read');
      return developmentSnapshot;
    },
    async requestReload() {
      calls.push('reload');
      return {
        schemaVersion: 1,
        actionId: 'action-reload-001',
        developmentSessionId: 'development-mcp-001',
        buildRevision: 3,
        oldRuntimeInstanceId: 'runtime-mcp-001',
        newRuntimeInstanceId: 'runtime-mcp-002',
        result: 'reloaded',
      } as const;
    },
    async captureFrame() {
      calls.push('capture');
      return {
        schemaVersion: 1,
        actionId: 'action-capture-001',
        captureId: 'capture-001',
        developmentSessionId: 'development-mcp-001',
        runtimeInstanceId: 'runtime-mcp-002',
        buildRevision: 3,
        mimeType: 'image/png',
        byteLength: 68,
        sha256: 'a'.repeat(64),
        path: '/project/.antiky/captures/capture-001.png',
      } as const;
    },
  };

  const initialized = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } },
  });
  assert.equal(initialized.result.protocolVersion, '2025-11-25');
  assert.deepEqual(initialized.result.capabilities, { resources: {}, tools: {} });

  const listed = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 2, method: 'resources/list', params: {},
  });
  assert.deepEqual(
    listed.result.resources.map((resource: { uri: string }) => resource.uri),
    MCP_RESOURCE_URIS,
  );

  for (const [index, uri] of MCP_RESOURCE_URIS.entries()) {
    const response = await processMcpRequest(client, {
      jsonrpc: '2.0', id: 10 + index, method: 'resources/read', params: { uri },
    });
    const content = response.result.contents[0];
    assert.equal(content.uri, uri);
    assert.equal(content.mimeType, 'application/json');
    assert.doesNotMatch(content.text, /credential/i);
    const value = JSON.parse(content.text);
    assert.equal(value.schemaVersion, 1);
    if (uri === 'antiky://runtime/status') assert.deepEqual(value.inspection, frameworkInspection);
  }

  const tools = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 30, method: 'tools/list', params: {},
  });
  assert.deepEqual(
    tools.result.tools.map((tool: { name: string }) => tool.name),
    ['dev_reload', 'capture_frame'],
  );

  const reload = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'dev_reload', arguments: {} },
  });
  assert.equal(reload.result.structuredContent.newRuntimeInstanceId, 'runtime-mcp-002');
  const capture = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 32, method: 'tools/call', params: { name: 'capture_frame', arguments: {} },
  });
  assert.equal(capture.result.structuredContent.captureId, 'capture-001');
  assert.deepEqual(calls, ['read', 'read', 'read', 'read', 'read', 'reload', 'capture']);
});

test('MCP returns bounded protocol errors for unknown resources, tools, and methods', async () => {
  const client = {
    async readDevelopmentSnapshot() { return developmentSnapshot; },
    async requestReload() { throw new Error('not reached'); },
    async captureFrame() { throw new Error('not reached'); },
  };
  const missingResource = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 'a', method: 'resources/read', params: { uri: 'antiky://unknown' },
  });
  assert.equal(missingResource.error.code, -32602);
  const missingTool = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 'b', method: 'tools/call', params: { name: 'unknown', arguments: {} },
  });
  assert.equal(missingTool.error.code, -32602);
  const missingMethod = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 'c', method: 'unknown', params: {},
  });
  assert.equal(missingMethod.error.code, -32601);
  assert.ok(JSON.stringify(missingMethod).length < 1024);
});

test('the MCP stdio adapter emits one JSON-RPC response per request line', async () => {
  const input = new PassThrough();
  let output = '';
  const client = {
    async readDevelopmentSnapshot() { return developmentSnapshot; },
    async requestReload() { throw new Error('not reached'); },
    async captureFrame() { throw new Error('not reached'); },
  };
  const running = runMcpServer(client, input, (line) => { output += line; });
  input.end([
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/list', params: {} }),
    '{',
    '',
  ].join('\n'));
  await running;

  const replies = output.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(replies.map((reply) => reply.id), [1, 2, null]);
  assert.equal(replies[2].error.code, -32700);
  assert.doesNotMatch(output, /credential/i);
});

test('MCP tool failures remain structured tool results with stable Antiky codes', async () => {
  const client = {
    async readDevelopmentSnapshot() { return developmentSnapshot; },
    async requestReload() {
      throw new AntikyCliError('ANTIKY_RUNTIME_UNAVAILABLE', 'The runtime is unavailable.');
    },
    async captureFrame() { throw new Error('not reached'); },
  };
  const failure = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 40, method: 'tools/call', params: { name: 'dev_reload', arguments: {} },
  });
  assert.equal(failure.result.isError, true);
  assert.deepEqual(failure.result.structuredContent, {
    schemaVersion: 1,
    error: {
      code: 'ANTIKY_RUNTIME_UNAVAILABLE',
      message: 'The runtime is unavailable.',
    },
  });
  assert.doesNotMatch(JSON.stringify(failure), /credential/i);
});
