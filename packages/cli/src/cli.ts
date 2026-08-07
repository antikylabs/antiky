import { resolve } from 'node:path';

import { ID_KINDS, generateId, type IdKind } from '@antiky/framework';

import { connectDevelopmentClient, inspectDevelopmentSession } from './development/client.ts';
import { AntikyCliError } from './errors.ts';
import {
  NOOP_CLI_DIAGNOSTIC_SINK,
  emitCliDiagnostic,
  type CliDiagnosticSink,
} from './host/diagnostics.ts';
import { startDevelopmentSession } from './host/session.ts';
import { callMcpTool } from './mcp/client.ts';
import { runMcpServer } from './mcp/server.ts';
import { loadAntikyProject, migrateAntikyConfig } from './project-node.ts';

export const CLI_USAGE = `Usage:
  antiky dev [--project path]
  antiky inspect [--project path]
  antiky mcp [--project path]
  antiky tool <name> [json] [--project path]
  antiky migrate --name name --output path [--config path]
  antiky generate id <world|entity|command|session> [--json]`;

const MAX_TOOL_INPUT_BYTES = 64 * 1024;

export type CliIo = Readonly<{
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}>;

export type RunCliOptions = Readonly<{
  diagnosticSink?: CliDiagnosticSink;
}>;

function parseProjectPath(args: readonly string[]): string | undefined {
  if (args.length === 0) return undefined;
  if (args.length === 2 && args[0] === '--project' && args[1]) return resolve(args[1]);
  throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
}

type ToolInvocation = Readonly<{
  name: string;
  input: Readonly<Record<string, unknown>>;
  projectPath?: string;
}>;

type GenerateIdInvocation = Readonly<{
  kind: IdKind;
  json: boolean;
}>;

function parseGenerateIdInvocation(args: readonly string[]): GenerateIdInvocation {
  const [noun, kind, option, ...rest] = args;
  if (
    noun !== 'id'
    || typeof kind !== 'string'
    || !ID_KINDS.includes(kind as IdKind)
    || (option !== undefined && option !== '--json')
    || rest.length > 0
  ) {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
  }
  return Object.freeze({ kind: kind as IdKind, json: option === '--json' });
}

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

  let projectPath: string | undefined;
  let input: Readonly<Record<string, unknown>> = Object.freeze({});
  let hasProject = false;
  let hasInput = false;
  for (let index = 0; index < options.length;) {
    const argument = options[index]!;
    if (argument === '--project') {
      const value = options[index + 1];
      if (!value || value.startsWith('--')) {
        invalidToolInvocation('Expected a value after --project.');
      }
      if (hasProject) invalidToolInvocation('Option --project can be used only once.');
      projectPath = resolve(value);
      hasProject = true;
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

  return Object.freeze({ name, input, ...(projectPath === undefined ? {} : { projectPath }) });
}

type MigrationInvocation = Readonly<{
  configPath: string;
  outputPath: string;
  projectName: string;
}>;

function parseMigrationInvocation(args: readonly string[]): MigrationInvocation {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (
      !option
      || !['--config', '--output', '--name'].includes(option)
      || !value
      || value.startsWith('--')
      || values.has(option)
    ) {
      throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
    }
    values.set(option, value);
  }
  const outputPath = values.get('--output');
  const projectName = values.get('--name');
  if (!outputPath || !projectName) {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
  }
  return Object.freeze({
    configPath: resolve(values.get('--config') ?? 'antiky.config.json'),
    outputPath: resolve(outputPath),
    projectName,
  });
}

async function executeCli(
  args: readonly string[],
  io: CliIo,
  diagnosticSink: CliDiagnosticSink,
): Promise<number> {
  const [command, ...commandArgs] = args;
  if (
    command !== 'dev'
    && command !== 'inspect'
    && command !== 'mcp'
    && command !== 'tool'
    && command !== 'migrate'
    && command !== 'generate'
  ) {
    throw new AntikyCliError('ANTIKY_ARGUMENT_INVALID', CLI_USAGE);
  }
  if (command === 'generate') {
    const invocation = parseGenerateIdInvocation(commandArgs);
    const id = generateId(invocation.kind);
    io.stdout(invocation.json
      ? `${JSON.stringify({ kind: invocation.kind, id }, null, 2)}\n`
      : `${id}\n`);
    return 0;
  }
  if (command === 'migrate') {
    const invocation = parseMigrationInvocation(commandArgs);
    const project = await migrateAntikyConfig(invocation);
    io.stdout(`Created ${project.manifestPath}\n`);
    return 0;
  }
  if (command === 'tool') {
    const invocation = parseToolInvocation(commandArgs);
    const project = await loadAntikyProject(invocation.projectPath);
    const result = await callMcpTool(project, invocation.name, invocation.input);
    io.stdout(`${JSON.stringify(result.structuredContent, null, 2)}\n`);
    return result.isError ? 1 : 0;
  }
  const projectPath = parseProjectPath(commandArgs);

  if (command === 'inspect') {
    const snapshot = await inspectDevelopmentSession(projectPath);
    io.stdout(`${JSON.stringify(snapshot, null, 2)}\n`);
    return 0;
  }
  if (command === 'mcp') {
    const client = await connectDevelopmentClient(projectPath);
    await runMcpServer(client, process.stdin, io.stdout);
    return 0;
  }

  const project = await loadAntikyProject(projectPath);
  const session = await startDevelopmentSession(project, {
    writeOutput: (line) => io.stdout(`${line}\n`),
    diagnosticSink,
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

export async function runCli(
  args: readonly string[],
  io: CliIo = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  },
  options: RunCliOptions = {},
): Promise<number> {
  const diagnosticSink = options.diagnosticSink ?? NOOP_CLI_DIAGNOSTIC_SINK;
  try {
    return await executeCli(args, io, diagnosticSink);
  } catch (cause: unknown) {
    if (cause instanceof AntikyCliError) throw cause;
    emitCliDiagnostic(diagnosticSink, {
      level: 'error',
      code: 'ANTIKY_CLI_FAILED',
      component: 'cli',
    });
    throw new AntikyCliError(
      'ANTIKY_INTERNAL_ERROR',
      'The Antiky CLI failed unexpectedly.',
    );
  }
}
