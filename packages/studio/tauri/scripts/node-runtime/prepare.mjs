import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import {
  NODE_RUNTIME_DEPENDENCY,
  cacheMatchesNodeRuntimeDependency,
} from './dependency.mjs';

const packageDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const nativeDirectory = join(packageDirectory, '.native');
const downloadsDirectory = join(nativeDirectory, 'downloads');
const manifestPath = join(nativeDirectory, 'node-runtime.json');
const runtimePath = join(packageDirectory, 'resources', 'node');
const runtimeLicensePath = join(packageDirectory, 'resources', 'node-LICENSE');

function fail(message) {
  throw new Error(`[ANTIKY_NODE_RUNTIME_PREPARE_FAILED] ${message}`);
}

async function isNonemptyFile(path) {
  try {
    const information = await stat(path);
    return information.isFile() && information.size > 0;
  } catch {
    return false;
  }
}

function runtimeVersion(path) {
  const result = spawnSync(path, ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

async function cacheIsReady() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    return cacheMatchesNodeRuntimeDependency(manifest.dependency)
      && await isNonemptyFile(runtimePath)
      && await isNonemptyFile(runtimeLicensePath)
      && runtimeVersion(runtimePath) === `v${NODE_RUNTIME_DEPENDENCY.version}`;
  } catch {
    return false;
  }
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadVerified(url, destination, expectedHash) {
  if (await isNonemptyFile(destination) && await sha256(destination) === expectedHash) return;

  const partial = `${destination}.part`;
  await rm(partial, { force: true });
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) fail(`Download returned HTTP ${response.status}.`);
  await pipeline(response.body, createWriteStream(partial, { flags: 'wx' }));

  const actualHash = await sha256(partial);
  if (actualHash !== expectedHash) {
    await rm(partial, { force: true });
    fail(`Archive hash mismatch: expected ${expectedHash}, received ${actualHash}.`);
  }
  await rename(partial, destination);
}

function extract(archive, destination) {
  const result = spawnSync('tar', ['-xzf', archive, '-C', destination], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`tar exited with status ${result.status}: ${result.stderr.trim()}`);
}

async function prepare() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    fail('Antiky Studio supports macOS arm64 only.');
  }
  if (await cacheIsReady()) {
    console.log(`Node ${NODE_RUNTIME_DEPENDENCY.version} runtime is ready.`);
    return;
  }

  await mkdir(downloadsDirectory, { recursive: true });
  const archivePath = join(downloadsDirectory, NODE_RUNTIME_DEPENDENCY.archive);
  await downloadVerified(
    `https://nodejs.org/download/release/v${NODE_RUNTIME_DEPENDENCY.version}/${NODE_RUNTIME_DEPENDENCY.archive}`,
    archivePath,
    NODE_RUNTIME_DEPENDENCY.archiveSha256,
  );

  const workDirectory = join(nativeDirectory, `.node-runtime-${process.pid}`);
  const stagedRuntime = join(packageDirectory, 'resources', `.node-${process.pid}`);
  const stagedLicense = join(packageDirectory, 'resources', `.node-LICENSE-${process.pid}`);
  await rm(workDirectory, { recursive: true, force: true });
  await rm(stagedRuntime, { force: true });
  await rm(stagedLicense, { force: true });
  await mkdir(workDirectory, { recursive: true });
  try {
    extract(archivePath, workDirectory);
    const extractedRuntime = join(
      workDirectory,
      NODE_RUNTIME_DEPENDENCY.archive.replace(/\.tar\.gz$/, ''),
      'bin',
      'node',
    );
    const extractedLicense = join(
      workDirectory,
      NODE_RUNTIME_DEPENDENCY.archive.replace(/\.tar\.gz$/, ''),
      'LICENSE',
    );
    if (!await isNonemptyFile(extractedRuntime)) fail('Pinned Node executable was not extracted.');
    if (!await isNonemptyFile(extractedLicense)) fail('Pinned Node license was not extracted.');

    await copyFile(extractedRuntime, stagedRuntime);
    await copyFile(extractedLicense, stagedLicense);
    await chmod(stagedRuntime, 0o755);
    const version = runtimeVersion(stagedRuntime);
    if (version !== `v${NODE_RUNTIME_DEPENDENCY.version}`) {
      fail(`Prepared runtime reported ${version ?? 'no version'}.`);
    }
    await rename(stagedRuntime, runtimePath);
    await rename(stagedLicense, runtimeLicensePath);
    await writeFile(
      manifestPath,
      `${JSON.stringify({ schemaVersion: 1, dependency: NODE_RUNTIME_DEPENDENCY }, null, 2)}\n`,
      'utf8',
    );
  } finally {
    await rm(stagedRuntime, { force: true });
    await rm(stagedLicense, { force: true });
    await rm(workDirectory, { recursive: true, force: true });
  }
  console.log(`Prepared Node ${NODE_RUNTIME_DEPENDENCY.version} runtime.`);
}

await prepare();
