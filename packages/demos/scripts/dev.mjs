import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const [slug, ...extra] = args;

if (extra.length > 0) {
  console.error('Usage: npm run dev -- demos [demo-slug]');
  process.exit(1);
}

if (slug && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(`Invalid demo slug: ${slug}`);
  process.exit(1);
}

const root = fileURLToPath(new URL('../../../', import.meta.url));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const path = slug ? `/demos/${slug}` : '/demos';

console.log(`Starting the demo host at http://127.0.0.1:3010${path}`);

const child = spawn(
  npmCommand,
  [
    'run',
    'dev',
    '--workspace',
    '@antiky/website',
    '--',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3010',
  ],
  {
    cwd: root,
    env: { ...process.env, ANTIKY_DEMO_SLUG: slug ?? '' },
    stdio: 'inherit',
  },
);

child.on('error', (error) => {
  console.error(`Unable to start the demo host: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 1));
