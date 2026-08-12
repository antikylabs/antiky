#!/usr/bin/env node
/**
 * Pull named models out of a Kenney kit into a demo.
 *
 * The catalog indexes these kits — slug, licence, upstream page — but does not serve the bytes, so
 * retrieval is the consumer's job. Kenney publishes one zip per kit at a versioned URL linked from
 * the kit's page; this scrapes that link rather than hard-coding it, because the hash segment
 * changes whenever the kit is re-cut.
 *
 * Only the named models are extracted. A kit is forty assets and a demo wants four; committing the
 * rest would be several megabytes of LFS for models nothing references.
 *
 * Usage:
 *   node install-kenney-kit.mjs --slug modular-space-kit --demo combat-arena \
 *     --models template-wall,template-wall-detail-a
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const demosRoot = fileURLToPath(new URL('..', import.meta.url));

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--slug') options.slug = argv[index += 1];
    else if (argv[index] === '--demo') options.demo = argv[index += 1];
    else if (argv[index] === '--models') options.models = argv[index += 1].split(',');
    else throw new Error(`Unknown argument "${argv[index]}".`);
  }
  for (const required of ['slug', 'demo', 'models']) {
    if (options[required] === undefined) throw new Error(`--${required} is required.`);
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
const catalog = JSON.parse(await readFile(
  path.join(demosRoot, '..', 'asset-catalog', 'data', 'curated-sources.generated.json'),
  'utf8',
));
const entries = Array.isArray(catalog) ? catalog : catalog.assets ?? catalog.items;
const entry = entries.find((candidate) => candidate.slug === options.slug);
if (entry === undefined) throw new Error(`No catalog entry for "${options.slug}".`);

const page = await (await fetch(entry.upstream.url)).text();
const [zipUrl] = page.match(/https?:\/\/[^"' ]*\.zip/) ?? [];
if (zipUrl === undefined) throw new Error(`No zip link on ${entry.upstream.url}`);

const staging = path.join(demosRoot, '..', '..', '.kenney-cache', options.slug);
await mkdir(staging, { recursive: true });
const archive = path.join(staging, 'kit.zip');
const bytes = Buffer.from(await (await fetch(zipUrl)).arrayBuffer());
await writeFile(archive, bytes);
await run('unzip', ['-o', '-q', archive, '-d', staging]);

const destination = path.join(demosRoot, 'antiky', options.demo, 'assets', 'kenney', options.slug);
await mkdir(destination, { recursive: true });

/** Find a named model anywhere in the extracted tree — kit layouts differ between releases. */
async function findModel(directory, name) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) {
      const found = await findModel(full, name);
      if (found !== undefined) return found;
    } else if (item.name === `${name}.glb`) return full;
  }
  return undefined;
}

const installed = [];
for (const model of options.models) {
  const source = await findModel(staging, model);
  if (source === undefined) throw new Error(`${model}.glb is not in this kit.`);
  const data = await readFile(source);
  await writeFile(path.join(destination, `${model}.glb`), data);
  installed.push({
    file: `assets/kenney/${options.slug}/${model}.glb`,
    bytes: data.byteLength,
    sha256: createHash('sha256').update(data).digest('hex'),
  });
  process.stdout.write(`${model}.glb — ${(data.byteLength / 1024).toFixed(0)} kB\n`);
}

const receiptPath = path.join(demosRoot, 'antiky', options.demo, 'assets', 'antiky-assets.json');
const receipts = JSON.parse(await readFile(receiptPath, 'utf8'));
receipts.assets = receipts.assets.filter((asset) => asset.catalogId !== entry.id);
receipts.assets.push({
  catalogId: entry.id,
  kind: 'model',
  installedAt: new Date().toISOString(),
  provider: entry.provider,
  upstream: { ...entry.upstream, archive: zipUrl },
  license: entry.license,
  files: installed,
});
await writeFile(receiptPath, `${JSON.stringify(receipts, null, 2)}\n`);
await rm(archive, { force: true });
