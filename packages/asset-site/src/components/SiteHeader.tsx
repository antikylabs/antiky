import Link from 'next/link';

const NAV = [
  ['https://antikylabs.com/thesis', 'Thesis'],
  ['https://antikylabs.com/studio', 'Studio'],
  ['https://antikylabs.com/framework', 'Framework'],
  ['https://antikylabs.com/games', 'Games'],
  ['https://antikylabs.com/research', 'Research'],
  ['https://antikylabs.com/docs', 'Docs'],
] as const;

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path d="M5 21V7h18v14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m9 18 5-9 5 9M11.2 14h5.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <a href="https://antikylabs.com" className="brand" aria-label="Antiky Labs home"><Mark /><span>Antiky Labs</span></a>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {NAV.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        <Link href="/assets" className="active" aria-current="page">Assets</Link>
      </nav>
      <a className="header-action" href="https://antikylabs.com/studio">Explore Studio <span aria-hidden="true">→</span></a>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          <Link href="/assets" aria-current="page">Assets</Link>
          {NAV.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>
      </details>
    </header>
  );
}
