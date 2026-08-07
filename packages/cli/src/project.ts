import { AntikyCliError } from './errors.ts';

export { AntikyCliError } from './errors.ts';

export const ANTIKY_PROJECT_SCHEMA_VERSION = 1 as const;
export const ANTIKY_PROJECT_MAX_BYTES = 64 * 1024;

const LOOPBACK_HOST = '127.0.0.1' as const;
const COMMAND_PLACEHOLDERS = new Set([
  'host',
  'gamePort',
  'inspectionPort',
  'gameUrl',
  'gameWidth',
  'gameHeight',
]);

type UnknownRecord = Record<string, unknown>;

export type AntikyProjectManifest = Readonly<{
  schemaVersion: typeof ANTIKY_PROJECT_SCHEMA_VERSION;
  name: string;
  development: Readonly<{
    command: readonly string[];
    shaderCommand: readonly string[];
    workingDirectory: string;
    url: string;
    viewport: Readonly<{ width: number; height: number }>;
  }>;
  network: Readonly<{
    host: typeof LOOPBACK_HOST;
    gamePort: number;
    inspectionPort: number;
  }>;
  build: Readonly<{
    command: readonly string[];
    workingDirectory: string;
  }>;
}>;

export type AntikyProjectBoundary = Readonly<{
  manifestPath: string;
  projectRoot: string;
  revision: string;
  developmentWorkingDirectory: string;
  buildWorkingDirectory: string;
}>;

export type AntikyProject = Readonly<{
  schemaVersion: typeof ANTIKY_PROJECT_SCHEMA_VERSION;
  name: string;
  manifestPath: string;
  projectRoot: string;
  revision: string;
  development: Readonly<{
    command: readonly string[];
    shaderCommand: readonly string[];
    workingDirectory: string;
    url: string;
    viewport: Readonly<{ width: number; height: number }>;
  }>;
  network: AntikyProjectManifest['network'];
  build: Readonly<{
    command: readonly string[];
    workingDirectory: string;
  }>;
}>;

function projectError(
  code: 'ANTIKY_PROJECT_INVALID' | 'ANTIKY_PROJECT_INCOMPATIBLE' | 'ANTIKY_PROJECT_TOO_LARGE',
  message: string,
  path: string,
): never {
  throw new AntikyCliError(code, `${message} at ${path}`, path);
}

function invalid(message: string, path: string): never {
  projectError('ANTIKY_PROJECT_INVALID', message, path);
}

function readObject(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('Expected an object', path);
  }
  return value as UnknownRecord;
}

function checkKeys(value: UnknownRecord, required: readonly string[], path: string): void {
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
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)
  ) {
    invalid(
      `Expected a non-empty string without control characters, at most ${maximumLength} characters`,
      path,
    );
  }
  return value;
}

function readName(value: unknown): string {
  const name = readString(value, '$.name', 128).trim().normalize('NFC');
  if (name.length === 0) invalid('Expected a non-empty project name', '$.name');
  return name;
}

function readPort(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65_535) {
    invalid('Expected an integer from 1 through 65535', path);
  }
  return value;
}

function readDimension(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 16_384) {
    invalid('Expected an integer from 1 through 16384', path);
  }
  return value;
}

function readPortableDirectory(value: unknown, path: string): string {
  const directory = readString(value, path, 1024);
  if (
    directory.includes('\\')
    || directory.startsWith('/')
    || /^[A-Za-z]:/u.test(directory)
    || directory.split('/').some((part) => part === '..' || part === '')
  ) {
    invalid('Expected a portable relative directory that stays inside the project', path);
  }
  return directory;
}

function readCommand(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) {
    invalid('Expected an array with 1 through 64 command tokens', path);
  }
  return Object.freeze(value.map((token, index) => {
    const tokenPath = `${path}[${index}]`;
    const text = readString(token, tokenPath);
    for (const match of text.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/gu)) {
      if (!COMMAND_PLACEHOLDERS.has(match[1]!)) invalid('Unknown command placeholder', tokenPath);
    }
    return text;
  }));
}

function readUrl(value: unknown, gamePort: number): string {
  const text = readString(value, '$.development.url', 2048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    invalid('Expected a valid absolute URL', '$.development.url');
  }
  if (
    url.protocol !== 'http:'
    || url.hostname !== LOOPBACK_HOST
    || Number(url.port || 80) !== gamePort
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || !url.pathname.startsWith('/')
  ) {
    invalid(
      'Expected an HTTP URL on the configured game address without credentials, a query, or a fragment',
      '$.development.url',
    );
  }
  return url.href;
}

export function parseAntikyProjectManifest(source: string): AntikyProjectManifest {
  if (new TextEncoder().encode(source).byteLength > ANTIKY_PROJECT_MAX_BYTES) {
    projectError('ANTIKY_PROJECT_TOO_LARGE', 'Project manifest exceeds 65536 bytes', '$');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    invalid('Project manifest is not valid JSON', '$');
  }

  const root = readObject(parsed, '$');
  checkKeys(root, ['schemaVersion', 'name', 'development', 'network', 'build'], '$');
  if (root.schemaVersion !== ANTIKY_PROJECT_SCHEMA_VERSION) {
    projectError(
      'ANTIKY_PROJECT_INCOMPATIBLE',
      `Expected schema version ${ANTIKY_PROJECT_SCHEMA_VERSION}`,
      '$.schemaVersion',
    );
  }

  const network = readObject(root.network, '$.network');
  checkKeys(network, ['host', 'gamePort', 'inspectionPort'], '$.network');
  if (network.host !== LOOPBACK_HOST) {
    invalid(`Expected the loopback host ${LOOPBACK_HOST}`, '$.network.host');
  }
  const gamePort = readPort(network.gamePort, '$.network.gamePort');
  const inspectionPort = readPort(network.inspectionPort, '$.network.inspectionPort');
  if (gamePort === inspectionPort) {
    invalid('Inspection port must differ from the game port', '$.network.inspectionPort');
  }

  const development = readObject(root.development, '$.development');
  checkKeys(
    development,
    ['command', 'shaderCommand', 'workingDirectory', 'url', 'viewport'],
    '$.development',
  );
  const viewport = readObject(development.viewport, '$.development.viewport');
  checkKeys(viewport, ['width', 'height'], '$.development.viewport');

  const build = readObject(root.build, '$.build');
  checkKeys(build, ['command', 'workingDirectory'], '$.build');

  return Object.freeze({
    schemaVersion: ANTIKY_PROJECT_SCHEMA_VERSION,
    name: readName(root.name),
    development: Object.freeze({
      command: readCommand(development.command, '$.development.command'),
      shaderCommand: readCommand(development.shaderCommand, '$.development.shaderCommand'),
      workingDirectory: readPortableDirectory(
        development.workingDirectory,
        '$.development.workingDirectory',
      ),
      url: readUrl(development.url, gamePort),
      viewport: Object.freeze({
        width: readDimension(viewport.width, '$.development.viewport.width'),
        height: readDimension(viewport.height, '$.development.viewport.height'),
      }),
    }),
    network: Object.freeze({
      host: LOOPBACK_HOST,
      gamePort,
      inspectionPort,
    }),
    build: Object.freeze({
      command: readCommand(build.command, '$.build.command'),
      workingDirectory: readPortableDirectory(build.workingDirectory, '$.build.workingDirectory'),
    }),
  });
}

function expandCommand(
  command: readonly string[],
  replacements: Readonly<Record<string, string>>,
): readonly string[] {
  return Object.freeze(command.map((token) => {
    let expanded = token;
    for (const [placeholder, replacement] of Object.entries(replacements)) {
      expanded = expanded.replaceAll(`{${placeholder}}`, replacement);
    }
    return expanded;
  }));
}

export function describeAntikyProject(
  manifest: AntikyProjectManifest,
  boundary: AntikyProjectBoundary,
): AntikyProject {
  const replacements = {
    host: manifest.network.host,
    gamePort: String(manifest.network.gamePort),
    inspectionPort: String(manifest.network.inspectionPort),
    gameUrl: manifest.development.url,
    gameWidth: String(manifest.development.viewport.width),
    gameHeight: String(manifest.development.viewport.height),
  };

  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    name: manifest.name,
    manifestPath: boundary.manifestPath,
    projectRoot: boundary.projectRoot,
    revision: boundary.revision,
    development: Object.freeze({
      command: expandCommand(manifest.development.command, replacements),
      shaderCommand: expandCommand(manifest.development.shaderCommand, replacements),
      workingDirectory: boundary.developmentWorkingDirectory,
      url: manifest.development.url,
      viewport: manifest.development.viewport,
    }),
    network: manifest.network,
    build: Object.freeze({
      command: expandCommand(manifest.build.command, replacements),
      workingDirectory: boundary.buildWorkingDirectory,
    }),
  });
}
