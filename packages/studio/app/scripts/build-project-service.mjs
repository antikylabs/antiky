import { chmod, copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appDirectory, '../../..');
const outputDirectory = resolve(repositoryRoot, 'packages/studio/tauri/resources');
const entry = resolve(repositoryRoot, 'packages/cli/src/studio-worker.ts');

await mkdir(outputDirectory, { recursive: true });
await build({
  configFile: false,
  logLevel: 'warn',
  root: repositoryRoot,
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: outputDirectory,
    rollupOptions: {
      output: {
        entryFileNames: 'project-service.mjs',
        format: 'es',
      },
    },
    ssr: entry,
    target: 'node22',
  },
  ssr: {
    noExternal: true,
  },
});

const runtime = resolve(outputDirectory, 'node');
await copyFile(process.execPath, runtime);
await chmod(runtime, 0o755);
