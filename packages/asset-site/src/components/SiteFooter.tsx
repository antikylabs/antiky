import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <div>
          <a className="footer-brand" href="https://antikylabs.com">Antiky Labs</a>
          <p>Trusted game-building assets with explicit licenses, durable provenance, and records agents can understand.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/assets">Assets</Link>
          <a href="https://antikylabs.com/studio">Studio</a>
          <a href="https://antikylabs.com/docs">Docs</a>
          <a href="https://github.com/antikylabs/antiky">GitHub ↗</a>
        </nav>
      </div>
      <div className="wrap footer-note">
        <span>© {new Date().getFullYear()} Antiky Labs</span>
        <span>CC0-first. Source evidence stays attached.</span>
      </div>
    </footer>
  );
}
