export const SITE_NAME = 'Antiky Labs';
export const SITE_TAGLINE = 'Tools for making worlds.';
export const SITE_DESCRIPTION =
  'Antiky Labs builds playable browser experiments, an emerging 2.3D game framework, active research, and future games through Antiky Worlds.';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

export const GITHUB_URL = 'https://github.com/shadowcodex';
export const BROMETAL_URL = 'https://brometal.dev';
export const BROMETAL_VERSION = '0.14.0';

export const STATUS_LINE =
  'Antiky Framework and Emberwyrd are in development. The browser studies are the work you can run today.';

export type NavLink = { href: string; label: string };

export const NAV: NavLink[] = [
  { href: '/framework', label: 'Framework' },
  { href: '/docs', label: 'Docs' },
  { href: '/worlds', label: 'Worlds' },
  { href: '/research', label: 'Research' },
  { href: '/demos', label: 'Demos' },
];

export function canonical(path: string): string {
  return new URL(path, SITE_URL).toString();
}
