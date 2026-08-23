import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  setRepositoryVersion,
  validateRepositoryVersion,
} from '../release-version.mjs';

async function writeJson(root, path, value) {
  const destination = join(root, path);
  await mkdir(join(destination, '..'), { recursive: true });
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, path) {
  return JSON.parse(await readFile(join(root, path), 'utf8'));
}

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'antiky-version-'));
  await Promise.all([
    writeJson(root, 'package.json', {
      name: 'antiky',
      version: '0.0.0',
      private: true,
      workspaces: ['packages/core', 'packages/tools/*'],
    }),
    writeJson(root, 'packages/core/package.json', {
      name: '@antiky/core',
      version: '0.0.0',
      dependencies: {
        '@antiky/tool': '0.0.0',
        external: '^4.0.0',
      },
    }),
    writeJson(root, 'packages/tools/tool/package.json', {
      name: '@antiky/tool',
      version: '0.0.0',
      private: true,
    }),
    writeJson(root, 'package-lock.json', {
      name: 'antiky',
      version: '0.0.0',
      lockfileVersion: 3,
      packages: {
        '': { name: 'antiky', version: '0.0.0' },
        'packages/core': {
          name: '@antiky/core',
          version: '0.0.0',
          dependencies: { '@antiky/tool': '0.0.0', external: '^4.0.0' },
        },
        'packages/tools/tool': {
          name: '@antiky/tool',
          version: '0.0.0',
        },
      },
    }),
    writeJson(root, 'packages/studio/tauri/tauri.conf.json', {
      productName: 'Antiky Studio',
      version: '0.0.0',
    }),
  ]);
  await mkdir(join(root, 'packages/studio/tauri'), { recursive: true });
  await Promise.all([
    writeFile(
      join(root, 'packages/studio/tauri/Cargo.toml'),
      '[package]\nname = "antiky-studio"\nversion = "0.0.0"\nedition = "2024"\n',
      'utf8',
    ),
    writeFile(
      join(root, 'packages/studio/tauri/Cargo.lock'),
      'version = 4\n\n[[package]]\nname = "antiky-studio"\nversion = "0.0.0"\n',
      'utf8',
    ),
  ]);
  return root;
}

test('setting a release version synchronizes npm, Tauri, Cargo, and internal dependency records', async () => {
  const root = await createFixture();
  try {
    const result = await setRepositoryVersion(root, '1.2.3');
    const [rootPackage, corePackage, lock, tauriConfig, cargo, cargoLock] = await Promise.all([
      readJson(root, 'package.json'),
      readJson(root, 'packages/core/package.json'),
      readJson(root, 'package-lock.json'),
      readJson(root, 'packages/studio/tauri/tauri.conf.json'),
      readFile(join(root, 'packages/studio/tauri/Cargo.toml'), 'utf8'),
      readFile(join(root, 'packages/studio/tauri/Cargo.lock'), 'utf8'),
    ]);

    assert.deepEqual(result, { version: '1.2.3', packageCount: 3 });
    assert.equal(rootPackage.version, '1.2.3');
    assert.equal(corePackage.version, '1.2.3');
    assert.equal(corePackage.dependencies['@antiky/tool'], '1.2.3');
    assert.equal(corePackage.dependencies.external, '^4.0.0');
    assert.equal(lock.version, '1.2.3');
    assert.equal(lock.packages['packages/core'].version, '1.2.3');
    assert.equal(lock.packages['packages/core'].dependencies['@antiky/tool'], '1.2.3');
    assert.equal(tauriConfig.version, '1.2.3');
    assert.match(cargo, /version = "1\.2\.3"/);
    assert.match(cargoLock, /name = "antiky-studio"\nversion = "1\.2\.3"/);
    await validateRepositoryVersion(root, 'v1.2.3');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('version validation rejects a mismatched release tag and one drifting workspace', async () => {
  const root = await createFixture();
  try {
    await assert.rejects(validateRepositoryVersion(root, 'v9.9.9'), /tag v9\.9\.9/);
    const tool = await readJson(root, 'packages/tools/tool/package.json');
    tool.version = '2.0.0';
    await writeJson(root, 'packages/tools/tool/package.json', tool);
    await assert.rejects(
      validateRepositoryVersion(root),
      /packages\/tools\/tool\/package\.json has version 2\.0\.0/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
