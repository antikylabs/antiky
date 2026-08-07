import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import {
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
import { spawnSync } from 'node:child_process';

import { GHOSTTY_DEPENDENCY, cacheMatchesDependency } from './ghostty-dependency.mjs';

const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const nativeDirectory = join(packageDirectory, '.native');
const manifestPath = join(nativeDirectory, 'dependency.json');
const installDirectory = join(nativeDirectory, 'ghostty');
const headerPath = join(installDirectory, 'include', 'ghostty.h');
const libraryPath = join(installDirectory, 'lib', 'libghostty-internal.a');

function fail(message) {
  throw new Error(`[ANTIKY_GHOSTTY_PREPARE_FAILED] ${message}`);
}

async function isNonemptyFile(path) {
  try {
    return (await stat(path)).isFile() && (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function cacheIsReady() {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    return cacheMatchesDependency(manifest.dependency)
      && await isNonemptyFile(headerPath)
      && await isNonemptyFile(libraryPath);
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

function run(program, arguments_, cwd) {
  const result = spawnSync(program, arguments_, {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${program} exited with status ${result.status}.`);
}

async function extract(archive, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  run('tar', ['-xf', archive, '-C', destination], packageDirectory);
}

async function prepare() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    fail('Studio Slice 00 supports macOS arm64 only.');
  }
  if (await cacheIsReady()) {
    console.log(`Ghostty ${GHOSTTY_DEPENDENCY.ghosttyRevision.slice(0, 12)} is ready.`);
    return;
  }

  await mkdir(nativeDirectory, { recursive: true });
  const downloads = join(nativeDirectory, 'downloads');
  const work = join(nativeDirectory, 'work');
  await mkdir(downloads, { recursive: true });

  const ghosttyArchive = join(downloads, `${GHOSTTY_DEPENDENCY.ghosttyRevision}.tar.gz`);
  const zigArchive = join(downloads, `zig-aarch64-macos-${GHOSTTY_DEPENDENCY.zigVersion}.tar.xz`);
  await downloadVerified(
    `https://github.com/ghostty-org/ghostty/archive/${GHOSTTY_DEPENDENCY.ghosttyRevision}.tar.gz`,
    ghosttyArchive,
    GHOSTTY_DEPENDENCY.ghosttyArchiveSha256,
  );
  await downloadVerified(
    `https://ziglang.org/download/${GHOSTTY_DEPENDENCY.zigVersion}/zig-aarch64-macos-${GHOSTTY_DEPENDENCY.zigVersion}.tar.xz`,
    zigArchive,
    GHOSTTY_DEPENDENCY.zigArchiveSha256,
  );

  const ghosttyExtract = join(work, 'ghostty');
  const zigExtract = join(work, 'zig');
  await extract(ghosttyArchive, ghosttyExtract);
  await extract(zigArchive, zigExtract);

  const ghosttySource = join(ghosttyExtract, `ghostty-${GHOSTTY_DEPENDENCY.ghosttyRevision}`);
  const zigExecutable = join(
    zigExtract,
    `zig-aarch64-macos-${GHOSTTY_DEPENDENCY.zigVersion}`,
    'zig',
  );
  if (!await isNonemptyFile(zigExecutable)) fail('Pinned Zig executable was not extracted.');

  run(zigExecutable, [
    'build',
    '-Doptimize=ReleaseFast',
    '-Dxcframework-target=native',
    '-Demit-macos-app=false',
  ], ghosttySource);

  const builtHeader = join(ghosttySource, 'include', 'ghostty.h');
  const builtLibrary = join(
    ghosttySource,
    'macos',
    'GhosttyKit.xcframework',
    'macos-arm64',
    'libghostty-internal.a',
  );
  if (!await isNonemptyFile(builtHeader) || !await isNonemptyFile(builtLibrary)) {
    fail('Ghostty build did not produce the expected header and static library.');
  }

  const staged = join(nativeDirectory, `.ghostty-${process.pid}`);
  await rm(staged, { recursive: true, force: true });
  await mkdir(join(staged, 'include'), { recursive: true });
  await mkdir(join(staged, 'lib'), { recursive: true });
  await copyFile(builtHeader, join(staged, 'include', 'ghostty.h'));
  await copyFile(builtLibrary, join(staged, 'lib', 'libghostty-internal.a'));
  await rm(installDirectory, { recursive: true, force: true });
  await rename(staged, installDirectory);
  await writeFile(
    manifestPath,
    `${JSON.stringify({ schemaVersion: 1, dependency: GHOSTTY_DEPENDENCY }, null, 2)}\n`,
    'utf8',
  );
  await rm(work, { recursive: true, force: true });
  console.log(`Prepared Ghostty ${GHOSTTY_DEPENDENCY.ghosttyRevision.slice(0, 12)}.`);
}

await prepare();

