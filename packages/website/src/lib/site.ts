export const SITE_NAME = 'Antiky Labs';
export const SITE_TAGLINE = 'Build the world in your mind.';
export const SITE_DESCRIPTION =
  'Antiky Labs is a game technology lab building games and an AI-native development system around human creative authority.';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

export const GITHUB_URL = 'https://github.com/antikylabs/antiky';
export const STUDIO_RELEASES_URL = `${GITHUB_URL}/releases`;
export const STUDIO_RELEASES_READY = process.env.NEXT_PUBLIC_STUDIO_RELEASES_READY === 'true';
export const DISCORD_URL = 'https://discord.gg/3Qs2uejUf9';
export const BROMETAL_URL = 'https://brometal.dev';
export const BROMETAL_VERSION = '0.14.0';

export const STATUS_LINE =
  'Antiky Town and the browser studies run today. The broader development system and Emberwyrd remain in development.';

export type NavLink = { href: string; label: string };

export const NAV: NavLink[] = [
  { href: '/thesis', label: 'Thesis' },
  { href: '/studio', label: 'Studio' },
  { href: '/framework', label: 'Framework' },
  { href: '/games', label: 'Games' },
  { href: '/assets', label: 'Assets' },
  { href: '/research', label: 'Research' },
  { href: '/docs', label: 'Docs' },
];

export function canonical(path: string): string {
  return new URL(path, SITE_URL).toString();
}
