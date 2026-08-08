import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildDemoArtifact } from './build-demo-artifact.mjs';
import { stageDemoArtifacts } from './stage-demo-artifacts.mjs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function build(repositoryRoot, workspace) {
  return new Promise((resolve, reject) => {
    const child = spawn(npm, ['run', 'build', '--workspace', workspace], {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ANTIKY_DEMO_BUILD_FAILED: ${workspace} exited with ${code ?? 'no status'}`));
    });
  });
}

export async function buildPublishedDemo({ repositoryRoot, demo }) {
  await build(repositoryRoot, demo.workspace);
  const sourceArguments = demo.sources.flatMap((source) => [
    '--source',
    `${source.label}=${path.join(repositoryRoot, source.path)}`,
  ]);
  return buildDemoArtifact([
    '--slug', demo.slug,
    '--name', demo.projectName,
    '--dist', path.join(repositoryRoot, demo.projectDirectory, 'dist'),
    '--webgpu', String(demo.renderer !== 'threejs'),
    ...sourceArguments,
  ]);
}

export async function buildPublicDemos({ repositoryRoot, publicationPath, destination }) {
  const publication = JSON.parse(await readFile(publicationPath, 'utf8'));
  for (const demo of publication.demos) {
    await buildPublishedDemo({ repositoryRoot, demo });
  }
  return stageDemoArtifacts({ repositoryRoot, publicationPath, destination });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
  await buildPublicDemos({
    repositoryRoot,
    publicationPath: path.join(repositoryRoot, 'packages/website/demo-publication.json'),
    destination: path.join(repositoryRoot, 'packages/website/public/demo-builds'),
  });
}
