'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from '@/components/Icons';
import { DISCORD_URL, NAV, RESOURCE_NAV, SITE_NAME } from '@/lib/site';

export default function SiteHeader() {
  const pathname = usePathname();
  const renderLink = (link: (typeof NAV)[number]) => {
    const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
    return (
      <Link key={link.href} href={link.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
        {link.label}
      </Link>
    );
  };
  const renderLinks = (mobile = false) => NAV.map((link) => (
    link.href === '/resources'
      ? <ResourcesMenu mobile={mobile} pathname={pathname} key={link.href} />
      : renderLink(link)
  ));

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}>
        <Mark />
        <span>{SITE_NAME}</span>
      </Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{renderLinks()}</nav>
      <div className="header-actions">
        <Link className="header-secondary" href="/assets">Get free game assets</Link>
        <a className="header-action" href={DISCORD_URL} target="_blank" rel="noreferrer">
          Join Discord <ArrowUpRight />
        </a>
      </div>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {renderLinks(true)}
          <Link href="/demos">Demos</Link>
          <Link className="mobile-secondary-action" href="/assets">Get free game assets</Link>
          <a className="mobile-primary-action" href={DISCORD_URL} target="_blank" rel="noreferrer">
            Join Discord <ArrowUpRight />
          </a>
        </nav>
      </details>
    </header>
  );
}

function ResourcesMenu({ mobile, pathname }: { mobile: boolean; pathname: string }) {
  const active = pathname === '/assets' || pathname.startsWith('/assets/')
    || pathname === '/resources' || pathname.startsWith('/resources/');

  return (
    <details className={mobile ? 'mobile-resource-menu' : 'nav-resources'}>
      <summary className={active ? 'active' : undefined}>Resources</summary>
      <div className="resource-menu-links">
        {RESOURCE_NAV.map((link) => {
          const linkActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link href={link.href} className={linkActive ? 'active' : undefined} aria-current={linkActive ? 'page' : undefined} key={link.href}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
      <path d="M5 21V7h18v14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m9 18 5-9 5 9M11.2 14h5.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
