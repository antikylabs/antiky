import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  createInspectionSnapshot,
  parseCommandId,
  parseEntityId,
  parseWorldId,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { processMcpRequest, runMcpServer } from '../src/mcp/server.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { MCP_TOOL_NAMES } from '../src/mcp/tools.ts';

const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
const LIGHT_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
const SET_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
const CORRECTION_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');

const authoringLight = {
  worldId: WORLD_ID,
  entityId: LIGHT_ID,
  label: 'Harbor Lamp',
  revision: 1,
  transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
  pointLight: { schemaVersion: 1, color: [1, 0.52, 0.22], radius: 4, power: 1.05 },
} as const;

const frameworkInspection = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: { instanceId: 'runtime-mcp-001', lifecycle: 'running' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 42, framesPerSecond: 60 },
    render: { owner: 'framework', canvasWidth: 640, canvasHeight: 480, drawCalls: 16 },
  },
  pointLights: {
    schemaVersion: 1,
    owner: 'framework',
    worldId: WORLD_ID,
    eventSequence: 0,
    authoring: [authoringLight],
    runtime: {
      instanceId: 'runtime-mcp-001',
      eventSequence: 0,
      pointLights: [{ entityId: LIGHT_ID, revision: 1, power: 1.05 }],
    },
    render: {
      eventSequence: 0,
      pointLights: [{ entityId: LIGHT_ID, renderSlot: 0, revision: 1, power: 1.05 }],
      dirtySlots: [],
    },
    facts: [],
  },
});

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
    viewport: { width: 1280, height: 720 },
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

const unusedPointLightMethods = {
  async listPointLights(): Promise<never> { throw new Error('not reached'); },
  async getPointLight(): Promise<never> { throw new Error('not reached'); },
  async setPointLightPower(): Promise<never> { throw new Error('not reached'); },
  async correctPointLightPower(): Promise<never> { throw new Error('not reached'); },
};

test('MCP exposes one well-described tools-only development surface', async () => {
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
    async listPointLights() {
      calls.push('list-point-lights');
      return {
        schemaVersion: 1,
        developmentSessionId: 'development-mcp-001',
        runtimeInstanceId: 'runtime-mcp-001',
        worldId: WORLD_ID,
        eventSequence: 0,
        pointLights: [authoringLight],
      } as const;
    },
    async getPointLight(entityId: string) {
      calls.push(`get-point-light:${entityId}`);
      return {
        schemaVersion: 1,
        developmentSessionId: 'development-mcp-001',
        runtimeInstanceId: 'runtime-mcp-001',
        worldId: WORLD_ID,
        eventSequence: 0,
        pointLight: {
          authoring: authoringLight,
          runtime: { entityId: LIGHT_ID, revision: 1, power: 1.05 },
          render: { entityId: LIGHT_ID, renderSlot: 0, revision: 1, power: 1.05 },
          facts: [],
        },
      } as const;
    },
    async setPointLightPower(command: unknown) {
      calls.push(`set-point-light:${JSON.stringify(command)}`);
      return {
        schemaVersion: 1,
        code: 'ACCEPTED',
        accepted: true,
        commandId: SET_COMMAND_ID,
        worldId: WORLD_ID,
        entityId: LIGHT_ID,
        currentRevision: 1,
        resultingRevision: 2,
        eventSequence: 1,
        runtimeInstanceId: 'runtime-mcp-001',
      } as const;
    },
    async correctPointLightPower(request: unknown) {
      calls.push(`correct-point-light:${JSON.stringify(request)}`);
      return {
        schemaVersion: 1,
        code: 'ACCEPTED',
        accepted: true,
        commandId: CORRECTION_COMMAND_ID,
        worldId: WORLD_ID,
        entityId: LIGHT_ID,
        currentRevision: 2,
        resultingRevision: 3,
        eventSequence: 2,
        runtimeInstanceId: 'runtime-mcp-001',
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
  assert.deepEqual(initialized.result.capabilities, { tools: {} });

  const resources = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 2, method: 'resources/list', params: {},
  });
  assert.equal(resources.error.code, -32601);

  const tools = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 30, method: 'tools/list', params: {},
  });
  const readToolNames = [
    'get_dev_status',
    'get_latest_build',
    'get_runtime_status',
    'get_render_stats',
    'get_diagnostics',
    'list_point_lights',
    'get_point_light',
  ];
  assert.deepEqual(
    tools.result.tools.map((tool: { name: string }) => tool.name),
    MCP_TOOL_NAMES,
  );
  assert.doesNotMatch(JSON.stringify(tools), /antiky:\/\//);

  const descriptionGuidance: Record<string, readonly RegExp[]> = {
    get_dev_status: [/call this first/i, /takes no arguments/i],
    get_latest_build: [/after a source, shader, asset, or config change/i, /accepted revision/i],
    get_runtime_status: [/before .*dev_reload.*capture_frame/i, /null inspection/i],
    get_render_stats: [/renderer health or performance/i, /does not capture/i],
    get_diagnostics: [/build is not ready/i, /stable code/i],
    list_point_lights: [/point-light inspection/i, /does not change/i],
    get_point_light: [/stable entity id/i, /accepted facts/i],
    dev_reload: [/after .*accepted revision/i, /does not start a development session/i],
    capture_frame: [/exact pixels/i, /get_render_stats/i],
    set_point_light_power: [/expected revision/i, /world\.light\.edit/i],
    correct_point_light_power: [/new accepted fact/i, /corrected command/i],
  };
  for (const definition of tools.result.tools as Array<{
    name: string;
    description: string;
    inputSchema: unknown;
    annotations: Record<string, boolean>;
  }>) {
    assert.ok(definition.description.length >= 120, `${definition.name} needs richer guidance`);
    for (const pattern of descriptionGuidance[definition.name] ?? []) {
      assert.match(definition.description, pattern);
    }
    assert.equal((definition.inputSchema as { type?: string }).type, 'object');
    assert.equal(
      (definition.inputSchema as { additionalProperties?: boolean }).additionalProperties,
      false,
    );
    assert.equal(definition.annotations.destructiveHint, false);
    assert.equal(definition.annotations.openWorldHint, false);
  }
  for (const name of readToolNames) {
    const definition = tools.result.tools.find((tool: { name: string }) => tool.name === name);
    assert.equal(definition.annotations.readOnlyHint, true);
    assert.equal(definition.annotations.idempotentHint, true);
  }

  for (const [index, name] of readToolNames.slice(0, 5).entries()) {
    const read = await processMcpRequest(client, {
      jsonrpc: '2.0',
      id: 40 + index,
      method: 'tools/call',
      params: index === 0 ? { name } : { name, arguments: {} },
    });
    assert.equal(read.result.structuredContent.schemaVersion, 1);
    assert.doesNotMatch(JSON.stringify(read), /credential/i);
  }

  const listed = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'list_point_lights' },
  });
  assert.equal(listed.result.structuredContent.pointLights[0].entityId, LIGHT_ID);
  const oneLight = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 51,
    method: 'tools/call',
    params: { name: 'get_point_light', arguments: { entityId: LIGHT_ID } },
  });
  assert.equal(oneLight.result.structuredContent.pointLight.authoring.label, 'Harbor Lamp');

  const reload = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'dev_reload', arguments: {} },
  });
  assert.equal(reload.result.structuredContent.newRuntimeInstanceId, 'runtime-mcp-002');
  const capture = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 32, method: 'tools/call', params: { name: 'capture_frame', arguments: {} },
  });
  assert.equal(capture.result.structuredContent.captureId, 'capture-001');
  const setPower = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 33,
    method: 'tools/call',
    params: {
      name: 'set_point_light_power',
      arguments: {
        commandId: SET_COMMAND_ID,
        worldId: WORLD_ID,
        entityId: LIGHT_ID,
        expectedRevision: 1,
        power: 2,
      },
    },
  });
  assert.equal(setPower.result.structuredContent.code, 'ACCEPTED');
  const corrected = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 34,
    method: 'tools/call',
    params: {
      name: 'correct_point_light_power',
      arguments: {
        commandId: CORRECTION_COMMAND_ID,
        correctedCommandId: SET_COMMAND_ID,
        expectedRevision: 2,
      },
    },
  });
  assert.equal(corrected.result.structuredContent.resultingRevision, 3);
  assert.deepEqual(calls, [
    'read', 'read', 'read', 'read', 'read',
    'list-point-lights', `get-point-light:${LIGHT_ID}`,
    'reload', 'capture',
    `set-point-light:${JSON.stringify({
      protocolVersion: 1,
      commandVersion: 1,
      type: 'antiky.authoring.set-point-light-power',
      commandId: SET_COMMAND_ID,
      worldId: WORLD_ID,
      entityId: LIGHT_ID,
      expectedRevision: 1,
      data: { power: 2 },
    })}`,
    `correct-point-light:${JSON.stringify({
      protocolVersion: 1,
      commandVersion: 1,
      commandId: CORRECTION_COMMAND_ID,
      correctedCommandId: SET_COMMAND_ID,
      expectedRevision: 2,
    })}`,
  ]);
});

test('MCP returns bounded protocol errors for Resource methods, unknown tools, and unknown methods', async () => {
  const client = {
    ...unusedPointLightMethods,
    async readDevelopmentSnapshot() { return developmentSnapshot; },
    async requestReload() { throw new Error('not reached'); },
    async captureFrame() { throw new Error('not reached'); },
  };
  const missingResource = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 'a', method: 'resources/read', params: { uri: 'antiky://unknown' },
  });
  assert.equal(missingResource.error.code, -32601);
  const missingTool = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 'b', method: 'tools/call', params: { name: 'unknown', arguments: {} },
  });
  assert.equal(missingTool.error.code, -32602);
  const invalidPointLightArguments = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 'invalid-point-light',
    method: 'tools/call',
    params: {
      name: 'set_point_light_power',
      arguments: {
        commandId: SET_COMMAND_ID,
        worldId: WORLD_ID,
        entityId: LIGHT_ID,
        expectedRevision: 1,
        power: 2,
        permissions: ['world.light.edit'],
      },
    },
  });
  assert.equal(invalidPointLightArguments.error.code, -32602);
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
    ...unusedPointLightMethods,
    async readDevelopmentSnapshot() { return developmentSnapshot; },
    async requestReload() { throw new Error('not reached'); },
    async captureFrame() { throw new Error('not reached'); },
  };
  const running = runMcpServer(client, input, (line) => { output += line; });
  input.end([
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
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
    ...unusedPointLightMethods,
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
