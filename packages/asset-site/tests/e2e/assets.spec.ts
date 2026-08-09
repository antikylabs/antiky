import { expect, test } from '@playwright/test';

test('prioritizes Kenney and Quaternius without a single-source first page', async ({ page }) => {
  await page.goto('/assets');
  const providerIds = await page.getByRole('article').evaluateAll((cards) => cards.map((card) => {
    const href = card.querySelector('a')?.getAttribute('href') ?? '';
    return href.split('/')[2];
  }));
  expect(providerIds).toHaveLength(48);
  expect(providerIds.slice(0, 5)).toEqual(['kenney', 'quaternius', 'kenney', 'quaternius', 'poly-haven']);
  expect(providerIds.filter((provider) => provider === 'kenney')).toHaveLength(20);
  expect(providerIds.filter((provider) => provider === 'quaternius')).toHaveLength(19);
  expect(providerIds.filter((provider) => provider === 'poly-haven')).toHaveLength(9);
});

test('searches forest models and opens permanent provenance', async ({ page }) => {
  await page.goto('/assets?q=forest&type=model');

  await expect(page.getByRole('heading', { name: 'Start with something good.' })).toBeVisible();
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Dead Tree Trunk', exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(card.getByText('5 files')).toBeVisible();
  await expect(card.getByText('forest', { exact: true })).toBeVisible();
  await card.getByRole('link').click();

  await expect(page).toHaveURL('/assets/poly-haven/dead-tree-trunk');
  await expect(page.getByRole('heading', { name: 'Dead Tree Trunk' })).toBeVisible();
  await expect(page.getByText('Install verified', { exact: true })).toBeVisible();
  await expect(page.getByText('5 source files')).toBeVisible();
  await expect(page.getByText('forest floor', { exact: true })).toBeVisible();
  await expect(page.getByText('1e56e4393417d157e43e26bd8b7b019189d313ed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'JSON record' })).toBeVisible();
});

test('serves a structured catalog endpoint for Studio and agents', async ({ request }) => {
  const response = await request.get('/api/assets?q=forest&type=model');
  expect(response.ok()).toBe(true);
  const body = await response.json();

  expect(body.schemaVersion).toBe(2);
  expect(body.totalCatalogAssets).toBe(1292);
  expect(body.assets.some((asset: { id: string }) => asset.id === 'poly-haven:dead-tree-trunk')).toBe(true);
});

test('serves the Kenney Nature Kit preview as a local raster image', async ({ page, request }) => {
  await page.goto('/assets/kenney/nature-kit');
  const preview = page.getByRole('img', { name: 'Preview of Nature Kit' });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const source = await preview.getAttribute('src');
  expect(source).toBe('/previews/curated/kenney-nature-kit.webp');
  const response = await request.get(source!);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('image/webp');
  await expect(page.getByText('330 source files')).toBeVisible();
  await expect(page.getByText('Source metadata verified', { exact: true })).toBeVisible();
});

test('serves official Quaternius Ultimate Nature artwork locally', async ({ page, request }) => {
  await page.goto('/assets/quaternius/ultimate-nature');
  const preview = page.getByRole('img', { name: 'Preview of Ultimate Nature Pack' });
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const source = await preview.getAttribute('src');
  expect(source).toBe('/previews/curated/quaternius-ultimate-nature.webp');
  const response = await request.get(source!);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()['content-type']).toContain('image/webp');
});

test('labels API-cataloged Poly Haven records without implying install verification', async ({ page }) => {
  await page.goto('/assets/poly-haven/grass-medium-01');
  await expect(page.getByRole('heading', { name: 'Grass Medium 01' })).toBeVisible();
  await expect(page.getByText('Source metadata verified', { exact: true })).toBeVisible();
  await expect(page.getByText('File count not published', { exact: true })).toBeVisible();
});
