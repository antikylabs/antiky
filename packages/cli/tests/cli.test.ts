import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { ID_KINDS, isUuidV7 } from '@antiky/framework';

import { AntikyCliError } from '../src/errors.ts';
// @ts-ignore direct TypeScript source import for the Node strip-types runner
import { runCli } from '../src/cli.ts';

function output() {
  const stdout: string[] = [];
  return {
    stdout,
    io: { stdout: (text: string) => stdout.push(text), stderr: () => {} },
  };
}

async function emptyProjectDirectory(name: string): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), 'antiky-cli-init-'));
  const directory = join(parent, name);
  await mkdir(directory);
  return directory;
}

function expectCliError(code: string) {
  return (error: unknown): boolean => {
    assert.ok(error instanceof AntikyCliError);
    assert.equal(error.code, code);
    return true;
  };
}

test('antiky init help describes one non-interactive manifest command', async () => {
  const help = output();

  assert.equal(await runCli(['init', '--help'], help.io), 0);
  assert.match(help.stdout.join(''), /antiky init \[name\] \[--directory path\]/);
  assert.match(help.stdout.join(''), /creates one \.antiky project manifest/i);
});

test('antiky init uses the folder name and creates only the frozen manifest', async () => {
  const directory = await emptyProjectDirectory('harbor-lights');
  const expected = await readFile(new URL('fixtures/initialized-project.antiky', import.meta.url), 'utf8');
  const result = output();

  assert.equal(await runCli(['init', '--directory', directory], result.io), 0);

  const manifestPath = join(directory, 'harbor-lights.antiky');
  assert.deepEqual(await readdir(directory), ['harbor-lights.antiky']);
  assert.equal(await readFile(manifestPath, 'utf8'), expected);
  assert.equal((await stat(manifestPath)).isFile(), true);
  assert.match(result.stdout.join(''), /Created .*harbor-lights\.antiky/);
  assert.match(result.stdout.join(''), /antiky dev/);
  assert.match(result.stdout.join(''), /Antiky Studio/);
});

test('antiky init keeps a Unicode display name and normalizes its file slug', async () => {
  const directory = await emptyProjectDirectory('existing-game');

  assert.equal(await runCli([
    'init',
    'Crème Brûlée',
    '--directory', directory,
  ], output().io), 0);

  const path = join(directory, 'creme-brulee.antiky');
  assert.deepEqual(await readdir(directory), ['creme-brulee.antiky']);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).name, 'Crème Brûlée');
});

test('antiky init never replaces the same or a differently named project', async () => {
  const initialized = await emptyProjectDirectory('First Project');
  assert.equal(await runCli(['init', '--directory', initialized], output().io), 0);
  const manifestPath = join(initialized, 'first-project.antiky');
  const before = await readFile(manifestPath, 'utf8');

  await assert.rejects(
    () => runCli(['init', '--directory', initialized]),
    expectCliError('ANTIKY_PROJECT_EXISTS'),
  );
  assert.equal(await readFile(manifestPath, 'utf8'), before);
  assert.deepEqual(await readdir(initialized), ['first-project.antiky']);

  const existing = await emptyProjectDirectory('Another Project');
  await writeFile(join(existing, 'already-here.antiky'), 'keep this exact content\n');
  await assert.rejects(
    () => runCli(['init', 'New Name', '--directory', existing]),
    expectCliError('ANTIKY_PROJECT_EXISTS'),
  );
  assert.equal(await readFile(join(existing, 'already-here.antiky'), 'utf8'), 'keep this exact content\n');
  assert.deepEqual(await readdir(existing), ['already-here.antiky']);
});

test('antiky init returns stable errors for unsafe names and invalid targets', async () => {
  const directory = await emptyProjectDirectory('valid-target');
  for (const name of ['../escape', 'bad\\path', '東京']) {
    await assert.rejects(
      () => runCli(['init', name, '--directory', directory]),
      expectCliError('ANTIKY_PROJECT_NAME_INVALID'),
    );
  }
  assert.deepEqual(await readdir(directory), []);

  const parent = await mkdtemp(join(tmpdir(), 'antiky-cli-init-target-'));
  const file = join(parent, 'not-a-directory');
  await writeFile(file, 'unchanged\n');
  await assert.rejects(
    () => runCli(['init', '--directory', file]),
    expectCliError('ANTIKY_PROJECT_DIRECTORY_INVALID'),
  );
  await assert.rejects(
    () => runCli(['init', '--directory', join(parent, 'missing')]),
    expectCliError('ANTIKY_PROJECT_DIRECTORY_INVALID'),
  );
  assert.equal(await readFile(file, 'utf8'), 'unchanged\n');
});

test('antiky init reports a create failure and leaves an unwritable target unchanged', async () => {
  const directory = await emptyProjectDirectory('read-only-project');
  await chmod(directory, 0o555);
  try {
    await assert.rejects(
      () => runCli(['init', '--directory', directory]),
      expectCliError('ANTIKY_PROJECT_CREATE_FAILED'),
    );
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await chmod(directory, 0o755);
  }
});

test('antiky generate id uses the framework generator for every supported kind', async () => {
  for (const kind of ID_KINDS) {
    const plain = output();
    assert.equal(await runCli(['generate', 'id', kind], plain.io), 0);
    assert.equal(plain.stdout.length, 1);
    assert.equal(isUuidV7(plain.stdout[0]?.trim()), true);

    const json = output();
    assert.equal(await runCli(['generate', 'id', kind, '--json'], json.io), 0);
    const value = JSON.parse(json.stdout[0]!) as { kind: string; id: string };
    assert.deepEqual(Object.keys(value), ['kind', 'id']);
    assert.equal(value.kind, kind);
    assert.equal(isUuidV7(value.id), true);
  }
});

test('antiky generate id rejects unknown kinds and options with usage', async () => {
  for (const args of [
    ['generate', 'id', 'player'],
    ['generate', 'id', 'world', '--yaml'],
    ['generate', 'world'],
  ]) {
    await assert.rejects(
      () => runCli(args),
      (error: unknown) => (
        error instanceof AntikyCliError
        && error.code === 'ANTIKY_ARGUMENT_INVALID'
        && /antiky generate id/.test(error.message)
      ),
    );
  }
});

test('an unexpected CLI failure emits a safe diagnostic and a bounded public error', async () => {
  const diagnostics: unknown[] = [];

  await assert.rejects(
    () => runCli(['generate', 'id', 'world'], {
      stdout: () => { throw new Error('credential=must-not-leak'); },
      stderr: () => {},
    }, {
      diagnosticSink: (event: unknown) => diagnostics.push(event),
    }),
    (error: unknown) => (
      error instanceof AntikyCliError
      && error.code === 'ANTIKY_INTERNAL_ERROR'
      && error.message === 'The Antiky CLI failed unexpectedly.'
      && !error.message.includes('must-not-leak')
    ),
  );
  assert.deepEqual(diagnostics, [{
    schemaVersion: 1,
    level: 'error',
    code: 'ANTIKY_CLI_FAILED',
    component: 'cli',
  }]);
});

test('antiky migrate creates an explicitly named project and normal commands reject --config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'antiky-cli-migrate-'));
  const configPath = join(directory, 'antiky.config.json');
  const outputPath = join(directory, 'sample.antiky');
  await writeFile(configPath, `${JSON.stringify({
    schemaVersion: 1,
    game: {
      command: ['node', 'game.mjs'],
      shaderCommand: ['node', 'shaders.mjs'],
      workingDirectory: '.',
      url: 'http://127.0.0.1:43100/',
      viewport: { width: 960, height: 540 },
    },
    network: { host: '127.0.0.1', gamePort: 43100, inspectionPort: 43101 },
  }, null, 2)}\n`);

  const migrated = output();
  assert.equal(await runCli([
    'migrate',
    '--config', configPath,
    '--output', outputPath,
    '--name', 'Sample Project',
  ], migrated.io), 0);
  assert.match(migrated.stdout.join(''), /Created .*sample\.antiky/u);
  assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).name, 'Sample Project');

  await assert.rejects(
    () => runCli(['inspect', '--config', configPath]),
    (error: unknown) => error instanceof AntikyCliError
      && error.code === 'ANTIKY_ARGUMENT_INVALID',
  );
});
