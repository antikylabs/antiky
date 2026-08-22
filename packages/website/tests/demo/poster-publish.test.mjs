import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { publishDemoPoster } from '../../scripts/media/publish/demo-poster.mjs';

test('demo poster promotion accepts only an approved managed capture and writes bounded launch files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'antiky-poster-publish-'));
  const inputPath = path.join(root, 'capture.png');
  const publicationPath = path.join(root, 'publication.json');
  await sharp({
    create: { width: 1280, height: 720, channels: 3, background: { r: 31, g: 47, b: 79 } },
  }).png().toFile(inputPath);
  await writeFile(publicationPath, JSON.stringify({ demos: [{ slug: 'fixture' }] }));

  const result = await publishDemoPoster({
    slug: 'fixture',
    inputPath,
    publicationPath,
    masterRoot: path.join(root, 'masters'),
    publicRoot: path.join(root, 'public'),
  });
  assert.equal(result.master.width, 2560);
  assert.equal(result.master.height, 1440);
  assert.ok(result.delivery.bytes <= 1_200_000);
  assert.equal((await sharp(await readFile(result.delivery.path)).metadata()).format, 'webp');

  await assert.rejects(
    publishDemoPoster({ slug: 'unlisted', inputPath, publicationPath }),
    /MEDIA_DEMO_NOT_APPROVED/,
  );
  await mkdir(path.join(root, 'bad'), { recursive: true });
  const badInput = path.join(root, 'bad', 'small.png');
  await sharp({ create: { width: 32, height: 32, channels: 3, background: 'black' } }).png().toFile(badInput);
  await assert.rejects(
    publishDemoPoster({ slug: 'fixture', inputPath: badInput, publicationPath }),
    /MEDIA_CAPTURE_INVALID/,
  );
});
