import { resolve } from 'node:path';

import { loadAntikyConfig } from './config.ts';
import { connectDevelopmentClient, inspectDevelopmentSession } from './development/client.ts';
import { AntikyCliError } from './errors.ts';
import { startDevelopmentSession } from './host/session.ts';
import { runMcpServer } from './mcp/server.ts';

export const CLI_USAGE = `Usage:
  antiky dev [--config path]
  antiky inspect [--config path]
  antiky mcp [--config path]`;

export type CliIo = Readonly<{
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}>;

function parseConfigPath(args: readonly string[]): string {
  if (args.length === 0) return resolve('antiky.config.json');
  if (args.length === 2 && args[0] === '--config' && args[1]) return resolve(args[1]);
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
}

export async function runCli(
  args: readonly string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  const [command, ...commandArgs] = args;
  if (command !== 'dev' && command !== 'inspect' && command !== 'mcp') {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
  }
  const configPath = parseConfigPath(commandArgs);

  if (command === 'inspect') {
    const snapshot = await inspectDevelopmentSession(configPath);
    io.stdout(`${JSON.stringify(snapshot, null, 2)}\n`);
    return 0;
  }
  if (command === 'mcp') {
    const client = await connectDevelopmentClient(configPath);
    await runMcpServer(client, process.stdin, io.stdout);
    return 0;
  }

  const config = await loadAntikyConfig(configPath);
  const session = await startDevelopmentSession(config, {
    writeOutput: (line) => io.stdout(`${line}\n`),
  });
  let interruptCode = 130;
  let interruptReceived = false;
  const stopForSignal = (exitCode: number) => {
    if (!interruptReceived) {
      interruptReceived = true;
      interruptCode = exitCode;
    }
    void session.stop('interrupt', interruptCode);
  };
  const onInterrupt = () => {
    stopForSignal(130);
  };
  const onTerminate = () => {
    stopForSignal(143);
  };
  const onHangup = () => {
    stopForSignal(129);
  };
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  process.on('SIGHUP', onHangup);
  try {
    const result = await session.stopped;
    return result.reason === 'interrupt' ? interruptCode : result.exitCode;
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
    process.off('SIGHUP', onHangup);
  }
}
