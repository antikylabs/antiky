import Link from 'next/link';

import type { CatalogAsset } from '@antiky/asset-catalog';
import { fileCountLabel, VERIFICATION_COPY } from '@/lib/asset-presentation';

export function AssetCard({ asset }: Readonly<{ asset: CatalogAsset }>) {
  const fileLabel = fileCountLabel(asset.fileCount);
  const verification = VERIFICATION_COPY[asset.verification];
  return (
    <article className="asset-card">
      <Link href={`/assets/${asset.provider.id}/${asset.slug}`}>
        <div className="asset-card-media">
          <img src={asset.preview.url} width={asset.preview.width} height={asset.preview.height} alt={`Preview of ${asset.name}`} loading="lazy" referrerPolicy="no-referrer" />
          <span className={`status status-${asset.verification}`} title={verification.description}>{verification.label}</span>
        </div>
        <div className="asset-card-copy">
          <div className="asset-meta">
            <span>{asset.provider.name}</span>
            <span>Quality {asset.quality}</span><span>{asset.kind}</span><span>{fileLabel}</span>
          </div>
          <h2>{asset.name}</h2>
          <p>{asset.description}</p>
          <div className="tag-list" aria-label="Tags">
            {asset.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <div className="asset-card-foot"><span>{asset.formats.join(' · ') || 'Formats pending'}</span><span aria-hidden="true">→</span></div>
        </div>
      </Link>
    </article>
  );
}
