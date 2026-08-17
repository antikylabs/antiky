import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '../..');

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

test('test files live in a tests directory', async () => {
  const tracked = await git(['ls-files']);
  const testFiles = tracked.split('\n').filter((file) => (
    /(?:^|\/)[^/]+\.(?:test|spec)\.[^.]+$/.test(file)
  ));
  const violations = testFiles.filter((file) => !file.split('/').includes('tests'));
  assert.deepEqual(violations, []);
});

test('package domains use hierarchy instead of repeated filename prefixes', async () => {
  const tracked = await git(['ls-files', 'packages']);
  const prefixGroups = new Map();

  for (const file of tracked.split('\n')) {
    if (file.includes('/.agents/')) continue;
    if (file.includes('.shader.')) continue;
    if (file.includes('.gen.')) continue;

    const extension = path.extname(file);
    if (!['.ts', '.tsx', '.mjs'].includes(extension)) continue;

    const stem = path.basename(file, extension).replace(/\.(?:test|spec)$/, '');
    const separator = stem.indexOf('-');
    if (separator < 0) continue;

    const key = `${path.dirname(file)}/${stem.slice(0, separator)}`;
    const group = prefixGroups.get(key) ?? [];
    group.push(file);
    prefixGroups.set(key, group);
  }

  const violations = Array.from(prefixGroups.values())
    .filter((files) => files.length > 1)
    .flat()
    .sort();
  assert.deepEqual(violations, []);
});

test('repository-level scripts stay within the owned allowlist', async () => {
  const tracked = await git(['ls-files', 'scripts']);
  assert.deepEqual(tracked.split('\n'), [
    'scripts/dev.mjs',
    'scripts/frame-stats.mjs',
    'scripts/motion-stats.mjs',
    'scripts/patch-brometal.mjs',
    'scripts/patch-brometal/attribute-buffer-defects.mjs',
    'scripts/patch-brometal/discard.mjs',
    'scripts/patch-brometal/offscreen-multisampling.mjs',
    'scripts/patch-brometal/present.mjs',
    'scripts/patch-brometal/render-target-filtering.mjs',
    'scripts/patch-brometal/sampler-lod-clamp.mjs',
    'scripts/patch-brometal/target-readback.mjs',
    'scripts/patch-brometal/texture-array-sampler.mjs',
    'scripts/patch-brometal/webgpu-perspective-depth.mjs',
    'scripts/port-release.mjs',
    'scripts/shoot-demos.mjs',
    'scripts/tests/brometal-readback.test.mjs',
    'scripts/tests/frame-stats.test.mjs',
    'scripts/tests/motion-stats.test.mjs',
    'scripts/tests/patch-brometal.test.mjs',
    'scripts/tests/port-release.test.mjs',
    'scripts/tests/repository-policy.test.mjs',
    'scripts/tests/runtime-patches.test.mjs',
    'scripts/tests/shoot-demos.test.mjs',
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
    'test:gpu',
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
