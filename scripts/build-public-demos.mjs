import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { stageDemoArtifacts } from './stage-demo-artifacts.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const publicationPath = path.join(repositoryRoot, 'packages/website/demo-publication.json');
const destination = path.join(repositoryRoot, 'packages/website/public/demo-builds');
const publication = JSON.parse(await readFile(publicationPath, 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function build(workspace) {
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

for (const demo of publication.demos) await build(demo.workspace);
await stageDemoArtifacts({ repositoryRoot, publicationPath, destination });
