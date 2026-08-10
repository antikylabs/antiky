'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AssetCard } from './AssetCard';
import { catalogCount, catalogFormats, catalogProviders, catalogSearch, type PublicCatalogQuery } from '../lib/catalog';

const PAGE_SIZE = 48;

function pageLink(query: PublicCatalogQuery, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/assets?${search}` : '/assets';
}

export function AssetCatalog() {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const syncSearch = () => setSearch(window.location.search);
    syncSearch();
    window.addEventListener('popstate', syncSearch);
    return () => window.removeEventListener('popstate', syncSearch);
  }, []);

  const searchParams = new URLSearchParams(search);
  const query = {
    q: searchParams.get('q') ?? '',
    type: searchParams.get('type') ?? '',
    provider: searchParams.get('provider') ?? '',
    dimension: searchParams.get('dimension') ?? '',
    format: searchParams.get('format') ?? '',
    verification: searchParams.get('verification') ?? '',
    sort: searchParams.get('sort') ?? 'random',
  };
  const matches = catalogSearch(query);
  const providers = catalogProviders();
  const formats = catalogFormats();
  const requestedPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const assets = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <div><dt>Assets</dt><dd>{catalogCount()}</dd></div>
            <div><dt>Sources</dt><dd>{providers.length}</dd></div>
            <div><dt>License</dt><dd>CC0</dd></div>
          </dl>
          <div className="agent-guide-links" aria-label="Agent resources">
            <Link className="agent-guide-link" href="/llms.txt"><span>Agents:</span> llms.txt <span aria-hidden="true">↗</span></Link>
            <Link className="agent-guide-link" href="/llms-full.txt"><span>Full context:</span> llms-full.txt <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </header>

      <form className="asset-search wrap" action="/assets" role="search" key={search}>
        <label htmlFor="asset-query"><span>Search the catalog</span><small>Names, tags, creators, and categories</small></label>
        <div className="search-row">
          <input id="asset-query" name="q" defaultValue={query.q} placeholder="Try “forest”" type="search" />
          <button type="submit">Search</button>
        </div>
        <div className="filter-row">
          <select aria-label="Asset type" name="type" defaultValue={query.type}>
            <option value="">All types</option>
            <option value="audio">Audio</option>
            <option value="font">Fonts</option>
            <option value="hdri">HDRIs</option>
            <option value="model">Models</option>
            <option value="sprite">Sprites</option>
            <option value="texture">Textures</option>
          </select>
          <select aria-label="Dimension" name="dimension" defaultValue={query.dimension}>
            <option value="">2D + 3D</option>
            <option value="2d">2D assets</option>
            <option value="3d">3D assets</option>
          </select>
          <select aria-label="Provider" name="provider" defaultValue={query.provider}>
            <option value="">All sources</option>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
          <select aria-label="Format" name="format" defaultValue={query.format}>
            <option value="">All formats</option>
            {formats.map((format) => <option key={format} value={format}>{format.toUpperCase()}</option>)}
          </select>
          <select aria-label="Verification status" name="verification" defaultValue={query.verification}>
            <option value="">All statuses</option>
            <option value="cataloged">Cataloged metadata</option>
            <option value="source-verified">Source verified</option>
            <option value="install-verified">Install verified</option>
          </select>
          <select aria-label="Sort assets" name="sort" defaultValue={query.sort}>
            <option value="random">Featured shuffle</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="files-desc">Most files</option>
            <option value="newest">Recently cataloged</option>
          </select>
        </div>
        {search && <a className="clear-filters" href="/assets">Clear all filters</a>}
      </form>

      <section className="catalog-section wrap" aria-labelledby="catalog-heading">
        <div className="section-heading">
          <div><p className="section-label">Browse / filtered results</p><h2 id="catalog-heading">Catalog</h2></div>
          <span>{matches.length} {matches.length === 1 ? 'asset' : 'assets'} / page {page} of {pageCount}</span>
        </div>
        {assets.length > 0 ? (
          <div className="asset-grid">{assets.map((asset) => <AssetCard asset={asset} key={asset.id} />)}</div>
        ) : (
          <div className="empty-state"><p>No assets match this search.</p></div>
        )}
        {matches.length > PAGE_SIZE && (
          <nav className="pagination" aria-label="Catalog pages">
            {page > 1 ? <a href={pageLink(query, page - 1)}>← Previous</a> : <span />}
            <span>Page {page} of {pageCount}</span>
            {page < pageCount ? <a href={pageLink(query, page + 1)}>Next →</a> : <span />}
          </nav>
        )}
        <aside className="verification-guide" aria-label="Catalog status guide">
          <p><strong>Cataloged metadata</strong> records source and licensing.</p>
          <p><strong>Source metadata verified</strong> comes from an official provider API or source page.</p>
          <p><strong>Install verified</strong> adds file sizes and hashes checked during installation.</p>
        </aside>
      </section>
    </main>
  );
}
