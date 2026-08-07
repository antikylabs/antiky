import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createEngineSession,
  createInspectionSnapshot,
  createPointLightAuthoringService,
  inspectPointLightService,
  parseCommandId,
  parseEntityId,
  parseSessionId,
  parseWorldId,
  type PointLightCommandResult,
} from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  AntikyCliError,
  connectDevelopmentClient,
  inspectDevelopmentSession,
  loadAntikyProject,
  runCli,
  startDevelopmentSession,
} from '../src/index.ts';
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { createInspectionServer } from '../src/host/inspection-server.ts';

const fixture = fileURLToPath(new URL('fixtures/managed-child.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
const studioWorker = fileURLToPath(new URL('../src/studio-worker.ts', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const GAME_PORT = 43100;
const INSPECTION_PORT = 43101;

async function makeProject(options: {
  gameBehavior?: 'run' | 'fail';
  shaderBehavior?: 'run' | 'fail';
  gameCommand?: string[];
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'antiky-session-'));
  const marker = join(directory, 'children.log');
  const projectPath = join(directory, 'session.antiky');
  const gameCommand = options.gameCommand ?? [
    process.execPath,
    fixture,
    'game',
    marker,
    options.gameBehavior ?? 'run',
  ];
  const config = {
    schemaVersion: 1,
    name: 'Development session fixture',
    development: {
      command: gameCommand,
      shaderCommand: [
        process.execPath,
        fixture,
        'shaders',
        marker,
        options.shaderBehavior ?? 'run',
      ],
      workingDirectory: '.',
      url: `http://127.0.0.1:${GAME_PORT}/demos/town-study`,
      viewport: { width: 960, height: 540 },
    },
    network: {
      host: '127.0.0.1',
      gamePort: GAME_PORT,
      inspectionPort: INSPECTION_PORT,
    },
    build: {
      command: ['npm', 'run', 'build'],
      workingDirectory: '.',
    },
  };
  await writeFile(projectPath, `${JSON.stringify(config, null, 2)}\n`);
  return { directory, marker, projectPath };
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMilliseconds = 3000,
): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > timeoutMilliseconds) throw new Error('Timed out waiting for state.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

async function canRead(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve(false);
      else reject(error);
    });
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}

function processExists(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw cause;
  }
}

test('development session starts both children, publishes health, and cleans up', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const lines: string[] = [];
  const diagnostics: unknown[] = [];
  const session = await startDevelopmentSession(config, {
    writeOutput: (line) => lines.push(line),
    diagnosticSink: (event: unknown) => diagnostics.push(event),
  });
  const descriptor = join(dirname(project.projectPath), '.antiky', 'dev-session.json');
  try {
    await waitFor(async () => (
      await canRead(project.marker)
      && (await readFile(project.marker, 'utf8')).split('\n').length >= 3
    ));
    const snapshot = await inspectDevelopmentSession(project.projectPath);
    assert.equal(snapshot.developmentSessionId, session.id);
    assert.equal(snapshot.processes.game.state, 'running');
    assert.equal(snapshot.processes.shaders.state, 'running');
    assert.equal(snapshot.connection.state, 'waiting');
    assert.equal(snapshot.cleanup.state, 'active');
    assert.equal(snapshot.build.owner, 'cli');
    assert.equal(snapshot.build.result, 'pending');
    assert.equal(snapshot.measurements.owner, 'cli');
    assert.equal(snapshot.inspection, null);
    assert.doesNotMatch(JSON.stringify(snapshot), /credential/i);
    assert.ok(lines.some((line) => line.includes(config.development.url)));
    assert.ok(lines.some((line) => line.includes(session.id)));

    const descriptorMode = (await stat(descriptor)).mode & 0o777;
    assert.equal(descriptorMode, 0o600);
    assert.equal(
      await readFile(join(project.directory, '.antiky', '.gitignore'), 'utf8'),
      '*\n!.gitignore\n',
    );

    const firstLaunchDuration = snapshot.measurements.launchMilliseconds;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(session.snapshot().measurements.launchMilliseconds, firstLaunchDuration);
  } finally {
    const result = await session.stop('normal');
    assert.equal(result.reason, 'normal');
    assert.equal(result.exitCode, 0);
  }
  assert.equal(await canRead(descriptor), false);
  assert.equal(await canRead(join(project.directory, '.antiky', '.gitignore')), true);
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await portIsFree(INSPECTION_PORT), true);
  const diagnosticCodes = diagnostics.flatMap((event) => (
    typeof event === 'object' && event !== null && 'code' in event && typeof event.code === 'string'
      ? [event.code]
      : []
  ));
  for (const code of [
    'ANTIKY_SESSION_STARTING',
    'ANTIKY_SESSION_READY',
    'ANTIKY_SESSION_STOPPING',
    'ANTIKY_SESSION_STOPPED',
  ]) assert.ok(diagnosticCodes.includes(code), `missing ${code}`);
  assert.ok(diagnostics.every((event) => (
    typeof event === 'object'
    && event !== null
    && 'developmentSessionId' in event
    && event.developmentSessionId === session.id
  )));
});

test('development session owns the game host when the project command only watches builds', async () => {
  const project = await makeProject();
  await mkdir(join(project.directory, 'dist'));
  await writeFile(join(project.directory, 'dist', 'antiky.game.js'), 'export default () => ({ frame() {}, dispose() {} });\n');
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config, { writeOutput: () => {} });

  try {
    const response = await fetch(config.development.url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
    const html = await response.text();
    assert.match(html, /<canvas[^>]+id="antiky-game"/);
    assert.match(html, /src="\/__antiky__\/host\.js"/);

    const moduleResponse = await fetch(`${new URL(config.development.url).origin}/__antiky__/build/antiky.game.js`);
    assert.equal(moduleResponse.status, 200);
    assert.match(moduleResponse.headers.get('content-type') ?? '', /^text\/javascript/);
    assert.match(await moduleResponse.text(), /export default/);

    const escaped = await fetch(`${new URL(config.development.url).origin}/__antiky__/build/%2e%2e/session.antiky`);
    assert.equal(escaped.status, 404);
  } finally {
    await session.stop('normal');
  }
});

test('Studio worker imports the project service and stops it through a structured lifecycle', async () => {
  const project = await makeProject();
  await mkdir(join(project.directory, 'dist'));
  await writeFile(join(project.directory, 'dist', 'antiky.game.js'), 'export default () => ({ frame() {}, dispose() {} });\n');
  const child = spawn(process.execPath, [
    '--experimental-strip-types',
    '--experimental-transform-types',
    studioWorker,
    project.projectPath,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  try {
    await waitFor(() => stdout.includes('\n'));
    const ready = JSON.parse(stdout.trim()) as {
      type: string;
      connection: { developmentSessionId: string; inspectionUrl: string; credential: string };
    };
    assert.equal(ready.type, 'ready');
    assert.ok(ready.connection.developmentSessionId.length > 0);
    assert.equal(ready.connection.inspectionUrl, `http://127.0.0.1:${INSPECTION_PORT}`);
    assert.ok(ready.connection.credential.length >= 32);
    const gameResponse = await fetch(`http://127.0.0.1:${GAME_PORT}/demos/town-study`);
    assert.equal(gameResponse.status, 200);
    await gameResponse.text();

    child.stdin.write(`${JSON.stringify({ type: 'stop' })}\n`);
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    assert.deepEqual(exit, { code: 0, signal: null }, stderr);
    assert.equal(await portIsFree(GAME_PORT), true);
    assert.equal(await portIsFree(INSPECTION_PORT), true);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});

test('antiky dev starts a loopback Streamable HTTP MCP endpoint', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const lines: string[] = [];
  const session = await startDevelopmentSession(config, {
    writeOutput: (line) => lines.push(line),
  });

  try {
    assert.equal(session.mcpUrl, `${session.inspectionUrl}/mcp`);
    assert.ok(lines.includes(`MCP: ${session.mcpUrl}`));
    assert.ok(lines.includes('Services: game host, game build, shaders, inspection, mcp'));

    const initialize = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'development-test', version: '1' },
        },
      }),
    });
    assert.equal(initialize.status, 200);
    assert.match(initialize.headers.get('content-type') ?? '', /^application\/json/);
    const initialized = await initialize.json() as {
      result: { protocolVersion: string; capabilities: unknown };
    };
    assert.equal(initialized.result.protocolVersion, '2025-11-25');
    assert.deepEqual(initialized.result.capabilities, { tools: {} });

    const tools = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(tools.status, 200);
    const toolList = await tools.json() as { result: { tools: Array<{ name: string }> } };
    assert.deepEqual(toolList.result.tools.map((tool) => tool.name), [
      'get_dev_status',
      'get_latest_build',
      'get_runtime_status',
      'get_render_stats',
      'get_diagnostics',
      'get_session_status',
      'get_world_inspection',
      'get_event_log',
      'list_point_lights',
      'get_point_light',
      'dev_reload',
      'capture_frame',
      'pause_simulation',
      'resume_simulation',
      'step_simulation',
      'set_point_light_power',
      'correct_point_light_power',
    ]);

    const toolOutput: string[] = [];
    const toolExitCode = await runCli([
      'tool',
      'get_dev_status',
      '--project',
      project.projectPath,
    ], {
      stdout: (text) => toolOutput.push(text),
      stderr: () => {},
    });
    assert.equal(toolExitCode, 0);
    assert.equal(toolOutput.length, 1);
    const toolStatus = JSON.parse(toolOutput[0]!) as {
      developmentSessionId: string;
      processes: { game: { state: string }; shaders: { state: string } };
    };
    assert.equal(toolStatus.developmentSessionId, session.id);
    assert.equal(toolStatus.processes.game.state, 'running');
    assert.equal(toolStatus.processes.shaders.state, 'running');

    const unavailableOutput: string[] = [];
    const unavailableExitCode = await runCli([
      'tool',
      'list_point_lights',
      '--project',
      project.projectPath,
    ], {
      stdout: (text) => unavailableOutput.push(text),
      stderr: () => {},
    });
    assert.equal(unavailableExitCode, 1);
    assert.equal(
      JSON.parse(unavailableOutput[0]!).error.code,
      'ANTIKY_RUNTIME_UNAVAILABLE',
    );

    const unknownCall = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'unknown-call',
        method: 'tools/call',
        params: { name: 'unknown_tool', arguments: { credential: 'do-not-store' } },
      }),
    });
    assert.equal(unknownCall.status, 200);

    const client = await connectDevelopmentClient(project.projectPath);
    const callLog = await client.getMcpCallLog();
    assert.deepEqual(callLog.calls.map((call) => call.toolName), [
      'get_dev_status',
      'list_point_lights',
      'unknown_tool',
    ]);
    assert.deepEqual(callLog.calls.map((call) => call.outcome), [
      'success',
      'tool-error',
      'protocol-error',
    ]);
    assert.equal(
      callLog.calls[0]?.correlationIds.developmentSessionId,
      session.id,
    );
    assert.equal(callLog.calls[2]?.redaction.applied, true);
    assert.doesNotMatch(JSON.stringify(callLog), /do-not-store/);
    assert.deepEqual(await client.getMcpCallLog(), callLog);

    const protectedCallLog = await fetch(`${session.inspectionUrl}/v1/mcp-calls`);
    assert.equal(protectedCallLog.status, 401);

    const activeDescriptor = JSON.parse(await readFile(
      join(project.directory, '.antiky', 'dev-session.json'),
      'utf8',
    )) as { credential: string };
    const studioOrigin = 'tauri://localhost';
    const studioPreflight = await fetch(`${session.inspectionUrl}/v1/development`, {
      method: 'OPTIONS',
      headers: {
        origin: studioOrigin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    });
    assert.equal(studioPreflight.status, 204);
    assert.equal(studioPreflight.headers.get('access-control-allow-origin'), studioOrigin);
    const studioSnapshot = await fetch(`${session.inspectionUrl}/v1/development`, {
      headers: {
        authorization: `Bearer ${activeDescriptor.credential}`,
        origin: studioOrigin,
      },
    });
    assert.equal(studioSnapshot.status, 200);
    assert.equal(studioSnapshot.headers.get('access-control-allow-origin'), studioOrigin);

    const studioControlPreflight = await fetch(
      `${session.inspectionUrl}/v1/actions/pause-simulation`,
      {
        method: 'OPTIONS',
        headers: {
          origin: studioOrigin,
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type',
        },
      },
    );
    assert.equal(studioControlPreflight.status, 204);
    assert.equal(
      studioControlPreflight.headers.get('access-control-allow-origin'),
      studioOrigin,
    );
    const studioControl = await fetch(
      `${session.inspectionUrl}/v1/actions/pause-simulation`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${activeDescriptor.credential}`,
          'content-type': 'application/json',
          origin: studioOrigin,
        },
        body: JSON.stringify({ schemaVersion: 1 }),
      },
    );
    assert.equal(studioControl.status, 503);
    assert.equal(studioControl.headers.get('access-control-allow-origin'), studioOrigin);
    assert.equal(
      ((await studioControl.json()) as { error: { code: string } }).error.code,
      'ANTIKY_RUNTIME_UNAVAILABLE',
    );

    await assert.rejects(
      () => runCli(['tool', 'not_a_real_tool', '--project', project.projectPath]),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ARGUMENT_INVALID'
      ),
    );

    const notification = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'notifications/initialized', params: {},
      }),
    });
    assert.equal(notification.status, 202);
    assert.equal(await notification.text(), '');

    const eventStream = await fetch(session.mcpUrl);
    assert.equal(eventStream.status, 405);
    assert.equal(eventStream.headers.get('allow'), 'POST');

    const wrongOrigin = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        origin: 'https://example.com',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
    });
    assert.equal(wrongOrigin.status, 403);

    const unsupportedVersion = await fetch(session.mcpUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2026-07-28',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }),
    });
    assert.equal(unsupportedVersion.status, 400);

    const protectedInspection = await fetch(`${session.inspectionUrl}/v1/development`);
    assert.equal(protectedInspection.status, 401);
  } finally {
    await session.stop('normal');
  }
});

test('antiky tool rejects missing names and non-object JSON input before making a request', async () => {
  await assert.rejects(
    () => runCli(['tool']),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_ARGUMENT_INVALID'
    ),
  );
  await assert.rejects(
    () => runCli(['tool', 'list_point_lights', '--input', '[]']),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_ARGUMENT_INVALID'
    ),
  );
});

test('busy ports reject before either child starts', async () => {
  const project = await makeProject();
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(GAME_PORT, '127.0.0.1', resolve));

  try {
    const config = await loadAntikyProject(project.projectPath);
    await assert.rejects(
      () => startDevelopmentSession(config),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_PORT_BUSY'
        && error.path === '$.network.gamePort'
      ),
    );
    assert.equal(await canRead(project.marker), false);
    assert.equal(await portIsFree(INSPECTION_PORT), true);
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
});

test('a busy inspection port also rejects before either child starts', async () => {
  const project = await makeProject();
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(INSPECTION_PORT, '127.0.0.1', resolve));

  try {
    const config = await loadAntikyProject(project.projectPath);
    await assert.rejects(
      () => startDevelopmentSession(config),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_PORT_BUSY'
        && error.path === '$.network.inspectionPort'
      ),
    );
    assert.equal(await canRead(project.marker), false);
    assert.equal(await portIsFree(GAME_PORT), true);
  } finally {
    await new Promise<void>((resolve) => blocker.close(() => resolve()));
  }
});

test('a partial spawn failure stops the first child and releases every resource', async () => {
  const project = await makeProject({ gameCommand: ['antiky-command-that-does-not-exist'] });
  const config = await loadAntikyProject(project.projectPath);

  await assert.rejects(
    () => startDevelopmentSession(config),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_CHILD_START_FAILED'
      && error.message === 'Unable to start game.'
      && !error.message.includes('antiky-command-that-does-not-exist')
    ),
  );
  await waitFor(() => portIsFree(INSPECTION_PORT));
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await canRead(join(project.directory, '.antiky', 'dev-session.json')), false);
});

test('one child failure stops its sibling and reports the child exit', async () => {
  const project = await makeProject({ shaderBehavior: 'fail' });
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config);
  const result = await session.stopped;

  assert.equal(result.reason, 'child-failure');
  assert.equal(result.exitCode, 7);
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await portIsFree(INSPECTION_PORT), true);
});

test('cleanup kills a child process group after its leader exits', async () => {
  const project = await makeProject({ gameBehavior: 'run' });
  const source = JSON.parse(await readFile(project.projectPath, 'utf8')) as {
    development: { command: string[] };
  };
  source.development.command = [process.execPath, fixture, 'game-parent', project.marker, 'orphan'];
  await writeFile(project.projectPath, `${JSON.stringify(source, null, 2)}\n`);
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config);
  let groupId: number | undefined;

  try {
    await waitFor(async () => {
      if (!(await canRead(project.marker))) return false;
      const match = (await readFile(project.marker, 'utf8')).match(/game-parent:(\d+)/);
      if (match) groupId = Number(match[1]);
      return Boolean(groupId);
    });
    const result = await session.stopped;
    assert.equal(result.reason, 'child-failure');
    await waitFor(() => portIsFree(GAME_PORT));
    assert.equal(await portIsFree(INSPECTION_PORT), true);
  } finally {
    if (!(await portIsFree(GAME_PORT)) && groupId) {
      try {
        process.kill(-groupId, 'SIGKILL');
      } catch (cause: unknown) {
        if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
      }
    }
  }
});

test('cleanup attempts every resource and settles when one cleanup operation fails', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const attempted: string[] = [];
  const diagnostics: unknown[] = [];
  const session = await startDevelopmentSession(config, {
    writeOutput: () => {},
    diagnosticSink: (event: unknown) => diagnostics.push(event),
    async runCleanupOperation(name, operation) {
      attempted.push(name);
      if (name === 'session-descriptor') throw new Error('injected descriptor cleanup failure');
      await operation();
    },
  });
  const descriptorPath = session.descriptorPath;
  const childProcessIds = [
    session.snapshot().processes.game.pid,
    session.snapshot().processes.shaders.pid,
  ].filter((processId): processId is number => processId !== undefined);

  try {
    const result = await session.stop('normal');
    assert.equal(await session.stopped, result);
    assert.equal(result.cleanupFailureCount, 1);
    assert.equal(result.exitCode, 1);
    assert.equal(session.snapshot().cleanup.state, 'failed');
    assert.deepEqual(new Set(attempted), new Set([
      'action-broker',
      'game-port-reservation',
      'inspection-port-reservation',
      'session-descriptor',
      'build-watcher',
      'game-host',
      'shaders-child',
      'game-child',
      'inspection-server',
    ]));
    assert.equal(await canRead(descriptorPath), true);
    assert.equal(await portIsFree(GAME_PORT), true);
    assert.equal(await portIsFree(INSPECTION_PORT), true);
    assert.equal(childProcessIds.some(processExists), false);
    assert.deepEqual(
      diagnostics.find((event) => (
        typeof event === 'object'
        && event !== null
        && 'code' in event
        && event.code === 'ANTIKY_CLEANUP_FAILED'
      )),
      {
        schemaVersion: 1,
        level: 'error',
        code: 'ANTIKY_CLEANUP_FAILED',
        developmentSessionId: session.id,
        component: 'session-descriptor',
      },
    );
    assert.doesNotMatch(JSON.stringify(diagnostics), /injected descriptor cleanup failure/);
  } finally {
    await rm(descriptorPath, { force: true });
    for (const processId of childProcessIds) {
      if (!processExists(processId)) continue;
      try {
        process.kill(-processId, 'SIGKILL');
      } catch (cause: unknown) {
        if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
      }
    }
  }
});

test('SIGINT stops the CLI session and releases both ports', async () => {
  const project = await makeProject();
  const child = spawn(process.execPath, [
    '--experimental-strip-types',
    '--experimental-transform-types',
    cli,
    'dev',
    '--project',
    project.projectPath,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  let result: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  try {
    await waitFor(() => stdout.includes('development session'));
    child.kill('SIGINT');
    result = await new Promise((resolve) => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }

  assert.equal(result?.signal, null, stderr);
  assert.equal(result?.code, 130, stderr);
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await portIsFree(INSPECTION_PORT), true);
});

test('terminal SIGINT through the npm antiky wrapper leaves no child group or descriptor', async (context) => {
  if (process.platform === 'win32') {
    context.skip('POSIX terminal process groups are not available on Windows.');
    return;
  }
  const project = await makeProject();
  const npm = 'npm';
  const child = spawn(npm, [
    'run',
    'antiky',
    '--',
    'dev',
    '--project',
    project.projectPath,
  ], {
    cwd: repositoryRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  const descriptor = join(project.directory, '.antiky', 'dev-session.json');
  let cleanShutdown = false;
  let observedShutdown = {};

  try {
    await waitFor(() => stdout.includes('development session'));
    process.kill(-child.pid!, 'SIGINT');
    await new Promise<void>((resolve) => child.once('exit', () => resolve()));
    try {
      await waitFor(async () => (
        !(await canRead(descriptor))
        && await portIsFree(GAME_PORT)
        && await portIsFree(INSPECTION_PORT)
      ));
      cleanShutdown = true;
    } catch {
      cleanShutdown = false;
      const descriptorValue = await canRead(descriptor)
        ? JSON.parse(await readFile(descriptor, 'utf8')) as { ownerPid: number }
        : null;
      observedShutdown = {
        descriptorExists: descriptorValue !== null,
        ownerPid: descriptorValue?.ownerPid ?? null,
        ownerAlive: descriptorValue ? processExists(descriptorValue.ownerPid) : false,
        gamePortFree: await portIsFree(GAME_PORT),
        inspectionPortFree: await portIsFree(INSPECTION_PORT),
      };
    }
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch (cause: unknown) {
        if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
      }
    }
    if (await canRead(project.marker)) {
      const processIds = (await readFile(project.marker, 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((line) => Number(line.split(':')[1]));
      for (const processId of processIds) {
        try {
          process.kill(-processId, 'SIGKILL');
        } catch (cause: unknown) {
          if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
        }
      }
    }
    await rm(descriptor, { force: true });
    await waitFor(async () => await portIsFree(GAME_PORT) && await portIsFree(INSPECTION_PORT));
  }

  assert.equal(cleanShutdown, true, `${stdout}\n${stderr}\n${JSON.stringify(observedShutdown)}`);
});

test('browser publication, direct reads, CLI inspection, and a typed client share one snapshot', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config, { writeOutput: () => {} });
  const origin = new URL(config.development.url).origin;

  try {
    const bootstrapResponse = await fetch(`${session.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin },
    });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json() as {
      schemaVersion: number;
      developmentSessionId: string;
      gameUrl: string;
      credential: string;
    };
    assert.equal(bootstrap.schemaVersion, 1);
    assert.equal(bootstrap.developmentSessionId, session.id);
    assert.equal(bootstrap.gameUrl, config.development.url);

    const frameworkSnapshot = createInspectionSnapshot({
      schemaVersion: 1,
      runtime: { instanceId: 'runtime-parity-001', lifecycle: 'running' },
      diagnostics: [],
      measurements: {
        runtime: { owner: 'framework', frameCount: 42, framesPerSecond: 60 },
        render: {
          owner: 'framework',
          canvasWidth: 1280,
          canvasHeight: 720,
          drawCalls: 16,
          instances: 1247,
          uploadBytesPerFrame: 320,
        },
      },
    });
    const publishResponse = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({
        schemaVersion: 1,
        developmentSessionId: session.id,
        publicationSequence: 1,
        snapshot: frameworkSnapshot,
      }),
    });
    assert.equal(publishResponse.status, 202);
    assert.deepEqual(await publishResponse.json(), {
      schemaVersion: 1,
      accepted: true,
      developmentSessionId: session.id,
      runtimeInstanceId: 'runtime-parity-001',
      acceptedBuildRevision: 1,
    });

    const direct = session.snapshot();
    const cliInspection = await inspectDevelopmentSession(project.projectPath);
    const client = await connectDevelopmentClient(project.projectPath);
    const studioCompatible = await client.readDevelopmentSnapshot();

    assert.equal(direct.connection.state, 'connected');
    assert.equal(direct.acceptedBuildRevision, 1);
    assert.deepEqual(direct.inspection, frameworkSnapshot);
    assert.deepEqual(cliInspection.inspection, frameworkSnapshot);
    assert.deepEqual(studioCompatible.inspection, frameworkSnapshot);
    assert.deepEqual(cliInspection, studioCompatible);
  } finally {
    await session.stop('normal');
  }
});

test('direct, CLI, typed-client, HTTP MCP, and browser command paths share one point-light service', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config, {
    writeOutput: () => {},
    actionTimeoutMilliseconds: 1000,
  });
  const origin = new URL(config.development.url).origin;
  const worldId = parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc');
  const visibleId = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abd');
  const headlessId = parseEntityId('018f0f3a-7b2c-7a1d-8e2f-123456789abe');
  const setCommandId = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac0');
  const correctionCommandId = parseCommandId('018f0f3a-7b2c-7a1d-8e2f-123456789ac1');
  const runtimeInstanceId = 'runtime-point-lights-001';
  const service = createPointLightAuthoringService({
    worldId,
    pointLights: [
      {
        entityId: visibleId,
        label: 'Harbor Lamp',
        revision: 1,
        transform: { schemaVersion: 1, position: [-3.5, 4.25, 6.75] },
        pointLight: {
          schemaVersion: 1,
          color: [1, 0.52, 0.22],
          radius: 4,
          power: 1.05,
        },
      },
      {
        entityId: headlessId,
        label: 'Gate Lamp',
        revision: 1,
        transform: { schemaVersion: 1 },
        pointLight: { schemaVersion: 1, power: 0.5 },
      },
    ],
    runtimeInstanceId,
    renderBindings: [{ entityId: visibleId, renderSlot: 0 }],
  });
  let publicationSequence = 0;

  try {
    const bootstrapResponse = await fetch(`${session.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin },
    });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await bootstrapResponse.json() as { credential: string };
    const browserHeaders = {
      authorization: `Bearer ${bootstrap.credential}`,
      'content-type': 'application/json',
      origin,
    };
    const publish = async () => {
      publicationSequence += 1;
      const response = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: session.id,
          publicationSequence,
          snapshot: createInspectionSnapshot({
            schemaVersion: 1,
            runtime: { instanceId: runtimeInstanceId, lifecycle: 'running' },
            diagnostics: [],
            measurements: {
              runtime: { owner: 'framework', frameCount: publicationSequence },
              render: { owner: 'framework', drawCalls: 16 },
            },
            pointLights: inspectPointLightService(service),
          }),
        }),
      });
      assert.equal(response.status, 202, await response.text());
    };
    const completeNextPointLightAction = async (): Promise<PointLightCommandResult> => {
      const deadline = Date.now() + 500;
      type PointLightBrowserAction = {
        actionId: string;
        kind: 'set-point-light-power' | 'correct-point-light-power';
        runtimeInstanceId: string;
        command?: unknown;
        request?: unknown;
        context: unknown;
      };
      let action: PointLightBrowserAction | null = null;
      while (!action) {
        const response = await fetch(
          `${session.inspectionUrl}/v1/runtime/action?runtimeInstanceId=${runtimeInstanceId}`,
          { headers: { authorization: `Bearer ${bootstrap.credential}`, origin } },
        );
        if (response.status === 200) {
          action = await response.json() as PointLightBrowserAction;
          break;
        }
        assert.equal(response.status, 204);
        if (Date.now() >= deadline) throw new Error('Timed out waiting for point-light action.');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (!action) throw new Error('Point-light action was not returned.');
      const selectedAction = action;
      const result = selectedAction.kind === 'set-point-light-power'
        ? service.submitPointLightPower(selectedAction.command, selectedAction.context)
        : service.correctPointLightPower(selectedAction.request, selectedAction.context);
      const completion = await fetch(`${session.inspectionUrl}/v1/runtime/action-result`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: session.id,
          runtimeInstanceId,
          actionId: selectedAction.actionId,
          result: { kind: 'point-light-command', commandResult: result },
        }),
      });
      assert.equal(completion.status, 202, await completion.text());
      return result;
    };
    const callMcp = async (id: number, name: string, argumentsValue?: unknown) => {
      const response = await fetch(session.mcpUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-11-25',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: {
            name,
            ...(argumentsValue === undefined ? {} : { arguments: argumentsValue }),
          },
        }),
      });
      assert.equal(response.status, 200);
      return await response.json() as {
        result: { structuredContent: Record<string, unknown>; isError?: boolean };
      };
    };

    await publish();
    const client = await connectDevelopmentClient(project.projectPath);
    const directBefore = inspectPointLightService(service);
    const cliBefore = await inspectDevelopmentSession(project.projectPath);
    const typedList = await client.listPointLights();
    const typedLight = await client.getPointLight(visibleId);
    const mcpList = await callMcp(1, 'list_point_lights');
    const mcpLight = await callMcp(2, 'get_point_light', { entityId: visibleId });
    const humanListOutput: string[] = [];
    const humanListExitCode = await runCli([
      'tool',
      'list_point_lights',
      '--project',
      project.projectPath,
    ], {
      stdout: (text) => humanListOutput.push(text),
      stderr: () => {},
    });
    const humanLightOutput: string[] = [];
    const humanLightExitCode = await runCli([
      'tool',
      'get_point_light',
      JSON.stringify({ entityId: visibleId }),
      '--project',
      project.projectPath,
    ], {
      stdout: (text) => humanLightOutput.push(text),
      stderr: () => {},
    });

    assert.deepEqual(session.snapshot().inspection?.pointLights, directBefore);
    assert.deepEqual(cliBefore.inspection?.pointLights, directBefore);
    assert.deepEqual(typedList.pointLights, directBefore.authoring);
    assert.deepEqual(mcpList.result.structuredContent, typedList);
    assert.deepEqual(mcpLight.result.structuredContent, typedLight);
    assert.equal(humanListExitCode, 0);
    assert.equal(humanLightExitCode, 0);
    assert.deepEqual(JSON.parse(humanListOutput[0]!), typedList);
    assert.deepEqual(JSON.parse(humanLightOutput[0]!), typedLight);
    assert.equal(typedLight.pointLight?.render?.renderSlot, 0);
    assert.equal((await client.getPointLight(headlessId)).pointLight?.render, null);

    const setCommand = {
      protocolVersion: 1 as const,
      commandVersion: 1 as const,
      type: 'antiky.authoring.set-point-light-power' as const,
      commandId: setCommandId,
      worldId,
      entityId: visibleId,
      expectedRevision: 1,
      data: { power: 2 },
    };
    const setPromise = client.setPointLightPower(setCommand);
    const directSetResult = await completeNextPointLightAction();
    const clientSetResult = await setPromise;
    assert.deepEqual(clientSetResult, directSetResult);
    assert.equal(clientSetResult.code, 'ACCEPTED');
    await publish();

    const correctionPromise = callMcp(3, 'correct_point_light_power', {
      commandId: correctionCommandId,
      correctedCommandId: setCommandId,
      expectedRevision: 2,
    });
    const directCorrectionResult = await completeNextPointLightAction();
    const mcpCorrection = await correctionPromise;
    assert.deepEqual(mcpCorrection.result.structuredContent, directCorrectionResult);
    assert.equal(directCorrectionResult.resultingRevision, 3);
    await publish();

    const finalDirect = inspectPointLightService(service);
    const finalTyped = await client.getPointLight(visibleId);
    const finalMcp = await callMcp(4, 'get_point_light', { entityId: visibleId });
    assert.equal(finalDirect.authoring[0]?.pointLight.power, 1.05);
    assert.equal(finalDirect.facts.length, 2);
    assert.deepEqual(finalMcp.result.structuredContent, finalTyped);
    assert.deepEqual(finalTyped.pointLight?.facts, finalDirect.facts);
    assert.doesNotMatch(JSON.stringify(finalMcp), /credential|permissions|principalId/i);

    for (const invalidCommand of [
      {},
      undefined,
      { ...setCommand, padding: 'x'.repeat(5_000) },
    ]) {
      await assert.rejects(
        () => client.setPointLightPower(invalidCommand as never),
        (error: unknown) => (
          error instanceof AntikyCliError
          && error.code === 'ANTIKY_ARGUMENT_INVALID'
        ),
      );
    }
    assert.deepEqual(inspectPointLightService(service), finalDirect);

    const oversized = await fetch(
      `${session.inspectionUrl}/v1/actions/set-point-light-power`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${bootstrap.credential}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          schemaVersion: 1,
          command: { ...setCommand, padding: 'x'.repeat(5_000) },
        }),
      },
    );
    assert.equal(oversized.status, 413);
  } finally {
    service.dispose();
    await session.stop('normal');
  }
});

test('direct, typed-client, HTTP, MCP, and human CLI session controls share one result', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const development = await startDevelopmentSession(config, {
    writeOutput: () => {},
    actionTimeoutMilliseconds: 1000,
  });
  const origin = new URL(config.development.url).origin;
  const runtimeInstanceId = 'runtime-session-controls-001';
  const engine = createEngineSession({
    sessionId: parseSessionId('018f0f3a-7b2c-7a1d-8e2f-123456789ab0'),
    worldId: parseWorldId('018f0f3a-7b2c-7a1d-8e2f-123456789abc'),
    runtimeInstanceId,
    systems: [{ id: 'town-update', run: () => undefined }],
    captureInput: () => Object.freeze({}),
    getStateDigest: () => 'town:test-session-controls',
  });
  let publicationSequence = 0;

  try {
    const bootstrapResponse = await fetch(`${development.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin },
    });
    const bootstrap = await bootstrapResponse.json() as { credential: string };
    const browserHeaders = {
      authorization: `Bearer ${bootstrap.credential}`,
      'content-type': 'application/json',
      origin,
    };
    const publish = async () => {
      publicationSequence += 1;
      const response = await fetch(`${development.inspectionUrl}/v1/runtime/snapshot`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: development.id,
          publicationSequence,
          snapshot: createInspectionSnapshot({
            schemaVersion: 1,
            runtime: {
              instanceId: runtimeInstanceId,
              lifecycle: engine.readStatus().mode === 'paused' ? 'paused' : 'running',
            },
            diagnostics: [],
            measurements: {
              runtime: { owner: 'framework', frameCount: publicationSequence },
              render: { owner: 'framework', drawCalls: 1 },
            },
            session: engine.readStatus(),
          }),
        }),
      });
      assert.equal(response.status, 202, await response.text());
    };
    type SessionAction = {
      actionId: string;
      kind: 'pause-simulation' | 'resume-simulation' | 'step-simulation';
      expectedCompletedStepCount?: number;
    };
    const completeNext = async () => {
      const deadline = Date.now() + 500;
      let action: SessionAction;
      while (true) {
        const response = await fetch(
          `${development.inspectionUrl}/v1/runtime/action?runtimeInstanceId=${runtimeInstanceId}`,
          { headers: { authorization: `Bearer ${bootstrap.credential}`, origin } },
        );
        if (response.status === 200) {
          action = await response.json() as SessionAction;
          break;
        }
        assert.equal(response.status, 204);
        if (Date.now() >= deadline) throw new Error('Timed out waiting for session action.');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const result = action.kind === 'pause-simulation'
        ? engine.pause('tool')
        : action.kind === 'resume-simulation'
          ? engine.resume('tool')
          : engine.step(action.expectedCompletedStepCount!, Object.freeze({}));
      const status = engine.readStatus();
      const completion = await fetch(`${development.inspectionUrl}/v1/runtime/action-result`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: development.id,
          runtimeInstanceId,
          actionId: action.actionId,
          result: { kind: 'session-control', controlResult: result, session: status },
        }),
      });
      assert.equal(completion.status, 202, await completion.text());
      await publish();
      return {
        schemaVersion: 1 as const,
        actionId: action.actionId,
        developmentSessionId: development.id,
        result,
        session: status,
      };
    };
    const callMcp = async (id: number, name: string, argumentsValue: object = {}) => {
      const response = await fetch(development.mcpUrl, {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-11-25',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: { name, arguments: argumentsValue },
        }),
      });
      assert.equal(response.status, 200);
      return await response.json() as {
        result: { structuredContent: Record<string, unknown> };
      };
    };

    await publish();
    const client = await connectDevelopmentClient(project.projectPath);
    assert.deepEqual((await client.getSessionStatus()).session, engine.readStatus());

    const typedPending = client.pauseSimulation();
    void typedPending.catch(() => {});
    const directPause = await completeNext();
    assert.deepEqual(await typedPending, directPause);

    const httpPending = fetch(`${development.inspectionUrl}/v1/actions/step-simulation`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, expectedCompletedStepCount: 99 }),
    });
    void httpPending.catch(() => {});
    const directStale = await completeNext();
    const httpResponse = await httpPending;
    assert.equal(httpResponse.status, 200);
    assert.deepEqual(await httpResponse.json(), directStale);
    assert.equal(directStale.result.code, 'STALE_COMPLETED_STEP');

    const mcpPending = callMcp(1, 'step_simulation', { expectedCompletedStepCount: 0 });
    void mcpPending.catch(() => {});
    const directStep = await completeNext();
    const mcpStep = await mcpPending;
    assert.deepEqual(mcpStep.result.structuredContent, directStep);
    assert.equal(directStep.result.code, 'STEPPED');

    const humanOutput: string[] = [];
    const humanPending = runCli([
      'tool',
      'resume_simulation',
      '--project',
      project.projectPath,
    ], {
      stdout: (text) => humanOutput.push(text),
      stderr: () => {},
    });
    void humanPending.catch(() => {});
    const directResume = await completeNext();
    assert.equal(await humanPending, 0);
    assert.deepEqual(JSON.parse(humanOutput[0]!), directResume);
    assert.equal(directResume.result.code, 'RESUMED');

    const mcpStatus = await callMcp(2, 'get_session_status');
    assert.deepEqual(mcpStatus.result.structuredContent, await client.getSessionStatus());
  } finally {
    engine.dispose();
    await development.stop('normal');
  }
});

test('unexpected inspection failures emit a safe request-correlated diagnostic', async () => {
  const credential = 'credential-must-not-appear-in-diagnostics';
  const diagnostics: unknown[] = [];
  const server = createInspectionServer({
    host: '127.0.0.1',
    port: INSPECTION_PORT,
    developmentSessionId: 'development-request-diagnostic-001',
    gameUrl: `http://127.0.0.1:${GAME_PORT}/game`,
    credential,
    diagnosticSink: (event) => diagnostics.push(event),
    readDevelopmentSnapshot() {
      throw new Error('authorization and payload must-not-appear');
    },
    acceptInspection: () => 0,
    disconnectRuntime: () => {},
    touchRuntime: () => {},
    nextAction: () => null,
    completeCapture: async () => {},
    completePointLightCommand: async () => {},
    completeSessionControl: async () => {},
    requestReload: async () => { throw new Error('not reached'); },
    captureFrame: async () => { throw new Error('not reached'); },
    setPointLightPower: async () => { throw new Error('not reached'); },
    correctPointLightPower: async () => { throw new Error('not reached'); },
    pauseSimulation: async () => { throw new Error('not reached'); },
    resumeSimulation: async () => { throw new Error('not reached'); },
    stepSimulation: async () => { throw new Error('not reached'); },
  });
  await server.start();

  try {
    const response = await fetch(`http://127.0.0.1:${INSPECTION_PORT}/v1/development`, {
      headers: { authorization: `Bearer ${credential}` },
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: { code: 'ANTIKY_INTERNAL_ERROR', message: 'Inspection service failed.' },
    });
    assert.equal(diagnostics.length, 1);
    const [diagnostic] = diagnostics as Array<Record<string, unknown>>;
    assert.deepEqual({ ...diagnostic, requestId: undefined }, {
      schemaVersion: 1,
      level: 'error',
      code: 'ANTIKY_REQUEST_FAILED',
      developmentSessionId: 'development-request-diagnostic-001',
      requestId: undefined,
      component: 'inspection-server',
    });
    assert.match(String(diagnostic?.requestId), /^request-[0-9a-f-]{36}$/);
    const diagnosticText = JSON.stringify(diagnostics);
    assert.doesNotMatch(diagnosticText, /credential|authorization|payload|must-not-appear/i);
  } finally {
    await server.stop();
  }
});

test('browser boundary rejects unauthorized, wrong-origin, stale, malformed, and oversized messages', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config, { writeOutput: () => {} });
  const origin = new URL(config.development.url).origin;
  const snapshot = createInspectionSnapshot({
    schemaVersion: 1,
    runtime: { instanceId: 'runtime-security-001', lifecycle: 'ready' },
    diagnostics: [],
    measurements: {
      runtime: { owner: 'framework', frameCount: 2 },
      render: { owner: 'framework', canvasWidth: 640, canvasHeight: 480 },
    },
  });

  try {
    const bootstrapResponse = await fetch(`${session.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin },
    });
    const bootstrap = await bootstrapResponse.json() as { credential: string };
    const validEnvelope = {
      schemaVersion: 1,
      developmentSessionId: session.id,
      publicationSequence: 1,
      snapshot,
    };

    const unauthorized = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify(validEnvelope),
    });
    assert.equal(unauthorized.status, 401);

    const wrongOrigin = await fetch(`${session.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin: 'http://127.0.0.1:49999' },
    });
    assert.equal(wrongOrigin.status, 403);

    const malformed = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: '{',
    });
    assert.equal(malformed.status, 400);

    const oversized = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: ' '.repeat(256 * 1024 + 1),
    });
    assert.equal(oversized.status, 413);

    const invalidPointLights = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({
        ...validEnvelope,
        snapshot: { ...snapshot, pointLights: {} },
      }),
    });
    assert.equal(invalidPointLights.status, 400);

    const invalidSession = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({
        ...validEnvelope,
        snapshot: { ...snapshot, session: {} },
      }),
    });
    assert.equal(invalidSession.status, 400);
    assert.equal(
      ((await invalidSession.json()) as { error: { code: string } }).error.code,
      'ANTIKY_ENGINE_SESSION_INVALID',
    );

    const stale = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootstrap.credential}`,
        'content-type': 'application/json',
        origin,
      },
      body: JSON.stringify({ ...validEnvelope, developmentSessionId: 'development-stale' }),
    });
    assert.equal(stale.status, 409);
    assert.equal(session.snapshot().connection.state, 'waiting');
    assert.equal(session.snapshot().inspection, null);
  } finally {
    await session.stop('normal');
  }
});

test('disconnect, reconnect, controlled reload, and capture preserve related identities', async () => {
  const project = await makeProject();
  const config = await loadAntikyProject(project.projectPath);
  const session = await startDevelopmentSession(config, {
    writeOutput: () => {},
    actionTimeoutMilliseconds: 1000,
  });
  const origin = new URL(config.development.url).origin;

  try {
    const bootstrapResponse = await fetch(`${session.inspectionUrl}/v1/browser/bootstrap`, {
      headers: { origin },
    });
    const bootstrap = await bootstrapResponse.json() as { credential: string };
    const browserHeaders = {
      authorization: `Bearer ${bootstrap.credential}`,
      'content-type': 'application/json',
      origin,
    };
    const publish = async (runtimeInstanceId: string, publicationSequence: number) => {
      const response = await fetch(`${session.inspectionUrl}/v1/runtime/snapshot`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: session.id,
          publicationSequence,
          snapshot: createInspectionSnapshot({
            schemaVersion: 1,
            runtime: { instanceId: runtimeInstanceId, lifecycle: 'ready' },
            diagnostics: [],
            measurements: {
              runtime: { owner: 'framework', frameCount: 2 },
              render: { owner: 'framework', canvasWidth: 1, canvasHeight: 1 },
            },
          }),
        }),
      });
      assert.equal(response.status, 202, JSON.stringify(await response.json()));
    };
    const disconnect = async (runtimeInstanceId: string, publicationSequence: number) => {
      const response = await fetch(`${session.inspectionUrl}/v1/runtime/disconnect`, {
        method: 'POST',
        headers: browserHeaders,
        body: JSON.stringify({
          schemaVersion: 1,
          developmentSessionId: session.id,
          runtimeInstanceId,
          publicationSequence,
        }),
      });
      assert.equal(response.status, 202);
    };
    const pollAction = async (runtimeInstanceId: string) => {
      const deadline = Date.now() + 500;
      while (true) {
        const response = await fetch(
          `${session.inspectionUrl}/v1/runtime/action?runtimeInstanceId=${runtimeInstanceId}`,
          { headers: { authorization: `Bearer ${bootstrap.credential}`, origin } },
        );
        if (response.status === 200) {
          return await response.json() as { actionId: string; kind: 'reload' | 'capture' };
        }
        assert.equal(response.status, 204);
        if (Date.now() >= deadline) throw new Error('Timed out waiting for development action.');
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };

    await publish('runtime-reconnect-001', 1);
    const developmentSessionId = session.id;
    await disconnect('runtime-reconnect-001', 2);
    assert.equal(session.snapshot().connection.state, 'unavailable');
    await publish('runtime-reconnect-002', 1);
    assert.equal(session.snapshot().connection.state, 'connected');
    assert.equal(session.snapshot().developmentSessionId, developmentSessionId);
    assert.equal(session.snapshot().acceptedBuildRevision, 1);

    const client = await connectDevelopmentClient(project.projectPath);
    const reloadPromise = client.requestReload();
    const reloadAction = await pollAction('runtime-reconnect-002');
    assert.equal(reloadAction.kind, 'reload');
    await disconnect('runtime-reconnect-002', 2);
    await publish('runtime-reconnect-003', 1);
    assert.deepEqual(await reloadPromise, {
      schemaVersion: 1,
      actionId: reloadAction.actionId,
      developmentSessionId,
      buildRevision: 1,
      oldRuntimeInstanceId: 'runtime-reconnect-002',
      newRuntimeInstanceId: 'runtime-reconnect-003',
      result: 'reloaded',
    });

    const capturePromise = client.captureFrame();
    void capturePromise.catch(() => {});
    const captureAction = await pollAction('runtime-reconnect-003');
    assert.equal(captureAction.kind, 'capture');
    const png = Buffer.alloc(5 * 1024 * 1024 + 64 * 1024);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
    const captureResponse = await fetch(`${session.inspectionUrl}/v1/runtime/action-result`, {
      method: 'POST',
      headers: browserHeaders,
      body: JSON.stringify({
        schemaVersion: 1,
        developmentSessionId,
        runtimeInstanceId: 'runtime-reconnect-003',
        actionId: captureAction.actionId,
        result: {
          kind: 'capture',
          mimeType: 'image/png',
          canvasWidth: 1,
          canvasHeight: 1,
          dataBase64: png.toString('base64'),
        },
      }),
    });
    assert.equal(captureResponse.status, 202);
    const capture = await capturePromise;
    assert.equal(capture.developmentSessionId, developmentSessionId);
    assert.equal(capture.runtimeInstanceId, 'runtime-reconnect-003');
    assert.equal(capture.buildRevision, 1);
    assert.equal(capture.actionId, captureAction.actionId);
    assert.equal(capture.byteLength, png.length);
    assert.deepEqual(await readFile(capture.path), png);
    assert.doesNotMatch(JSON.stringify(capture), /credential/i);
  } finally {
    await session.stop('normal');
  }
});
