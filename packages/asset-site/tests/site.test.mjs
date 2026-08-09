import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const packageRoot = path.resolve(import.meta.dirname, '..');

test('asset-site is a shared UI package with no independently deployed Next application', async () => {
  const packageManifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const publicModule = await readFile(path.join(packageRoot, 'src/public.ts'), 'utf8');
  const catalog = await readFile(path.join(packageRoot, 'src/components/AssetCatalog.tsx'), 'utf8');
  const detail = await readFile(path.join(packageRoot, 'src/components/AssetDetail.tsx'), 'utf8');
  const styles = await readFile(path.join(packageRoot, 'src/assets.css'), 'utf8');

  assert.equal(packageManifest.name, '@antiky/asset-site');
  assert.equal(packageManifest.dependencies['@antiky/asset-catalog'], '0.0.0');
  assert.deepEqual(Object.keys(packageManifest.scripts).sort(), ['test', 'typecheck']);
  assert.match(publicModule, /AssetCatalog/);
  assert.match(publicModule, /AssetDetail/);
  assert.match(catalog, /window\.location\.search/);
  assert.doesNotMatch(catalog, /useSearchParams/);
  assert.match(detail, /Complete catalog JSON/);
  assert.match(styles, /\.asset-grid/);
  await assert.rejects(readFile(path.join(packageRoot, 'src/app/api/assets/route.ts')), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(packageRoot, 'src/app/llms.txt/route.ts')), { code: 'ENOENT' });
});
