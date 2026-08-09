import Link from 'next/link';
import { BROMETAL_URL, DISCORD_URL, GITHUB_URL, NAV, SITE_NAME, STUDIO_RELEASES_URL } from '@/lib/site';
import { ArrowUpRight } from '@/components/Icons';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <div>
          <Link className="footer-brand" href="/">{SITE_NAME}</Link>
          <p>A game technology lab building games and an AI-native development system around human creative authority.</p>
        </div>
        <nav aria-label="Footer navigation">
          {NAV.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link href="/demos">Demos</Link>
          <a href={STUDIO_RELEASES_URL} target="_blank" rel="noreferrer">Studio releases <ArrowUpRight /></a>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">Discord <ArrowUpRight /></a>
          <a href={BROMETAL_URL} target="_blank" rel="noreferrer">BroMetal <ArrowUpRight /></a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub <ArrowUpRight /></a>
        </nav>
      </div>
      <div className="wrap footer-note">
        <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        {process.env.NODE_ENV === 'production' && (
          <span className="live-presence" role="status" aria-live="polite">
            <span className="live-presence-dot" aria-hidden="true" />
            <span><span id="ssps-live-count">—</span> active now</span>
          </span>
        )}
        <span>Current proof is public. The larger game and system are still being built.</span>
      </div>
    </footer>
  );
}
