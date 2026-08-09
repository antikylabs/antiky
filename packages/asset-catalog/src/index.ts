export type AssetKind = 'audio' | 'font' | 'hdri' | 'model' | 'sprite' | 'texture';
export type HashAlgorithm = 'md5' | 'sha1' | 'sha256';

export type AssetLicense = {
  readonly id: string;
  readonly name: string;
  readonly referenceUrl: string;
  readonly permitsModification: boolean;
  readonly permitsRedistribution: boolean;
  readonly requiresAttribution: boolean;
};

export type AssetProvider = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
};

export type AssetDownload = {
  readonly path: string;
  readonly format: string;
  readonly size: number;
  readonly url: string;
  readonly hash: Readonly<{ algorithm: HashAlgorithm; value: string }>;
};

export type AssetProvenance = {
  readonly creator: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly sourceSha256: string;
};

export type CatalogAsset = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly kind: AssetKind;
  readonly formats: readonly string[];
  readonly tags: readonly string[];
  readonly categories: readonly string[];
  readonly provider: AssetProvider;
  readonly upstream: Readonly<{
    id: string;
    url: string;
    filesHash: string;
    retrievedAt: string;
  }>;
  readonly preview: Readonly<{ url: string; sourceUrl: string; width: number; height: number }>;
  readonly downloads: readonly AssetDownload[];
  readonly license: AssetLicense;
  readonly provenance: AssetProvenance;
  readonly attribution: Readonly<{ required: boolean; notice: string }>;
  readonly verification: 'pending' | 'verified';
};

export type CatalogQuery = {
  readonly text?: string;
  readonly kind?: AssetKind;
  readonly provider?: string;
  readonly verifiedOnly?: boolean;
};

export function searchAssets(assets: readonly CatalogAsset[], query: CatalogQuery): CatalogAsset[] {
  const text = query.text?.trim().toLocaleLowerCase();

  return assets.filter((asset) => {
    if (query.kind && asset.kind !== query.kind) return false;
    if (query.provider && asset.provider.id !== query.provider) return false;
    if (query.verifiedOnly && asset.verification !== 'verified') return false;
    if (!text) return true;

    const searchable = [
      asset.name,
      asset.description,
      asset.provenance.creator,
      asset.provider.name,
      ...asset.tags,
      ...asset.categories,
    ].join(' ').toLocaleLowerCase();
    return searchable.includes(text);
  });
}

export function findAsset(
  assets: readonly CatalogAsset[],
  provider: string,
  slug: string,
): CatalogAsset | undefined {
  return assets.find((asset) => asset.provider.id === provider && asset.slug === slug);
}
