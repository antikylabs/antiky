import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

import type { AntikyProject } from '@antiky/cli/project';
import { getCurrentWindow } from '@tauri-apps/api/window';

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
import { changeGameFullscreen } from './gameFullscreen.ts';
import {
  DEFAULT_WORKSPACE_SPLITS,
  resizeWorkspaceSplit,
  stepWorkspaceSplit,
  WORKSPACE_SPLIT_LIMITS,
} from './workspaceLayout.ts';
import type { WorkspaceSplitAxis } from './workspaceLayout.ts';

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
  const [fullscreenIssue, setFullscreenIssue] = useState<string | null>(null);
  const [resizingAxis, setResizingAxis] = useState<WorkspaceSplitAxis | null>(null);
  const [workspaceSplits, setWorkspaceSplits] = useState(DEFAULT_WORKSPACE_SPLITS);
  const gameStageRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
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

    const enabled = platform === 'native'
      ? !gameFullscreen
      : document.fullscreenElement !== gameStage;
    try {
      const changed = await changeGameFullscreen({
        browserDocument: document,
        browserTarget: gameStage,
        enabled,
        nativeWindow: platform === 'native' ? getCurrentWindow() : undefined,
        platform,
      });
      if (!changed) {
        setFullscreenIssue('Fullscreen is unavailable in this Studio.');
        return;
      }
      setFullscreenIssue(null);
      if (platform === 'native') setGameFullscreen(enabled);
    } catch (error) {
      console.error('Studio could not change game fullscreen.', error);
      setFullscreenIssue('Studio could not change fullscreen.');
    }
  };

  useEffect(() => {
    const updateFullscreenState = () => {
      setGameFullscreen(document.fullscreenElement === gameStageRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const updateWorkspaceSplit = (axis: WorkspaceSplitAxis, pointerPosition: number) => {
    const bounds = workspaceRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const nextValue = resizeWorkspaceSplit(axis, pointerPosition, bounds);
    setWorkspaceSplits((currentSplits) => ({ ...currentSplits, [axis]: nextValue }));
  };
  const beginWorkspaceResize = (
    axis: WorkspaceSplitAxis,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingAxis(axis);
    updateWorkspaceSplit(axis, axis === 'column' ? event.clientX : event.clientY);
  };
  const continueWorkspaceResize = (
    axis: WorkspaceSplitAxis,
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    updateWorkspaceSplit(axis, axis === 'column' ? event.clientX : event.clientY);
  };
  const finishWorkspaceResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizingAxis(null);
  };
  const handleWorkspaceResizeKey = (
    axis: WorkspaceSplitAxis,
    event: KeyboardEvent<HTMLDivElement>,
  ) => {
    const nextValue = stepWorkspaceSplit(axis, workspaceSplits[axis], event.key);
    if (nextValue === workspaceSplits[axis]) return;

    event.preventDefault();
    setWorkspaceSplits((currentSplits) => ({ ...currentSplits, [axis]: nextValue }));
  };
  const workspaceStyle = {
    '--workspace-column-split': `${workspaceSplits.column}%`,
    '--workspace-row-split': `${workspaceSplits.row}%`,
  } as CSSProperties;

  return (
    <main className={`studio-shell connection-${development.status} page-${settingsOpen ? 'settings' : 'workspace'} platform-${platform}${gameFullscreen ? ' game-fullscreen' : ''}`}>
      <header className="titlebar" data-tauri-drag-region="true">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <nav
          aria-hidden={settingsOpen || undefined}
          aria-label="Simulation controls"
          className="titlebar-controls"
          inert={settingsOpen}
        >
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
        </nav>
        {development.issue && (
          <span className="titlebar-issue">{development.issue.message}</span>
        )}
        {projectIssue && (
          <span className="titlebar-issue" role="alert">{projectIssue.message}</span>
        )}
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
      </header>

      <div
        aria-hidden={settingsOpen || undefined}
        className={`workspace${resizingAxis ? ` is-resizing-${resizingAxis}` : ''}`}
        inert={settingsOpen}
        ref={workspaceRef}
        style={workspaceStyle}
      >
        <Panel
          actions={(
            <div className="panel-actions">
              <button
                aria-label="Enter game fullscreen"
                className="panel-action-button"
                disabled={!snapshot}
                onClick={() => void toggleGameFullscreen()}
                title="Enter game fullscreen"
                type="button"
              >Fullscreen</button>
              {fullscreenIssue && <span className="fullscreen-issue" role="alert">{fullscreenIssue}</span>}
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
                  ? 'Game stopped. Restart when you are ready.'
                  : recoveryMessage(platform)}
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

        <div
          role="separator"
          aria-label="Resize game and inspection panels"
          aria-orientation="vertical"
          aria-valuemax={WORKSPACE_SPLIT_LIMITS.column.max}
          aria-valuemin={WORKSPACE_SPLIT_LIMITS.column.min}
          aria-valuenow={Math.round(workspaceSplits.column)}
          className="workspace-resizer workspace-column-resizer"
          onDoubleClick={() => setWorkspaceSplits((current) => ({
            ...current,
            column: DEFAULT_WORKSPACE_SPLITS.column,
          }))}
          onKeyDown={(event) => handleWorkspaceResizeKey('column', event)}
          onLostPointerCapture={finishWorkspaceResize}
          onPointerCancel={finishWorkspaceResize}
          onPointerDown={(event) => beginWorkspaceResize('column', event)}
          onPointerMove={(event) => continueWorkspaceResize('column', event)}
          onPointerUp={finishWorkspaceResize}
          tabIndex={0}
          title="Drag or use Left and Right Arrow keys. Press Home or double-click to reset."
        />
        <div
          role="separator"
          aria-label="Resize upper and lower panels"
          aria-orientation="horizontal"
          aria-valuemax={WORKSPACE_SPLIT_LIMITS.row.max}
          aria-valuemin={WORKSPACE_SPLIT_LIMITS.row.min}
          aria-valuenow={Math.round(workspaceSplits.row)}
          className="workspace-resizer workspace-row-resizer"
          onDoubleClick={() => setWorkspaceSplits((current) => ({
            ...current,
            row: DEFAULT_WORKSPACE_SPLITS.row,
          }))}
          onKeyDown={(event) => handleWorkspaceResizeKey('row', event)}
          onLostPointerCapture={finishWorkspaceResize}
          onPointerCancel={finishWorkspaceResize}
          onPointerDown={(event) => beginWorkspaceResize('row', event)}
          onPointerMove={(event) => continueWorkspaceResize('row', event)}
          onPointerUp={finishWorkspaceResize}
          tabIndex={0}
          title="Drag or use Up and Down Arrow keys. Press Home or double-click to reset."
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
        <span>Step {session?.clock.completedStepCount ?? '—'}</span>
        <span>Frame {inspection?.measurements.runtime.frameCount ?? '—'}</span>
        <span>Draws {inspection?.measurements.render.drawCalls ?? '—'}</span>
      </footer>
    </main>
  );
}
