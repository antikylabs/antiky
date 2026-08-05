import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

test('slice-specific verification code stays with its objective', async () => {
  const violations = [];
  for (const directory of [path.join(root, 'packages'), path.join(root, 'scripts')]) {
    const entries = await readdir(directory, { recursive: true }).catch(() => []);
    for (const entry of entries) {
      if (/slice-\d+/i.test(entry)) {
        violations.push(path.relative(root, path.join(directory, entry)));
      }
    }
  }

  assert.deepEqual(violations.sort(), []);
});

test('shared verification systems have stable general-purpose homes', async () => {
  await Promise.all([
    'scripts/verification/browser.mjs',
    'scripts/verification/evidence.mjs',
    'scripts/verification/runtime.mjs',
    'scripts/verification/webgpu-probe.mjs',
  ].map((file) => access(path.join(root, file))));
});

test('slice verification commands point into their objective folders', async () => {
  const rootPackage = await import(path.join(root, 'package.json'), { with: { type: 'json' } });

  assert.match(
    rootPackage.default.scripts['verify:slice-00'],
    /docs\/objectives\/antiky-town\/slice-00\/verification\/verify\.mjs$/,
  );
  assert.match(
    rootPackage.default.scripts['verify:slice-01'],
    /docs\/objectives\/antiky-town\/slice-01\/verification\/verify\.mjs$/,
  );
});

test('product package metadata does not know the slice schedule', async () => {
  const packageRoot = path.join(root, 'packages');
  const violations = [];
  for (const workspace of await readdir(packageRoot, { withFileTypes: true })) {
    if (!workspace.isDirectory()) continue;
    const packageFile = path.join(packageRoot, workspace.name, 'package.json');
    const packageJson = await import(packageFile, { with: { type: 'json' } }).catch(() => null);
    for (const [name, command] of Object.entries(packageJson?.default.scripts ?? {})) {
      if (/slice-\d+/i.test(`${name} ${command}`)) {
        violations.push(`${path.relative(root, packageFile)}#scripts.${name}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
