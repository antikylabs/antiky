'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from '@/components/Icons';
import StudioPrimaryAction from '@/components/StudioPrimaryAction';
import { DISCORD_URL, NAV, SITE_NAME } from '@/lib/site';

export default function SiteHeader() {
  const pathname = usePathname();
  const renderLinks = () => NAV.map((link) => {
    const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
    return (
      <Link key={link.href} href={link.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
        {link.label}
      </Link>
    );
  });

  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}>
        <Mark />
        <span>{SITE_NAME}</span>
      </Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{renderLinks()}</nav>
      <div className="header-actions">
        <a className="header-community" href={DISCORD_URL} target="_blank" rel="noreferrer">Discord</a>
        <StudioPrimaryAction className="header-action" />
      </div>
      <details className="mobile-menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile navigation">
          {renderLinks()}
          <Link href="/demos">Demos</Link>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord <ArrowUpRight /></a>
          <StudioPrimaryAction className="mobile-primary-action" />
        </nav>
      </details>
    </header>
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
