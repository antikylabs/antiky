import { useState } from 'react';

import type { AntikyProject } from '@antiky/cli/project';

import { NativeTerminal } from '../NativeTerminal.tsx';
import type { StudioDevelopmentState } from '../development/coordinator.ts';
import type {
  StudioContext,
} from '../development/native.ts';
import type {
  StudioDevelopmentActions,
  StudioPlatform,
} from '../development/useStudioDevelopment.ts';
import type { NativeProjectError } from '../editor/types.ts';
import { ActivityPanel } from './ActivityPanel.tsx';
import { InspectionPanel } from './InspectionPanel.tsx';
import { LiveGameFrame } from './LiveGameFrame.tsx';
import { EmptyState, Panel } from './primitives.tsx';
import { SettingsPage } from './SettingsPage.tsx';

const brandUrl = new URL(
  '../../../../website/public/brand/antiky-labs-wordmark-and-text-white.svg',
  import.meta.url,
).href;

export type StudioShellActions = Pick<StudioDevelopmentActions, 'pause' | 'refresh' | 'resume' | 'step'>;

type StudioShellProps = Readonly<{
  platform: StudioPlatform;
  context: StudioContext;
  development: StudioDevelopmentState;
  actions: StudioShellActions;
  initialPage?: 'settings' | 'workspace';
  page?: 'settings' | 'workspace';
  project?: Pick<AntikyProject, 'manifestPath' | 'projectRoot' | 'schemaVersion'> | null;
  projectIssue?: NativeProjectError | null;
  projectOpening?: boolean;
  onOpenProject?(): void;
  onPageChange?(page: 'settings' | 'workspace'): void;
  onSspsPresenceChange?(enabled: boolean): boolean | Promise<boolean>;
  sspsPresenceEnabled?: boolean;
}>;

function ControlIcon({ children }: Readonly<{ children: string }>) {
  return <span className="control-icon" aria-hidden="true">{children}</span>;
}

function statusLabel(development: StudioDevelopmentState): string {
  if (development.status === 'connected') return 'Connected';
  if (development.status === 'connecting') return 'Connecting';
  if (development.status === 'stale') return 'Connection lost · stale view';
  return 'Disconnected';
}

function recoveryMessage(platform: StudioPlatform): string {
  return platform === 'native'
    ? 'Start antiky dev in the terminal, then retry the connection.'
    : 'Start antiky dev and open this project in the desktop app to connect.';
}

export function StudioShell({
  platform,
  context,
  development,
  actions,
  initialPage = 'workspace',
  page: controlledPage,
  project = null,
  projectIssue = null,
  projectOpening = false,
  onOpenProject = () => undefined,
  onPageChange = () => undefined,
  onSspsPresenceChange = () => false,
  sspsPresenceEnabled = true,
}: StudioShellProps) {
  const [localPage, setLocalPage] = useState(initialPage);
  const page = controlledPage ?? localPage;
  const settingsOpen = platform === 'native' && page === 'settings';
  const current = development.status === 'connected';
  const stale = development.status === 'stale';
  const snapshot = development.snapshot;
  const inspection = snapshot?.inspection;
  const session = inspection?.session;
  const mode = session?.mode;
  const lifecycle = inspection?.runtime.lifecycle;
  const pending = development.pendingControl;
  const runtimeAcceptsControls = snapshot?.connection.state === 'connected'
    && (lifecycle === 'ready' || lifecycle === 'running' || lifecycle === 'paused');
  const controlsAvailable = current
    && runtimeAcceptsControls
    && session !== undefined
    && pending === null;
  const connectionLabel = statusLabel(development);
  const projectLabel = context.projectName || 'No project selected';
  const changePage = (nextPage: 'settings' | 'workspace') => {
    setLocalPage(nextPage);
    onPageChange(nextPage);
  };

  return (
    <main className={`studio-shell connection-${development.status} page-${settingsOpen ? 'settings' : 'workspace'} platform-${platform}${!settingsOpen && project ? ' has-project-boundary' : ''}`}>
      <header className="titlebar" data-tauri-drag-region="true">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <div className="project-context" title={context.projectDirectory || undefined}>
          <strong>{projectLabel}</strong>
        </div>
        {platform === 'native' && project && (
          <button
            className="titlebar-page-button"
            disabled={projectOpening}
            onClick={onOpenProject}
            type="button"
          >{projectOpening ? 'Opening…' : 'Open project'}</button>
        )}
        {platform === 'native' && (
          <button
            aria-label={settingsOpen ? 'Return to workspace' : 'Open Settings'}
            className="titlebar-page-button"
            onClick={() => changePage(settingsOpen ? 'workspace' : 'settings')}
            type="button"
          >
            {settingsOpen ? 'Workspace' : 'Settings'}
          </button>
        )}
        <div className="connection-state" aria-label={`Development host ${connectionLabel.toLowerCase()}`}>
          <span className={`status-dot status-${development.status}`} />
          {connectionLabel}
        </div>
      </header>

      {settingsOpen ? (
        <div aria-label="Settings context" className="controlbar settings-contextbar">
          <span className="controlbar-label">Studio</span>
          <strong>Settings</strong>
          <span>Preferences are saved on this device.</span>
        </div>
      ) : (
        <nav className="controlbar" aria-label="Simulation controls">
        <span className="controlbar-label">Simulation</span>
        <div className="control-actions">
          {(development.issue || development.status === 'disconnected') && (
            <button onClick={() => void actions.refresh()} type="button">Retry</button>
          )}
          <button
            disabled={!controlsAvailable || mode !== 'running'}
            onClick={() => void actions.pause()}
            type="button"
          ><ControlIcon>Ⅱ</ControlIcon>{pending === 'pause' ? 'Pausing' : 'Pause'}</button>
          <button
            disabled={!controlsAvailable || mode !== 'paused'}
            onClick={() => void actions.resume()}
            type="button"
          ><ControlIcon>▶</ControlIcon>{pending === 'resume' ? 'Resuming' : 'Resume'}</button>
          <button
            disabled={!controlsAvailable || mode !== 'paused'}
            onClick={() => void actions.step()}
            type="button"
          ><ControlIcon>↦</ControlIcon>{pending === 'step' ? 'Stepping' : 'Step'}</button>
        </div>
        <div className="session-summary">
          <span className="state-chip">{mode ?? 'No session'}</span>
          <span>
            {session
              ? `Step ${session.clock.completedStepCount} · runtime ${inspection?.runtime.instanceId}`
              : recoveryMessage(platform)}
          </span>
          {development.issue && <span className="control-issue">{development.issue.message}</span>}
        </div>
        </nav>
      )}

      {!settingsOpen && project && (
        <div className="project-boundary" aria-label="Active project boundary">
          <span><strong>Manifest</strong>{project.manifestPath}</span>
          <span><strong>Schema {project.schemaVersion}</strong></span>
          <span><strong>Project root</strong>{project.projectRoot}</span>
          {projectIssue && (
            <span className="project-open-issue" role="alert">{projectIssue.message}</span>
          )}
        </div>
      )}

      {settingsOpen ? (
        <SettingsPage
          onSspsPresenceChange={onSspsPresenceChange}
          sspsPresenceEnabled={sspsPresenceEnabled}
        />
      ) : (
        <div className="workspace">
        <Panel
          actions={<span className="panel-state">{current ? snapshot?.connection.state : connectionLabel}</span>}
          className="game-panel"
          title="Live game"
          workspaceArea="game"
        >
          <div className="game-stage">
            {current && snapshot ? (
              <LiveGameFrame
                developmentSessionId={snapshot.developmentSessionId}
                gameUrl={snapshot.project.gameUrl}
                runtimeConnected={snapshot.connection.state === 'connected'}
              />
            ) : (
              <EmptyState title={stale ? 'Live game disconnected' : 'No live game'}>
                {stale
                  ? 'The last snapshot is retained below as stale. Reconnect before using the game view.'
                  : 'The configured game appears here when the development host is available.'}
              </EmptyState>
            )}
          </div>
        </Panel>

        <Panel
          actions={<span className="panel-state">Local</span>}
          className="terminal-panel"
          title="Terminal"
          workspaceArea="terminal"
        >
          <div className="terminal-surface" data-terminal-platform={platform}>
            {platform === 'native' ? <NativeTerminal /> : (
              <EmptyState title="Native terminal unavailable">
                Open this project in the desktop app to use the embedded terminal.
              </EmptyState>
            )}
          </div>
        </Panel>

        <InspectionPanel snapshot={snapshot} stale={stale} />
        <ActivityPanel
          issue={development.issue}
          mcpCallLog={development.mcpCallLog}
          snapshot={snapshot}
          stale={stale}
        />
        </div>
      )}

      <footer className="statusbar">
        <span><span className={`status-dot status-${development.status}`} />{connectionLabel}</span>
        <span>Build {snapshot?.build.revision ?? '—'}</span>
        <span>Runtime {inspection?.runtime.instanceId ?? '—'}</span>
        <span>Frame {inspection?.measurements.runtime.frameCount ?? '—'}</span>
        <span>Draws {inspection?.measurements.render.drawCalls ?? '—'}</span>
      </footer>
    </main>
  );
}
