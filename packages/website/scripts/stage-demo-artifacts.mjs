import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { computeSourceRevision } from './build-demo-artifact.mjs';

const MANIFEST_NAME = 'antiky-artifact.json';
const ENTRY_NAME = 'antiky.game.js';
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 96 * 1024 * 1024;
const MAX_FILES = 256;

function fail(code, slug, detail) {
  const target = slug ? ` (${slug})` : '';
  throw new Error(`${code}${target}: ${detail}`);
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value, expected, code, slug, label) {
  if (!isObject(value)) fail(code, slug, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    fail(code, slug, `${label} has unknown or missing fields`);
  }
}

function resolveInside(root, relative, code, slug) {
  if (typeof relative !== 'string' || relative === '' || path.isAbsolute(relative) || relative.includes('\\')) {
    fail(code, slug, `Invalid relative path: ${String(relative)}`);
  }
  const resolved = path.resolve(root, relative);
  const relation = path.relative(root, resolved);
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    fail(code, slug, `Path leaves its root: ${relative}`);
  }
  return resolved;
}

function hash(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function filesBelow(root, relative = '', slug = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) fail('ANTIKY_ARTIFACT_SYMLINK', slug, child);
    if (entry.isDirectory()) files.push(...await filesBelow(root, child, slug));
    else if (entry.isFile()) files.push(child.split(path.sep).join('/'));
  }
  return files;
}

function parsePublication(source) {
  let publication;
  try {
    publication = JSON.parse(source);
  } catch {
    fail('ANTIKY_PUBLICATION_INVALID', '', 'Publication JSON is invalid');
  }
  exactKeys(publication, ['schemaVersion', 'demos'], 'ANTIKY_PUBLICATION_INVALID', '', 'publication');
  if (publication.schemaVersion !== 1 || !Array.isArray(publication.demos) || publication.demos.length === 0) {
    fail('ANTIKY_PUBLICATION_INVALID', '', 'Publication schema version 1 needs demos');
  }
  const slugs = new Set();
  const workspaces = new Set();
  for (const demo of publication.demos) {
    exactKeys(
      demo,
      ['slug', 'projectName', 'renderer', 'workspace', 'projectDirectory', 'sources'],
      'ANTIKY_PUBLICATION_INVALID',
      demo?.slug,
      'demo',
    );
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(demo.slug)) {
      fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Slug is invalid');
    }
    if (slugs.has(demo.slug)) fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Slug is duplicated');
    if (typeof demo.projectName !== 'string' || demo.projectName.trim() === '') {
      fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Project name is required');
    }
    if (!['antiky', 'brometal', 'threejs'].includes(demo.renderer)) {
      fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Renderer is invalid');
    }
    if (typeof demo.workspace !== 'string' || !demo.workspace.startsWith('@antiky/demo-')) {
      fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Workspace is invalid');
    }
    if (workspaces.has(demo.workspace)) fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Workspace is duplicated');
    if (!Array.isArray(demo.sources) || demo.sources.length === 0) {
      fail('ANTIKY_PUBLICATION_INVALID', demo.slug, 'Sources are required');
    }
    for (const sourceEntry of demo.sources) {
      exactKeys(sourceEntry, ['label', 'path'], 'ANTIKY_PUBLICATION_INVALID', demo.slug, 'source');
    }
    slugs.add(demo.slug);
    workspaces.add(demo.workspace);
  }
  return publication;
}

function parseManifest(source, approved) {
  let manifest;
  try {
    manifest = JSON.parse(source);
  } catch {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest JSON is invalid');
  }
  exactKeys(
    manifest,
    [
      'schemaVersion',
      'gameModuleContractVersion',
      'projectName',
      'slug',
      'sourceRevision',
      'entry',
      'requirements',
      'viewport',
      'files',
    ],
    'ANTIKY_ARTIFACT_MANIFEST_INVALID',
    approved.slug,
    'manifest',
  );
  exactKeys(manifest.requirements, ['webgpu'], 'ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'requirements');
  exactKeys(manifest.viewport, ['width', 'height'], 'ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'viewport');
  if (
    manifest.schemaVersion !== 1
    || manifest.gameModuleContractVersion !== 1
    || manifest.slug !== approved.slug
    || manifest.projectName !== approved.projectName
    || manifest.entry !== ENTRY_NAME
    || manifest.requirements.webgpu !== (approved.renderer !== 'threejs')
    || !Number.isSafeInteger(manifest.viewport.width)
    || manifest.viewport.width < 1
    || !Number.isSafeInteger(manifest.viewport.height)
    || manifest.viewport.height < 1
    || !Array.isArray(manifest.files)
    || manifest.files.length < 1
    || manifest.files.length > MAX_FILES
  ) {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest values are incompatible');
  }
  const paths = new Set();
  let totalBytes = 0;
  for (const file of manifest.files) {
    exactKeys(file, ['path', 'size', 'sha256'], 'ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'file');
    if (
      typeof file.path !== 'string'
      || !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+$/.test(file.path)
      || paths.has(file.path)
      || !Number.isSafeInteger(file.size)
      || file.size < 0
      || file.size > MAX_FILE_BYTES
      || !/^[a-f0-9]{64}$/.test(file.sha256)
    ) {
      fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'File record is invalid');
    }
    totalBytes += file.size;
    if (totalBytes > MAX_ARTIFACT_BYTES) fail('ANTIKY_ARTIFACT_TOO_LARGE', approved.slug, 'Artifact is too large');
    paths.add(file.path);
  }
  if (!paths.has(ENTRY_NAME)) fail('ANTIKY_ARTIFACT_ENTRY_MISSING', approved.slug, `${ENTRY_NAME} is not declared`);
  return manifest;
}

async function verifyOneArtifact(repositoryRoot, approved) {
  const projectDirectory = resolveInside(
    repositoryRoot,
    approved.projectDirectory,
    'ANTIKY_PUBLICATION_INVALID',
    approved.slug,
  );
  const dist = path.join(projectDirectory, 'dist');
  const manifestPath = path.join(dist, MANIFEST_NAME);
  let distMetadata;
  try {
    distMetadata = await lstat(dist);
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      fail('ANTIKY_ARTIFACT_MANIFEST_MISSING', approved.slug, `${MANIFEST_NAME} is missing`);
    }
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Artifact output cannot be inspected');
  }
  if (distMetadata.isSymbolicLink()) fail('ANTIKY_ARTIFACT_SYMLINK', approved.slug, 'dist');
  if (!distMetadata.isDirectory()) {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Artifact output is not a directory');
  }
  let manifestMetadata;
  try {
    manifestMetadata = await lstat(manifestPath);
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      fail('ANTIKY_ARTIFACT_MANIFEST_MISSING', approved.slug, `${MANIFEST_NAME} is missing`);
    }
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest cannot be inspected');
  }
  if (manifestMetadata.isSymbolicLink()) fail('ANTIKY_ARTIFACT_SYMLINK', approved.slug, MANIFEST_NAME);
  if (!manifestMetadata.isFile()) {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest is not a file');
  }
  let manifestBytes;
  try {
    manifestBytes = await readFile(manifestPath);
  } catch {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest cannot be read');
  }
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    fail('ANTIKY_ARTIFACT_MANIFEST_INVALID', approved.slug, 'Manifest is too large');
  }
  const manifest = parseManifest(manifestBytes.toString('utf8'), approved);
  const sourceArguments = approved.sources.map((source) => {
    const resolved = resolveInside(repositoryRoot, source.path, 'ANTIKY_PUBLICATION_INVALID', approved.slug);
    return `${source.label}=${resolved}`;
  });
  const expectedRevision = await computeSourceRevision(sourceArguments);
  if (manifest.sourceRevision !== expectedRevision) {
    fail('ANTIKY_ARTIFACT_STALE', approved.slug, 'Source revision does not match the current source');
  }

  // Both lists sorted the same way before they are compared element by element. `filesBelow` walks
  // with `localeCompare(name, 'en')`, which is locale collation, while the expected list uses the
  // default code-unit `.sort()`. The two disagree whenever case or punctuation is involved:
  // `template-wall-Dzn8tX6E.glb` sorts before `template-wall-detail-a-Dmly8Er6.glb` by code unit and
  // after it by locale, so an identical set of files compared as two differently-ordered lists
  // reported "missing or extra files" with nothing missing and nothing extra.
  const actualFiles = (await filesBelow(dist, '', approved.slug)).sort();
  const expectedFiles = [...manifest.files.map((file) => file.path), MANIFEST_NAME].sort();
  if (actualFiles.length !== expectedFiles.length || actualFiles.some((file, index) => file !== expectedFiles[index])) {
    fail('ANTIKY_ARTIFACT_FILE_SET_INVALID', approved.slug, 'Build output has missing or extra files');
  }
  for (const file of manifest.files) {
    const sourcePath = resolveInside(dist, file.path, 'ANTIKY_ARTIFACT_PATH_INVALID', approved.slug);
    const metadata = await lstat(sourcePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      fail('ANTIKY_ARTIFACT_SYMLINK', approved.slug, file.path);
    }
    const bytes = await readFile(sourcePath);
    if (bytes.byteLength !== file.size || hash(bytes) !== file.sha256) {
      fail('ANTIKY_ARTIFACT_DIGEST_MISMATCH', approved.slug, file.path);
    }
  }
  return { approved, dist, manifest };
}

export async function stageDemoArtifacts({ repositoryRoot, publicationPath, destination }) {
  const publication = parsePublication(await readFile(publicationPath, 'utf8'));
  const verified = [];
  for (const approved of publication.demos) {
    verified.push(await verifyOneArtifact(repositoryRoot, approved));
  }

  const destinationParent = path.dirname(destination);
  const stage = path.join(destinationParent, `.demo-builds-stage-${process.pid}`);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  try {
    for (const artifact of verified) {
      const output = path.join(stage, artifact.approved.slug);
      await mkdir(output, { recursive: true });
      for (const file of [...artifact.manifest.files.map((entry) => entry.path), MANIFEST_NAME]) {
        const target = resolveInside(output, file, 'ANTIKY_ARTIFACT_PATH_INVALID', artifact.approved.slug);
        await mkdir(path.dirname(target), { recursive: true });
        await copyFile(path.join(artifact.dist, file), target);
      }
    }
    await rm(destination, { recursive: true, force: true });
    await rename(stage, destination);
  } catch (cause) {
    await rm(stage, { recursive: true, force: true });
    throw cause;
  }
  return verified.map(({ approved, manifest }) => ({ slug: approved.slug, manifest }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
  await stageDemoArtifacts({
    repositoryRoot,
    publicationPath: path.join(repositoryRoot, 'packages/website/demo-publication.json'),
    destination: path.join(repositoryRoot, 'packages/website/public/demo-builds'),
  });
}
