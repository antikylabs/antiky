#!/usr/bin/env node
/**
 * Install a Poly Haven material set into a demo, verified.
 *
 * Why this exists rather than `installCatalogAsset`: that installer reads a `downloads` array off
 * each catalog entry — per-file url, size and hash — and **no entry in
 * `poly-haven.generated.json` has one.** All 995 carry the key as an empty array, so the installer
 * has nothing to fetch and its size and hash checks have no inputs. Until the catalog generator is
 * taught to populate them, this fetches the same descriptors from the source the generator should be
 * using and applies the same two checks.
 *
 * The checks are the point. A texture that arrives truncated or substituted is not something you
 * notice by looking at a demo; you notice it months later as a surface that is subtly wrong. Size
 * and md5 both come from Poly Haven's API alongside the URL, so verifying costs nothing beyond
 * comparing two strings.
 *
 * Usage:
 *   node install-poly-haven-material.mjs --slug plywood --demo traversal-study [--resolution 1k]
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const demosRoot = fileURLToPath(new URL('../..', import.meta.url));
/** The four maps a triplanar PBR path consumes. `nor_gl` is OpenGL-convention green, which is what these shaders assume. */
const MAPS = Object.freeze({ Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough', AO: 'ao' });

function parseArguments(argv) {
  const options = { resolution: '1k', format: 'jpg' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--slug') options.slug = argv[index += 1];
    else if (argv[index] === '--demo') options.demo = argv[index += 1];
    else if (argv[index] === '--resolution') options.resolution = argv[index += 1];
    else if (argv[index] === '--format') options.format = argv[index += 1];
    else throw new Error(`Unknown argument "${argv[index]}".`);
  }
  for (const required of ['slug', 'demo']) {
    if (options[required] === undefined) throw new Error(`--${required} is required.`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(
    path.join(demosRoot, '..', 'asset-catalog', 'data', 'poly-haven.generated.json'),
    'utf8',
  ));
  const entries = Array.isArray(catalog) ? catalog : catalog.assets ?? catalog.items;
  const entry = entries.find((candidate) => candidate.slug === options.slug);
  if (entry === undefined) throw new Error(`No catalog entry for "${options.slug}".`);
  if (entry.kind !== 'texture') throw new Error(`"${options.slug}" is a ${entry.kind}, not a texture.`);

  const listing = await fetch(`https://api.polyhaven.com/files/${entry.upstream.id}`);
  if (!listing.ok) throw new Error(`Poly Haven files API returned ${listing.status} for ${entry.upstream.id}`);
  const files = await listing.json();

  const directory = path.join(demosRoot, 'antiky', options.demo, 'assets', 'poly-haven', options.slug);
  await mkdir(directory, { recursive: true });

  const installed = [];
  for (const [apiName, shortName] of Object.entries(MAPS)) {
    const descriptor = files[apiName]?.[options.resolution]?.[options.format];
    if (descriptor === undefined) {
      throw new Error(`${options.slug} has no ${apiName} at ${options.resolution}/${options.format}. `
        + `Available: ${Object.keys(files).join(', ')}`);
    }
    const response = await fetch(descriptor.url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${descriptor.url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    // Both checks the catalog installer would have made, against the same two fields it wanted.
    if (bytes.byteLength !== descriptor.size) {
      throw new Error(`Size mismatch for ${apiName}: expected ${descriptor.size}, received ${bytes.byteLength}`);
    }
    const md5 = createHash('md5').update(bytes).digest('hex');
    if (md5 !== String(descriptor.md5).toLowerCase()) {
      throw new Error(`Hash mismatch for ${apiName}: expected ${descriptor.md5}, computed ${md5}`);
    }
    const fileName = `${options.slug}_${shortName}_${options.resolution}.${options.format}`;
    await writeFile(path.join(directory, fileName), bytes);
    installed.push({
      map: shortName,
      file: `assets/poly-haven/${options.slug}/${fileName}`,
      bytes: bytes.byteLength,
      md5,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      url: descriptor.url,
    });
  }

  // Two receipt conventions live in this repository: most demos keep one `antiky-assets.json`
  // manifest, and `antiky-town` keeps a JSON file beside each asset. Write whichever the demo
  // already uses rather than imposing one — a receipt nobody reads is worse than no receipt.
  const manifestPath = path.join(demosRoot, 'antiky', options.demo, 'assets', 'antiky-assets.json');
  const hasManifest = existsSync(manifestPath);
  const receiptPath = hasManifest
    ? manifestPath
    : path.join(directory, `${options.slug}.json`);
  const receipts = hasManifest
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : { assets: [] };
  receipts.assets = receipts.assets.filter((asset) => asset.catalogId !== entry.id);
  receipts.assets.push({
    catalogId: entry.id,
    kind: 'texture',
    installedAt: new Date().toISOString(),
    provider: entry.provider,
    upstream: entry.upstream,
    license: entry.license,
    resolution: options.resolution,
    format: options.format,
    files: installed,
  });
  await writeFile(receiptPath, `${JSON.stringify(receipts, null, 2)}\n`);
  process.stdout.write(`${options.slug} → ${options.demo}: ${installed.length} maps, `
    + `${(installed.reduce((total, file) => total + file.bytes, 0) / 1024 / 1024).toFixed(1)} MB, all verified\n`);
}

await main();
