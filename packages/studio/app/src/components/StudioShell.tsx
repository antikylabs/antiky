import { useEffect, useRef, useState } from 'react';

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

export type StudioShellActions = Pick<StudioDevelopmentActions,
  'pause' | 'refresh' | 'restartGame' | 'resume' | 'step' | 'stopGame'
>;

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
  if (development.status === 'stopped') return 'Stopped';
  return 'Disconnected';
}

function recoveryMessage(platform: StudioPlatform): string {
  return platform === 'native'
    ? 'Studio starts this project host automatically. Retry if startup did not complete.'
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
  const [gameFullscreen, setGameFullscreen] = useState(false);
  const gameStageRef = useRef<HTMLDivElement>(null);
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
  const pendingLifecycle = development.pendingLifecycle;
  const runtimeAcceptsControls = snapshot?.connection.state === 'connected'
    && (lifecycle === 'ready' || lifecycle === 'running' || lifecycle === 'paused');
  const controlsAvailable = current
    && runtimeAcceptsControls
    && session !== undefined
    && pending === null
    && pendingLifecycle === null;
  const lifecycleControlsAvailable = platform === 'native'
    && project !== null
    && pending === null
    && pendingLifecycle === null;
  const connectionLabel = statusLabel(development);
  const projectLabel = context.projectName || 'No project selected';
  const gameReconnecting = snapshot !== null && (
    development.status !== 'connected' || snapshot.connection.state !== 'connected'
  );
  const changePage = (nextPage: 'settings' | 'workspace') => {
    setLocalPage(nextPage);
    onPageChange(nextPage);
  };
  const toggleGameFullscreen = async () => {
    const gameStage = gameStageRef.current;
    if (!gameStage) return;

    if (document.fullscreenElement === gameStage) {
      await document.exitFullscreen();
      return;
    }

    await gameStage.requestFullscreen();
  };

  useEffect(() => {
    const updateFullscreenState = () => {
      setGameFullscreen(document.fullscreenElement === gameStageRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  return (
    <main className={`studio-shell connection-${development.status} page-${settingsOpen ? 'settings' : 'workspace'} platform-${platform}`}>
      <header className="titlebar" data-tauri-drag-region="true">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <div className="project-context">
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

      <nav
        aria-hidden={settingsOpen || undefined}
        className="controlbar"
        inert={settingsOpen}
        aria-label="Simulation controls"
      >
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
          {platform === 'native' && project && (
            <>
              <button
                disabled={!lifecycleControlsAvailable}
                onClick={() => void actions.restartGame()}
                type="button"
              >{pendingLifecycle === 'restart' ? 'Restarting…' : 'Restart game'}</button>
              <button
                disabled={!lifecycleControlsAvailable || development.status === 'stopped'}
                onClick={() => void actions.stopGame()}
                type="button"
              >{pendingLifecycle === 'stop' ? 'Stopping…' : 'Stop game'}</button>
            </>
          )}
        </div>
        <div className="session-summary">
          <span className="state-chip">{mode ?? 'No session'}</span>
          <span>
            {session
              ? `Step ${session.clock.completedStepCount} · runtime ${inspection?.runtime.instanceId}`
              : development.status === 'stopped'
                ? 'Game stopped. Restart when you are ready.'
                : recoveryMessage(platform)}
          </span>
          {development.issue && <span className="control-issue">{development.issue.message}</span>}
          {projectIssue && (
            <span className="project-open-issue" role="alert">{projectIssue.message}</span>
          )}
        </div>
      </nav>

      <div
        aria-hidden={settingsOpen || undefined}
        className="workspace"
        inert={settingsOpen}
      >
        <Panel
          actions={(
            <div className="panel-actions">
              <span className="panel-state">{current ? snapshot?.connection.state : connectionLabel}</span>
              <button
                aria-label="Enter game fullscreen"
                className="panel-action-button"
                disabled={!snapshot}
                onClick={() => void toggleGameFullscreen()}
                title="Enter game fullscreen"
                type="button"
              >Fullscreen</button>
            </div>
          )}
          className="game-panel"
          title="Live game"
          workspaceArea="game"
        >
          <div className="game-stage" ref={gameStageRef}>
            {snapshot ? (
              <>
                <LiveGameFrame
                  developmentSessionId={snapshot.developmentSessionId}
                  gameUrl={snapshot.project.gameUrl}
                />
                {gameReconnecting && (
                  <span className="game-connection-note" role="status">
                    {stale ? 'Reconnecting…' : 'Waiting for game…'}
                  </span>
                )}
                {gameFullscreen && (
                  <button
                    aria-label="Exit game fullscreen"
                    className="fullscreen-exit-button"
                    onClick={() => void toggleGameFullscreen()}
                    type="button"
                  >Exit fullscreen</button>
                )}
              </>
            ) : (
              <EmptyState title={development.status === 'stopped' ? 'Game stopped' : 'No live game'}>
                {development.status === 'stopped'
                  ? 'Restart the game to start a fresh managed session.'
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
            {platform === 'native' ? <NativeTerminal visible={!settingsOpen} /> : (
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

      {settingsOpen && (
        <SettingsPage
          onSspsPresenceChange={onSspsPresenceChange}
          sspsPresenceEnabled={sspsPresenceEnabled}
        />
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
