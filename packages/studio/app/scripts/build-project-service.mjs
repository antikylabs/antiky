import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(appDirectory, '../../..');
const outputDirectory = resolve(repositoryRoot, 'packages/studio/tauri/resources');
const entry = resolve(repositoryRoot, 'packages/cli/src/studio/worker.ts');

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
      external: ['playwright', 'playwright-core'],
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

const modulesDirectory = resolve(outputDirectory, 'node_modules');
await rm(modulesDirectory, { recursive: true, force: true });
await mkdir(modulesDirectory, { recursive: true });
await Promise.all([
  cp(
    resolve(repositoryRoot, 'node_modules/playwright'),
    resolve(modulesDirectory, 'playwright'),
    { recursive: true },
  ),
  cp(
    resolve(repositoryRoot, 'node_modules/playwright-core'),
    resolve(modulesDirectory, 'playwright-core'),
    { recursive: true },
  ),
]);
