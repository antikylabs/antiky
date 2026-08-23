import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
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

const installableAsset = Object.freeze({
  id: 'poly-haven:forest-floor',
  slug: 'forest-floor',
  name: 'Forest Floor',
  description: 'Forest material.',
  kind: 'texture',
  quality: 1,
  fileCount: 1,
  formats: ['jpg'],
  tags: ['forest'],
  categories: ['nature'],
  provider: { id: 'poly-haven', name: 'Poly Haven', url: 'https://polyhaven.com' },
  upstream: {
    id: 'forest_floor',
    url: 'https://polyhaven.com/a/forest_floor',
    filesHash: 'files-hash',
    retrievedAt: '2026-08-09T00:00:00.000Z',
  },
  preview: {
    url: '/previews/poly-haven/forest-floor.webp',
    sourceUrl: 'https://example.com/preview.png',
    width: 256,
    height: 256,
    hosting: 'local',
  },
  facts: {},
  downloads: [{
    path: 'forest_floor_diff_1k.jpg',
    format: 'jpg',
    size: 11,
    url: 'https://dl.polyhaven.org/forest.jpg',
    hash: { algorithm: 'md5', value: '0123456789abcdef0123456789abcdef' },
  }],
  license: {
    id: 'cc0-1.0',
    name: 'CC0 1.0 Universal',
    referenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    permitsModification: true,
    permitsRedistribution: true,
    requiresAttribution: false,
  },
  provenance: {
    creator: 'eye-candy.xyz',
    sourceUrl: 'https://polyhaven.com/a/forest_floor',
    retrievedAt: '2026-08-09T00:00:00.000Z',
    sourceHash: { algorithm: 'sha1', value: 'files-hash' },
  },
  attribution: { required: true, notice: 'Asset delivered through the Poly Haven API.' },
  verification: 'install-verified',
});

const primaryAssetUrl = 'https://assets.antikylabs.com/v1/assets/poly-haven/forest-floor.json';
const githubFallbackUrl = 'https://raw.githubusercontent.com/antikylabs/antiky/main/packages/asset-catalog/data/installable-assets.v1.json';

function primaryAssetResponse(asset: unknown = installableAsset): Response {
  return Response.json({
    version: 'v1',
    schemaVersion: 1,
    generatedAt: '2026-08-12T15:04:10.163Z',
    asset,
  });
}

test('antiky init help describes one non-interactive manifest command', async () => {
  const help = output();

  assert.equal(await runCli(['init', '--help'], help.io), 0);
  assert.match(help.stdout.join(''), /antiky init \[name\] \[--directory path\]/);
  assert.match(help.stdout.join(''), /creates one \.antiky project manifest/i);
});

test('antiky asset install resolves a catalog asset and validated project', async () => {
  const directory = await emptyProjectDirectory('asset-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const installed: Array<{ id: string; root: string }> = [];
  const result = output();

  assert.equal(await runCli([
    'asset', 'install', 'poly-haven:forest-floor', '--project', directory,
  ], result.io, {
    catalogFetcher: async () => primaryAssetResponse(),
    assetInstaller: async ({ asset, projectRoot }) => {
      installed.push({ id: asset.id, root: projectRoot });
      return { catalogId: asset.id, installedAt: '2026-08-09T00:00:00.000Z', files: [] };
    },
  }), 0);

  assert.deepEqual(installed, [{ id: 'poly-haven:forest-floor', root: await realpath(directory) }]);
  assert.match(result.stdout.join(''), /Installed poly-haven:forest-floor/);
});

test('antiky asset install rejects unknown catalog IDs', async () => {
  const directory = await emptyProjectDirectory('missing-asset-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  await assert.rejects(
    runCli(
      ['asset', 'install', 'poly-haven:missing', '--project', directory],
      output().io,
      { catalogFetcher: async () => new Response('not found', { status: 404 }) },
    ),
    expectCliError('ANTIKY_ASSET_NOT_FOUND'),
  );
});

test('antiky init uses the folder name and creates only the frozen manifest', async () => {
  const directory = await emptyProjectDirectory('harbor-lights');
  const expected = await readFile(
    new URL('project/fixtures/initialized-project.antiky', import.meta.url),
    'utf8',
  );
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

test('antiky asset install reads one record from the deployed catalog', async () => {
  const directory = await emptyProjectDirectory('hosted-asset-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const fetched: string[] = [];
  const installed: Array<{ id: string; root: string }> = [];
  const result = output();

  assert.equal(await runCli([
    'asset', 'install', 'poly-haven:forest-floor', '--project', directory,
  ], result.io, {
    catalogFetcher: async (input) => {
      fetched.push(String(input));
      return primaryAssetResponse();
    },
    assetInstaller: async ({ asset, projectRoot }) => {
      installed.push({ id: asset.id, root: projectRoot });
      return { catalogId: asset.id, installedAt: '2026-08-12T15:04:10.163Z', files: [] };
    },
  }), 0);

  assert.deepEqual(fetched, [primaryAssetUrl]);
  assert.deepEqual(installed, [{ id: installableAsset.id, root: await realpath(directory) }]);
  assert.match(result.stdout.join(''), /Installed poly-haven:forest-floor/u);
});

test('antiky asset install does not contact GitHub without explicit approval', async () => {
  const directory = await emptyProjectDirectory('declined-fallback-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const fetched: string[] = [];

  await assert.rejects(
    () => runCli([
      'asset', 'install', 'poly-haven:forest-floor', '--project', directory,
    ], output().io, {
      catalogFetcher: async (input) => {
        fetched.push(String(input));
        return new Response('unavailable', { status: 503 });
      },
    }),
    (error: unknown) => error instanceof AntikyCliError
      && error.code === 'ANTIKY_CATALOG_UNAVAILABLE'
      && error.message.includes('--allow-github-fallback'),
  );

  assert.deepEqual(fetched, [primaryAssetUrl]);
});

test('antiky asset install uses the GitHub raw fallback after explicit approval', async () => {
  const directory = await emptyProjectDirectory('approved-fallback-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const fetched: string[] = [];
  const installed: string[] = [];

  assert.equal(await runCli([
    'asset', 'install', 'poly-haven:forest-floor',
    '--project', directory,
    '--allow-github-fallback',
  ], output().io, {
    catalogFetcher: async (input) => {
      const url = String(input);
      fetched.push(url);
      if (url === primaryAssetUrl) throw new TypeError('simulated DNS failure');
      if (url === githubFallbackUrl) {
        return Response.json({
          version: 'v1',
          schemaVersion: 1,
          generatedAt: '2026-08-12T15:04:10.163Z',
          assets: [installableAsset],
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
    assetInstaller: async ({ asset }) => {
      installed.push(asset.id);
      return { catalogId: asset.id, installedAt: '2026-08-12T15:04:10.163Z', files: [] };
    },
  }), 0);

  assert.deepEqual(fetched, [primaryAssetUrl, githubFallbackUrl]);
  assert.deepEqual(installed, [installableAsset.id]);
});

test('antiky asset install does not use fallback for an unknown hosted asset', async () => {
  const directory = await emptyProjectDirectory('unknown-hosted-asset-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const fetched: string[] = [];

  await assert.rejects(
    () => runCli([
      'asset', 'install', 'poly-haven:forest-floor',
      '--project', directory,
      '--allow-github-fallback',
    ], output().io, {
      catalogFetcher: async (input) => {
        fetched.push(String(input));
        return new Response('not found', { status: 404 });
      },
    }),
    expectCliError('ANTIKY_ASSET_NOT_FOUND'),
  );

  assert.deepEqual(fetched, [primaryAssetUrl]);
});

test('antiky asset install rejects an invalid hosted record without falling back', async () => {
  const directory = await emptyProjectDirectory('invalid-hosted-asset-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const fetched: string[] = [];
  let installCount = 0;

  await assert.rejects(
    () => runCli([
      'asset', 'install', 'poly-haven:forest-floor',
      '--project', directory,
      '--allow-github-fallback',
    ], output().io, {
      catalogFetcher: async (input) => {
        fetched.push(String(input));
        return primaryAssetResponse({ ...installableAsset, id: 'poly-haven:different-asset' });
      },
      assetInstaller: async () => {
        installCount += 1;
        throw new Error('must not install');
      },
    }),
    expectCliError('ANTIKY_CATALOG_INVALID'),
  );

  assert.deepEqual(fetched, [primaryAssetUrl]);
  assert.equal(installCount, 0);
});

test('antiky studio validates and opens one explicit project without starting development', async () => {
  const directory = await emptyProjectDirectory('studio-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const manifestPath = join(directory, 'studio-project.antiky');
  const launched: string[] = [];
  const result = output();

  assert.equal(await runCli(['studio', '--project', manifestPath], result.io, {
    studioLauncher: async (path: string) => { launched.push(path); },
  }), 0);

  assert.deepEqual(launched, [await realpath(manifestPath)]);
  assert.match(result.stdout.join(''), /Opened .*studio-project\.antiky in Antiky Studio/u);
});

test('antiky studio accepts a positional project directory or manifest', async () => {
  const directory = await emptyProjectDirectory('positional-studio-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const manifestPath = join(directory, 'positional-studio-project.antiky');
  const canonicalManifestPath = await realpath(manifestPath);

  for (const target of [directory, manifestPath]) {
    const launched: string[] = [];
    assert.equal(await runCli(['studio', target], output().io, {
      studioLauncher: async (path: string) => { launched.push(path); },
    }), 0);
    assert.deepEqual(launched, [canonicalManifestPath]);
  }
});

test('antiky studio discovers the one project in the current directory', async () => {
  const directory = await emptyProjectDirectory('discovered-studio-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const launched: string[] = [];
  const previousDirectory = process.cwd();
  try {
    process.chdir(directory);
    assert.equal(await runCli(['studio'], output().io, {
      studioLauncher: async (path: string) => { launched.push(path); },
    }), 0);
  } finally {
    process.chdir(previousDirectory);
  }

  assert.deepEqual(launched, [await realpath(join(directory, 'discovered-studio-project.antiky'))]);
});

test('antiky studio rejects an invalid project before asking the OS to open Studio', async () => {
  const directory = await emptyProjectDirectory('invalid-studio-project');
  const manifestPath = join(directory, 'invalid-studio-project.antiky');
  await writeFile(manifestPath, '{}\n');
  let launches = 0;

  await assert.rejects(
    () => runCli(['studio', '--project', manifestPath], output().io, {
      studioLauncher: async () => { launches += 1; },
    }),
    expectCliError('ANTIKY_PROJECT_INVALID'),
  );
  assert.equal(launches, 0);
});

test('antiky studio accepts only one bounded project target', async () => {
  for (const args of [
    ['studio', '--project'],
    ['studio', '--project', 'one.antiky', '--project', 'two.antiky'],
    ['studio', 'one', 'two'],
    ['studio', 'one', '--project', 'two'],
    ['studio', '--unknown'],
  ]) {
    await assert.rejects(
      () => runCli(args),
      (error: unknown) => error instanceof AntikyCliError
        && error.code === 'ANTIKY_ARGUMENT_INVALID'
        && /antiky studio \[path \| --project path\]/.test(error.message),
    );
  }
});

test('antiky dev --open starts one project and opens its exact loopback game URL', async () => {
  const directory = await emptyProjectDirectory('open-game-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const manifestPath = join(directory, 'open-game-project.antiky');
  const opened: string[] = [];
  const started: string[] = [];
  const options = {
    developmentStarter: async (project: { manifestPath: string; network: {
      host: string;
      gamePort: number;
    } }) => {
      started.push(project.manifestPath);
      return {
        connection: {
          gameUrl: `http://${project.network.host}:${project.network.gamePort}/`,
        },
        stopped: Promise.resolve({ reason: 'normal', exitCode: 0 }),
      };
    },
    gameLauncher: async (url: string) => { opened.push(url); },
  } as unknown as Parameters<typeof runCli>[2];

  assert.equal(await runCli([
    'dev', '--open', '--project', manifestPath,
  ], output().io, options), 0);
  assert.deepEqual(started, [await realpath(manifestPath)]);
  assert.deepEqual(opened, ['http://127.0.0.1:3010/']);
});

test('antiky dev --open stops a started session when the browser cannot open', async () => {
  const directory = await emptyProjectDirectory('failed-open-game-project');
  assert.equal(await runCli(['init', '--directory', directory], output().io), 0);
  const stopped: Array<{ reason: string; exitCode: number }> = [];
  const options = {
    developmentStarter: async () => ({
      stopped: new Promise(() => {}),
      stop: async (reason: string, exitCode: number) => {
        stopped.push({ reason, exitCode });
        return { reason, exitCode };
      },
    }),
    gameLauncher: async () => {
      throw new AntikyCliError('ANTIKY_GAME_LAUNCH_FAILED', 'Could not open game.');
    },
  } as unknown as Parameters<typeof runCli>[2];

  await assert.rejects(
    () => runCli(['dev', '--open', '--project', directory], output().io, options),
    expectCliError('ANTIKY_GAME_LAUNCH_FAILED'),
  );
  assert.deepEqual(stopped, [{ reason: 'start-failure', exitCode: 1 }]);
});

test('antiky dev rejects duplicate and unknown launch options before starting', async () => {
  for (const args of [
    ['dev', '--open', '--open'],
    ['dev', '--project'],
    ['dev', '--project', 'one.antiky', '--project', 'two.antiky'],
    ['dev', '--unknown'],
  ]) {
    await assert.rejects(
      () => runCli(args),
      (error: unknown) => error instanceof AntikyCliError
        && error.code === 'ANTIKY_ARGUMENT_INVALID'
        && /antiky dev \[--open\] \[--project path\]/.test(error.message),
    );
  }
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
