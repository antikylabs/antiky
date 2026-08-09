import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';
import { CATALOG_ASSETS } from '../src/catalog-data.ts';

const outputRoot = path.resolve(process.argv[2] ?? '../asset-site/public');
const polyHaven = CATALOG_ASSETS.filter((asset) => asset.provider.id === 'poly-haven');

for (const asset of polyHaven) {
  const response = await fetch(asset.preview.sourceUrl, {
    headers: { 'User-Agent': 'AntikyAssetCatalog/0.1 (https://antikylabs.com/assets)' },
  });
  if (!response.ok) throw new Error(`Preview download failed (${response.status}): ${asset.preview.sourceUrl}`);
  const output = path.join(outputRoot, asset.preview.url);
  await mkdir(path.dirname(output), { recursive: true });
  const webp = await sharp(await response.arrayBuffer()).resize(256, 256, { fit: 'cover' }).webp({ quality: 72 }).toBuffer();
  await writeFile(output, webp);
  process.stdout.write(`Generated ${path.relative(process.cwd(), output)} (${webp.byteLength} bytes)\n`);
}
