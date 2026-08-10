export type CliDiagnosticLevel = 'info' | 'warning' | 'error';

export type CliDiagnosticCode =
  | 'ANTIKY_SESSION_STARTING'
  | 'ANTIKY_SESSION_READY'
  | 'ANTIKY_SESSION_STOPPING'
  | 'ANTIKY_SESSION_STOPPED'
  | 'ANTIKY_SESSION_START_FAILED'
  | 'ANTIKY_COMPONENT_STARTED'
  | 'ANTIKY_CHILD_EXITED'
  | 'ANTIKY_CLEANUP_FAILED'
  | 'ANTIKY_RUNTIME_CONNECTED'
  | 'ANTIKY_RUNTIME_TIMED_OUT'
  | 'ANTIKY_RUNTIME_DISCONNECTED'
  | 'ANTIKY_ACTION_STARTED'
  | 'ANTIKY_ACTION_DELIVERED'
  | 'ANTIKY_ACTION_COMPLETED'
  | 'ANTIKY_ACTION_TIMED_OUT'
  | 'ANTIKY_ACTION_CANCELLED'
  | 'ANTIKY_CAPTURE_SAVE_FAILED'
  | 'ANTIKY_REQUEST_FAILED'
  | 'ANTIKY_CLI_FAILED';

export type CliDiagnosticComponent =
  | 'cli'
  | 'session'
  | 'action-broker'
  | 'evidence-store'
  | 'game-port-reservation'
  | 'inspection-port-reservation'
  | 'session-descriptor'
  | 'build-watcher'
  | 'game-host'
  | 'game-child'
  | 'shaders-child'
  | 'inspection-server'
  | 'runtime-connection'
  | 'capture-store'
  | 'capture-service'
  | 'capture-sequence-service';

export type CliDiagnosticEvent = Readonly<{
  schemaVersion: 1;
  level: CliDiagnosticLevel;
  code: CliDiagnosticCode;
  developmentSessionId?: string;
  runtimeInstanceId?: string;
  actionId?: string;
  requestId?: string;
  component?: CliDiagnosticComponent;
}>;

export type CliDiagnosticSink = (event: CliDiagnosticEvent) => void;

export const NOOP_CLI_DIAGNOSTIC_SINK: CliDiagnosticSink = () => {};

export function emitCliDiagnostic(
  sink: CliDiagnosticSink,
  event: Omit<CliDiagnosticEvent, 'schemaVersion'>,
): void {
  try {
    sink(Object.freeze({ schemaVersion: 1, ...event }));
  } catch {
    // Diagnostics must never change the lifecycle operation they describe.
  }
}
