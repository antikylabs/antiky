import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer as createNetServer, type Server as NetServer } from 'node:net';
import { join } from 'node:path';

import type { AntikyProject } from '../project.ts';
import type { DevelopmentConnection } from '../development/browser-client.ts';
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
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticComponent,
  type CliDiagnosticSink,
} from './diagnostics.ts';
import { createInspectionServer } from './inspection-server.ts';
import { createDevelopmentGameHost } from './game-server.ts';
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

export type DevelopmentCleanupOperation =
  | 'action-broker'
  | 'game-port-reservation'
  | 'inspection-port-reservation'
  | 'session-descriptor'
  | 'build-watcher'
  | 'game-host'
  | 'game-child'
  | 'shaders-child'
  | 'inspection-server';

export type DevelopmentSessionOptions = Readonly<{
  writeOutput?: (line: string) => void;
  watchPaths?: readonly string[];
  buildFailureTimeoutMilliseconds?: number;
  actionTimeoutMilliseconds?: number;
  runtimeConnectionTimeoutMilliseconds?: number;
  diagnosticSink?: CliDiagnosticSink;
  runCleanupOperation?: (
    name: DevelopmentCleanupOperation,
    operation: () => Promise<void>,
  ) => Promise<void>;
}>;

export interface DevelopmentSession {
  readonly id: string;
  readonly connection: DevelopmentConnection;
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
  if (!await waitForChildExit(child, CHILD_STOP_TIMEOUT_MILLISECONDS)) {
    throw new AntikyCliError(
      'ANTIKY_CHILD_STOP_FAILED',
      `The ${child.name} process group did not stop.`,
    );
  }
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
  project: AntikyProject,
  options: DevelopmentSessionOptions = {},
): Promise<DevelopmentSession> {
  const writeOutput = options.writeOutput ?? ((line: string) => process.stdout.write(`${line}\n`));
  const diagnosticSink = options.diagnosticSink ?? NOOP_CLI_DIAGNOSTIC_SINK;
  const runCleanupOperation = options.runCleanupOperation
    ?? ((_name: DevelopmentCleanupOperation, operation: () => Promise<void>) => operation());
  let gameReservation: NetServer | undefined;
  let inspectionReservation: NetServer | undefined;
  try {
    gameReservation = await reservePort(
      project.network.host,
      project.network.gamePort,
      '$.network.gamePort',
    );
    inspectionReservation = await reservePort(
      project.network.host,
      project.network.inspectionPort,
      '$.network.inspectionPort',
    );
  } catch (cause) {
    await Promise.allSettled([
      closeNetServer(gameReservation),
      closeNetServer(inspectionReservation),
    ]);
    throw cause;
  }

  const id = randomUUID();
  const reportSession = (
    level: 'info' | 'warning' | 'error',
    code:
      | 'ANTIKY_SESSION_STARTING'
      | 'ANTIKY_SESSION_READY'
      | 'ANTIKY_SESSION_STOPPING'
      | 'ANTIKY_SESSION_STOPPED'
      | 'ANTIKY_SESSION_START_FAILED'
      | 'ANTIKY_COMPONENT_STARTED'
      | 'ANTIKY_CHILD_EXITED'
      | 'ANTIKY_CLEANUP_FAILED',
    component: CliDiagnosticComponent = 'session',
  ): void => emitCliDiagnostic(diagnosticSink, {
    level,
    code,
    developmentSessionId: id,
    component,
  });
  reportSession('info', 'ANTIKY_SESSION_STARTING');
  const credential = randomBytes(32).toString('base64url');
  const inspectionUrl = `http://${project.network.host}:${project.network.inspectionPort}`;
  const mcpUrl = `${inspectionUrl}/mcp`;
  const descriptorPath = getSessionDescriptorPath(project.manifestPath);
  const startedAtMilliseconds = Date.now();
  const startedAt = new Date(startedAtMilliseconds).toISOString();
  let launchMilliseconds: number | undefined;
  const buildTracker = createBuildTracker({
    developmentSessionId: id,
    rootDirectory: project.development.workingDirectory,
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
    developmentSessionId: id,
    diagnosticSink,
    acceptBuild: (inspection) => buildTracker.acceptRuntime(inspection),
    ...(options.runtimeConnectionTimeoutMilliseconds === undefined
      ? {}
      : { timeoutMilliseconds: options.runtimeConnectionTimeoutMilliseconds }),
  });

  const actionBroker = createDevelopmentActionBroker({
    developmentSessionId: id,
    rootDirectory: project.development.workingDirectory,
    diagnosticSink,
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
      project: Object.freeze({
        name: project.name,
        manifestPath: project.manifestPath,
        projectRoot: project.projectRoot,
        revision: project.revision,
        gameUrl: project.development.url,
        host: project.network.host,
        gamePort: project.network.gamePort,
        inspectionPort: project.network.inspectionPort,
        viewport: project.development.viewport,
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
    host: project.network.host,
    port: project.network.inspectionPort,
    developmentSessionId: id,
    gameUrl: project.development.url,
    credential,
    diagnosticSink,
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
    completePointLightCommand: (input) => actionBroker.completePointLightCommand(input),
    completeSessionControl: (input) => actionBroker.completeSessionControl(input),
    requestReload: () => actionBroker.requestReload(),
    captureFrame: () => actionBroker.captureFrame(),
    setPointLightPower: (command) => actionBroker.setPointLightPower(command),
    correctPointLightPower: (request) => actionBroker.correctPointLightPower(request),
    pauseSimulation: () => actionBroker.pauseSimulation(),
    resumeSimulation: () => actionBroker.resumeSimulation(),
    stepSimulation: (expectedCompletedStepCount) => (
      actionBroker.stepSimulation(expectedCompletedStepCount)
    ),
  });
  const gameHost = createDevelopmentGameHost({
    host: project.network.host,
    port: project.network.gamePort,
    gameUrl: project.development.url,
    projectName: project.name,
    projectDirectory: project.development.workingDirectory,
  });

  const stop = (
    reason: DevelopmentStopReason = 'normal',
    exitCode = reason === 'normal' ? 0 : 1,
  ): Promise<DevelopmentStopResult> => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      stopping = true;
      cleanupState = 'stopping';
      reportSession('info', 'ANTIKY_SESSION_STOPPING');
      const cleanupStarted = Date.now();
      const cleanupOperations: ReadonlyArray<Readonly<{
        name: DevelopmentCleanupOperation;
        operation: () => Promise<void>;
      }>> = [
        {
          name: 'action-broker',
          operation: async () => { actionBroker.stop(); },
        },
        {
          name: 'game-port-reservation',
          operation: () => closeNetServer(gameReservation),
        },
        {
          name: 'inspection-port-reservation',
          operation: () => closeNetServer(inspectionReservation),
        },
        {
          name: 'session-descriptor',
          operation: () => removeSessionDescriptor(descriptorPath),
        },
        {
          name: 'build-watcher',
          operation: () => buildTracker.stop(),
        },
        {
          name: 'game-host',
          operation: () => gameHost.stop(),
        },
        ...children.map((child) => ({
          name: `${child.name}-child` as const,
          operation: () => stopChild(child),
        })),
        {
          name: 'inspection-server',
          operation: () => inspectionServer.stop(),
        },
      ];
      const cleanupResults = await Promise.allSettled(cleanupOperations.map(({ name, operation }) => (
        Promise.resolve().then(() => runCleanupOperation(name, operation))
      )));
      const cleanupFailureCount = cleanupResults.reduce(
        (count, result) => count + (result.status === 'rejected' ? 1 : 0),
        0,
      );
      cleanupResults.forEach((cleanupResult, index) => {
        if (cleanupResult.status !== 'rejected') return;
        reportSession(
          'error',
          'ANTIKY_CLEANUP_FAILED',
          cleanupOperations[index]!.name,
        );
      });
      cleanupMilliseconds = Date.now() - cleanupStarted;
      cleanupState = cleanupFailureCount === 0 ? 'stopped' : 'failed';
      const result = Object.freeze({
        reason,
        exitCode: cleanupFailureCount > 0 && exitCode === 0 ? 1 : exitCode,
        cleanupMilliseconds,
        cleanupFailureCount,
      });
      reportSession(
        cleanupFailureCount === 0 ? 'info' : 'error',
        'ANTIKY_SESSION_STOPPED',
      );
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
      cwd: project.development.workingDirectory,
      detached,
      env: {
        ...process.env,
        ANTIKY_HOST: project.network.host,
        ANTIKY_GAME_PORT: String(project.network.gamePort),
        ANTIKY_INSPECTION_PORT: String(project.network.inspectionPort),
        ANTIKY_GAME_URL: project.development.url,
        ANTIKY_GAME_WIDTH: String(project.development.viewport.width),
        ANTIKY_GAME_HEIGHT: String(project.development.viewport.height),
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
      reportSession(
        stopping ? 'info' : 'error',
        'ANTIKY_CHILD_EXITED',
        `${name}-child`,
      );
      if (!stopping) void stop('child-failure', code && code !== 0 ? code : 1);
    });
    try {
      await waitForSpawn(child);
    } catch (cause: unknown) {
      processRecords[name].state = 'failed';
      reportSession('error', 'ANTIKY_SESSION_START_FAILED', `${name}-child`);
      throw new AntikyCliError(
        'ANTIKY_CHILD_START_FAILED',
        `Unable to start ${name}.`,
      );
    }
    processRecords[name].pid = child.pid;
    processRecords[name].state = 'running';
    reportSession('info', 'ANTIKY_COMPONENT_STARTED', `${name}-child`);
  };

  try {
    await closeNetServer(inspectionReservation);
    inspectionReservation = undefined;
    await inspectionServer.start();
    reportSession('info', 'ANTIKY_COMPONENT_STARTED', 'inspection-server');
    await writeSessionDescriptor(descriptorPath, {
      schemaVersion: 1,
      developmentSessionId: id,
      projectRevision: project.revision,
      inspectionUrl,
      credential,
      ownerPid: process.pid,
    });
    reportSession('info', 'ANTIKY_COMPONENT_STARTED', 'session-descriptor');
    await spawnManaged('shaders', project.development.shaderCommand);
    await closeNetServer(gameReservation);
    gameReservation = undefined;
    await gameHost.start();
    reportSession('info', 'ANTIKY_COMPONENT_STARTED', 'game-host');
    await spawnManaged('game', project.development.command);
    launchMilliseconds = Date.now() - startedAtMilliseconds;
    await buildTracker.watch(options.watchPaths ?? [
      project.manifestPath,
      join(project.development.workingDirectory, 'packages', 'demos', 'src'),
      join(project.development.workingDirectory, 'packages', 'demos', 'dev-host'),
      join(project.development.workingDirectory, 'src'),
    ]);
    reportSession('info', 'ANTIKY_COMPONENT_STARTED', 'build-watcher');
  } catch (cause) {
    reportSession('error', 'ANTIKY_SESSION_START_FAILED');
    await stop('start-failure', 1);
    if (cause instanceof AntikyCliError) throw cause;
    throw new AntikyCliError(
      'ANTIKY_CHILD_START_FAILED',
      'Unable to start the development session.',
    );
  }

  reportSession('info', 'ANTIKY_SESSION_READY');

  writeOutput(`Antiky development session ${id}`);
  writeOutput(`Project: ${project.manifestPath}`);
  writeOutput(`Game: ${project.development.url}`);
  writeOutput(`Inspection: ${inspectionUrl}`);
  writeOutput(`MCP: ${mcpUrl}`);
  writeOutput('Services: game host, game build, shaders, inspection, mcp');

  return Object.freeze({
    id,
    connection: Object.freeze({
      inspectionUrl,
      developmentSessionId: id,
      credential,
    }),
    inspectionUrl,
    mcpUrl,
    descriptorPath,
    stopped,
    snapshot,
    stop,
  });
}
