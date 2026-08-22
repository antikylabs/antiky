import type { Metadata } from 'next';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: 'technology',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_URL,
    type: 'website',
    locale: 'en_US',
    images: [{
      url: '/media/marketing/launch-key-art.webp',
      width: 1600,
      height: 900,
      alt: 'Illustrative Antiky Labs launch artwork showing a physical modular maquette under restrained amber and violet studio light.',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{
      url: '/media/marketing/launch-key-art.webp',
      alt: 'Illustrative Antiky Labs launch artwork showing a physical modular maquette under restrained amber and violet studio light.',
    }],
  },
};

const SITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#org` },
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === 'production' && (
          <>
            <script
              data-site="HELZNBFB"
              defer
              src="https://cdn.usefathom.com/script.js"
            />
            <script
              async
              data-site-id="268"
              src="https://usessps.com/ssps.js"
            />
          </>
        )}
      </head>
      <body>
        <script
          type="application/ld+json"
          // React escapes text children of <script>, so the JSON goes in raw.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_SCHEMA) }}
        />
        <div id="shell">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
