import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import type { CatalogAsset, HashAlgorithm } from './catalog.ts';

const REGISTRY_SCHEMA_VERSION = 1 as const;
const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;

export type InstalledAssetReceipt = Readonly<{
  catalogId: string;
  installedAt: string;
  files: readonly Readonly<{ path: string; sha256: string; size: number }>[];
}>;

function safeRelativePath(value: string): string {
  if (
    value.length === 0
    || value.startsWith('/')
    || value.includes('\\')
    || value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe catalog asset path: ${value}`);
  }
  return value;
}

function assertInside(root: string, target: string): void {
  const path = relative(resolve(root), resolve(target));
  if (path === '..' || path.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error(`Asset path escapes the Antiky project: ${target}`);
  }
}

async function assertAntikyProject(root: string): Promise<void> {
  const manifests = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.antiky'));
  if (manifests.length !== 1) {
    throw new Error(`Expected exactly one .antiky manifest in project root: ${root}`);
  }
}

function digest(algorithm: HashAlgorithm, bytes: Uint8Array): string {
  return createHash(algorithm).update(bytes).digest('hex');
}

async function downloadFile(
  file: CatalogAsset['downloads'][number],
  fetcher: typeof fetch,
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const response = await fetcher(file.url, {
    headers: { 'User-Agent': 'AntikyCLI/0.1 (https://antikylabs.com)' },
  });
  if (!response.ok) throw new Error(`Asset download failed (${response.status}): ${file.url}`);
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && Number(declaredLength) > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Asset file exceeds download limit: ${file.path}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== file.size) {
    throw new Error(`Asset size mismatch for ${file.path}: expected ${file.size}, received ${bytes.byteLength}`);
  }
  if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Asset file exceeds download limit: ${file.path}`);
  }
  const actual = digest(file.hash.algorithm, bytes);
  if (actual !== file.hash.value.toLocaleLowerCase('en-US')) {
    throw new Error(`Asset hash mismatch for ${file.path}`);
  }
  return { bytes, sha256: digest('sha256', bytes) };
}

export async function installCatalogAsset(input: Readonly<{
  asset: CatalogAsset;
  projectRoot: string;
  fetch?: typeof fetch;
  installedAt?: string;
}>): Promise<InstalledAssetReceipt> {
  if (input.asset.verification !== 'install-verified') {
    throw new Error('Only install-verified assets can be installed');
  }
  await assertAntikyProject(input.projectRoot);

  const fetcher = input.fetch ?? fetch;
  const installedAt = input.installedAt ?? new Date().toISOString();
  const assetsRoot = join(input.projectRoot, 'assets');
  const destinationRoot = join(assetsRoot, input.asset.provider.id, input.asset.slug);
  const temporaryRoot = join(assetsRoot, `.install-${randomUUID()}`);
  assertInside(input.projectRoot, destinationRoot);
  await mkdir(temporaryRoot, { recursive: true });

  const installedFiles: Array<{
    path: string;
    sourceUrl: string;
    upstreamHash: CatalogAsset['downloads'][number]['hash'];
    sha256: string;
    size: number;
  }> = [];

  try {
    for (const file of input.asset.downloads) {
      const assetPath = safeRelativePath(file.path);
      const target = join(temporaryRoot, assetPath);
      assertInside(temporaryRoot, target);
      const downloaded = await downloadFile(file, fetcher);
      await mkdir(resolve(target, '..'), { recursive: true });
      await writeFile(target, downloaded.bytes, { flag: 'wx' });
      installedFiles.push({
        path: join('assets', input.asset.provider.id, input.asset.slug, assetPath),
        sourceUrl: file.url,
        upstreamHash: file.hash,
        sha256: downloaded.sha256,
        size: downloaded.bytes.byteLength,
      });
    }

    await rm(destinationRoot, { recursive: true, force: true });
    await mkdir(resolve(destinationRoot, '..'), { recursive: true });
    await rename(temporaryRoot, destinationRoot);

    const registryPath = join(assetsRoot, 'antiky-assets.json');
    let existing: { schemaVersion: number; assets: unknown[] } = {
      schemaVersion: REGISTRY_SCHEMA_VERSION,
      assets: [],
    };
    try {
      existing = JSON.parse(await readFile(registryPath, 'utf8')) as typeof existing;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
    if (existing.schemaVersion !== REGISTRY_SCHEMA_VERSION || !Array.isArray(existing.assets)) {
      throw new Error(`Unsupported Antiky asset registry: ${registryPath}`);
    }

    const record = {
      catalogId: input.asset.id,
      installedAt,
      provider: input.asset.provider,
      upstream: input.asset.upstream,
      license: input.asset.license,
      attribution: input.asset.attribution,
      files: installedFiles,
    };
    const otherAssets = existing.assets.filter((candidate) => (
      !(candidate && typeof candidate === 'object' && 'catalogId' in candidate
        && candidate.catalogId === input.asset.id)
    ));
    await writeFile(
      registryPath,
      `${JSON.stringify({ schemaVersion: REGISTRY_SCHEMA_VERSION, assets: [...otherAssets, record] }, null, 2)}\n`,
      'utf8',
    );

    return Object.freeze({
      catalogId: input.asset.id,
      installedAt,
      files: Object.freeze(installedFiles.map(({ path, sha256, size }) => ({ path, sha256, size }))),
    });
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}
