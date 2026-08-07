import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 96 * 1024 * 1024;
const MAX_FILES = 256;
const MANIFEST_NAME = 'antiky-artifact.json';
const ENTRY_NAME = 'antiky.game.js';
const ignoredSourceNames = new Set([
  '.antiky',
  '.DS_Store',
  '.git',
  'dist',
  'node_modules',
]);

function fail(message) {
  throw new Error(`ANTIKY_ARTIFACT_INVALID: ${message}`);
}

function parseArguments(argv) {
  const values = { sources: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith('--') || value === undefined) fail(`Invalid argument ${option ?? ''}`);
    index += 1;
    if (option === '--source') values.sources.push(value);
    else if (option === '--slug') values.slug = value;
    else if (option === '--name') values.name = value;
    else if (option === '--dist') values.dist = value;
    else if (option === '--width') values.width = value;
    else if (option === '--height') values.height = value;
    else fail(`Unknown option ${option}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug ?? '')) fail('A valid --slug is required');
  if (typeof values.name !== 'string' || values.name.trim() === '') fail('A non-empty --name is required');
  if (values.sources.length === 0) fail('At least one --source is required');
  const width = Number(values.width ?? 1280);
  const height = Number(values.height ?? 720);
  if (!Number.isSafeInteger(width) || width < 1) fail('--width must be a positive integer');
  if (!Number.isSafeInteger(height) || height < 1) fail('--height must be a positive integer');
  return {
    slug: values.slug,
    name: values.name.trim(),
    dist: path.resolve(values.dist ?? 'dist'),
    sources: values.sources,
    width,
    height,
  };
}

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

function portablePath(value) {
  return value.split(path.sep).join('/');
}

async function filesBelow(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) fail(`Symbolic links are not permitted: ${entry.name}`);
    if (ignoredSourceNames.has(entry.name) || entry.name.endsWith('.tsbuildinfo')) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function computeSourceRevision(sourceArguments) {
  const hash = createHash('sha256');
  const sources = sourceArguments.map((argument) => {
    const separator = argument.indexOf('=');
    if (separator < 1 || separator === argument.length - 1) {
      fail(`Source must use label=path: ${argument}`);
    }
    return {
      label: argument.slice(0, separator),
      root: path.resolve(argument.slice(separator + 1)),
    };
  }).sort((left, right) => left.label.localeCompare(right.label, 'en'));

  const labels = new Set();
  for (const source of sources) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.label)) fail(`Invalid source label ${source.label}`);
    if (labels.has(source.label)) fail(`Duplicate source label ${source.label}`);
    labels.add(source.label);
    const metadata = await lstat(source.root);
    const files = metadata.isDirectory() ? await filesBelow(source.root) : [''];
    for (const relative of files) {
      const file = relative === '' ? source.root : path.join(source.root, relative);
      const bytes = await readFile(file);
      hash.update(`${source.label}/${portablePath(relative || path.basename(source.root))}\0`);
      hash.update(bytes);
      hash.update('\0');
    }
  }
  return `sha256:${hash.digest('hex')}`;
}

async function describeArtifactFiles(dist) {
  const relativeFiles = (await filesBelow(dist)).filter((file) => file !== MANIFEST_NAME);
  if (relativeFiles.length === 0) fail('The build output is empty');
  if (relativeFiles.length > MAX_FILES) fail(`The build has more than ${MAX_FILES} files`);
  const files = [];
  let totalBytes = 0;
  for (const relative of relativeFiles) {
    const bytes = await readFile(path.join(dist, relative));
    if (bytes.byteLength > MAX_FILE_BYTES) fail(`${portablePath(relative)} is too large`);
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_ARTIFACT_BYTES) fail('The complete artifact is too large');
    files.push({
      path: portablePath(relative),
      size: bytes.byteLength,
      sha256: digest(bytes),
    });
  }
  if (!files.some((file) => file.path === ENTRY_NAME)) fail(`${ENTRY_NAME} is missing`);
  return files;
}

export async function buildDemoArtifact(argv) {
  const options = parseArguments(argv);
  const files = await describeArtifactFiles(options.dist);
  const manifest = {
    schemaVersion: 1,
    gameModuleContractVersion: 1,
    projectName: options.name,
    slug: options.slug,
    sourceRevision: await computeSourceRevision(options.sources),
    entry: ENTRY_NAME,
    requirements: {
      webgpu: true,
    },
    viewport: {
      width: options.width,
      height: options.height,
    },
    files,
  };

  await writeFile(
    path.join(options.dist, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await buildDemoArtifact(process.argv.slice(2));
}
