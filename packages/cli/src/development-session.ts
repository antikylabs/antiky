import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import { dirname, join } from 'node:path';

import type { AntikyConfig } from './config.ts';
import {
  DEVELOPMENT_SCHEMA_VERSION,
  type DevelopmentCleanupState,
  type DevelopmentProcessState,
  type DevelopmentSnapshot,
  type DevelopmentStopReason,
  type DevelopmentStopResult,
} from './development-types.ts';
import { AntikyCliError } from './errors.ts';

const SESSION_DIRECTORY = '.antiky';
const SESSION_FILE = 'dev-session.json';
const CHILD_STOP_TIMEOUT_MILLISECONDS = 1500;

type ProcessRecord = {
  state: DevelopmentProcessState;
  pid?: number;
  exitCode?: number;
};

type ManagedChild = {
  name: 'game' | 'shaders';
  process: ChildProcess;
  detached: boolean;
};

export type DevelopmentSessionOptions = Readonly<{
  writeOutput?: (line: string) => void;
}>;

export interface DevelopmentSession {
  readonly id: string;
  readonly inspectionUrl: string;
  readonly descriptorPath: string;
  readonly stopped: Promise<DevelopmentStopResult>;
  snapshot(): DevelopmentSnapshot;
  stop(reason?: DevelopmentStopReason, exitCode?: number): Promise<DevelopmentStopResult>;
}

type SessionDescriptor = Readonly<{
  schemaVersion: 1;
  developmentSessionId: string;
  configHash: string;
  inspectionUrl: string;
  credential: string;
  ownerPid: number;
}>;

function processSnapshot(record: ProcessRecord): Readonly<ProcessRecord> {
  return Object.freeze({
    state: record.state,
    ...(record.pid === undefined ? {} : { pid: record.pid }),
    ...(record.exitCode === undefined ? {} : { exitCode: record.exitCode }),
  });
}

function closeNetServer(server: NetServer | undefined): Promise<void> {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}

function closeHttpServer(server: HttpServer): Promise<void> {
  if (!server.listening) return Promise.resolve();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

async function reservePort(
  host: string,
  port: number,
  path: '$.network.gamePort' | '$.network.inspectionPort',
): Promise<NetServer> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', (cause: NodeJS.ErrnoException) => {
      if (cause.code === 'EADDRINUSE' || cause.code === 'EACCES') {
        reject(new AntikyCliError('ANTIKY_PORT_BUSY', `Port ${host}:${port} is unavailable.`, path));
      } else {
        reject(cause);
      }
    });
    server.listen({ host, port, exclusive: true }, resolve);
  });
  return server;
}

function hasCredential(header: string | undefined, credential: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice('Bearer '.length));
  const expected = Buffer.from(credential);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function writeJson(
  response: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  response.end(text);
}

async function listenHttp(server: HttpServer, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host, port, exclusive: true }, resolve);
  });
}

async function writeDescriptor(path: string, descriptor: SessionDescriptor): Promise<void> {
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(descriptor, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
    await chmod(path, 0o600);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

async function removeDescriptor(path: string): Promise<void> {
  await rm(path, { force: true });
  try {
    await rmdir(dirname(path));
  } catch (cause: unknown) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw cause;
  }
}

function sendSignal(child: ManagedChild, signal: NodeJS.Signals): void {
  try {
    if (child.detached && child.process.pid) {
      process.kill(-child.process.pid, signal);
      return;
    }
    if (child.process.exitCode === null && child.process.signalCode === null) child.process.kill(signal);
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code !== 'ESRCH') throw cause;
  }
}

function processGroupExists(child: ManagedChild): boolean {
  if (!child.detached || !child.process.pid) {
    return child.process.exitCode === null && child.process.signalCode === null;
  }
  try {
    process.kill(-child.process.pid, 0);
    return true;
  } catch (cause: unknown) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false;
    if (code === 'EPERM') return true;
    throw cause;
  }
}

async function waitForChildExit(child: ManagedChild, timeoutMilliseconds: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMilliseconds;
  while (processGroupExists(child)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return true;
}

async function stopChild(child: ManagedChild): Promise<void> {
  sendSignal(child, 'SIGTERM');
  if (await waitForChildExit(child, CHILD_STOP_TIMEOUT_MILLISECONDS)) return;
  sendSignal(child, 'SIGKILL');
  await waitForChildExit(child, CHILD_STOP_TIMEOUT_MILLISECONDS);
}

function waitForSpawn(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSpawn = () => {
      child.off('error', onError);
      resolve();
    };
    const onError = (cause: Error) => {
      child.off('spawn', onSpawn);
      reject(cause);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

export async function startDevelopmentSession(
  config: AntikyConfig,
  options: DevelopmentSessionOptions = {},
): Promise<DevelopmentSession> {
  const writeOutput = options.writeOutput ?? ((line: string) => process.stdout.write(`${line}\n`));
  let gameReservation: NetServer | undefined;
  let inspectionReservation: NetServer | undefined;
  try {
    gameReservation = await reservePort(
      config.network.host,
      config.network.gamePort,
      '$.network.gamePort',
    );
    inspectionReservation = await reservePort(
      config.network.host,
      config.network.inspectionPort,
      '$.network.inspectionPort',
    );
  } catch (cause) {
    await closeNetServer(gameReservation);
    await closeNetServer(inspectionReservation);
    throw cause;
  }

  const id = randomUUID();
  const credential = randomBytes(32).toString('base64url');
  const inspectionUrl = `http://${config.network.host}:${config.network.inspectionPort}`;
  const descriptorPath = join(dirname(config.path), SESSION_DIRECTORY, SESSION_FILE);
  const startedAtMilliseconds = Date.now();
  const startedAt = new Date(startedAtMilliseconds).toISOString();
  let launchMilliseconds: number | undefined;
  const processRecords = {
    game: { state: 'starting' } as ProcessRecord,
    shaders: { state: 'starting' } as ProcessRecord,
  };
  let cleanupState: DevelopmentCleanupState = 'active';
  let cleanupMilliseconds: number | undefined;
  const children: ManagedChild[] = [];
  let stopping = false;
  let stopPromise: Promise<DevelopmentStopResult> | undefined;
  let resolveStopped!: (result: DevelopmentStopResult) => void;
  const stopped = new Promise<DevelopmentStopResult>((resolve) => { resolveStopped = resolve; });

  const snapshot = (): DevelopmentSnapshot => Object.freeze({
    schemaVersion: DEVELOPMENT_SCHEMA_VERSION,
    developmentSessionId: id,
    acceptedBuildRevision: 0,
    startedAt,
    config: Object.freeze({
      path: config.path,
      gameUrl: config.game.url,
      host: config.network.host,
      gamePort: config.network.gamePort,
      inspectionPort: config.network.inspectionPort,
    }),
    processes: Object.freeze({
      game: processSnapshot(processRecords.game),
      shaders: processSnapshot(processRecords.shaders),
    }),
    connection: Object.freeze({ state: 'waiting' as const }),
    cleanup: Object.freeze({ state: cleanupState }),
    diagnostics: Object.freeze([]),
    measurements: Object.freeze({
      owner: 'cli' as const,
      launchMilliseconds: launchMilliseconds ?? Math.max(0, Date.now() - startedAtMilliseconds),
      ...(cleanupMilliseconds === undefined ? {} : { cleanupMilliseconds }),
    }),
    inspection: null,
  });

  const gameOrigin = new URL(config.game.url).origin;
  const expectedHost = `${config.network.host}:${config.network.inspectionPort}`;
  const httpServer = createHttpServer((request, response) => {
    if (request.headers.host !== expectedHost) {
      writeJson(response, 400, { error: { code: 'ANTIKY_HOST_INVALID', message: 'Invalid Host header.' } });
      return;
    }
    if (request.headers.origin && request.headers.origin !== gameOrigin) {
      writeJson(response, 403, { error: { code: 'ANTIKY_ORIGIN_INVALID', message: 'Invalid Origin header.' } });
      return;
    }
    if (!hasCredential(request.headers.authorization, credential)) {
      writeJson(response, 401, { error: { code: 'ANTIKY_UNAUTHORIZED', message: 'Authorization is required.' } });
      return;
    }
    if (request.method === 'GET' && request.url === '/v1/development') {
      writeJson(response, 200, snapshot());
      return;
    }
    writeJson(response, 404, { error: { code: 'ANTIKY_NOT_FOUND', message: 'Resource does not exist.' } });
  });

  const stop = (
    reason: DevelopmentStopReason = 'normal',
    exitCode = reason === 'normal' ? 0 : 1,
  ): Promise<DevelopmentStopResult> => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      stopping = true;
      cleanupState = 'stopping';
      const cleanupStarted = Date.now();
      await Promise.all(children.map(stopChild));
      await closeHttpServer(httpServer);
      await removeDescriptor(descriptorPath);
      cleanupMilliseconds = Date.now() - cleanupStarted;
      cleanupState = 'stopped';
      const result = Object.freeze({ reason, exitCode, cleanupMilliseconds });
      resolveStopped(result);
      return result;
    })();
    return stopPromise;
  };

  const spawnManaged = async (
    name: 'game' | 'shaders',
    command: readonly string[],
  ): Promise<void> => {
    const detached = process.platform !== 'win32';
    const child = spawn(command[0]!, command.slice(1), {
      cwd: config.game.workingDirectory,
      detached,
      env: {
        ...process.env,
        ANTIKY_HOST: config.network.host,
        ANTIKY_GAME_PORT: String(config.network.gamePort),
        ANTIKY_INSPECTION_PORT: String(config.network.inspectionPort),
        ANTIKY_GAME_URL: config.game.url,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const managed = { name, process: child, detached };
    children.push(managed);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => writeOutput(`[${name}] ${chunk.trimEnd()}`));
    child.stderr?.on('data', (chunk: string) => writeOutput(`[${name}] ${chunk.trimEnd()}`));
    child.once('exit', (code) => {
      const record = processRecords[name];
      record.exitCode = code ?? 1;
      record.state = stopping ? 'stopped' : 'failed';
      if (!stopping) void stop('child-failure', code && code !== 0 ? code : 1);
    });
    try {
      await waitForSpawn(child);
    } catch (cause: unknown) {
      processRecords[name].state = 'failed';
      throw new AntikyCliError(
        'ANTIKY_CHILD_START_FAILED',
        `Unable to start ${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
    processRecords[name].pid = child.pid;
    processRecords[name].state = 'running';
  };

  try {
    await closeNetServer(inspectionReservation);
    inspectionReservation = undefined;
    await listenHttp(httpServer, config.network.host, config.network.inspectionPort);
    await writeDescriptor(descriptorPath, {
      schemaVersion: 1,
      developmentSessionId: id,
      configHash: config.hash,
      inspectionUrl,
      credential,
      ownerPid: process.pid,
    });
    await spawnManaged('shaders', config.game.shaderCommand);
    await closeNetServer(gameReservation);
    gameReservation = undefined;
    await spawnManaged('game', config.game.command);
    launchMilliseconds = Date.now() - startedAtMilliseconds;
  } catch (cause) {
    await closeNetServer(gameReservation);
    await closeNetServer(inspectionReservation);
    await stop('start-failure', 1);
    if (cause instanceof AntikyCliError) throw cause;
    throw new AntikyCliError(
      'ANTIKY_CHILD_START_FAILED',
      `Unable to start the development session: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  writeOutput(`Antiky development session ${id}`);
  writeOutput(`Config: ${config.path}`);
  writeOutput(`Game: ${config.game.url}`);
  writeOutput(`Inspection: ${inspectionUrl}`);
  writeOutput('Services: game, shaders, inspection');

  return Object.freeze({
    id,
    inspectionUrl,
    descriptorPath,
    stopped,
    snapshot,
    stop,
  });
}
