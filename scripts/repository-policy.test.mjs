import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..');

async function git(args) {
  const { stdout } = await execute('git', args, { cwd: repositoryRoot });
  return stdout.trim();
}

test('objective run evidence is never tracked', async () => {
  const tracked = await git(['ls-files']);
  const violations = tracked.split('\n').filter((file) => (
    /^docs\/objectives\/.+\/(?:outputs|verification)\//.test(file)
  ));
  assert.deepEqual(violations, []);
});

test('repository-level scripts stay within the owned allowlist', async () => {
  const tracked = await git(['ls-files', 'scripts']);
  assert.deepEqual(tracked.split('\n'), [
    'scripts/dev.mjs',
    'scripts/frame-stats.mjs',
    'scripts/frame-stats.test.mjs',
    'scripts/motion-stats.mjs',
    'scripts/motion-stats.test.mjs',
    'scripts/patch-brometal.mjs',
    'scripts/patch-brometal.test.mjs',
    'scripts/patch-brometal/attribute-buffer-defects.mjs',
    'scripts/patch-brometal/discard.mjs',
    'scripts/patch-brometal/offscreen-multisampling.mjs',
    'scripts/patch-brometal/present.mjs',
    'scripts/patch-brometal/render-target-filtering.mjs',
    'scripts/patch-brometal/sampler-lod-clamp.mjs',
    'scripts/port-release.mjs',
    'scripts/port-release.test.mjs',
    'scripts/repository-policy.test.mjs',
    'scripts/shoot-demos.mjs',
    'scripts/shoot-demos.test.mjs',
  ]);
});

test('root package commands stay within the cross-workspace allowlist', async () => {
  const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(rootPackage.scripts).sort(), [
    'antiky',
    'build',
    'check',
    'demos:shoot',
    'demos:verify',
    'dev',
    'dev:demos',
    'dev:framework',
    'dev:studio',
    'dev:studio:web',
    'dev:website',
    'docs:api',
    'docs:api:check',
    'portRelease',
    'postinstall',
    'test',
    'typecheck',
  ]);
});

test('PNG, JPEG, and JPG files use valid Git LFS pointers', async () => {
  const attributes = await readFile(path.join(repositoryRoot, '.gitattributes'), 'utf8');
  assert.match(attributes, /^\*\.png filter=lfs diff=lfs merge=lfs -text$/m);
  assert.match(attributes, /^\*\.jpeg filter=lfs diff=lfs merge=lfs -text$/m);
  assert.match(attributes, /^\*\.jpg filter=lfs diff=lfs merge=lfs -text$/m);
  await execute('git', ['lfs', 'fsck', '--pointers'], { cwd: repositoryRoot });
});
