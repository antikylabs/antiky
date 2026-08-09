import { expect, test } from '@playwright/test';

test('searches forest models and opens permanent provenance', async ({ page }) => {
  await page.goto('/assets?q=forest&type=model');

  await expect(page.getByRole('heading', { name: 'Start with something good.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Dead Tree Trunk/ })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: 'Dead Tree Trunk' });
  await expect(card.getByText('5 files')).toBeVisible();
  await expect(card.getByText('forest', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Dead Tree Trunk/ }).click();

  await expect(page).toHaveURL('/assets/poly-haven/dead-tree-trunk');
  await expect(page.getByRole('heading', { name: 'Dead Tree Trunk' })).toBeVisible();
  await expect(page.getByText('5 source files')).toBeVisible();
  await expect(page.getByText('forest floor', { exact: true })).toBeVisible();
  await expect(page.getByText('1e56e4393417d157e43e26bd8b7b019189d313ed')).toBeVisible();
  await expect(page.getByRole('link', { name: 'JSON record' })).toBeVisible();
});

test('serves a structured catalog endpoint for Studio and agents', async ({ request }) => {
  const response = await request.get('/api/assets?q=forest&type=model');
  expect(response.ok()).toBe(true);
  const body = await response.json();

  expect(body.schemaVersion).toBe(1);
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
});
