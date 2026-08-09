import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const packageRoot = path.resolve(import.meta.dirname, '..');

test('asset site exposes catalog, detail, and JSON routes', async () => {
  const packageManifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  const searchPage = await readFile(path.join(packageRoot, 'src/app/assets/page.tsx'), 'utf8');
  const detailPage = await readFile(path.join(packageRoot, 'src/app/assets/[provider]/[slug]/page.tsx'), 'utf8');
  const api = await readFile(path.join(packageRoot, 'src/app/api/assets/route.ts'), 'utf8');
  const layout = await readFile(path.join(packageRoot, 'src/app/layout.tsx'), 'utf8');
  const styles = await readFile(path.join(packageRoot, 'src/app/styles.css'), 'utf8');

  assert.equal(packageManifest.name, '@antiky/asset-site');
  assert.equal(packageManifest.dependencies['@antiky/asset-catalog'], '0.0.0');
  assert.match(searchPage, /catalogSearch/);
  assert.match(detailPage, /catalogAsset/);
  assert.match(api, /NextResponse\.json/);
  assert.match(layout, /@fontsource-variable\/space-grotesk/);
  assert.match(layout, /SiteHeader/);
  assert.match(layout, /SiteFooter/);
  assert.match(styles, /--bg:\s*#050506/);
  assert.match(styles, /--accent:\s*#8b7cff/);
});
