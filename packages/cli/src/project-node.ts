import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';

import { AntikyCliError } from './errors.ts';
import {
  ANTIKY_PROJECT_MAX_BYTES,
  type AntikyProject,
  describeAntikyProject,
  parseAntikyProjectManifest,
} from './project.ts';

type NodeProjectErrorCode =
  | 'ANTIKY_PROJECT_AMBIGUOUS'
  | 'ANTIKY_PROJECT_EXISTS'
  | 'ANTIKY_PROJECT_INVALID'
  | 'ANTIKY_PROJECT_NOT_FILE'
  | 'ANTIKY_PROJECT_NOT_FOUND'
  | 'ANTIKY_PROJECT_PATH_ESCAPE'
  | 'ANTIKY_PROJECT_TOO_LARGE';

function projectError(code: NodeProjectErrorCode, message: string, path = '$'): never {
  throw new AntikyCliError(code, message, path);
}

async function boundedFileBytes(path: string): Promise<Buffer> {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      projectError('ANTIKY_PROJECT_NOT_FOUND', `Antiky project does not exist: ${path}`);
    }
    throw cause;
  }
  if (metadata.isSymbolicLink()) {
    projectError('ANTIKY_PROJECT_PATH_ESCAPE', `Antiky project must not be a symbolic link: ${path}`);
  }
  if (!metadata.isFile()) {
    projectError('ANTIKY_PROJECT_NOT_FILE', `Antiky project is not a regular file: ${path}`);
  }
  if (metadata.size > ANTIKY_PROJECT_MAX_BYTES) {
    projectError('ANTIKY_PROJECT_TOO_LARGE', 'Project manifest exceeds 65536 bytes');
  }

  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedMetadata = await handle.stat();
    if (!openedMetadata.isFile()) {
      projectError('ANTIKY_PROJECT_NOT_FILE', `Antiky project is not a regular file: ${path}`);
    }
    const bytes = Buffer.alloc(ANTIKY_PROJECT_MAX_BYTES + 1);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (bytesRead > ANTIKY_PROJECT_MAX_BYTES) {
      projectError('ANTIKY_PROJECT_TOO_LARGE', 'Project manifest exceeds 65536 bytes');
    }
    return bytes.subarray(0, bytesRead);
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'ELOOP') {
      projectError('ANTIKY_PROJECT_PATH_ESCAPE', `Antiky project must not be a symbolic link: ${path}`);
    }
    throw cause;
  } finally {
    await handle?.close();
  }
}

function decodeProject(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    projectError('ANTIKY_PROJECT_INVALID', 'Project manifest is not valid UTF-8');
  }
}

function staysInside(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  const parentPrefix = `..${process.platform === 'win32' ? '\\' : '/'}`;
  return fromRoot === '' || (fromRoot !== '..' && !fromRoot.startsWith(parentPrefix));
}

async function canonicalWorkingDirectory(
  root: string,
  requested: string,
  fieldPath: string,
): Promise<string> {
  let candidate: string;
  try {
    candidate = await realpath(resolve(root, requested));
  } catch {
    projectError(
      'ANTIKY_PROJECT_INVALID',
      `Working directory does not exist at ${fieldPath}`,
      fieldPath,
    );
  }
  if (!staysInside(root, candidate)) {
    projectError(
      'ANTIKY_PROJECT_PATH_ESCAPE',
      `Working directory escapes the project at ${fieldPath}`,
      fieldPath,
    );
  }
  return candidate;
}

export async function discoverAntikyProjectManifest(directory = process.cwd()): Promise<string> {
  const root = resolve(directory);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      projectError('ANTIKY_PROJECT_NOT_FOUND', `Project directory does not exist: ${root}`);
    }
    throw cause;
  }
  const manifests = entries.filter((entry) => entry.name.endsWith('.antiky'));
  if (manifests.length === 0) {
    projectError('ANTIKY_PROJECT_NOT_FOUND', `No .antiky project exists in: ${root}`);
  }
  if (manifests.length > 1) {
    projectError('ANTIKY_PROJECT_AMBIGUOUS', `More than one .antiky project exists in: ${root}`);
  }
  const manifest = manifests[0]!;
  if (manifest.isSymbolicLink()) {
    projectError(
      'ANTIKY_PROJECT_PATH_ESCAPE',
      `Antiky project must not be a symbolic link: ${resolve(root, manifest.name)}`,
    );
  }
  return realpath(resolve(root, manifest.name));
}

export async function loadAntikyProject(projectPath?: string): Promise<AntikyProject> {
  const selectedPath = projectPath === undefined
    ? await discoverAntikyProjectManifest()
    : resolve(projectPath);
  if (extname(selectedPath) !== '.antiky') {
    projectError('ANTIKY_PROJECT_INVALID', `Expected a .antiky project: ${selectedPath}`);
  }

  const bytes = await boundedFileBytes(selectedPath);
  const manifest = parseAntikyProjectManifest(decodeProject(bytes));
  const manifestPath = await realpath(selectedPath);
  const projectRoot = await realpath(dirname(manifestPath));
  const developmentWorkingDirectory = await canonicalWorkingDirectory(
    projectRoot,
    manifest.development.workingDirectory,
    '$.development.workingDirectory',
  );
  const buildWorkingDirectory = await canonicalWorkingDirectory(
    projectRoot,
    manifest.build.workingDirectory,
    '$.build.workingDirectory',
  );

  return describeAntikyProject(manifest, {
    manifestPath,
    projectRoot,
    revision: createHash('sha256').update(bytes).digest('hex'),
    developmentWorkingDirectory,
    buildWorkingDirectory,
  });
}

export type AntikyConfigMigrationOptions = Readonly<{
  configPath: string;
  outputPath: string;
  projectName: string;
}>;

export async function migrateAntikyConfig(
  options: AntikyConfigMigrationOptions,
): Promise<AntikyProject> {
  const configPath = resolve(options.configPath);
  const outputPath = resolve(options.outputPath);
  if (extname(outputPath) !== '.antiky') {
    projectError('ANTIKY_PROJECT_INVALID', `Expected a .antiky output path: ${outputPath}`);
  }

  const configRoot = await realpath(dirname(configPath));
  const outputRoot = await realpath(dirname(outputPath));
  if (configRoot !== outputRoot) {
    projectError('ANTIKY_PROJECT_PATH_ESCAPE', 'The migrated project must stay beside the legacy config');
  }

  const source = decodeProject(await boundedFileBytes(configPath));
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    projectError('ANTIKY_PROJECT_INVALID', 'Legacy config is not valid JSON');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    projectError('ANTIKY_PROJECT_INVALID', 'Legacy config must be an object');
  }
  const legacy = parsed as Record<string, unknown>;
  const migratedSource = `${JSON.stringify({
    schemaVersion: legacy.schemaVersion,
    name: options.projectName,
    development: legacy.game,
    network: legacy.network,
    build: {
      command: ['npm', 'run', 'build'],
      workingDirectory: '.',
    },
  }, null, 2)}\n`;
  parseAntikyProjectManifest(migratedSource);

  try {
    await writeFile(outputPath, migratedSource, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
      projectError('ANTIKY_PROJECT_EXISTS', `Antiky project already exists: ${outputPath}`);
    }
    throw cause;
  }
  return loadAntikyProject(outputPath);
}
