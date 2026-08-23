import frameworkPackage from '../../../framework/package.json';

export const SITE_NAME = 'Antiky Labs';
export const SITE_TAGLINE = 'Build the world in your mind.';
export const SITE_DESCRIPTION =
  'Antiky Labs builds games, an open-source TypeScript framework, and a visual workspace for creators working with coding agents.';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://antikylabs.com';

export const GITHUB_URL = 'https://github.com/antikylabs/antiky';
export const STUDIO_RELEASES_URL = `${GITHUB_URL}/releases`;
export const STUDIO_RELEASES_READY = process.env.NEXT_PUBLIC_STUDIO_RELEASES_READY === 'true';
export const DISCORD_URL = 'https://discord.gg/3Qs2uejUf9';
export const BROMETAL_URL = 'https://brometal.dev';
export const BROMETAL_VERSION = frameworkPackage.dependencies.brometal;

export const STATUS_LINE =
  'Antiky Town and the browser studies run today. The broader development system and Emberwyrd remain in development.';

export type NavLink = { href: string; label: string };

export const NAV: NavLink[] = [
  { href: '/thesis', label: 'Thesis' },
  { href: '/framework', label: 'Framework' },
  { href: '/studio', label: 'Studio' },
  { href: '/games', label: 'Games' },
  { href: '/resources', label: 'Resources' },
  { href: '/research', label: 'Research' },
  { href: '/docs', label: 'Docs' },
];

export const RESOURCE_NAV: NavLink[] = [
  { href: '/resources', label: 'Resources overview' },
  { href: '/assets', label: 'Get free game assets' },
  { href: '/resources/skills', label: 'Agent skills' },
  { href: '/resources/shaders', label: 'Shader library' },
  { href: '/resources/projects', label: 'Project library' },
];

export function canonical(path: string): string {
  return new URL(path, SITE_URL).toString();
}
