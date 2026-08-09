export type AssetKind = 'audio' | 'font' | 'model' | 'sprite' | 'texture';

export type AssetLicense = {
  readonly id: string;
  readonly name: string;
  readonly referenceUrl: string;
  readonly permitsModification: boolean;
  readonly permitsRedistribution: boolean;
  readonly requiresAttribution: boolean;
};

export type AssetProvenance = {
  readonly creator: string;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly sourceSha256: string;
};

export type CatalogAsset = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly kind: AssetKind;
  readonly formats: readonly string[];
  readonly tags: readonly string[];
  readonly license: AssetLicense;
  readonly provenance: AssetProvenance;
  readonly verification: 'pending' | 'verified';
};

export type CatalogQuery = {
  readonly text?: string;
  readonly kind?: AssetKind;
  readonly verifiedOnly?: boolean;
};

export function searchAssets(assets: readonly CatalogAsset[], query: CatalogQuery): CatalogAsset[] {
  const text = query.text?.trim().toLocaleLowerCase();

  return assets.filter((asset) => {
    if (query.kind && asset.kind !== query.kind) return false;
    if (query.verifiedOnly && asset.verification !== 'verified') return false;
    if (!text) return true;

    const searchable = [asset.name, asset.description, asset.provenance.creator, ...asset.tags]
      .join(' ')
      .toLocaleLowerCase();
    return searchable.includes(text);
  });
}
