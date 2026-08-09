import Link from 'next/link';

import type { CatalogAsset } from '@antiky/asset-catalog';

export function AssetCard({ asset }: Readonly<{ asset: CatalogAsset }>) {
  return (
    <article className="asset-card">
      <Link href={`/assets/${asset.provider.id}/${asset.slug}`}>
        <img src={asset.preview.url} width={asset.preview.width} height={asset.preview.height} alt="" />
        <div className="asset-card-copy">
          <div className="asset-meta">
            <span>{asset.provider.name}</span>
            <span>{asset.kind}</span>
          </div>
          <h2>{asset.name}</h2>
          <p>{asset.description}</p>
          <span className={`status status-${asset.verification}`}>{asset.verification}</span>
        </div>
      </Link>
    </article>
  );
}
