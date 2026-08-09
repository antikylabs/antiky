import { searchAssets, type CatalogAsset } from '@antiky/asset-catalog';

const starterAssets: CatalogAsset[] = [];

export default function ResourcesPage() {
  const assets = searchAssets(starterAssets, { verifiedOnly: true });

  return (
    <main>
      <header>
        <a className="eyebrow" href="https://antikylabs.com">Antiky Labs</a>
        <h1>Start with something good.</h1>
        <p>
          Search reusable game assets with clear licensing, durable provenance, and formats your
          tools can understand.
        </p>
      </header>

      <form action="/" role="search">
        <label htmlFor="resource-query">Find models, textures, sprites, audio, and more</label>
        <div className="search-row">
          <input id="resource-query" name="q" placeholder="Try “low-poly forest”" type="search" />
          <button type="submit">Search resources</button>
        </div>
      </form>

      <section aria-labelledby="catalog-heading">
        <div className="section-heading">
          <h2 id="catalog-heading">Verified resources</h2>
          <span>{assets.length} available</span>
        </div>
        <div className="empty-state">
          <p>The catalog is ready for its first verified provider.</p>
          <small>Every listing will include its source, license, hash, and verification state.</small>
        </div>
      </section>
    </main>
  );
}
