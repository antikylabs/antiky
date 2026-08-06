import { StudioShell } from './components/StudioShell.tsx';
import {
  useStudioDevelopment,
  type StudioPlatform,
} from './development/useStudioDevelopment.ts';

export type StudioPage = 'settings' | 'workspace';

export function resolveInitialStudioPage(platform: StudioPlatform, hash: string): StudioPage {
  return platform === 'native' && hash === '#settings' ? 'settings' : 'workspace';
}

export function studioPageHref(
  location: Readonly<{ pathname: string; search: string }>,
  page: StudioPage,
): string {
  const base = `${location.pathname}${location.search}`;
  return page === 'settings' ? `${base}#settings` : base;
}

type AppProps = Readonly<{
  initialPage?: StudioPage;
  onPageChange?(page: StudioPage): void;
  onSspsPresenceChange?(enabled: boolean): boolean | Promise<boolean>;
  platform: StudioPlatform;
  sspsPresenceEnabled?: boolean;
}>;

export function App({
  initialPage = 'workspace',
  onPageChange = () => undefined,
  onSspsPresenceChange = () => false,
  platform,
  sspsPresenceEnabled = true,
}: AppProps) {
  const view = useStudioDevelopment(platform);
  return (
    <StudioShell
      actions={view.actions}
      context={view.context}
      development={view.development}
      initialPage={initialPage}
      onPageChange={onPageChange}
      onSspsPresenceChange={onSspsPresenceChange}
      platform={platform}
      sspsPresenceEnabled={sspsPresenceEnabled}
    />
  );
}
