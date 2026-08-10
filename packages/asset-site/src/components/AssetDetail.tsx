import Link from 'next/link';

import type { CatalogAsset } from '@antiky/asset-catalog';
import { fileCountLabel, VERIFICATION_COPY } from '../lib/presentation';

export function AssetDetail({ asset }: Readonly<{ asset: CatalogAsset }>) {
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
            <div><dt>Formats</dt><dd>{asset.formats.join(', ') || 'Not published'}</dd></div>
            <div><dt>Status</dt><dd><span className="verification-name">{verification.label}</span><small>{verification.description}</small></dd></div>
            {asset.facts.publishedAt && <div><dt>Published</dt><dd>{asset.facts.publishedAt.slice(0, 10)}</dd></div>}
            {asset.facts.downloadCount !== undefined && <div><dt>Source downloads</dt><dd>{asset.facts.downloadCount.toLocaleString('en-US')}</dd></div>}
            {asset.facts.polygonCount !== undefined && <div><dt>Polygons</dt><dd>{asset.facts.polygonCount.toLocaleString('en-US')}</dd></div>}
            {asset.facts.maxResolution && <div><dt>Max resolution</dt><dd>{asset.facts.maxResolution.join(' × ')}</dd></div>}
          </dl>
          <p className="notice"><span>Attribution record</span>{asset.attribution.notice}</p>
          <div className="actions">
            <a className="button button-primary" href={asset.upstream.url}>View original source</a>
            <a href={`https://catalog-api.antikylabs.com/v1/assets/${asset.provider.id}/${asset.slug}.json`}>Asset JSON</a>
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
