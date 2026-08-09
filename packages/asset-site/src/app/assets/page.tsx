import type { Metadata } from 'next';

import { AssetCard } from '../../components/AssetCard';
import { catalogProviders, catalogSearch } from '../../lib/catalog';

export const metadata: Metadata = {
  title: 'Game assets · Antiky Assets',
  description: 'Search game-ready assets with explicit licensing and durable provenance.',
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function AssetsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = { q: one(params.q), type: one(params.type), provider: one(params.provider) };
  const assets = catalogSearch(query);
  const providers = catalogProviders();

  return (
    <main className="assets-page">
      <header className="assets-hero wrap">
        <div>
          <p className="section-label">Antiky asset library / CC0-first</p>
          <h1>Start with<br />something good.</h1>
        </div>
        <div className="assets-hero-copy">
          <p>Game-ready building blocks with clear licensing, source evidence, and formats agents can understand.</p>
          <dl className="hero-stats">
            <div><dt>Assets</dt><dd>{assets.length}</dd></div>
            <div><dt>Sources</dt><dd>{providers.length}</dd></div>
            <div><dt>License</dt><dd>CC0</dd></div>
          </dl>
        </div>
      </header>

      <form className="asset-search wrap" action="/assets" role="search">
        <label htmlFor="asset-query"><span>Search the catalog</span><small>Names, tags, creators, and categories</small></label>
        <div className="search-row">
          <input id="asset-query" name="q" defaultValue={query.q} placeholder="Try “forest”" type="search" />
          <select aria-label="Asset type" name="type" defaultValue={query.type}>
            <option value="">All types</option>
            <option value="model">Models</option>
            <option value="texture">Textures</option>
            <option value="hdri">HDRIs</option>
          </select>
          <select aria-label="Provider" name="provider" defaultValue={query.provider}>
            <option value="">All sources</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
          <button type="submit">Search</button>
        </div>
      </form>

      <section className="catalog-section wrap" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <div><p className="section-label">Browse / filtered results</p><h2 id="catalog-heading">Catalog</h2></div>
          <span>{assets.length} {assets.length === 1 ? 'asset' : 'assets'}</span>
        </div>
        {assets.length > 0 ? (
          <div className="asset-grid">{assets.map((asset) => <AssetCard asset={asset} key={asset.id} />)}</div>
        ) : (
          <div className="empty-state"><p>No assets match this search.</p></div>
        )}
      </section>
    </main>
  );
}
