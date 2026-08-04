import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createDemoHostEnvironment, parseDemoHostOptions } from './dev-options.mjs';

let options;
try {
  options = parseDemoHostOptions(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Usage: npm run dev -- [demo-slug] [--host 127.0.0.1] [--port N] [--width N] [--height N]');
  process.exit(1);
}

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log(
  `Starting the focused ${options.slug} game host at http://${options.host}:${options.port}/ `
  + `(${options.width}x${options.height}).`,
);

const child = spawn(
  npmCommand,
  [
    'run', 'host:dev',
    '--',
    '--host',
    options.host,
    '--port',
    String(options.port),
  ],
  {
    cwd: packageRoot,
    env: createDemoHostEnvironment(options),
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error(`Unable to start the demo host: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 1));
