import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const websiteRoot = new URL('../', import.meta.url);

test('the main website owns the static asset catalog routes', async () => {
  const manifest = JSON.parse(await readFile(new URL('package.json', websiteRoot), 'utf8'));
  const indexPage = await readFile(new URL('src/app/assets/page.tsx', websiteRoot), 'utf8');
  const detailPage = await readFile(new URL('src/app/assets/[provider]/[slug]/page.tsx', websiteRoot), 'utf8');
  const assetPackage = JSON.parse(await readFile(new URL('../asset-site/package.json', websiteRoot), 'utf8'));
  const stageScript = await readFile(new URL('scripts/stage-asset-site.mjs', websiteRoot), 'utf8');

  assert.equal(manifest.dependencies['@antiky/asset-site'], '0.0.0');
  assert.match(indexPage, /AssetCatalog/);
  assert.match(detailPage, /generateStaticParams/);
  assert.match(detailPage, /AssetDetail/);
  assert.equal(assetPackage.exports['./ui'], './src/public.ts');
  assert.match(manifest.scripts['assets:stage'], /build --workspace @antiky\/asset-catalog/);
  assert.match(stageScript, /asset-catalog\/dist\/previews/);
  await assert.rejects(readFile(new URL('src/app/assets/catalog.json/route.ts', websiteRoot)), { code: 'ENOENT' });
});

test('the static website publishes one canonical llms index and complete context', async () => {
  const llmsRoute = await readFile(new URL('src/app/llms.txt/route.ts', websiteRoot), 'utf8');
  const fullRoute = await readFile(new URL('src/app/llms-full.txt/route.ts', websiteRoot), 'utf8');

  assert.match(llmsRoute, /renderLlmsTxt/);
  assert.match(fullRoute, /renderLlmsFullTxt/);
  await assert.rejects(readFile(new URL('src/app/assets/llms.txt/route.ts', websiteRoot)), { code: 'ENOENT' });
  await assert.rejects(readFile(new URL('src/app/api/assets/route.ts', websiteRoot)), { code: 'ENOENT' });
});

test('the production build statically generates assets and complete agent context', async () => {
  const outputRoot = new URL('.next/server/app/', websiteRoot);
  const staticCatalog = JSON.parse(await readFile(new URL('../asset-catalog/dist/v1/catalog.json', websiteRoot), 'utf8'));
  const [assetsPage, natureKit, llms, llmsFull] = await Promise.all([
    readFile(new URL('assets.html', outputRoot), 'utf8'),
    readFile(new URL('assets/kenney/nature-kit.html', outputRoot), 'utf8'),
    readFile(new URL('llms.txt.body', outputRoot), 'utf8'),
    readFile(new URL('llms-full.txt.body', outputRoot), 'utf8'),
  ]);

  assert.match(assetsPage, /Start with/);
  assert.match(natureKit, /Nature Kit/);
  assert.match(natureKit, /https:\/\/catalog-api\.antikylabs\.com\/v1\/assets\/kenney\/nature-kit\.json/);
  assert.match(llms, /^# Antiky Labs\n\n> /);
  assert.match(llms, /https:\/\/antikylabs\.com\/llms-full\.txt/);
  assert.match(llms, /https:\/\/antikylabs\.com\/assets\/kenney\/nature-kit/);
  assert.match(llms, /https:\/\/catalog-api\.antikylabs\.com\/v1\/catalog\.json/);
  assert.match(llmsFull, /## Documentation: Framework API reference/);
  assert.match(llmsFull, /## Documentation: Find and use game assets/);
  assert.match(llmsFull, /### Nature Kit/);
  assert.match(llmsFull, /### Ultimate Nature Pack/);
  await assert.rejects(readFile(new URL('assets/llms.txt.body', outputRoot)), { code: 'ENOENT' });

  for (const asset of staticCatalog.assets) {
    await access(new URL(`assets/${asset.provider.id}/${asset.slug}.html`, outputRoot));
    if (asset.preview.url.startsWith('/')) {
      await access(new URL(`public${asset.preview.url}`, websiteRoot));
      await access(new URL(`../asset-catalog/dist${asset.preview.url}`, websiteRoot));
    }
  }
});
