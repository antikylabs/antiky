import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DEFAULT_LIMIT = 1_200_000;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function positiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

export async function publishStaticMedia({
  inputPath,
  outputPath,
  width,
  height,
  quality = 88,
  limit = DEFAULT_LIMIT,
  position = 'centre',
}) {
  const input = await readFile(inputPath);
  const inputMetadata = await sharp(input).metadata();
  if (!inputMetadata.width || !inputMetadata.height) {
    throw new Error(`MEDIA_INPUT_INVALID (${inputPath})`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp`;
  await rm(temporary, { force: true });
  await sharp(input)
    .resize(width, height, { fit: 'cover', position, kernel: sharp.kernel.lanczos3 })
    .webp({ quality, effort: 6 })
    .toFile(temporary);
  await rename(temporary, outputPath);

  const output = await readFile(outputPath);
  const outputMetadata = await sharp(output).metadata();
  if (output.length > limit) {
    throw new Error(`MEDIA_DELIVERY_OVERSIZED (${outputPath}): ${output.length} bytes`);
  }

  return Object.freeze({
    input: {
      path: inputPath,
      sha256: digest(input),
      width: inputMetadata.width,
      height: inputMetadata.height,
    },
    delivery: {
      path: outputPath,
      sha256: digest(output),
      width: outputMetadata.width,
      height: outputMetadata.height,
      bytes: output.length,
    },
  });
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--input') values.inputPath = path.resolve(argv[index += 1]);
    else if (argument === '--output') values.outputPath = path.resolve(argv[index += 1]);
    else if (argument === '--width') values.width = positiveInteger(argv[index += 1], 'width');
    else if (argument === '--height') values.height = positiveInteger(argv[index += 1], 'height');
    else if (argument === '--quality') values.quality = positiveInteger(argv[index += 1], 'quality');
    else if (argument === '--limit') values.limit = positiveInteger(argv[index += 1], 'limit');
    else if (argument === '--position') values.position = argv[index += 1];
    else throw new Error(`Unknown argument "${argument}".`);
  }
  if (!values.inputPath || !values.outputPath || !values.width || !values.height) {
    throw new Error('Usage: publish-static-media --input <file> --output <file.webp> --width <px> --height <px>');
  }
  if (values.quality && values.quality > 100) throw new Error('quality must be between 1 and 100.');
  return values;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await publishStaticMedia(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
