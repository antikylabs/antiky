#!/usr/bin/env node
/**
 * Inline a GLB's externally-referenced images into the file itself.
 *
 * Kenney ships kit models with `images[].uri` pointing at a shared `Textures/colormap.png` — sensible
 * for a kit, since forty models share one atlas and nobody wants forty copies of it. BroMetal's
 * loader refuses them: "GLB images with external URIs are not supported", because a runtime that
 * fetches side files has to invent a base-path convention.
 *
 * So each model gets its own copy of the atlas. That is a few hundred kilobytes per model and it is
 * the right trade for a demo shipping four of them — the alternative is a loader change to satisfy
 * an asset layout.
 *
 * The transform is narrow and reversible: read the JSON chunk, append each referenced image to the
 * binary chunk, add a bufferView pointing at it, and swap `uri` for `bufferView` + `mimeType`.
 * Nothing else in the file is touched.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

/** GLB chunks are four-byte aligned; JSON pads with spaces and binary pads with zeroes. */
function padded(bytes, pad) {
  const remainder = bytes.byteLength % 4;
  if (remainder === 0) return bytes;
  return Buffer.concat([bytes, Buffer.alloc(4 - remainder, pad)]);
}

export async function embedGlbImages(glbPath, textureDirectory) {
  const source = await readFile(glbPath);
  if (source.readUInt32LE(0) !== MAGIC) throw new Error(`${glbPath} is not a GLB.`);

  let offset = 12;
  let json;
  let binary = Buffer.alloc(0);
  while (offset < source.byteLength) {
    const length = source.readUInt32LE(offset);
    const type = source.readUInt32LE(offset + 4);
    const chunk = source.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) json = JSON.parse(chunk.toString('utf8'));
    else if (type === BIN_CHUNK) binary = Buffer.from(chunk);
    offset += 8 + length;
  }
  if (json === undefined) throw new Error(`${glbPath} has no JSON chunk.`);

  const external = (json.images ?? []).filter((image) => typeof image.uri === 'string');
  if (external.length === 0) return { changed: false, bytes: source.byteLength };

  json.bufferViews = json.bufferViews ?? [];
  const appended = [binary];
  let cursor = binary.byteLength;
  for (const image of json.images) {
    if (typeof image.uri !== 'string') continue;
    const imageBytes = padded(
      await readFile(path.join(textureDirectory, path.basename(image.uri))),
      0,
    );
    json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: imageBytes.byteLength });
    image.bufferView = json.bufferViews.length - 1;
    image.mimeType = image.uri.endsWith('.jpg') || image.uri.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png';
    delete image.uri;
    appended.push(imageBytes);
    cursor += imageBytes.byteLength;
  }

  const mergedBinary = Buffer.concat(appended);
  // The single buffer's declared length has to cover what the views now address, or a strict reader
  // rejects the file even though every byte is present.
  json.buffers = [{ byteLength: mergedBinary.byteLength }];

  const jsonChunk = padded(Buffer.from(JSON.stringify(json), 'utf8'), 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.byteLength + 8 + mergedBinary.byteLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.byteLength, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(mergedBinary.byteLength, 0);
  binHeader.writeUInt32LE(BIN_CHUNK, 4);

  const output = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, mergedBinary]);
  await writeFile(glbPath, output);
  return { changed: true, bytes: output.byteLength, images: external.length };
}

if (process.argv[2] !== undefined) {
  const [, , textureDirectory, ...models] = process.argv;
  for (const model of models) {
    const result = await embedGlbImages(model, textureDirectory);
    process.stdout.write(`${path.basename(model)} — ${result.changed
      ? `${result.images} image(s) embedded, ${(result.bytes / 1024).toFixed(0)} kB`
      : 'already embedded'}\n`);
  }
}
