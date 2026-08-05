import { resolve } from 'node:path';

import { loadAntikyConfig } from './config.ts';
import { connectDevelopmentClient, inspectDevelopmentSession } from './development/client.ts';
import { AntikyCliError } from './errors.ts';
import { startDevelopmentSession } from './host/session.ts';
import { callMcpTool } from './mcp/client.ts';
import { runMcpServer } from './mcp/server.ts';

export const CLI_USAGE = `Usage:
  antiky dev [--config path]
  antiky inspect [--config path]
  antiky mcp [--config path]
  antiky tool <name> [json] [--config path]`;

const MAX_TOOL_INPUT_BYTES = 64 * 1024;

export type CliIo = Readonly<{
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}>;

function parseConfigPath(args: readonly string[]): string {
  if (args.length === 0) return resolve('antiky.config.json');
  if (args.length === 2 && args[0] === '--config' && args[1]) return resolve(args[1]);
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
}

type ToolInvocation = Readonly<{
  name: string;
  input: Readonly<Record<string, unknown>>;
  configPath: string;
}>;

function invalidToolInvocation(message: string): never {
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', `${message}\n\n${CLI_USAGE}`);
}

function parseToolInput(value: string): Readonly<Record<string, unknown>> {
  if (Buffer.byteLength(value) > MAX_TOOL_INPUT_BYTES) {
    invalidToolInvocation('Tool input exceeds 65536 bytes.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    invalidToolInvocation('Tool input must be valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    invalidToolInvocation('Tool input must be a JSON object.');
  }
  return Object.freeze({ ...parsed as Record<string, unknown> });
}

function parseToolInvocation(args: readonly string[]): ToolInvocation {
  const [name, ...options] = args;
  if (!name || !/^[A-Za-z0-9_.-]{1,128}$/.test(name)) {
    invalidToolInvocation('Expected an MCP tool name.');
  }

  let configPath = resolve('antiky.config.json');
  let input: Readonly<Record<string, unknown>> = Object.freeze({});
  let hasConfig = false;
  let hasInput = false;
  for (let index = 0; index < options.length;) {
    const argument = options[index]!;
    if (argument === '--config') {
      const value = options[index + 1];
      if (!value || value.startsWith('--')) {
        invalidToolInvocation('Expected a value after --config.');
      }
      if (hasConfig) invalidToolInvocation('Option --config can be used only once.');
      configPath = resolve(value);
      hasConfig = true;
      index += 2;
      continue;
    }
    if (argument === '--input') {
      const value = options[index + 1];
      if (!value || value.startsWith('--')) {
        invalidToolInvocation('Expected a value after --input.');
      }
      if (hasInput) invalidToolInvocation('Tool input can be provided only once.');
      input = parseToolInput(value);
      hasInput = true;
      index += 2;
      continue;
    }
    if (argument.startsWith('--')) invalidToolInvocation(`Unknown option: ${argument}.`);
    if (hasInput) invalidToolInvocation('Tool input can be provided only once.');
    input = parseToolInput(argument);
    hasInput = true;
    index += 1;
  }

  return Object.freeze({ name, input, configPath });
}

export async function runCli(
  args: readonly string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
): Promise<number> {
  const [command, ...commandArgs] = args;
  if (command !== 'dev' && command !== 'inspect' && command !== 'mcp' && command !== 'tool') {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
  }
  if (command === 'tool') {
    const invocation = parseToolInvocation(commandArgs);
    const config = await loadAntikyConfig(invocation.configPath);
    const result = await callMcpTool(config, invocation.name, invocation.input);
    io.stdout(`${JSON.stringify(result.structuredContent, null, 2)}\n`);
    return result.isError ? 1 : 0;
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
