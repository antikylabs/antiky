import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import sharp from 'sharp';

const previewRoot = path.resolve(import.meta.dirname, '../public/previews/curated');

async function edgeRange(file, edge) {
  const { data, info } = await sharp(path.join(previewRoot, file)).raw().toBuffer({ resolveWithObject: true });
  const y = edge === 'top' ? 0 : info.height - 1;
  let minimum = 255;
  let maximum = 0;
  for (let x = 0; x < info.width; x += 1) {
    for (let channel = 0; channel < Math.min(3, info.channels); channel += 1) {
      const value = data[(y * info.width + x) * info.channels + channel];
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return maximum - minimum;
}

test('curated preview artwork fills the square thumbnail without letterbox bars', async () => {
  for (const file of ['kenney-nature-kit.webp', 'quaternius-ultimate-nature.webp']) {
    assert.ok(await edgeRange(file, 'top') > 20, `${file} has a flat top bar`);
    assert.ok(await edgeRange(file, 'bottom') > 20, `${file} has a flat bottom bar`);
  }
});
