import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const execute = promisify(execFile);
const sources = Promise.all([
  readFile(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8'),
  readFile(resolve(repositoryRoot, '.github/workflows/release.yml'), 'utf8'),
  readFile(resolve(repositoryRoot, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/studio/tauri/package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/studio/tauri/tauri.conf.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/framework/package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/cli/package.json'), 'utf8').then(JSON.parse),
]);

const expectedRepository = 'git+https://github.com/antikylabs/antiky.git';

async function trackedWorkspacePackages() {
  const { stdout } = await execute('git', ['ls-files', 'packages'], { cwd: repositoryRoot });
  const packagePaths = stdout
    .trim()
    .split('\n')
    .filter((path) => path.endsWith('/package.json'));
  return Promise.all(packagePaths.map(async (path) => (
    JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'))
  )));
}

function assertPackageMetadata(manifest, directory, version) {
  assert.equal(manifest.private, false);
  assert.equal(manifest.version, version);
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(manifest.files, ['dist', 'README.md', 'LICENSE.md']);
  assert.deepEqual(manifest.publishConfig, {
    access: 'public',
    registry: 'https://registry.npmjs.org/',
  });
  assert.deepEqual(manifest.repository, {
    type: 'git',
    url: expectedRepository,
    directory,
  });
  assert.equal(manifest.bugs.url, 'https://github.com/antikylabs/antiky/issues');
  assert.equal(manifest.engines.node, '>=22');
  assert.equal(manifest.scripts.build, 'tsc -b tsconfig.build.json');
  assert.equal(manifest.scripts.prepack, 'npm run build');
  assert.equal(manifest.types, './dist/index.d.ts');
}

async function packWorkspace(workspace, destination) {
  const { stdout } = await execute('npm', [
    'pack',
    '--workspace', workspace,
    '--pack-destination', destination,
    '--json',
  ], { cwd: repositoryRoot, maxBuffer: 10 * 1024 * 1024 });
  const jsonStart = stdout.lastIndexOf('\n[');
  const [result] = JSON.parse(stdout.slice(jsonStart < 0 ? 0 : jsonStart + 1));
  assert.equal(result.name, workspace);
  return Object.freeze({
    ...result,
    tarball: resolve(destination, result.filename),
  });
}

function assertCompiledPackage(pack, requiredPaths) {
  const paths = pack.files.map((file) => file.path).sort();
  for (const requiredPath of requiredPaths) assert.ok(paths.includes(requiredPath), requiredPath);
  for (const path of paths) {
    assert.ok(
      ['LICENSE.md', 'README.md', 'package.json'].includes(path)
        || /^dist\/.+\.(?:js|d\.ts)$/u.test(path),
      `${pack.name} contains unexpected package file: ${path}`,
    );
  }
  assert.ok(paths.every((path) => !path.startsWith('src/')));
  assert.ok(paths.every((path) => !path.startsWith('tests/')));
}

function workflowJob(workflow, name) {
  const start = workflow.indexOf(`  ${name}:\n`);
  assert.notEqual(start, -1, `missing workflow job: ${name}`);
  const nextJob = workflow.slice(start + 1).search(/\n  [a-z][a-z0-9-]*:\n/u);
  return nextJob < 0
    ? workflow.slice(start)
    : workflow.slice(start, start + 1 + nextJob);
}

test('CI checks the synchronized version and uploads an arm64 Studio package', async () => {
  const [ci] = await sources;

  assert.match(ci, /pull_request:/);
  assert.match(ci, /branches: \[main\]/);
  assert.match(ci, /permissions:\n  contents: read/);
  assert.match(ci, /runs-on: macos-latest/);
  assert.match(ci, /actions\/checkout@v7\n\s+with:\n\s+lfs: true/);
  assert.match(ci, /actions\/setup-node@v6/);
  assert.match(ci, /node-version: 24\.19\.0/);
  assert.match(ci, /npm ci/);
  assert.match(ci, /npm run version:check/);
  assert.match(ci, /npm run check/);
  assert.match(ci, /npm run prepare:ghostty --workspace @antiky\/studio-tauri/);
  assert.match(ci, /npm run prepare:resources --workspace @antiky\/studio-tauri/);
  assert.match(ci, /tauri-apps\/tauri-action@v1/);
  assert.match(ci, /projectPath: packages\/studio\/tauri/);
  assert.match(ci, /args: --target aarch64-apple-darwin/);
  assert.match(ci, /uploadWorkflowArtifacts: true/);
  assert.doesNotMatch(ci, /contents: write/);
});

test('release automation is tag-gated, validates the tag first, and creates a draft', async () => {
  const [, release] = await sources;
  const studioJob = workflowJob(release, 'release-studio');

  assert.match(release, /tags: \['v\*\.\*\.\*'\]/);
  assert.match(release, /permissions:\n  contents: read/);
  assert.match(studioJob, /permissions:\n\s+contents: write/);
  assert.match(studioJob, /runs-on: macos-latest/);
  assert.match(studioJob, /actions\/checkout@v7\n\s+with:\n\s+lfs: true/);
  assert.ok(
    studioJob.indexOf('npm run release:check') < studioJob.indexOf('tauri-apps/tauri-action@v1'),
    'the release tag must be checked before any release can be created',
  );
  assert.match(studioJob, /npm run prepare:ghostty --workspace @antiky\/studio-tauri/);
  assert.match(studioJob, /npm run prepare:resources --workspace @antiky\/studio-tauri/);
  assert.match(studioJob, /tagName: v__VERSION__/);
  assert.match(studioJob, /releaseDraft: true/);
  assert.match(studioJob, /generateReleaseNotes: true/);
  assert.match(studioJob, /projectPath: packages\/studio\/tauri/);
  assert.match(studioJob, /args: --target aarch64-apple-darwin/);
});

test('release publishes Framework before CLI through npm trusted publishing', async () => {
  const [, release] = await sources;
  const frameworkJob = workflowJob(release, 'publish-framework');
  const cliJob = workflowJob(release, 'publish-cli');

  for (const job of [frameworkJob, cliJob]) {
    assert.match(job, /runs-on: ubuntu-latest/);
    assert.match(job, /permissions:\n\s+contents: read\n\s+id-token: write/);
    assert.match(job, /actions\/checkout@v7/);
    assert.match(job, /actions\/setup-node@v6/);
    assert.match(job, /node-version: 24\.19\.0/);
    assert.match(job, /registry-url: https:\/\/registry\.npmjs\.org/);
    assert.match(job, /package-manager-cache: false/);
    assert.match(job, /npm ci/);
    assert.match(job, /npm run release:check/);
    assert.ok(
      job.indexOf('npm run release:check') < job.indexOf('npm publish'),
      'the release tag must be checked before npm publication',
    );
  }
  assert.match(frameworkJob, /needs: release-studio/);
  assert.match(frameworkJob, /npm publish --workspace @antiky\/framework --access public/);
  assert.match(cliJob, /needs: publish-framework/);
  assert.match(cliJob, /npm publish --workspace @antiky\/cli --access public/);
  assert.doesNotMatch(release, /NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.NPM/u);
});

test('local package commands build both ad-hoc-signed macOS bundle formats', async () => {
  const [, , rootPackage, tauriPackage, tauriConfig] = await sources;

  assert.equal(rootPackage.scripts['version:check'], 'node scripts/release-version.mjs check');
  assert.equal(rootPackage.scripts['version:set'], 'node scripts/release-version.mjs set');
  assert.equal(rootPackage.scripts['release:check'], 'node scripts/release-version.mjs check-tag');
  assert.equal(
    rootPackage.scripts['package:studio'],
    'npm run build --workspace @antiky/studio-tauri',
  );
  assert.equal(tauriPackage.scripts.tauri, 'tauri');
  assert.equal(tauriPackage.scripts.build, 'tauri build');
  assert.deepEqual(tauriConfig.bundle.targets, ['app', 'dmg']);
  assert.equal(tauriConfig.bundle.macOS.signingIdentity, '-');
});

test('only Framework and CLI are configured as public npm packages', async () => {
  const [, , rootPackage, , , frameworkPackage, cliPackage] = await sources;
  const packages = await trackedWorkspacePackages();
  const publishable = packages
    .filter((manifest) => manifest.private === false)
    .map((manifest) => manifest.name)
    .sort();

  assert.deepEqual(publishable, ['@antiky/cli', '@antiky/framework']);
  assertPackageMetadata(frameworkPackage, 'packages/framework', rootPackage.version);
  assertPackageMetadata(cliPackage, 'packages/cli', rootPackage.version);
  assert.equal(rootPackage.private, true);
  assert.equal(frameworkPackage.exports['.'].import, './dist/index.js');
  assert.equal(frameworkPackage.exports['.'].types, './dist/index.d.ts');
  assert.equal(frameworkPackage.exports['./render-driver'].import, './dist/render/brometal-driver.js');
  assert.equal(cliPackage.bin.antiky, './dist/bin.js');
  assert.equal(cliPackage.exports['.'].import, './dist/index.js');
  assert.equal(cliPackage.exports['./development'].import, './dist/development/index.js');
  assert.equal(cliPackage.dependencies['@antiky/framework'], cliPackage.version);
  assert.equal(cliPackage.dependencies['@types/node'], '^22.15.0');
});

test('npm tarballs install and run without TypeScript source', { timeout: 120_000 }, async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'antiky-npm-smoke-'));
  const tarballDirectory = join(temporaryRoot, 'tarballs');
  const consumerDirectory = join(temporaryRoot, 'consumer');
  await mkdir(tarballDirectory);
  await mkdir(consumerDirectory);

  try {
    const frameworkPack = await packWorkspace('@antiky/framework', tarballDirectory);
    const cliPack = await packWorkspace('@antiky/cli', tarballDirectory);
    assertCompiledPackage(frameworkPack, [
      'dist/index.d.ts',
      'dist/index.js',
      'dist/game/contract.js',
      'dist/game/host.js',
      'dist/render/brometal-driver.js',
    ]);
    assertCompiledPackage(cliPack, [
      'dist/bin.js',
      'dist/development/index.js',
      'dist/index.d.ts',
      'dist/index.js',
      'dist/project/index.js',
      'dist/studio/worker.js',
    ]);

    await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({
      name: 'antiky-package-smoke-consumer',
      private: true,
      type: 'module',
    }));
    await execute('npm', [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      frameworkPack.tarball,
      cliPack.tarball,
    ], { cwd: consumerDirectory, timeout: 120_000 });

    await execute('node', [
      '--input-type=module',
      '--eval',
      [
        "import { createWorldId, isUuidV7 } from '@antiky/framework';",
        "await import('@antiky/framework/game');",
        "await import('@antiky/framework/contract');",
        "await import('@antiky/cli/development');",
        "await import('@antiky/cli/project');",
        "if (!isUuidV7(createWorldId())) throw new Error('Framework package returned an invalid ID.');",
      ].join('\n'),
    ], { cwd: consumerDirectory });

    const binary = resolve(consumerDirectory, 'node_modules/.bin/antiky');
    const { stdout } = await execute(binary, ['init', '--help'], { cwd: consumerDirectory });
    assert.match(stdout, /Usage:\n  antiky init \[name\] \[--directory path\]/u);

    const consumerSource = join(consumerDirectory, 'consumer.ts');
    await writeFile(consumerSource, [
      "import { createWorldId, type WorldId } from '@antiky/framework';",
      "import type { CliIo } from '@antiky/cli';",
      "import type { DevelopmentClient } from '@antiky/cli/development';",
      'const worldId: WorldId = createWorldId();',
      'const cliIo: CliIo | undefined = undefined;',
      'const client: DevelopmentClient | undefined = undefined;',
      'void worldId;',
      'void cliIo;',
      'void client;',
    ].join('\n'));
    await execute(process.execPath, [
      resolve(repositoryRoot, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--module', 'NodeNext',
      '--moduleResolution', 'NodeNext',
      '--target', 'ES2022',
      '--lib', 'ES2022,DOM,DOM.Iterable',
      consumerSource,
    ], { cwd: consumerDirectory });
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
