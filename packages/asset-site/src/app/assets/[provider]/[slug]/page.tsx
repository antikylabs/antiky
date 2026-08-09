import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { catalogAsset } from '../../../../lib/catalog';
import { fileCountLabel, VERIFICATION_COPY } from '../../../../lib/presentation';

type Params = Promise<{ provider: string; slug: string }>;

export async function generateMetadata({ params }: Readonly<{ params: Params }>): Promise<Metadata> {
  const { provider, slug } = await params;
  const asset = catalogAsset(provider, slug);
  if (!asset) return {};
  return { title: `${asset.name} · Antiky Assets`, description: asset.description };
}

export default async function AssetPage({ params }: Readonly<{ params: Params }>) {
  const { provider, slug } = await params;
  const asset = catalogAsset(provider, slug);
  if (!asset) notFound();
  const fileLabel = fileCountLabel(asset.fileCount, true);
  const verification = VERIFICATION_COPY[asset.verification];

  return (
    <main className="asset-detail-page">
      <div className="wrap"><Link className="back-link" href="/assets">← All assets</Link></div>
      <article className="asset-detail wrap">
        <figure className="detail-media">
          <img className="detail-preview" src={asset.preview.url} width={512} height={512} alt={`Preview of ${asset.name}`} referrerPolicy="no-referrer" />
          <figcaption><span>{asset.provider.name}</span><span>{asset.license.name}</span></figcaption>
        </figure>
        <div className="detail-copy">
          <div className="asset-meta"><span>{asset.provider.name}</span><span>{asset.kind}</span></div>
          <h1>{asset.name}</h1>
          <p className="detail-lead">{asset.description}</p>
          <div className="tag-list detail-tags" aria-label="Tags">{asset.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <dl className="detail-facts">
            <div><dt>Files</dt><dd>{fileLabel}</dd></div>
            <div><dt>License</dt><dd><a href={asset.license.referenceUrl}>{asset.license.name}</a></dd></div>
            <div><dt>Creator</dt><dd>{asset.provenance.creator}</dd></div>
            <div><dt>Upstream ID</dt><dd><code>{asset.upstream.id}</code></dd></div>
            <div><dt>Files hash</dt><dd><code>{asset.upstream.filesHash}</code></dd></div>
            <div><dt>Formats</dt><dd>{asset.formats.join(', ') || 'Pending ingestion'}</dd></div>
            <div><dt>Status</dt><dd><span className="verification-name">{verification.label}</span><small>{verification.description}</small></dd></div>
            {asset.facts.publishedAt && <div><dt>Published</dt><dd>{asset.facts.publishedAt.slice(0, 10)}</dd></div>}
            {asset.facts.downloadCount !== undefined && <div><dt>Source downloads</dt><dd>{asset.facts.downloadCount.toLocaleString('en-US')}</dd></div>}
            {asset.facts.polygonCount !== undefined && <div><dt>Polygons</dt><dd>{asset.facts.polygonCount.toLocaleString('en-US')}</dd></div>}
            {asset.facts.maxResolution && <div><dt>Max resolution</dt><dd>{asset.facts.maxResolution.join(' × ')}</dd></div>}
          </dl>
          <p className="notice"><span>Attribution record</span>{asset.attribution.notice}</p>
          <div className="actions">
            <a className="button" href={asset.upstream.url}>View original source</a>
            <a href={`/api/assets/${asset.provider.id}/${asset.slug}`}>JSON record</a>
          </div>
          {asset.downloads.length > 0 && (
            <details className="download-files"><summary>{asset.downloads.length} selected download files</summary>
              <ul>{asset.downloads.map((file) => (
                <li key={file.path}><code>{file.path}</code> · {file.hash.algorithm}:{file.hash.value}</li>
              ))}</ul>
            </details>
          )}
        </div>
      </article>
    </main>
  );
}
