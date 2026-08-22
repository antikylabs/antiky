import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const websiteRoot = path.resolve(import.meta.dirname, '../..');
const MASTER_WIDTH = 2560;
const MASTER_HEIGHT = 1440;
const DELIVERY_LIMIT = 1_200_000;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function replaceImage(outputPath, render) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await rm(temporary, { force: true });
  await render(temporary);
  await rename(temporary, outputPath);
}

export async function publishDemoPoster({
  slug,
  inputPath,
  publicationPath = path.join(websiteRoot, 'demo-publication.json'),
  masterRoot = path.join(websiteRoot, 'media-masters', 'demos'),
  publicRoot = path.join(websiteRoot, 'public', 'media', 'demos'),
}) {
  const publication = JSON.parse(await readFile(publicationPath, 'utf8'));
  if (!publication.demos?.some((demo) => demo.slug === slug)) {
    throw new Error(`MEDIA_DEMO_NOT_APPROVED (${slug})`);
  }

  const input = await readFile(inputPath);
  const metadata = await sharp(input).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1280 || metadata.height !== 720) {
    throw new Error(`MEDIA_CAPTURE_INVALID (${slug}): expected a 1280x720 PNG managed capture`);
  }

  const masterPath = path.join(masterRoot, `${slug}.png`);
  const deliveryPath = path.join(publicRoot, `${slug}.webp`);
  await replaceImage(masterPath, (temporary) => sharp(input)
    .resize(MASTER_WIDTH, MASTER_HEIGHT, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toFile(temporary));
  await replaceImage(deliveryPath, (temporary) => sharp(masterPath)
    .webp({ quality: 88, effort: 6 })
    .toFile(temporary));

  const master = await readFile(masterPath);
  const delivery = await readFile(deliveryPath);
  if (delivery.length > DELIVERY_LIMIT) {
    throw new Error(`MEDIA_DELIVERY_OVERSIZED (${slug}): ${delivery.length} bytes`);
  }

  return Object.freeze({
    slug,
    input: { path: inputPath, sha256: digest(input), width: 1280, height: 720 },
    master: { path: masterPath, sha256: digest(master), width: MASTER_WIDTH, height: MASTER_HEIGHT },
    delivery: { path: deliveryPath, sha256: digest(delivery), width: MASTER_WIDTH, height: MASTER_HEIGHT, bytes: delivery.length },
  });
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--slug') options.slug = argv[index += 1];
    else if (argument === '--input') options.inputPath = path.resolve(argv[index += 1]);
    else throw new Error(`Unknown argument "${argument}".`);
  }
  if (!options.slug || !options.inputPath) throw new Error('Usage: publish-demo-poster --slug <slug> --input <capture.png>');
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await publishDemoPoster(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
