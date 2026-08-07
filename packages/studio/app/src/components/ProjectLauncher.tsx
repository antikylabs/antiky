const brandUrl = new URL(
  '../../../../website/public/brand/antiky-labs-wordmark-and-text-white.svg',
  import.meta.url,
).href;

type ProjectLauncherProps = Readonly<{
  issue: Readonly<{ code: string; message: string }> | null;
  onOpenProject(): void;
  onOpenSettings(): void;
  opening: boolean;
}>;

export function ProjectLauncher({
  issue,
  onOpenProject,
  onOpenSettings,
  opening,
}: ProjectLauncherProps) {
  return (
    <main className="project-launcher">
      <header className="titlebar" data-tauri-drag-region="true">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <button
          aria-label="Open Settings"
          className="titlebar-page-button"
          onClick={onOpenSettings}
          type="button"
        >Settings</button>
      </header>
      <section className="launcher-stage" aria-labelledby="launcher-heading">
        <div className="launcher-copy">
          <h1 id="launcher-heading">Open a project</h1>
          <p>Choose a <code>.antiky</code> file.</p>
          <button disabled={opening} onClick={onOpenProject} type="button">
            {opening ? 'Opening…' : 'Choose file'}
          </button>
          {issue && (
            <div className="launcher-issue" role="alert">
              <strong>{issue.code}</strong>
              <span>{issue.message}</span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
