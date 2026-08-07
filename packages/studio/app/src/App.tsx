import { useState } from 'react';

import { ProjectLauncher } from './components/ProjectLauncher.tsx';
import { StudioShell } from './components/StudioShell.tsx';
import {
  useStudioDevelopment,
  type StudioPlatform,
} from './development/useStudioDevelopment.ts';
import { useEditorProject } from './editor/useEditorProject.ts';

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
  const [page, setPage] = useState(initialPage);
  const editor = useEditorProject(platform);
  const view = useStudioDevelopment(platform, editor.state.project);
  const changePage = (nextPage: StudioPage) => {
    setPage(nextPage);
    onPageChange(nextPage);
  };

  if (platform === 'native' && page === 'workspace' && editor.state.project === null) {
    return (
      <ProjectLauncher
        issue={editor.state.issue}
        onOpenProject={() => { void editor.openProject(); }}
        onOpenSettings={() => changePage('settings')}
        opening={editor.state.opening}
      />
    );
  }

  return (
    <StudioShell
      actions={view.actions}
      context={view.context}
      development={view.development}
      onOpenProject={() => { void editor.openProject(); }}
      onPageChange={changePage}
      onSspsPresenceChange={onSspsPresenceChange}
      platform={platform}
      page={page}
      project={editor.state.project}
      projectIssue={editor.state.issue}
      projectOpening={editor.state.opening}
      sspsPresenceEnabled={sspsPresenceEnabled}
    />
  );
}
