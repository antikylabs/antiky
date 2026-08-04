import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createInspectionSnapshot } from '@antiky/framework';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  AntikyCliError,
  connectDevelopmentClient,
  inspectDevelopmentSession,
  loadAntikyConfig,
  startDevelopmentSession,
} from '../src/index.ts';

const fixture = fileURLToPath(new URL('fixtures/managed-child.mjs', import.meta.url));
const cli = fileURLToPath(new URL('../src/bin.ts', import.meta.url));
const GAME_PORT = 43100;
const INSPECTION_PORT = 43101;

async function makeProject(options: {
  gameBehavior?: 'run' | 'fail';
  shaderBehavior?: 'run' | 'fail';
  gameCommand?: string[];
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'antiky-session-'));
  const marker = join(directory, 'children.log');
  const configPath = join(directory, 'antiky.config.json');
  const gameCommand = options.gameCommand ?? [
    process.execPath,
    fixture,
    'game',
    marker,
    options.gameBehavior ?? 'run',
  ];
  const config = {
    schemaVersion: 1,
    game: {
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
    },
    network: {
      host: '127.0.0.1',
      gamePort: GAME_PORT,
      inspectionPort: INSPECTION_PORT,
    },
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { directory, marker, configPath };
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

test('development session starts both children, publishes health, and cleans up', async () => {
  const project = await makeProject();
  const config = await loadAntikyConfig(project.configPath);
  const lines: string[] = [];
  const session = await startDevelopmentSession(config, {
    writeOutput: (line) => lines.push(line),
  });
  const descriptor = join(dirname(project.configPath), '.antiky', 'dev-session.json');
  try {
    await waitFor(async () => (
      await canRead(project.marker)
      && (await readFile(project.marker, 'utf8')).split('\n').length >= 3
    ));
    const snapshot = await inspectDevelopmentSession(project.configPath);
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
    assert.ok(lines.some((line) => line.includes(config.game.url)));
    assert.ok(lines.some((line) => line.includes(session.id)));

    const descriptorMode = (await stat(descriptor)).mode & 0o777;
    assert.equal(descriptorMode, 0o600);

    const firstLaunchDuration = snapshot.measurements.launchMilliseconds;
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(session.snapshot().measurements.launchMilliseconds, firstLaunchDuration);
  } finally {
    const result = await session.stop('normal');
    assert.equal(result.reason, 'normal');
    assert.equal(result.exitCode, 0);
  }
  assert.equal(await canRead(descriptor), false);
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await portIsFree(INSPECTION_PORT), true);
});

test('antiky dev starts a loopback Streamable HTTP MCP endpoint', async () => {
  const project = await makeProject();
  const config = await loadAntikyConfig(project.configPath);
  const lines: string[] = [];
  const session = await startDevelopmentSession(config, {
    writeOutput: (line) => lines.push(line),
  });

  try {
    assert.equal(session.mcpUrl, `${session.inspectionUrl}/mcp`);
    assert.ok(lines.includes(`MCP: ${session.mcpUrl}`));
    assert.ok(lines.includes('Services: game, shaders, inspection, mcp'));

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
      'dev_reload',
      'capture_frame',
    ]);

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

test('busy ports reject before either child starts', async () => {
  const project = await makeProject();
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(GAME_PORT, '127.0.0.1', resolve));

  try {
    const config = await loadAntikyConfig(project.configPath);
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
    const config = await loadAntikyConfig(project.configPath);
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
  const config = await loadAntikyConfig(project.configPath);

  await assert.rejects(
    () => startDevelopmentSession(config),
    (error: unknown) => error instanceof AntikyCliError && error.code === 'ANTIKY_CHILD_START_FAILED',
  );
  await waitFor(() => portIsFree(INSPECTION_PORT));
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await canRead(join(project.directory, '.antiky', 'dev-session.json')), false);
});

test('one child failure stops its sibling and reports the child exit', async () => {
  const project = await makeProject({ shaderBehavior: 'fail' });
  const config = await loadAntikyConfig(project.configPath);
  const session = await startDevelopmentSession(config);
  const result = await session.stopped;

  assert.equal(result.reason, 'child-failure');
  assert.equal(result.exitCode, 7);
  assert.equal(await portIsFree(GAME_PORT), true);
  assert.equal(await portIsFree(INSPECTION_PORT), true);
});

test('cleanup kills a child process group after its leader exits', async () => {
  const project = await makeProject({ gameBehavior: 'run' });
  const source = JSON.parse(await readFile(project.configPath, 'utf8')) as {
    game: { command: string[] };
  };
  source.game.command = [process.execPath, fixture, 'game-parent', project.marker, 'orphan'];
  await writeFile(project.configPath, `${JSON.stringify(source, null, 2)}\n`);
  const config = await loadAntikyConfig(project.configPath);
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

test('SIGINT stops the CLI session and releases both ports', async () => {
  const project = await makeProject();
  const child = spawn(process.execPath, [
    '--experimental-strip-types',
    '--experimental-transform-types',
    cli,
    'dev',
    '--config',
    project.configPath,
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

test('browser publication, direct reads, CLI inspection, and a typed client share one snapshot', async () => {
  const project = await makeProject();
  const config = await loadAntikyConfig(project.configPath);
  const session = await startDevelopmentSession(config, { writeOutput: () => {} });
  const origin = new URL(config.game.url).origin;

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
    assert.equal(bootstrap.gameUrl, config.game.url);

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
    const cliInspection = await inspectDevelopmentSession(project.configPath);
    const client = await connectDevelopmentClient(project.configPath);
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

test('browser boundary rejects unauthorized, wrong-origin, stale, malformed, and oversized messages', async () => {
  const project = await makeProject();
  const config = await loadAntikyConfig(project.configPath);
  const session = await startDevelopmentSession(config, { writeOutput: () => {} });
  const origin = new URL(config.game.url).origin;
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
  const config = await loadAntikyConfig(project.configPath);
  const session = await startDevelopmentSession(config, {
    writeOutput: () => {},
    actionTimeoutMilliseconds: 1000,
  });
  const origin = new URL(config.game.url).origin;

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

    const client = await connectDevelopmentClient(project.configPath);
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
    const captureAction = await pollAction('runtime-reconnect-003');
    assert.equal(captureAction.kind, 'capture');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
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
