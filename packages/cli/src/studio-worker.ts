import { createInterface } from 'node:readline';

import { AntikyCliError } from './errors.ts';
import { startDevelopmentSession, type DevelopmentSession } from './host/session.ts';
import { initializeAntikyProject } from './project-initializer.ts';
import { loadAntikyProject } from './project-node.ts';

type StopMessage = Readonly<{ type: 'stop' }>;

function publicError(cause: unknown): Readonly<{ code: string; message: string }> {
  if (cause instanceof AntikyCliError) {
    return Object.freeze({ code: cause.code, message: cause.message.slice(0, 512) });
  }
  return Object.freeze({
    code: 'ANTIKY_NATIVE_UNAVAILABLE',
    message: 'The Studio project service could not start.',
  });
}

function readStopMessage(source: string): StopMessage {
  if (Buffer.byteLength(source) > 256) throw new Error('Studio worker message is too large.');
  const value: unknown = JSON.parse(source);
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.keys(value).length !== 1
    || (value as Record<string, unknown>).type !== 'stop'
  ) throw new Error('Studio worker message is incompatible.');
  return Object.freeze({ type: 'stop' });
}

async function runStudioWorker(): Promise<number> {
  const argumentsValue = process.argv.slice(2);
  if (argumentsValue[0] === '--initialize') {
    if (
      argumentsValue.length !== 3
      || Buffer.byteLength(argumentsValue[1]!) > 4096
      || Buffer.byteLength(argumentsValue[2]!) > 512
    ) {
      process.stdout.write(`${JSON.stringify({
        type: 'error',
        error: {
          code: 'ANTIKY_ARGUMENT_INVALID',
          message: 'Studio project creation needs one directory and one project name.',
        },
      })}\n`);
      return 1;
    }
    try {
      const project = await initializeAntikyProject({
        directory: argumentsValue[1],
        name: argumentsValue[2],
      });
      process.stdout.write(`${JSON.stringify({
        type: 'initialized',
        manifestPath: project.manifestPath,
      })}\n`);
      return 0;
    } catch (cause: unknown) {
      process.stdout.write(`${JSON.stringify({ type: 'error', error: publicError(cause) })}\n`);
      return 1;
    }
  }
  if (argumentsValue.length !== 1 || Buffer.byteLength(argumentsValue[0]!) > 4096) {
    process.stdout.write(`${JSON.stringify({
      type: 'error',
      error: {
        code: 'ANTIKY_ARGUMENT_INVALID',
        message: 'The Studio project service needs one project manifest path.',
      },
    })}\n`);
    return 1;
  }

  let session: DevelopmentSession;
  let project;
  try {
    project = await loadAntikyProject(argumentsValue[0]);
    session = await startDevelopmentSession(project, {
      portAllocation: 'studio-dynamic',
      writeOutput(line) {
        process.stderr.write(`[project-service] ${line}\n`);
      },
    });
  } catch (cause: unknown) {
    process.stdout.write(`${JSON.stringify({ type: 'error', error: publicError(cause) })}\n`);
    return 1;
  }

  process.stdout.write(`${JSON.stringify({
    type: 'ready',
    connection: {
      schemaVersion: 1,
      developmentSessionId: session.connection.developmentSessionId,
      projectRevision: project.revision,
      inspectionUrl: session.connection.inspectionUrl,
      credential: session.connection.credential,
      ownerPid: process.pid,
    },
  })}\n`);

  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let requestedExitCode = 0;
  let stopping = false;
  const stop = async (exitCode: number): Promise<void> => {
    if (stopping) return;
    stopping = true;
    requestedExitCode = exitCode;
    input.close();
    process.stdin.pause();
    await session.stop(exitCode === 0 ? 'normal' : 'interrupt', exitCode);
  };
  input.on('line', (line) => {
    try {
      readStopMessage(line);
      void stop(0);
    } catch {
      void stop(1);
    }
  });
  input.on('close', () => { void stop(requestedExitCode); });
  process.once('SIGINT', () => { void stop(130); });
  process.once('SIGTERM', () => { void stop(143); });

  const result = await session.stopped;
  return requestedExitCode === 0 ? result.exitCode : requestedExitCode;
}

process.exit(await runStudioWorker());
