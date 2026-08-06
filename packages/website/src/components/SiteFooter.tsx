import Link from 'next/link';
import { BROMETAL_URL, GITHUB_URL, NAV, SITE_NAME } from '@/lib/site';
import { ArrowUpRight } from '@/components/Icons';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <div>
          <Link className="footer-brand" href="/">{SITE_NAME}</Link>
          <p>Playable experiments, an emerging framework, and future worlds.</p>
        </div>
        <nav aria-label="Footer navigation">
          {NAV.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <a href={BROMETAL_URL} target="_blank" rel="noreferrer">BroMetal <ArrowUpRight /></a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub <ArrowUpRight /></a>
        </nav>
      </div>
      <div className="wrap footer-note">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        {process.env.NODE_ENV === 'production' && (
          <span className="live-presence" role="status" aria-live="polite">
            <span className="live-presence-dot" aria-hidden="true" />
            <span><span data-ssps-live-count>—</span> active now</span>
          </span>
        )}
        <span>Antiky Framework is emerging. Emberwyrd is planned.</span>
      </div>
    </footer>
  );
}
