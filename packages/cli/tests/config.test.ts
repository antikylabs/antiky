import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Node 22's strip-types test runner requires the source extension.
// @ts-ignore explicit TypeScript extension is for the direct test runner
import { AntikyCliError, loadAntikyConfig } from '../src/index.ts';

const validConfig = {
  schemaVersion: 1,
  game: {
    command: ['node', 'game.mjs', '{host}', '{gamePort}'],
    shaderCommand: ['node', 'shaders.mjs'],
    workingDirectory: '.',
    url: 'http://127.0.0.1:43100/demos/town-study',
  },
  network: {
    host: '127.0.0.1',
    gamePort: 43100,
    inspectionPort: 43101,
  },
};

const repositoryConfig = fileURLToPath(new URL('../../../antiky.config.json', import.meta.url));

async function writeConfig(value: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'antiky-config-'));
  const path = join(directory, 'antiky.config.json');
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}

async function expectInvalid(value: unknown, path: string): Promise<void> {
  const configPath = await writeConfig(value);
  await assert.rejects(
    () => loadAntikyConfig(configPath),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_CONFIG_INVALID'
      && error.path === path
    ),
  );
}

test('strict config resolves commands, working directory, URL, and loopback ports', async () => {
  const configPath = await writeConfig(validConfig);
  const config = await loadAntikyConfig(configPath);

  assert.equal(config.schemaVersion, 1);
  assert.equal(config.game.workingDirectory, await realpath(dirname(configPath)));
  assert.deepEqual(config.game.command, ['node', 'game.mjs', '127.0.0.1', '43100']);
  assert.deepEqual(config.game.shaderCommand, ['node', 'shaders.mjs']);
  assert.equal(config.game.url, 'http://127.0.0.1:43100/demos/town-study');
  assert.equal(config.network.host, '127.0.0.1');
  assert.equal(config.network.gamePort, 43100);
  assert.equal(config.network.inspectionPort, 43101);
  assert.match(config.hash, /^[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.game.command));
});

test('the repository config launches town-study and its shader watcher on fixed loopback ports', async () => {
  const config = await loadAntikyConfig(repositoryConfig);

  assert.equal(config.game.url, 'http://127.0.0.1:3010/demos/town-study');
  assert.deepEqual(config.game.command, [
    'npm',
    'run',
    'dev',
    '--workspace',
    '@antiky/website',
    '--',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3010',
  ]);
  assert.deepEqual(config.game.shaderCommand, [
    'npm',
    'run',
    'shaders:watch',
    '--workspace',
    '@antiky/demos',
  ]);
  assert.equal(config.network.inspectionPort, 3011);
});

test('the legacy development shortcuts keep the same fixed loopback route', async () => {
  const root = dirname(repositoryConfig);
  const websitePackage = JSON.parse(
    await readFile(join(root, 'packages/website/package.json'), 'utf8'),
  ) as { scripts: { dev: string } };
  const rootDispatcher = await readFile(join(root, 'scripts/dev.mjs'), 'utf8');
  const demoDispatcher = await readFile(join(root, 'packages/demos/scripts/dev.mjs'), 'utf8');

  assert.equal(websitePackage.scripts.dev, 'next dev');
  assert.match(rootDispatcher, /'--hostname', '127\.0\.0\.1', '--port', '3010'/);
  assert.match(demoDispatcher, /http:\/\/127\.0\.0\.1:3010/);
  assert.match(demoDispatcher, /'--hostname',[\s\S]*'127\.0\.0\.1',[\s\S]*'--port',[\s\S]*'3010'/);
});

test('config rejects unknown root and nested fields', async () => {
  await expectInvalid({ ...validConfig, open: true }, '$.open');
  await expectInvalid({
    ...validConfig,
    game: { ...validConfig.game, route: '/demos/town-study' },
  }, '$.game.route');
});

test('config rejects unsafe working directories', async () => {
  await expectInvalid({
    ...validConfig,
    game: { ...validConfig.game, workingDirectory: '..' },
  }, '$.game.workingDirectory');

  const directory = await mkdtemp(join(tmpdir(), 'antiky-config-symlink-'));
  const project = join(directory, 'project');
  await mkdir(project);
  const path = join(project, 'antiky.config.json');
  await writeFile(path, `${JSON.stringify({
    ...validConfig,
    game: { ...validConfig.game, workingDirectory: '../outside' },
  })}\n`);
  await assert.rejects(() => loadAntikyConfig(path), AntikyCliError);
});

test('config rejects unsafe hosts, invalid ports, and URL mismatches', async () => {
  await expectInvalid({
    ...validConfig,
    network: { ...validConfig.network, host: '0.0.0.0' },
  }, '$.network.host');
  await expectInvalid({
    ...validConfig,
    network: { ...validConfig.network, gamePort: 70_000 },
  }, '$.network.gamePort');
  await expectInvalid({
    ...validConfig,
    network: { ...validConfig.network, inspectionPort: 43100 },
  }, '$.network.inspectionPort');
  await expectInvalid({
    ...validConfig,
    game: { ...validConfig.game, url: 'http://127.0.0.1:9999/demos/town-study' },
  }, '$.game.url');
});

test('config rejects malformed JSON with one stable error', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'antiky-config-json-'));
  const path = join(directory, 'antiky.config.json');
  await writeFile(path, '{ not json }\n');

  await assert.rejects(
    () => loadAntikyConfig(path),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_CONFIG_INVALID'
      && error.path === '$'
    ),
  );
});
