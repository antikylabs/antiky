import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-mono/400.css';

import { SiteFooter } from '../components/SiteFooter';
import { SiteHeader } from '../components/SiteHeader';

import './styles.css';

export const metadata: Metadata = {
  title: 'Assets · Antiky Labs',
  description: 'Trusted building blocks for game makers and their agents.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><div id="shell"><SiteHeader />{children}<SiteFooter /></div></body>
    </html>
  );
}
