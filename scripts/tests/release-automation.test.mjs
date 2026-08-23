import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const sources = Promise.all([
  readFile(resolve(repositoryRoot, '.github/workflows/ci.yml'), 'utf8'),
  readFile(resolve(repositoryRoot, '.github/workflows/release.yml'), 'utf8'),
  readFile(resolve(repositoryRoot, 'package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/studio/tauri/package.json'), 'utf8').then(JSON.parse),
  readFile(resolve(repositoryRoot, 'packages/studio/tauri/tauri.conf.json'), 'utf8').then(JSON.parse),
]);

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

  assert.match(release, /tags: \['v\*\.\*\.\*'\]/);
  assert.match(release, /permissions:\n  contents: write/);
  assert.match(release, /runs-on: macos-latest/);
  assert.match(release, /actions\/checkout@v7\n\s+with:\n\s+lfs: true/);
  assert.ok(
    release.indexOf('npm run release:check') < release.indexOf('tauri-apps/tauri-action@v1'),
    'the release tag must be checked before any release can be created',
  );
  assert.match(release, /npm run prepare:ghostty --workspace @antiky\/studio-tauri/);
  assert.match(release, /npm run prepare:resources --workspace @antiky\/studio-tauri/);
  assert.match(release, /tagName: v__VERSION__/);
  assert.match(release, /releaseDraft: true/);
  assert.match(release, /generateReleaseNotes: true/);
  assert.match(release, /projectPath: packages\/studio\/tauri/);
  assert.match(release, /args: --target aarch64-apple-darwin/);
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
