import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const packageRoot = path.resolve(import.meta.dirname, '..');

test('resources site consumes the shared asset catalog', async () => {
  const packageManifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const page = await readFile(path.join(packageRoot, 'src/app/page.tsx'), 'utf8');

  assert.equal(packageManifest.dependencies['@antiky/asset-catalog'], '0.0.0');
  assert.match(page, /from '@antiky\/asset-catalog'/);
});
