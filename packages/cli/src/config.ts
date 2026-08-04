import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { AntikyCliError } from './errors.ts';

export const ANTIKY_CONFIG_SCHEMA_VERSION = 1 as const;
const MAX_CONFIG_BYTES = 64 * 1024;
const LOOPBACK_HOST = '127.0.0.1' as const;

export type AntikyConfig = Readonly<{
  schemaVersion: typeof ANTIKY_CONFIG_SCHEMA_VERSION;
  path: string;
  hash: string;
  game: Readonly<{
    command: readonly string[];
    shaderCommand: readonly string[];
    workingDirectory: string;
    url: string;
  }>;
  network: Readonly<{
    host: typeof LOOPBACK_HOST;
    gamePort: number;
    inspectionPort: number;
  }>;
}>;

type UnknownRecord = Record<string, unknown>;

function invalid(message: string, path: string): never {
  throw new AntikyCliError('ANTIKY_CONFIG_INVALID', `${message} at ${path}`, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(
  value: UnknownRecord,
  required: readonly string[],
  path: string,
): void {
  const allowed = new Set(required);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid('Unknown field', `${path}.${key}`);
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) invalid('Missing field', `${path}.${key}`);
  }
}

function readString(value: unknown, path: string, maximumLength = 4096): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maximumLength
    || value.includes('\0')
    || value.includes('\n')
    || value.includes('\r')
  ) {
    invalid(`Expected a single-line string no longer than ${maximumLength} characters`, path);
  }
  return value;
}

function readPort(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65_535) {
    invalid('Expected an integer from 1 through 65535', path);
  }
  return value;
}

function expandCommand(
  value: unknown,
  path: string,
  replacements: Readonly<Record<string, string>>,
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) {
    invalid('Expected an array with 1 through 64 command tokens', path);
  }
  const command = value.map((token, index) => {
    let resolved = readString(token, `${path}[${index}]`);
    for (const [placeholder, replacement] of Object.entries(replacements)) {
      resolved = resolved.replaceAll(`{${placeholder}}`, replacement);
    }
    if (/\{[A-Za-z][A-Za-z0-9]*\}/.test(resolved)) {
      invalid('Unknown command placeholder', `${path}[${index}]`);
    }
    return resolved;
  });
  return Object.freeze(command);
}

function validateGameUrl(value: unknown, host: string, gamePort: number): string {
  const text = readString(value, '$.game.url', 2048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    invalid('Expected a valid absolute URL', '$.game.url');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== host
    || Number(url.port || 80) !== gamePort
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || !url.pathname.startsWith('/')
  ) {
    invalid('Expected an HTTP URL on the configured game address without credentials or a query', '$.game.url');
  }
  return url.href;
}

async function resolveWorkingDirectory(configPath: string, value: unknown): Promise<string> {
  const requested = readString(value, '$.game.workingDirectory', 1024);
  if (isAbsolute(requested)) invalid('Expected a path relative to the config file', '$.game.workingDirectory');

  const projectDirectory = await realpath(dirname(configPath));
  let workingDirectory: string;
  try {
    workingDirectory = await realpath(resolve(projectDirectory, requested));
  } catch {
    invalid('Working directory does not exist', '$.game.workingDirectory');
  }
  const fromProject = relative(projectDirectory, workingDirectory);
  if (fromProject === '..' || fromProject.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    invalid('Working directory must stay inside the config directory', '$.game.workingDirectory');
  }
  return workingDirectory;
}

export async function loadAntikyConfig(configPath = 'antiky.config.json'): Promise<AntikyConfig> {
  const absolutePath = resolve(configPath);
  let source: string;
  try {
    source = await readFile(absolutePath, 'utf8');
  } catch (cause: unknown) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new AntikyCliError(
        'ANTIKY_CONFIG_NOT_FOUND',
        `Antiky config does not exist: ${absolutePath}`,
        '$',
      );
    }
    throw cause;
  }
  if (Buffer.byteLength(source) > MAX_CONFIG_BYTES) invalid('Config exceeds 65536 bytes', '$');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    invalid('Config is not valid JSON', '$');
  }
  const root = readObject(parsed, '$');
  checkKeys(root, ['schemaVersion', 'game', 'network'], '$');
  if (root.schemaVersion !== ANTIKY_CONFIG_SCHEMA_VERSION) {
    invalid(`Expected schema version ${ANTIKY_CONFIG_SCHEMA_VERSION}`, '$.schemaVersion');
  }

  const network = readObject(root.network, '$.network');
  checkKeys(network, ['host', 'gamePort', 'inspectionPort'], '$.network');
  if (network.host !== LOOPBACK_HOST) {
    invalid(`Expected the loopback host ${LOOPBACK_HOST}`, '$.network.host');
  }
  const gamePort = readPort(network.gamePort, '$.network.gamePort');
  const inspectionPort = readPort(network.inspectionPort, '$.network.inspectionPort');
  if (gamePort === inspectionPort) invalid('Inspection port must differ from the game port', '$.network.inspectionPort');

  const game = readObject(root.game, '$.game');
  checkKeys(game, ['command', 'shaderCommand', 'workingDirectory', 'url'], '$.game');
  const workingDirectory = await resolveWorkingDirectory(absolutePath, game.workingDirectory);
  const url = validateGameUrl(game.url, LOOPBACK_HOST, gamePort);
  const replacements = {
    host: LOOPBACK_HOST,
    gamePort: String(gamePort),
    inspectionPort: String(inspectionPort),
    gameUrl: url,
  };

  return Object.freeze({
    schemaVersion: ANTIKY_CONFIG_SCHEMA_VERSION,
    path: absolutePath,
    hash: createHash('sha256').update(source).digest('hex'),
    game: Object.freeze({
      command: expandCommand(game.command, '$.game.command', replacements),
      shaderCommand: expandCommand(game.shaderCommand, '$.game.shaderCommand', replacements),
      workingDirectory,
      url,
    }),
    network: Object.freeze({
      host: LOOPBACK_HOST,
      gamePort,
      inspectionPort,
    }),
  });
}
