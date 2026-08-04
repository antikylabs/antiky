import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import {
  AntikyCliError,
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
