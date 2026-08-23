import { spawn } from 'node:child_process';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const [target, ...targetArgs] = args;

const workspaces = {
  website: '@antiky/website',
  framework: '@antiky/framework',
};

const demoProjects = {
  'antiky-town': 'packages/demos/antiky-town/antiky-town.antiky',
  'combat-arena': 'packages/demos/combat-arena/combat-arena.antiky',
  'point-light-expo': 'packages/demos/point-light-expo/point-light-expo.antiky',
  'traversal-study': 'packages/demos/traversal-study/traversal-study.antiky',
};

if (!target || (!(target in workspaces) && target !== 'demos')) {
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
const demoSlug = targetArgs[0] ?? 'antiky-town';
if (target === 'demos' && !(demoSlug in demoProjects)) {
  console.error(`Unknown demo: ${demoSlug}`);
  process.exit(1);
}
const childArgs = target === 'demos'
  ? ['run', 'antiky', '--', 'dev', '--project', demoProjects[demoSlug]]
  : [
      'run',
      'dev',
      '--workspace',
      workspaces[target],
      '--',
      ...(target === 'website' && targetArgs.length === 0
        ? ['--hostname', '127.0.0.1', '--port', '3020']
        : targetArgs),
    ];
const child = spawn(
  npmCommand,
  childArgs,
  { stdio: 'inherit' },
);

child.on('error', (error) => {
  console.error(`Unable to start ${target}: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 1));
