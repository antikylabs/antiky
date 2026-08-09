import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
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
    'scripts/patch-brometal.mjs',
    'scripts/port-release.mjs',
    'scripts/port-release.test.mjs',
    'scripts/repository-policy.test.mjs',
  ]);
});

test('root package commands stay within the cross-workspace allowlist', async () => {
  const rootPackage = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(rootPackage.scripts).sort(), [
    'antiky',
    'build',
    'check',
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

test('published skills use valid, matching skill names', async () => {
  const skillsRoot = path.join(repositoryRoot, 'skills');
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillDirectories = entries.filter((entry) => entry.isDirectory());

  assert.ok(skillDirectories.length > 0);
  for (const directory of skillDirectories) {
    const skill = await readFile(path.join(skillsRoot, directory.name, 'SKILL.md'), 'utf8');
    assert.match(skill, /^---\nname: ([a-z0-9-]+)\ndescription: .+\n---\n/);
    assert.equal(skill.match(/^name: ([a-z0-9-]+)$/m)?.[1], directory.name);
  }
});
