import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  createInspectionSnapshot,
  createPointLightWorldViews,
  parseCommandId,
  parseEntityId,
  parseSessionId,
  parseWorldId,
} from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
import type { AntikyProject } from '../src/project.ts';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { callMcpTool } from '../src/mcp/client.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  MCP_PROTOCOL_VERSION,
  processMcpRequest,
  runMcpServer,
} from '../src/mcp/server.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { MCP_TOOL_NAMES } from '../src/mcp/tools.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { readCaptureCapabilities } from '../src/host/capture-capability-service.ts';

const WORLD_ID = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
const LIGHT_ID = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
const SET_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
const CORRECTION_COMMAND_ID = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');
const SESSION_ID = parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0');
const captureCapabilities = readCaptureCapabilities({
  configuredWidth: 1280,
  configuredHeight: 720,
  interactiveRuntimeConnected: true,
  probe: () => ({
    playwrightVersion: '1.62.1',
    browserRevision: '1234',
    browserVersion: '151.0.7922.34',
    browserInstalled: true,
  }),
});

test('the human CLI gives bounded MCP action tools the full action deadline', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const deadlines: number[] = [];
  let request = 0;
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value(milliseconds: number) {
      deadlines.push(milliseconds);
      return new AbortController().signal;
    },
  });
  globalThis.fetch = (async () => {
    request += 1;
    if (request === 1) {
      return Response.json({
        jsonrpc: '2.0',
        id: 1,
        result: { protocolVersion: MCP_PROTOCOL_VERSION },
      });
    }
    if (request === 2) return new Response(null, { status: 202 });
    return Response.json({
      jsonrpc: '2.0',
      id: 2,
      result: { structuredContent: { ok: true }, isError: false },
    });
  }) as typeof fetch;

  try {
    const result = await callMcpTool({
      network: { host: '127.0.0.1', inspectionPort: 3011 },
    } as unknown as AntikyProject, 'capture_gameplay_sequence', {});
    assert.deepEqual(result, { structuredContent: { ok: true }, isError: false });
    assert.deepEqual(deadlines, [15_000, 15_000, 30_000]);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(AbortSignal, 'timeout', {
      configurable: true,
      value: originalTimeout,
    });
  }
});

const runningSession = {
  schemaVersion: 2 as const,
  sessionId: SESSION_ID,
  worldId: WORLD_ID,
  runtimeInstanceId: 'runtime-mcp-001',
  mode: 'running' as const,
  fault: null,
  pauseReasons: [] as const,
  systemOrder: ['town-update'] as const,
  clock: {
    fixedStepSeconds: 1 / 60,
    maximumFrameElapsedSeconds: 0.05,
    maximumStepsPerFrame: 3,
    accumulatorSeconds: 0,
    completedStepCount: 4,
    inputSequence: 4,
    totalAcceptedElapsedSeconds: 4 / 60,
    totalDiscardedSeconds: 0,
  },
  revisions: { commandSequence: 0, controlRevision: 0, worldRevision: 0 },
  lastCompletedStep: {
    completedStepId: 4,
    inputSequence: 4,
    stateDigest: 'town:mcp-fixture',
  },
} as const;

const authoringLight = {
  worldId: WORLD_ID,
  entityId: LIGHT_ID,
  label: 'Harbor Lamp',
  revision: 1,
  transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
  pointLight: { schemaVersion: 1, color: [1, 0.52, 0.22], radius: 4, power: 1.05 },
} as const;

const pointLightInspection = {
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
} as const;

const worldViews = createPointLightWorldViews(pointLightInspection);

const frameworkInspection = createInspectionSnapshot({
  schemaVersion: 1,
  runtime: { instanceId: 'runtime-mcp-001', lifecycle: 'running' },
  diagnostics: [],
  measurements: {
    runtime: { owner: 'framework', frameCount: 42, framesPerSecond: 60 },
    render: { owner: 'framework', canvasWidth: 640, canvasHeight: 480, drawCalls: 16 },
  },
  session: runningSession,
  pointLights: pointLightInspection,
  ...worldViews,
});

const developmentSnapshot = {
  schemaVersion: 1,
  developmentSessionId: 'development-mcp-001',
  acceptedBuildRevision: 3,
  startedAt: '2026-08-04T00:00:00.000Z',
  project: {
    name: 'Test project',
    manifestPath: '/project/test.antiky',
    projectRoot: '/project',
    revision: 'a'.repeat(64),
    gameUrl: 'http://127.0.0.1:3010/demos/town-study',
    host: '127.0.0.1',
    gamePort: 3010,
    inspectionPort: 3011,
    viewport: { width: 1280, height: 720 },
  },
  processes: {
    game: { state: 'running', pid: 41001 },
    shaders: { state: 'running', pid: 41002 },
  },
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

const observation = Object.freeze({
  schemaVersion: 1 as const,
  developmentSessionId: 'development-mcp-001',
  acceptedBuildRevision: 3,
  runtimeInstanceId: 'runtime-mcp-001',
  publicationSequence: 5,
  publishedAt: '2026-08-10T17:40:00.000Z',
  connectionState: 'connected' as const,
  freshness: 'current' as const,
  session: Object.freeze({
    sessionId: SESSION_ID,
    worldId: WORLD_ID,
    mode: 'running' as const,
    completedStepCount: 4,
    controlRevision: 0,
    worldRevision: 0,
    stateDigest: 'fixture:4',
  }),
  world: Object.freeze({ worldId: WORLD_ID, revision: 0, eventSequence: 0 }),
});

const developmentSnapshotV2 = Object.freeze({
  ...developmentSnapshot,
  schemaVersion: 2 as const,
  observation,
});
const capturePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const captureArtifact = Object.freeze({
  schemaVersion: 1 as const,
  evidenceId: 'evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0',
  artifactId: 'artifact-431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460',
  uri: 'antiky-evidence://evidence-018f0f3a-7b2c-7a1d-8e2f-123456789ab0/artifact-431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460',
  kind: 'still' as const,
  role: 'canvas-master',
  mimeType: 'image/png' as const,
  width: 1,
  height: 1,
  byteLength: capturePng.byteLength,
  sha256: '431ced6916a2a21a156e38701afe55bbd7f88969fbbfc56d7fe099d47f265460',
  createdAt: '2026-08-10T17:40:01.000Z',
  observation,
  reviewState: 'private-unreviewed' as const,
  retention: Object.freeze({ scope: 'development-session' as const, state: 'retained' as const }),
  privacy: Object.freeze({
    gameCanvasOnly: true as const,
    desktopPixelsPossible: false as const,
    audio: 'none' as const,
    contentScan: 'not-performed' as const,
  }),
});

function sequenceArtifact(
  kind: 'poster' | 'manifest' | 'video',
  role: string,
  hashCharacter: string,
  mimeType: 'image/png' | 'application/json' | 'video/webm',
) {
  const sha256 = hashCharacter.repeat(64);
  return Object.freeze({
    ...captureArtifact,
    artifactId: `artifact-${sha256}`,
    uri: `${captureArtifact.uri.slice(0, captureArtifact.uri.indexOf('/artifact-'))}/artifact-${sha256}`,
    kind,
    role,
    mimeType,
    width: mimeType === 'application/json' ? null : 1,
    height: mimeType === 'application/json' ? null : 1,
    sha256,
  });
}

const captureSequenceResult = Object.freeze({
  schemaVersion: 1 as const,
  sequenceId: 'sequence-mcp-001',
  source: 'managed-runtime' as const,
  evidenceId: captureArtifact.evidenceId,
  observations: Object.freeze({ start: observation, end: observation }),
  target: Object.freeze({ width: 1, height: 1, deviceScaleFactor: 1 }),
  cadence: Object.freeze({
    framesPerSecond: 10,
    requestedFrameCount: 1,
    actualFrameCount: 1,
    lateFrameCount: 0 as const,
    droppedFrameCount: 0 as const,
    captureOffsetsMilliseconds: Object.freeze([100]),
  }),
  completedSteps: Object.freeze({
    start: observation.session!.completedStepCount,
    end: observation.session!.completedStepCount,
    startStateDigest: observation.session!.stateDigest,
    endStateDigest: observation.session!.stateDigest,
  }),
  artifacts: Object.freeze({
    masterFrameCount: 1,
    poster: sequenceArtifact('poster', 'sequence-poster', 'b', 'image/png'),
    manifest: sequenceArtifact('manifest', 'sequence-manifest', 'c', 'application/json'),
    video: sequenceArtifact('video', 'review-derivative', 'd', 'video/webm'),
    presentationTrace: null,
  }),
});

const unusedPointLightMethods = {
  async getWorldInspection(): Promise<never> { throw new Error('not reached'); },
  async getEventHistory(): Promise<never> { throw new Error('not reached'); },
  async listPointLights(): Promise<never> { throw new Error('not reached'); },
  async getPointLight(): Promise<never> { throw new Error('not reached'); },
  async setPointLightPower(): Promise<never> { throw new Error('not reached'); },
  async correctPointLightPower(): Promise<never> { throw new Error('not reached'); },
  async getSessionStatus(): Promise<never> { throw new Error('not reached'); },
  async pauseSimulation(): Promise<never> { throw new Error('not reached'); },
  async resumeSimulation(): Promise<never> { throw new Error('not reached'); },
  async stepSimulation(): Promise<never> { throw new Error('not reached'); },
};

test('MCP exposes one well-described tools-only development surface', async () => {
  const calls: string[] = [];
  const client = {
    async readDevelopmentSnapshot() {
      calls.push('read');
      return developmentSnapshot;
    },
    async readDevelopmentSnapshotV2() {
      calls.push('read-v2');
      return developmentSnapshotV2;
    },
    async getCaptureCapabilities() {
      calls.push('capture-capabilities');
      return captureCapabilities;
    },
    async getRenderEvidence() {
      calls.push('render-evidence');
      return {
        schemaVersion: 1 as const,
        developmentSessionId: observation.developmentSessionId,
        availableCount: 1,
        retainedCount: 1,
        complete: true,
        artifacts: Object.freeze([Object.freeze({
          creationSequence: 2,
          artifact: captureSequenceResult.artifacts.poster,
        })]),
      };
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
    async captureFrameV2() {
      calls.push('capture-v2');
      return {
        schemaVersion: 2,
        actionId: 'action-capture-002',
        captureId: 'capture-002',
        source: 'interactive-runtime',
        observation,
        deviceScaleFactor: 1,
        artifact: captureArtifact,
      } as const;
    },
    async captureFrameV3() {
      calls.push('capture-v3');
      return {
        schemaVersion: 3,
        actionId: 'action-capture-003',
        captureId: 'capture-003',
        source: 'managed-runtime',
        observation,
        deviceScaleFactor: 1,
        artifact: captureArtifact,
      } as const;
    },
    async captureGameplaySequence() {
      calls.push('capture-sequence');
      return captureSequenceResult;
    },
    async readEvidenceArtifact() {
      calls.push('read-evidence');
      return capturePng;
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
    async getSessionStatus() {
      calls.push('get-session-status');
      return {
        schemaVersion: 1,
        developmentSessionId: 'development-mcp-001',
        session: runningSession,
      } as const;
    },
    async getWorldInspection() {
      calls.push('get-world-inspection');
      return {
        schemaVersion: 1,
        developmentSessionId: 'development-mcp-001',
        world: worldViews.world,
      } as const;
    },
    async getEventHistory() {
      calls.push('get-event-history');
      return {
        schemaVersion: 1,
        developmentSessionId: 'development-mcp-001',
        events: worldViews.events,
      } as const;
    },
    async pauseSimulation() {
      calls.push('pause-simulation');
      return {
        schemaVersion: 1,
        actionId: 'action-pause-001',
        developmentSessionId: 'development-mcp-001',
        result: {
          code: 'PAUSED',
          mode: 'paused',
          completedStepCount: 4,
          controlRevision: 1,
          pauseReasons: ['tool'],
          renderRequested: false,
        },
        session: { ...runningSession, mode: 'paused', pauseReasons: ['tool'] },
      } as const;
    },
    async resumeSimulation() {
      calls.push('resume-simulation');
      return {
        schemaVersion: 1,
        actionId: 'action-resume-001',
        developmentSessionId: 'development-mcp-001',
        result: {
          code: 'RESUMED',
          mode: 'running',
          completedStepCount: 4,
          controlRevision: 2,
          pauseReasons: [],
          renderRequested: false,
        },
        session: runningSession,
      } as const;
    },
    async stepSimulation(expectedCompletedStepCount: number) {
      calls.push(`step-simulation:${expectedCompletedStepCount}`);
      return {
        schemaVersion: 1,
        actionId: 'action-step-001',
        developmentSessionId: 'development-mcp-001',
        result: {
          code: 'STEPPED',
          mode: 'paused',
          completedStepCount: 5,
          controlRevision: 2,
          pauseReasons: ['tool'],
          renderRequested: true,
        },
        session: { ...runningSession, mode: 'paused', pauseReasons: ['tool'] },
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
    'get_capture_capabilities',
    'get_render_evidence',
    'get_session_status',
    'get_world_inspection',
    'get_event_log',
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
    get_latest_build: [/after a source, shader, asset, or project-manifest change/i, /accepted revision/i],
    get_runtime_status: [/before .*dev_reload.*capture_frame/i, /null inspection/i],
    get_render_stats: [/renderer health or performance/i, /does not capture/i],
    get_diagnostics: [/build is not ready/i, /stable code/i],
    get_capture_capabilities: [/never launches a browser/i, /final-canvas/i],
    get_render_evidence: [/opaque evidence/i, /never accepts a path/i],
    get_session_status: [/fixed clock/i, /takes no arguments/i],
    get_world_inspection: [/entity hierarchy/i, /named store/i],
    get_event_log: [/accepted event-sourcing/i, /runtime-instance/i],
    list_point_lights: [/point-light inspection/i, /does not change/i],
    get_point_light: [/stable entity id/i, /accepted facts/i],
    dev_reload: [/after .*accepted revision/i, /does not start a development session/i],
    capture_frame: [/exact pixels/i, /get_render_stats/i],
    capture_gameplay_sequence: [/canvas-only motion sequence/i, /deterministic replay/i],
    set_point_light_power: [/expected revision/i, /world\.light\.edit/i],
    correct_point_light_power: [/new accepted fact/i, /corrected command/i],
    pause_simulation: [/tool pause reason/i, /does not rebuild/i],
    resume_simulation: [/tool pause reason/i, /other pause reasons/i],
    step_simulation: [/expected completed-step count/i, /retry/i],
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
    assert.equal(read.result.structuredContent.schemaVersion, index < 2 ? 1 : 2);
    if (index >= 2) assert.equal(read.result.structuredContent.observation, observation);
    assert.doesNotMatch(JSON.stringify(read), /credential/i);
    assert.doesNotMatch(
      JSON.stringify(read),
      /\/project|manifestPath|projectRoot|"pid"/i,
      `${name} must not expose local paths or process identities`,
    );
  }

  const capabilities = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 49, method: 'tools/call', params: { name: 'get_capture_capabilities' },
  });
  assert.deepEqual(capabilities.result.structuredContent, captureCapabilities);

  const renderEvidence = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 491,
    method: 'tools/call',
    params: {
      name: 'get_render_evidence',
      arguments: {
        schemaVersion: 1,
        evidenceId: captureSequenceResult.evidenceId,
        artifactId: captureSequenceResult.artifacts.poster.artifactId,
        limit: 1,
      },
    },
  });
  assert.equal(renderEvidence.result.content[1].type, 'image');
  assert.equal(renderEvidence.result.structuredContent.artifacts[0].creationSequence, 2);

  const listed = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 50, method: 'tools/call', params: { name: 'list_point_lights' },
  });
  assert.equal(listed.result.structuredContent.pointLights[0].entityId, LIGHT_ID);
  assert.equal(listed.result.structuredContent.schemaVersion, 2);
  assert.equal(listed.result.structuredContent.observation, observation);
  const oneLight = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 51,
    method: 'tools/call',
    params: { name: 'get_point_light', arguments: { entityId: LIGHT_ID } },
  });
  assert.equal(oneLight.result.structuredContent.pointLight.authoring.label, 'Harbor Lamp');
  assert.equal(oneLight.result.structuredContent.observation, observation);
  const world = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 52, method: 'tools/call', params: { name: 'get_world_inspection' },
  });
  assert.equal(world.result.structuredContent.world.entities[0].entityId, LIGHT_ID);
  assert.equal(world.result.structuredContent.observation, observation);
  const events = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 53, method: 'tools/call', params: { name: 'get_event_log' },
  });
  assert.equal(events.result.structuredContent.events.retention.lifetime, 'runtime-instance');
  assert.equal(events.result.structuredContent.observation, observation);

  const reload = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 31, method: 'tools/call', params: { name: 'dev_reload', arguments: {} },
  });
  assert.equal(reload.result.structuredContent.newRuntimeInstanceId, 'runtime-mcp-002');
  const capture = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 32,
    method: 'tools/call',
    params: {
      name: 'capture_frame',
      arguments: {
        schemaVersion: 2,
        expected: {
          developmentSessionId: observation.developmentSessionId,
          acceptedBuildRevision: observation.acceptedBuildRevision,
          runtimeInstanceId: observation.runtimeInstanceId,
        },
        runtimePolicy: 'current-or-managed',
        target: { width: 1, height: 1, deviceScaleFactor: 1 },
        warmUpFrames: 0,
        idempotencyKey: 'mcp-capture-fixture',
      },
    },
  });
  assert.equal(capture.result.structuredContent.captureId, 'capture-002');
  assert.equal(capture.result.content[1].type, 'image');
  assert.equal(capture.result.content[1].mimeType, 'image/png');
  assert.equal(capture.result.content[1].data, capturePng.toString('base64'));
  assert.doesNotMatch(JSON.stringify(capture.result.structuredContent), /path|base64|\/Users\//i);
  const managedCapture = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 321,
    method: 'tools/call',
    params: {
      name: 'capture_frame',
      arguments: {
        schemaVersion: 3,
        expected: {
          developmentSessionId: observation.developmentSessionId,
          acceptedBuildRevision: observation.acceptedBuildRevision,
          currentRuntimeInstanceId: null,
        },
        runtimePolicy: 'managed-only',
        target: { width: 1, height: 1, deviceScaleFactor: 1 },
        warmUpFrames: 0,
        idempotencyKey: 'mcp-managed-capture-fixture',
      },
    },
  });
  assert.equal(managedCapture.result.structuredContent.source, 'managed-runtime');
  assert.equal(managedCapture.result.content[1].type, 'image');
  const sequence = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 322,
    method: 'tools/call',
    params: {
      name: 'capture_gameplay_sequence',
      arguments: {
        schemaVersion: 1,
        expected: {
          developmentSessionId: observation.developmentSessionId,
          acceptedBuildRevision: observation.acceptedBuildRevision,
          currentRuntimeInstanceId: null,
        },
        runtimePolicy: 'managed-only',
        target: { width: 1, height: 1, deviceScaleFactor: 1 },
        source: { kind: 'window', durationMilliseconds: 100, framesPerSecond: 10 },
        idempotencyKey: 'mcp-sequence-fixture',
      },
    },
  });
  assert.equal(sequence.result.structuredContent.sequenceId, 'sequence-mcp-001');
  assert.deepEqual(
    sequence.result.content.slice(1).map((item: { type: string }) => item.type),
    ['resource_link', 'resource_link', 'resource_link'],
  );
  assert.doesNotMatch(JSON.stringify(sequence.result.structuredContent), /base64|path|pid/i);
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
  const sessionStatus = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 35, method: 'tools/call', params: { name: 'get_session_status' },
  });
  assert.equal(sessionStatus.result.structuredContent.session.sessionId, SESSION_ID);
  assert.equal(sessionStatus.result.structuredContent.observation, observation);
  const paused = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 36, method: 'tools/call', params: { name: 'pause_simulation' },
  });
  assert.equal(paused.result.structuredContent.result.code, 'PAUSED');
  const resumed = await processMcpRequest(client, {
    jsonrpc: '2.0', id: 37, method: 'tools/call', params: { name: 'resume_simulation' },
  });
  assert.equal(resumed.result.structuredContent.result.code, 'RESUMED');
  const stepped = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 38,
    method: 'tools/call',
    params: { name: 'step_simulation', arguments: { expectedCompletedStepCount: 4 } },
  });
  assert.equal(stepped.result.structuredContent.result.code, 'STEPPED');
  assert.deepEqual(calls, [
    'read', 'read',
    'read-v2', 'read-v2', 'read-v2',
    'capture-capabilities',
    'render-evidence', 'read-evidence',
    'read-v2', 'read-v2', 'read-v2', 'read-v2',
    'reload', 'capture-v2', 'read-evidence', 'capture-v3', 'read-evidence', 'capture-sequence',
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
    'read-v2',
    'pause-simulation',
    'resume-simulation',
    'step-simulation:4',
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
  const invalidStepArguments = await processMcpRequest(client, {
    jsonrpc: '2.0',
    id: 'invalid-step',
    method: 'tools/call',
    params: {
      name: 'step_simulation',
      arguments: { expectedCompletedStepCount: -1 },
    },
  });
  assert.equal(invalidStepArguments.error.code, -32602);
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
