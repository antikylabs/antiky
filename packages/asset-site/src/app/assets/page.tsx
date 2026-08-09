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
    <main>
      <header>
        <a className="eyebrow" href="https://antikylabs.com">Antiky Labs</a>
        <h1>Start with something good.</h1>
        <p>Game-ready building blocks with clear licensing, source evidence, and formats agents can understand.</p>
      </header>

      <form action="/assets" role="search">
        <label htmlFor="asset-query">Search assets</label>
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

      <section aria-labelledby="catalog-heading">
        <div className="section-heading">
          <h2 id="catalog-heading">Catalog</h2>
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
