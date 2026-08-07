import { useState, type FormEvent } from 'react';

import type { NativeRecentProject } from '../editor/types.ts';

const brandUrl = new URL(
  '../../../../website/public/brand/antiky-labs-wordmark-and-text-white.svg',
  import.meta.url,
).href;

type ProjectLauncherProps = Readonly<{
  creating: boolean;
  issue: Readonly<{ code: string; message: string }> | null;
  loadingRecentProjects: boolean;
  onCreateProject(name: string): void;
  onOpenProject(): void;
  onOpenRecentProject(manifestPath: string): void;
  onOpenSettings(): void;
  opening: boolean;
  recentProjects: readonly NativeRecentProject[];
  settingsOpen?: boolean;
}>;

function projectName(manifestPath: string): string {
  const fileName = manifestPath.split('/').at(-1) ?? manifestPath;
  const words = fileName.replace(/\.antiky$/u, '').split(/[-_\s]+/u).filter(Boolean);
  return words.map((word) => `${word.slice(0, 1).toLocaleUpperCase()}${word.slice(1)}`).join(' ');
}

export function ProjectLauncher({
  creating,
  issue,
  loadingRecentProjects,
  onCreateProject,
  onOpenProject,
  onOpenRecentProject,
  onOpenSettings,
  opening,
  recentProjects,
  settingsOpen = false,
}: ProjectLauncherProps) {
  const [name, setName] = useState('');
  const busy = creating || opening;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    if (normalizedName) onCreateProject(normalizedName);
  };

  return (
    <main className="project-launcher">
      <header className="titlebar" data-tauri-drag-region="true">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <button
          aria-label={settingsOpen ? 'Return to projects' : 'Open Settings'}
          className="titlebar-page-button"
          onClick={onOpenSettings}
          type="button"
        >{settingsOpen ? 'Workspace' : 'Settings'}</button>
      </header>
      <section
        aria-hidden={settingsOpen || undefined}
        className="launcher-stage"
        inert={settingsOpen}
        aria-label="Project launcher"
      >
        <div className="launcher-card launcher-create">
          <span className="launcher-eyebrow">New</span>
          <h1 id="launcher-heading">Create a project</h1>
          <p>Name the project, then choose the folder where its <code>.antiky</code> file belongs.</p>
          <form onSubmit={submit}>
            <label htmlFor="project-name">Project name</label>
            <input
              autoComplete="off"
              disabled={busy}
              id="project-name"
              maxLength={128}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Harbor Lights"
              value={name}
            />
            <button disabled={busy || name.trim().length === 0} type="submit">
              {creating ? 'Creating…' : 'Create project'}
            </button>
          </form>
        </div>

        <div className="launcher-card launcher-recents">
          <div className="launcher-recents-heading">
            <div>
              <span className="launcher-eyebrow">Continue</span>
              <h2>Recent projects</h2>
            </div>
            <button disabled={busy} onClick={onOpenProject} type="button">
              {opening ? 'Opening…' : 'Open project'}
            </button>
          </div>
          {loadingRecentProjects ? (
            <p className="launcher-empty">Loading recent projects…</p>
          ) : recentProjects.length === 0 ? (
            <p className="launcher-empty">No recent projects yet.</p>
          ) : (
            <ul className="recent-project-list">
              {recentProjects.map((project) => (
                <li key={project.manifestPath}>
                  <button
                    aria-disabled={!project.available}
                    disabled={busy || !project.available}
                    onClick={() => onOpenRecentProject(project.manifestPath)}
                    title={project.manifestPath}
                    type="button"
                  >
                    <span>{projectName(project.manifestPath)}</span>
                    <code>{project.projectRoot}</code>
                    {!project.available && <small>Project file is missing</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {issue && (
          <div className="launcher-issue" role="alert">
            <strong>{issue.code}</strong>
            <span>{issue.message}</span>
          </div>
        )}
      </section>
    </main>
  );
}
