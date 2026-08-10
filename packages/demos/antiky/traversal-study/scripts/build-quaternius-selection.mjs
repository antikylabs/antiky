import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const QUATERNIUS_SELECTION_FILES = Object.freeze([
  'Character.gltf',
  'Cloud_2.gltf',
  'Cloud_3.gltf',
  'LICENSE.txt',
  'RockPlatforms_Large.gltf',
  'Tower.gltf',
  'Tree.gltf',
]);

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createDeterministicSelectionZip(entries) {
  const ordered = [...entries].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;

  for (const entry of ordered) {
    const name = Buffer.from(entry.name, 'utf8');
    const bytes = Buffer.from(entry.bytes.buffer, entry.bytes.byteOffset, entry.bytes.byteLength);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localChunks.push(local, bytes);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralChunks.push(central);
    localOffset += local.length + bytes.length;
  }

  const centralDirectory = Buffer.concat(centralChunks);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(ordered.length, 8);
  end.writeUInt16LE(ordered.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localChunks, centralDirectory, end]);
}

export async function buildQuaterniusSelectionArchive(sourceDirectory, outputPath) {
  const entries = [];
  for (const name of QUATERNIUS_SELECTION_FILES) {
    entries.push({ name, bytes: await readFile(resolve(sourceDirectory, name)) });
  }
  const archive = createDeterministicSelectionZip(entries);
  await writeFile(outputPath, archive);
  return Object.freeze({
    outputPath,
    bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex'),
    entries: QUATERNIUS_SELECTION_FILES,
  });
}

const invokedPath = process.argv[1] === undefined ? '' : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [sourceDirectory, outputPath] = process.argv.slice(2);
  if (sourceDirectory === undefined || outputPath === undefined) {
    throw new Error('usage: node build-quaternius-selection.mjs SOURCE_DIRECTORY OUTPUT.zip');
  }
  process.stdout.write(`${JSON.stringify(await buildQuaterniusSelectionArchive(sourceDirectory, outputPath))}\n`);
}
