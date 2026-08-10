import type {
  DevelopmentSnapshot,
  DevelopmentSnapshotV2,
} from '../development/types.ts';

export const MCP_SNAPSHOT_READ_TOOL_NAMES = Object.freeze([
  'get_dev_status',
  'get_latest_build',
  'get_runtime_status',
  'get_render_stats',
  'get_diagnostics',
] as const);

export const MCP_POINT_LIGHT_READ_TOOL_NAMES = Object.freeze([
  'list_point_lights',
  'get_point_light',
] as const);

export const MCP_READ_TOOL_NAMES = Object.freeze([
  ...MCP_SNAPSHOT_READ_TOOL_NAMES,
  'get_capture_capabilities',
  'get_session_status',
  'get_world_inspection',
  'get_event_log',
  ...MCP_POINT_LIGHT_READ_TOOL_NAMES,
] as const);

export const MCP_TOOL_NAMES = Object.freeze([
  ...MCP_READ_TOOL_NAMES,
  'dev_reload',
  'capture_frame',
  'pause_simulation',
  'resume_simulation',
  'step_simulation',
  'set_point_light_power',
  'correct_point_light_power',
] as const);

export type McpSnapshotReadToolName = typeof MCP_SNAPSHOT_READ_TOOL_NAMES[number];
export type McpRuntimeSnapshotReadToolName = Extract<
  McpSnapshotReadToolName,
  'get_runtime_status' | 'get_render_stats' | 'get_diagnostics'
>;

const emptyInputSchema = Object.freeze({
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const);

const uuidV7Schema = Object.freeze({
  type: 'string',
  pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
} as const);

const getPointLightInputSchema = Object.freeze({
  type: 'object',
  properties: { entityId: uuidV7Schema },
  required: ['entityId'],
  additionalProperties: false,
} as const);

const setPointLightPowerInputSchema = Object.freeze({
  type: 'object',
  properties: {
    commandId: uuidV7Schema,
    worldId: uuidV7Schema,
    entityId: uuidV7Schema,
    expectedRevision: { type: 'integer', minimum: 0 },
    power: { type: 'number', minimum: 0, maximum: 4 },
  },
  required: ['commandId', 'worldId', 'entityId', 'expectedRevision', 'power'],
  additionalProperties: false,
} as const);

const correctPointLightPowerInputSchema = Object.freeze({
  type: 'object',
  properties: {
    commandId: uuidV7Schema,
    correctedCommandId: uuidV7Schema,
    expectedRevision: { type: 'integer', minimum: 0 },
  },
  required: ['commandId', 'correctedCommandId', 'expectedRevision'],
  additionalProperties: false,
} as const);

const stepSimulationInputSchema = Object.freeze({
  type: 'object',
  properties: {
    expectedCompletedStepCount: { type: 'integer', minimum: 0 },
  },
  required: ['expectedCompletedStepCount'],
  additionalProperties: false,
} as const);

const captureExpectedV2Schema = Object.freeze({
  type: 'object',
  properties: {
    developmentSessionId: { type: 'string', minLength: 1, maxLength: 128 },
    acceptedBuildRevision: { type: 'integer', minimum: 0 },
    runtimeInstanceId: { type: 'string', minLength: 1, maxLength: 128 },
    sessionId: { type: 'string', minLength: 1, maxLength: 128 },
    completedStepCount: { type: 'integer', minimum: 0 },
    stateDigest: { type: ['string', 'null'], maxLength: 512 },
  },
  required: ['developmentSessionId', 'acceptedBuildRevision', 'runtimeInstanceId'],
  additionalProperties: false,
} as const);

const captureExpectedV3Schema = Object.freeze({
  type: 'object',
  properties: {
    developmentSessionId: { type: 'string', minLength: 1, maxLength: 128 },
    acceptedBuildRevision: { type: 'integer', minimum: 0 },
    currentRuntimeInstanceId: {
      anyOf: [
        { type: 'string', minLength: 1, maxLength: 128 },
        { type: 'null' },
      ],
    },
    sessionId: { type: 'string', minLength: 1, maxLength: 128 },
    completedStepCount: { type: 'integer', minimum: 0 },
    stateDigest: { type: ['string', 'null'], maxLength: 512 },
  },
  required: ['developmentSessionId', 'acceptedBuildRevision', 'currentRuntimeInstanceId'],
  additionalProperties: false,
} as const);

const captureFrameInputSchema = Object.freeze({
  type: 'object',
  properties: {
    schemaVersion: { enum: [2, 3] },
    expected: { oneOf: [captureExpectedV2Schema, captureExpectedV3Schema] },
    runtimePolicy: { enum: ['current-or-managed', 'managed-only'] },
    target: {
      type: 'object',
      properties: {
        width: { type: 'integer', minimum: 1, maximum: 2560 },
        height: { type: 'integer', minimum: 1, maximum: 1440 },
        deviceScaleFactor: { type: 'number', minimum: 0.5, maximum: 2 },
      },
      required: ['width', 'height', 'deviceScaleFactor'],
      additionalProperties: false,
    },
    warmUpFrames: { type: 'integer', minimum: 0, maximum: 300 },
    idempotencyKey: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: [
    'schemaVersion', 'expected', 'runtimePolicy', 'target', 'warmUpFrames', 'idempotencyKey',
  ],
  oneOf: [
    { properties: { schemaVersion: { const: 2 }, expected: captureExpectedV2Schema } },
    { properties: { schemaVersion: { const: 3 }, expected: captureExpectedV3Schema } },
  ],
  additionalProperties: false,
} as const);

const readToolAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const);

const actionToolAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const);

const retrySafeActionToolAnnotations = Object.freeze({
  ...actionToolAnnotations,
  idempotentHint: true,
} as const);

export const MCP_TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'get_dev_status',
    description: 'Call this first when you need to understand an Antiky development session. It returns the session identity, accepted build revision, configured game URL and viewport, child-process health, runtime connection, cleanup state, and CLI timing measurements. It takes no arguments and does not change the session.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_latest_build',
    description: 'Call after a source, shader, asset, or project-manifest change to determine whether the newest build is ready. It returns the accepted revision plus the latest build attempt, change kind, result, changed path, and timing. Use the accepted revision—not filesystem timing—to decide whether reloading or inspecting the runtime is safe. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_runtime_status',
    description: 'Call before dev_reload or capture_frame, and whenever runtime-backed data is missing. It reports the browser runtime connection and latest framework inspection snapshot. A null inspection means no runtime snapshot is currently available; wait or call get_diagnostics instead of inventing runtime facts. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_render_stats',
    description: 'Call when evaluating renderer health or performance. It returns only framework-owned frame, canvas, draw, instance, and upload measurements, using null when facts are unavailable. This tool does not capture pixels or prove visual appearance; use capture_frame for an image. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_diagnostics',
    description: 'Call when a build is not ready, the runtime is unavailable, or another MCP action fails. It returns bounded development and framework diagnostics with a stable code, severity, message, and related identities. Use the stable code to choose recovery before relying on prose. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_capture_capabilities',
    description: 'Call before capturing game pixels to discover the pinned managed Chromium runtime, launch-free WebGPU status, configured final-canvas target, still and motion formats, presentation-input kinds, strict limits, retention scope, and whether an interactive runtime is connected. This read never launches a browser or exposes a path, process, profile, user agent, or device identity.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_session_status',
    description: 'Call to inspect the connected engine session and its fixed clock before changing simulation state. It returns session, world, and runtime identities; mode and pause reasons; immutable system order; completed-step and elapsed-time counters; revisions; and the latest state digest. It takes no arguments and does not change the session.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_world_inspection',
    description: 'Call to inspect the complete bounded entity hierarchy and named store views published by the connected Framework runtime. It returns stable entity and component summaries, real ChildOf relationships, explicit counts, and incomplete status. It takes no arguments and does not expose engine objects.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_event_log',
    description: 'Call to inspect accepted event-sourcing facts in source sequence order. It returns the source, world and runtime identities, bounded structured facts, counts, and the declared runtime-instance retention policy. It takes no arguments and does not include simulation steps, diagnostics, or MCP traffic.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'list_point_lights',
    description: 'Call to discover the point lights published by the connected runtime through the shared point-light inspection source. It returns stable world and entity identities, authored data, revisions, and the current event sequence. It does not change runtime or authoring state and takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_point_light',
    description: 'Call with one stable entity ID after list_point_lights to inspect a specific point light. It returns the matching authoring record, runtime projection, optional render binding, and accepted facts; a valid unknown ID returns null. This read does not change state.',
    inputSchema: getPointLightInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'dev_reload',
    description: 'Call after get_latest_build reports a ready accepted revision and get_runtime_status reports a connected runtime. It requests a controlled reload of that browser runtime and relates the old and new runtime identities to the build revision. It does not start a development session or rebuild source. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: actionToolAnnotations,
  },
  {
    name: 'capture_frame',
    description: 'Call when you need exact pixels from the game canvas after reading the version-two runtime observation and render dimensions. Fence the development session, accepted build, runtime, and any exact paused step; choose the current or managed runtime policy; and provide bounded target dimensions plus an idempotency key. It returns private path-safe evidence metadata and an MCP image block. Use get_render_stats for renderer measurements.',
    inputSchema: captureFrameInputSchema,
    annotations: actionToolAnnotations,
  },
  {
    name: 'pause_simulation',
    description: 'Call to add the local tool pause reason to the connected engine session. It does not rebuild or replace session state. Repeating the call is safe and returns NO_OP when that reason is already present. Other independent pause reasons remain visible in the returned session status. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: retrySafeActionToolAnnotations,
  },
  {
    name: 'resume_simulation',
    description: 'Call to remove only the local tool pause reason from the connected engine session. The session runs only when no other pause reasons remain, so a user or visibility pause is preserved. Repeating the call is safe and can return NO_OP. It takes no arguments and does not rebuild state.',
    inputSchema: emptyInputSchema,
    annotations: retrySafeActionToolAnnotations,
  },
  {
    name: 'step_simulation',
    description: 'Call while the session is paused with the expected completed-step count from get_session_status. One accepted call advances exactly one fixed tick and requests one paused render. The expected completed-step count makes a retry safe: a repeated or stale request returns STALE_COMPLETED_STEP and changes no state.',
    inputSchema: stepSimulationInputSchema,
    annotations: retrySafeActionToolAnnotations,
  },
  {
    name: 'set_point_light_power',
    description: 'Call after get_point_light with a new UUIDv7 command ID, the reported world and entity IDs, the current expected revision, and a power from 0 through 4. The local host supplies world.light.edit authority separately. The result uses stable command codes and an accepted change creates one fact.',
    inputSchema: setPointLightPowerInputSchema,
    annotations: actionToolAnnotations,
  },
  {
    name: 'correct_point_light_power',
    description: 'Call to correct an earlier accepted power change without deleting history. Supply a new UUIDv7 command ID, the corrected command ID from the accepted fact, and the current expected revision. A successful correction restores the earlier value by recording a new accepted fact.',
    inputSchema: correctPointLightPowerInputSchema,
    annotations: actionToolAnnotations,
  },
] as const);

export function isMcpSnapshotReadToolName(name: string): name is McpSnapshotReadToolName {
  return (MCP_SNAPSHOT_READ_TOOL_NAMES as readonly string[]).includes(name);
}

export function projectMcpReadTool(
  name: McpSnapshotReadToolName,
  snapshot: DevelopmentSnapshot,
): unknown {
  switch (name) {
    case 'get_dev_status':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        startedAt: snapshot.startedAt,
        project: {
          name: snapshot.project.name,
          revision: snapshot.project.revision,
          gameUrl: snapshot.project.gameUrl,
          host: snapshot.project.host,
          gamePort: snapshot.project.gamePort,
          inspectionPort: snapshot.project.inspectionPort,
          viewport: snapshot.project.viewport,
        },
        processes: {
          game: {
            state: snapshot.processes.game.state,
            ...(snapshot.processes.game.exitCode === undefined
              ? {}
              : { exitCode: snapshot.processes.game.exitCode }),
          },
          shaders: {
            state: snapshot.processes.shaders.state,
            ...(snapshot.processes.shaders.exitCode === undefined
              ? {}
              : { exitCode: snapshot.processes.shaders.exitCode }),
          },
        },
        connection: snapshot.connection,
        cleanup: snapshot.cleanup,
        measurements: snapshot.measurements,
      };
    case 'get_latest_build':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        build: snapshot.build,
      };
    case 'get_runtime_status':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        connection: snapshot.connection,
        inspection: snapshot.inspection,
      };
    case 'get_render_stats':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        runtimeInstanceId: snapshot.inspection?.runtime.instanceId ?? null,
        runtime: snapshot.inspection?.measurements.runtime ?? null,
        render: snapshot.inspection?.measurements.render ?? null,
      };
    case 'get_diagnostics':
      return {
        schemaVersion: 1,
        developmentSessionId: snapshot.developmentSessionId,
        development: snapshot.diagnostics,
        framework: snapshot.inspection?.diagnostics ?? [],
      };
  }
}

export function isMcpRuntimeSnapshotReadToolName(
  name: string,
): name is McpRuntimeSnapshotReadToolName {
  return name === 'get_runtime_status'
    || name === 'get_render_stats'
    || name === 'get_diagnostics';
}

export function projectMcpRuntimeReadToolV2(
  name: McpRuntimeSnapshotReadToolName,
  snapshot: DevelopmentSnapshotV2,
): unknown {
  switch (name) {
    case 'get_runtime_status':
      return {
        schemaVersion: 2,
        observation: snapshot.observation,
        acceptedBuildRevision: snapshot.acceptedBuildRevision,
        connection: snapshot.connection,
        inspection: snapshot.inspection,
      };
    case 'get_render_stats':
      return {
        schemaVersion: 2,
        observation: snapshot.observation,
        runtime: snapshot.inspection?.measurements.runtime ?? null,
        render: snapshot.inspection?.measurements.render ?? null,
      };
    case 'get_diagnostics':
      return {
        schemaVersion: 2,
        observation: snapshot.observation,
        developmentSessionId: snapshot.developmentSessionId,
        development: snapshot.diagnostics,
        framework: snapshot.inspection?.diagnostics ?? [],
      };
  }
}
