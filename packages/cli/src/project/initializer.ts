import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  lstat,
  link,
  open,
  readFile,
  readdir,
  realpath,
  unlink,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { AntikyCliError } from '../errors.ts';
import { loadAntikyProject } from './node.ts';
import {
  buildAntikyProjectManifest,
  formatAntikyProjectManifest,
  parseAntikyProjectManifest,
  type AntikyProject,
} from './index.ts';

const MAX_PROJECT_NAME_LENGTH = 128;
const MAX_PROJECT_SLUG_LENGTH = 64;
const RESERVED_FILE_SLUGS = new Set([
  'aux',
  'con',
  'nul',
  'prn',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

type ProjectIdentity = Readonly<{
  displayName: string;
  fileSlug: string;
}>;

export type AntikyProjectInitializationOptions = Readonly<{
  name?: string;
  directory?: string;
  signal?: AbortSignal;
}>;

export type AntikyProjectManifestFileOptions = Readonly<{
  directory: string;
  fileName: string;
  source: string;
  signal?: AbortSignal;
}>;

function initializationError(
  code:
    | 'ANTIKY_PROJECT_CREATE_FAILED'
    | 'ANTIKY_PROJECT_DIRECTORY_INVALID'
    | 'ANTIKY_PROJECT_EXISTS'
    | 'ANTIKY_PROJECT_INIT_INTERRUPTED'
    | 'ANTIKY_PROJECT_NAME_INVALID',
  message: string,
  path = '$',
): AntikyCliError {
  return new AntikyCliError(code, message, path);
}

function normalizeDisplayName(value: string): string {
  const displayName = value.trim().replace(/\s+/gu, ' ').normalize('NFC');
  if (
    displayName.length === 0
    || displayName.length > MAX_PROJECT_NAME_LENGTH
    || displayName === '.'
    || displayName === '..'
    || displayName.includes('/')
    || displayName.includes('\\')
    || /[\u0000-\u001f\u007f-\u009f]/u.test(displayName)
  ) {
    throw initializationError(
      'ANTIKY_PROJECT_NAME_INVALID',
      'Project name must be 1 through 128 characters and must not contain a path or control character.',
      'name',
    );
  }
  return displayName;
}

function defaultDisplayName(directoryName: string): string {
  return directoryName
    .replace(/[-_]+/gu, ' ')
    .trim()
    .split(/\s+/gu)
    .map((word) => `${word.slice(0, 1).toLocaleUpperCase('en-US')}${word.slice(1)}`)
    .join(' ');
}

function fileSlug(displayName: string): string {
  const slug = displayName
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/\p{Mark}+/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (
    slug.length === 0
    || slug.length > MAX_PROJECT_SLUG_LENGTH
    || RESERVED_FILE_SLUGS.has(slug)
  ) {
    throw initializationError(
      'ANTIKY_PROJECT_NAME_INVALID',
      'Project name must produce a safe lowercase file name with 1 through 64 characters.',
      'name',
    );
  }
  return slug;
}

function projectIdentity(value: string): ProjectIdentity {
  const displayName = normalizeDisplayName(value);
  return Object.freeze({ displayName, fileSlug: fileSlug(displayName) });
}

async function initializationDirectory(path: string): Promise<string> {
  const selected = resolve(path);
  let metadata;
  try {
    metadata = await lstat(selected);
  } catch {
    throw initializationError(
      'ANTIKY_PROJECT_DIRECTORY_INVALID',
      `Project directory does not exist: ${selected}`,
      'directory',
    );
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw initializationError(
      'ANTIKY_PROJECT_DIRECTORY_INVALID',
      `Project target must be an existing directory and not a symbolic link: ${selected}`,
      'directory',
    );
  }

  const canonical = await realpath(selected);
  try {
    await access(canonical, constants.W_OK);
  } catch {
    throw initializationError(
      'ANTIKY_PROJECT_CREATE_FAILED',
      `Project directory is not writable: ${canonical}`,
      'directory',
    );
  }
  return canonical;
}

function checkInterrupted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw initializationError(
      'ANTIKY_PROJECT_INIT_INTERRUPTED',
      'Project initialization was interrupted before the manifest was created.',
    );
  }
}

async function existingManifest(directory: string): Promise<string | null> {
  const entries = await readdir(directory, { withFileTypes: true });
  const manifest = entries.find((entry) => entry.name.endsWith('.antiky'));
  return manifest ? join(directory, manifest.name) : null;
}

async function removeOwnedFile(path: string | null): Promise<unknown | null> {
  if (path === null) return null;
  try {
    await unlink(path);
    return null;
  } catch (cause: unknown) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return cause;
  }
}

function normalizeCreateFailure(cause: unknown, directory: string): AntikyCliError {
  if (cause instanceof AntikyCliError) return cause;
  if ((cause as NodeJS.ErrnoException).code === 'ABORT_ERR') {
    return initializationError(
      'ANTIKY_PROJECT_INIT_INTERRUPTED',
      'Project initialization was interrupted before the manifest was created.',
    );
  }
  return initializationError(
    'ANTIKY_PROJECT_CREATE_FAILED',
    `Antiky could not create a project manifest in: ${directory}`,
    'directory',
  );
}

export async function createAntikyProjectManifestFile(
  options: AntikyProjectManifestFileOptions,
): Promise<string> {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.antiky$/u.test(options.fileName)) {
    throw initializationError(
      'ANTIKY_PROJECT_NAME_INVALID',
      'Project file name must use a safe lowercase slug and the .antiky extension.',
      'name',
    );
  }

  const directory = await initializationDirectory(options.directory);
  const finalPath = join(directory, options.fileName);
  const lockPath = join(directory, '.antiky-init.lock');
  const temporaryPath = join(directory, `.antiky-init-${randomUUID()}.tmp`);
  let ownsLock = false;
  let ownsTemporary = false;
  let operationError: unknown = null;

  try {
    checkInterrupted(options.signal);
    try {
      const lockHandle = await open(
        lockPath,
        constants.O_CREAT
          | constants.O_EXCL
          | constants.O_WRONLY
          | (constants.O_NOFOLLOW ?? 0),
        0o600,
      );
      ownsLock = true;
      await lockHandle.close();
    } catch (cause: unknown) {
      if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
        throw initializationError(
          'ANTIKY_PROJECT_CREATE_FAILED',
          `Another project initialization is active in: ${directory}`,
          'directory',
        );
      }
      throw cause;
    }
    checkInterrupted(options.signal);

    const existing = await existingManifest(directory);
    if (existing !== null) {
      throw initializationError(
        'ANTIKY_PROJECT_EXISTS',
        `Antiky project already exists: ${existing}`,
      );
    }

    const temporaryHandle = await open(
      temporaryPath,
      constants.O_CREAT
        | constants.O_EXCL
        | constants.O_WRONLY
        | (constants.O_NOFOLLOW ?? 0),
      0o600,
    );
    ownsTemporary = true;
    try {
      await temporaryHandle.writeFile(options.source, 'utf8');
      await temporaryHandle.sync();
      await temporaryHandle.chmod(0o644);
    } finally {
      await temporaryHandle.close();
    }
    checkInterrupted(options.signal);

    const savedSource = await readFile(temporaryPath, 'utf8');
    parseAntikyProjectManifest(savedSource);
    checkInterrupted(options.signal);

    const racedManifest = await existingManifest(directory);
    if (racedManifest !== null) {
      throw initializationError(
        'ANTIKY_PROJECT_EXISTS',
        `Antiky project already exists: ${racedManifest}`,
      );
    }
    try {
      await link(temporaryPath, finalPath);
    } catch (cause: unknown) {
      if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
        throw initializationError(
          'ANTIKY_PROJECT_EXISTS',
          `Antiky project already exists: ${finalPath}`,
        );
      }
      throw cause;
    }
  } catch (cause: unknown) {
    operationError = normalizeCreateFailure(cause, directory);
  }

  const temporaryCleanupError = ownsTemporary
    ? await removeOwnedFile(temporaryPath)
    : null;
  const lockCleanupError = ownsLock ? await removeOwnedFile(lockPath) : null;
  if (operationError !== null) throw operationError;
  if (temporaryCleanupError !== null || lockCleanupError !== null) {
    throw initializationError(
      'ANTIKY_PROJECT_CREATE_FAILED',
      `Antiky could not clean project initialization files in: ${directory}`,
      'directory',
    );
  }
  return finalPath;
}

export async function initializeAntikyProject(
  options: AntikyProjectInitializationOptions = {},
): Promise<AntikyProject> {
  const directory = await initializationDirectory(options.directory ?? process.cwd());
  const requestedName = options.name ?? defaultDisplayName(basename(directory));
  const identity = projectIdentity(requestedName);
  const manifest = buildAntikyProjectManifest(identity.displayName);
  const manifestPath = await createAntikyProjectManifestFile({
    directory,
    fileName: `${identity.fileSlug}.antiky`,
    source: formatAntikyProjectManifest(manifest),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  return loadAntikyProject(manifestPath);
}
