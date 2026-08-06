import { NativeTerminal } from '../NativeTerminal.tsx';
import type { StudioDevelopmentState } from '../development/coordinator.ts';
import type {
  StudioContext,
} from '../development/native.ts';
import type {
  StudioDevelopmentActions,
  StudioPlatform,
} from '../development/useStudioDevelopment.ts';
import { ActivityPanel } from './ActivityPanel.tsx';
import { InspectionPanel } from './InspectionPanel.tsx';
import { EmptyState, Panel } from './primitives.tsx';

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

export function StudioShell({ platform, context, development, actions }: StudioShellProps) {
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

  return (
    <main className={`studio-shell connection-${development.status}`}>
      <header className="titlebar">
        <div className="brand-lockup">
          <img alt="Antiky Labs" src={brandUrl} />
          <span>Studio</span>
        </div>
        <div className="project-context" title={context.projectDirectory || undefined}>
          <span className="technical-label">Workspace</span>
          <strong>{projectLabel}</strong>
        </div>
        <div className="connection-state" aria-label={`Development host ${connectionLabel.toLowerCase()}`}>
          <span className={`status-dot status-${development.status}`} />
          {connectionLabel}
        </div>
      </header>

      <nav className="controlbar" aria-label="Simulation controls">
        <div className="session-summary">
          <span className="state-chip">{mode ?? 'No session'}</span>
          <span>
            {session
              ? `Step ${session.clock.completedStepCount} · runtime ${inspection?.runtime.instanceId}`
              : recoveryMessage(platform)}
          </span>
          {development.issue && <span className="control-issue">{development.issue.message}</span>}
        </div>
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
      </nav>

      <div className="workspace">
        <Panel actions={<span className="panel-state">Local</span>} className="terminal-panel" title="Terminal">
          <div className="terminal-surface" data-terminal-platform={platform}>
            {platform === 'native' ? <NativeTerminal /> : (
              <EmptyState title="Native terminal unavailable">
                Open this project in the desktop app to use the embedded terminal.
              </EmptyState>
            )}
          </div>
        </Panel>

        <Panel
          actions={<span className="panel-state">{current ? snapshot?.connection.state : connectionLabel}</span>}
          className="game-panel"
          title="Live game"
        >
          <div className="game-stage">
            {current && snapshot ? (
              <iframe
                allow="autoplay; fullscreen; gamepad"
                allowFullScreen
                referrerPolicy="no-referrer"
                sandbox="allow-same-origin allow-scripts allow-pointer-lock"
                src={snapshot.config.gameUrl}
                title="Live Antiky game"
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

        <InspectionPanel snapshot={snapshot} stale={stale} />
        <ActivityPanel
          issue={development.issue}
          mcpCallLog={development.mcpCallLog}
          snapshot={snapshot}
          stale={stale}
        />
      </div>

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
