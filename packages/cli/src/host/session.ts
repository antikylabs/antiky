import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import { join } from 'node:path';

import type { AntikyConfig } from '../config.ts';
import { createBuildTracker } from './build-tracker.ts';
import { createDevelopmentActionBroker } from './actions.ts';
import {
  DEVELOPMENT_SCHEMA_VERSION,
  type DevelopmentCleanupState,
  type DevelopmentProcessState,
  type DevelopmentSnapshot,
  type DevelopmentStopReason,
  type DevelopmentStopResult,
} from '../development/types.ts';
import { AntikyCliError } from '../errors.ts';
import { createInspectionServer } from './inspection-server.ts';
import { createRuntimeConnection } from './runtime-connection.ts';
import {
  getSessionDescriptorPath,
  removeSessionDescriptor,
  writeSessionDescriptor,
} from './session-descriptor.ts';

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
  watchPaths?: readonly string[];
  buildFailureTimeoutMilliseconds?: number;
  actionTimeoutMilliseconds?: number;
  runtimeConnectionTimeoutMilliseconds?: number;
}>;

export interface DevelopmentSession {
  readonly id: string;
  readonly inspectionUrl: string;
  readonly mcpUrl: string;
  readonly descriptorPath: string;
  readonly stopped: Promise<DevelopmentStopResult>;
  snapshot(): DevelopmentSnapshot;
  stop(reason?: DevelopmentStopReason, exitCode?: number): Promise<DevelopmentStopResult>;
}

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
  const mcpUrl = `${inspectionUrl}/mcp`;
  const descriptorPath = getSessionDescriptorPath(config.path);
  const startedAtMilliseconds = Date.now();
  const startedAt = new Date(startedAtMilliseconds).toISOString();
  let launchMilliseconds: number | undefined;
  const buildTracker = createBuildTracker({
    developmentSessionId: id,
    rootDirectory: config.game.workingDirectory,
    ...(options.buildFailureTimeoutMilliseconds === undefined
      ? {}
      : { failureTimeoutMilliseconds: options.buildFailureTimeoutMilliseconds }),
  });
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

  const runtimeConnection = createRuntimeConnection({
    acceptBuild: (inspection) => buildTracker.acceptRuntime(inspection),
    ...(options.runtimeConnectionTimeoutMilliseconds === undefined
      ? {}
      : { timeoutMilliseconds: options.runtimeConnectionTimeoutMilliseconds }),
  });

  const actionBroker = createDevelopmentActionBroker({
    developmentSessionId: id,
    rootDirectory: config.game.workingDirectory,
    readRuntimeContext: () => {
      const runtime = runtimeConnection.read();
      return {
        runtimeInstanceId: runtime.runtimeInstanceId,
        buildRevision: buildTracker.snapshot().revision,
        connected: runtime.state === 'connected',
      };
    },
    ...(options.actionTimeoutMilliseconds === undefined
      ? {}
      : { timeoutMilliseconds: options.actionTimeoutMilliseconds }),
  });

  const snapshot = (): DevelopmentSnapshot => {
    const runtime = runtimeConnection.read();
    const build = buildTracker.snapshot();
    return Object.freeze({
      schemaVersion: DEVELOPMENT_SCHEMA_VERSION,
      developmentSessionId: id,
      acceptedBuildRevision: build.revision,
      startedAt,
      config: Object.freeze({
        path: config.path,
        gameUrl: config.game.url,
        host: config.network.host,
        gamePort: config.network.gamePort,
        inspectionPort: config.network.inspectionPort,
        viewport: config.game.viewport,
      }),
      processes: Object.freeze({
        game: processSnapshot(processRecords.game),
        shaders: processSnapshot(processRecords.shaders),
      }),
      connection: Object.freeze({ state: runtime.state }),
      cleanup: Object.freeze({ state: cleanupState }),
      build,
      diagnostics: buildTracker.diagnostics(),
      measurements: Object.freeze({
        owner: 'cli' as const,
        launchMilliseconds: launchMilliseconds ?? Math.max(0, Date.now() - startedAtMilliseconds),
        ...(cleanupMilliseconds === undefined ? {} : { cleanupMilliseconds }),
      }),
      inspection: runtime.inspection,
    });
  };

  const inspectionServer = createInspectionServer({
    host: config.network.host,
    port: config.network.inspectionPort,
    developmentSessionId: id,
    gameUrl: config.game.url,
    credential,
    readDevelopmentSnapshot: snapshot,
    acceptInspection(inspection, publicationSequence) {
      const acceptedBuildRevision = runtimeConnection.accept(inspection, publicationSequence);
      if (
        inspection.runtime.lifecycle === 'ready'
        || inspection.runtime.lifecycle === 'running'
        || inspection.runtime.lifecycle === 'paused'
      ) actionBroker.noteRuntimeConnected(inspection.runtime.instanceId);
      return acceptedBuildRevision;
    },
    disconnectRuntime: (runtimeInstanceId, publicationSequence) => (
      runtimeConnection.disconnect(runtimeInstanceId, publicationSequence)
    ),
    touchRuntime: (runtimeInstanceId) => runtimeConnection.touch(runtimeInstanceId),
    nextAction: (runtimeInstanceId) => actionBroker.nextAction(runtimeInstanceId),
    completeCapture: (input) => actionBroker.completeCapture(input),
    requestReload: () => actionBroker.requestReload(),
    captureFrame: () => actionBroker.captureFrame(),
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
      actionBroker.stop();
      await buildTracker.stop();
      await Promise.all(children.map(stopChild));
      await inspectionServer.stop();
      await removeSessionDescriptor(descriptorPath);
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
        ANTIKY_GAME_WIDTH: String(config.game.viewport.width),
        ANTIKY_GAME_HEIGHT: String(config.game.viewport.height),
        ANTIKY_INSPECTION_URL: inspectionUrl,
        ANTIKY_MCP_URL: mcpUrl,
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
    await inspectionServer.start();
    await writeSessionDescriptor(descriptorPath, {
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
    await buildTracker.watch(options.watchPaths ?? [
      config.path,
      join(config.game.workingDirectory, 'packages', 'demos', 'src'),
      join(config.game.workingDirectory, 'packages', 'demos', 'dev-host'),
      join(config.game.workingDirectory, 'src'),
    ]);
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
  writeOutput(`MCP: ${mcpUrl}`);
  writeOutput('Services: game, shaders, inspection, mcp');

  return Object.freeze({
    id,
    inspectionUrl,
    mcpUrl,
    descriptorPath,
    stopped,
    snapshot,
    stop,
  });
}
