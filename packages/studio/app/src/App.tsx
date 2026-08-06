import type { ReactNode } from 'react';

import { NativeTerminal } from './NativeTerminal.tsx';

const brandUrl = new URL(
  '../../../website/public/brand/antiky-labs-wordmark-and-text-white.svg',
  import.meta.url,
).href;

type StudioPlatform = 'browser' | 'native';

type AppProps = Readonly<{
  platform: StudioPlatform;
}>;

type PanelProps = Readonly<{
  className: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}>;

function Panel({ className, title, children, actions }: PanelProps) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="panel-heading">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">A</span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function TabList({ labels, active }: Readonly<{ labels: readonly string[]; active: string }>) {
  return (
    <div className="tabs" role="tablist" aria-label="Panel views">
      {labels.map((label) => (
        <button
          aria-selected={label === active}
          className={label === active ? 'active' : undefined}
          key={label}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ControlIcon({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="control-icon" aria-hidden="true">{children}</span>;
}

export function App({ platform }: AppProps) {
  return (
    <main className="studio-shell">
      <header className="titlebar">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <div className="project-context">
          <span className="technical-label">Workspace</span>
          <strong>No project session</strong>
        </div>
        <div className="connection-state" aria-label="Development host disconnected">
          <span className="status-dot status-offline" />
          Disconnected
        </div>
      </header>

      <nav className="controlbar" aria-label="Simulation controls">
        <div className="session-summary">
          <span className="state-chip">No session</span>
          <span>Start <code>antiky dev</code> to connect</span>
        </div>
        <div className="control-actions">
          <button disabled type="button"><ControlIcon>Ⅱ</ControlIcon>Pause</button>
          <button disabled type="button"><ControlIcon>▶</ControlIcon>Resume</button>
          <button disabled type="button"><ControlIcon>↦</ControlIcon>Step</button>
        </div>
      </nav>

      <div className="workspace">
        <Panel
          actions={<span className="panel-state">Local</span>}
          className="terminal-panel"
          title="Terminal"
        >
          <div className="terminal-surface" data-terminal-platform={platform}>
            {platform === 'native' ? (
              <NativeTerminal />
            ) : (
              <EmptyState title="Native terminal unavailable">
                Open this project in the desktop app to use the embedded terminal.
              </EmptyState>
            )}
          </div>
        </Panel>

        <Panel
          actions={<span className="panel-state">Waiting for game</span>}
          className="game-panel"
          title="Live game"
        >
          <div className="game-stage">
            <EmptyState title="No live game">
              The configured game appears here when the development host is available.
            </EmptyState>
          </div>
        </Panel>

        <Panel
          actions={<span className="panel-state">0 entities</span>}
          className="inspection-panel"
          title="Inspection"
        >
          <TabList active="Hierarchy" labels={['Hierarchy', 'Stores', 'Snapshot']} />
          <div className="inspection-body">
            <EmptyState title="No world inspection">
              Connect a compatible runtime to inspect its complete published hierarchy.
            </EmptyState>
          </div>
        </Panel>

        <Panel
          className="activity-panel"
          title="Activity"
          actions={<span className="panel-state">Runtime-instance memory</span>}
        >
          <TabList active="Events" labels={['Events', 'MCP calls', 'Diagnostics']} />
          <div className="activity-body">
            <div className="activity-column-head" aria-hidden="true">
              <span>Sequence</span>
              <span>Source</span>
              <span>Record</span>
              <span>Time</span>
            </div>
            <EmptyState title="No accepted events">
              Event-sourcing facts appear here in source order after a runtime publishes them.
            </EmptyState>
          </div>
        </Panel>
      </div>

      <footer className="statusbar">
        <span><span className="status-dot status-offline" />Host unavailable</span>
        <span>Build —</span>
        <span>Runtime —</span>
        <span>Frame —</span>
      </footer>
    </main>
  );
}
