import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const iconsDirectory = join(packageDirectory, 'icons');
const sourcePath = join(iconsDirectory, 'source.svg');
const artifactNames = Object.freeze(['icon.icns', 'icon.png']);

function fail(message) {
  throw new Error(`[ANTIKY_ICON_GENERATION_FAILED] ${message}`);
}

async function generate() {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'antiky-studio-icon-'));
  const stagedPaths = artifactNames.map((name) => (
    join(iconsDirectory, `.${name}-${process.pid}`)
  ));
  try {
    const result = spawnSync('tauri', ['icon', sourcePath, '--output', outputDirectory], {
      cwd: packageDirectory,
      encoding: 'utf8',
    });
    if (result.error) fail(result.error.message);
    if (result.status !== 0) {
      fail(`Tauri exited with status ${result.status}: ${result.stderr.trim()}`);
    }

    await mkdir(iconsDirectory, { recursive: true });
    await Promise.all(artifactNames.map((name, index) => (
      copyFile(join(outputDirectory, name), stagedPaths[index])
    )));
    for (let index = 0; index < artifactNames.length; index += 1) {
      await rename(stagedPaths[index], join(iconsDirectory, artifactNames[index]));
    }
  } finally {
    await Promise.all(stagedPaths.map((path) => rm(path, { force: true })));
    await rm(outputDirectory, { recursive: true, force: true });
  }
  console.log('Generated icons/icon.icns and icons/icon.png from icons/source.svg.');
}

generate().catch((reason) => {
  console.error(reason instanceof Error ? reason.message : reason);
  process.exitCode = 1;
});
