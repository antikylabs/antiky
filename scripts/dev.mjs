import { spawn } from 'node:child_process';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const [target, ...targetArgs] = args;

const workspaces = {
  website: '@antiky/website',
  framework: '@antiky/framework',
  demos: '@antiky/demos',
};

if (!target || !(target in workspaces)) {
  console.error(`Usage:
  npm run dev -- website
  npm run dev -- framework
  npm run dev -- demos [demo-slug]

Shortcuts:
  npm run dev:website
  npm run dev:framework
  npm run dev:demos -- [demo-slug]`);
  process.exit(1);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const defaultArgs = target === 'website' && targetArgs.length === 0
  ? ['--hostname', '127.0.0.1', '--port', '3010']
  : targetArgs;
const child = spawn(
  npmCommand,
  ['run', 'dev', '--workspace', workspaces[target], '--', ...defaultArgs],
  { stdio: 'inherit' },
);

child.on('error', (error) => {
  console.error(`Unable to start ${target}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 1));
