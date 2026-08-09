import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { catalogAsset } from '../../../../lib/catalog';

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

  return (
    <main>
      <Link className="back-link" href="/assets">← All assets</Link>
      <article className="asset-detail">
        <img className="detail-preview" src={asset.preview.url} width={512} height={512} alt={`Preview of ${asset.name}`} />
        <div>
          <div className="asset-meta"><span>{asset.provider.name}</span><span>{asset.kind}</span></div>
          <h1>{asset.name}</h1>
          <p>{asset.description}</p>
          <dl>
            <div><dt>License</dt><dd><a href={asset.license.referenceUrl}>{asset.license.name}</a></dd></div>
            <div><dt>Creator</dt><dd>{asset.provenance.creator}</dd></div>
            <div><dt>Upstream ID</dt><dd><code>{asset.upstream.id}</code></dd></div>
            <div><dt>Files hash</dt><dd><code>{asset.upstream.filesHash}</code></dd></div>
            <div><dt>Formats</dt><dd>{asset.formats.join(', ') || 'Pending ingestion'}</dd></div>
            <div><dt>Status</dt><dd>{asset.verification}</dd></div>
          </dl>
          <p className="notice">{asset.attribution.notice}</p>
          <div className="actions">
            <a className="button" href={asset.upstream.url}>View original source</a>
            <a href={`/api/assets/${asset.provider.id}/${asset.slug}`}>JSON record</a>
          </div>
          {asset.downloads.length > 0 && (
            <details><summary>{asset.downloads.length} verified download files</summary>
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
