import type { DevelopmentSnapshot } from '../development/types.ts';

export const MCP_READ_TOOL_NAMES = Object.freeze([
  'get_dev_status',
  'get_latest_build',
  'get_runtime_status',
  'get_render_stats',
  'get_diagnostics',
] as const);

export const MCP_TOOL_NAMES = Object.freeze([
  ...MCP_READ_TOOL_NAMES,
  'dev_reload',
  'capture_frame',
] as const);

export type McpReadToolName = typeof MCP_READ_TOOL_NAMES[number];

const emptyInputSchema = Object.freeze({
  type: 'object',
  properties: {},
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

export const MCP_TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'get_dev_status',
    description: 'Call this first when you need to understand an Antiky development session. It returns the session identity, accepted build revision, configured game URL and viewport, child-process health, runtime connection, cleanup state, and CLI timing measurements. It takes no arguments and does not change the session.',
    inputSchema: emptyInputSchema,
    annotations: readToolAnnotations,
  },
  {
    name: 'get_latest_build',
    description: 'Call after a source, shader, asset, or config change to determine whether the newest build is ready. It returns the accepted revision plus the latest build attempt, change kind, result, changed path, and timing. Use the accepted revision—not filesystem timing—to decide whether reloading or inspecting the runtime is safe. It takes no arguments.',
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
    name: 'dev_reload',
    description: 'Call after get_latest_build reports a ready accepted revision and get_runtime_status reports a connected runtime. It requests a controlled reload of that browser runtime and relates the old and new runtime identities to the build revision. It does not start a development session or rebuild source. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: actionToolAnnotations,
  },
  {
    name: 'capture_frame',
    description: 'Call when you need the exact pixels from the connected game canvas after get_runtime_status confirms a runtime. It writes a PNG capture and returns its path, hash, byte length, session identity, runtime identity, and build revision. Use get_render_stats for canvas and renderer measurements. It takes no arguments.',
    inputSchema: emptyInputSchema,
    annotations: actionToolAnnotations,
  },
] as const);

export function isMcpReadToolName(name: string): name is McpReadToolName {
  return (MCP_READ_TOOL_NAMES as readonly string[]).includes(name);
}

export function projectMcpReadTool(
  name: McpReadToolName,
  snapshot: DevelopmentSnapshot,
): unknown {
  switch (name) {
    case 'get_dev_status':
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
