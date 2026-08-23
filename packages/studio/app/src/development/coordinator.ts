import {
  createDevelopmentClient,
  type DevelopmentClient,
  type DevelopmentConnection,
  type DevelopmentMcpCallLog,
  type DevelopmentSessionControlResult,
  type DevelopmentSnapshotV2,
} from '@antiky/cli/development';

export type StudioConnectionStatus = 'connecting' | 'connected' | 'stale' | 'disconnected' | 'stopped';
export type StudioControl = 'pause' | 'resume' | 'step';
export type StudioGameLifecycle = 'restart' | 'stop';

export type StudioIssue = Readonly<{
  code: string;
  message: string;
}>;

export type StudioDevelopmentState = Readonly<{
  status: StudioConnectionStatus;
  developmentSessionId: string | null;
  snapshot: DevelopmentSnapshotV2 | null;
  mcpCallLog: DevelopmentMcpCallLog | null;
  pendingControl: StudioControl | null;
  pendingLifecycle: StudioGameLifecycle | null;
  lastControlResult: DevelopmentSessionControlResult | null;
  issue: StudioIssue | null;
  updateSequence: number;
}>;

export type StudioDevelopmentClient = Pick<DevelopmentClient,
  | 'readDevelopmentSnapshotV2'
  | 'getMcpCallLog'
  | 'requestReload'
  | 'pauseSimulation'
  | 'resumeSimulation'
  | 'stepSimulation'
>;

/** Browser-safe evidence operations Studio may adopt without gaining Playwright authority. */
export type StudioCaptureClient = Pick<DevelopmentClient,
  | 'getCaptureCapabilities'
  | 'captureFrameV3'
  | 'captureGameplaySequence'
  | 'getRenderEvidence'
>;

type Scheduler = (callback: () => void, delayMilliseconds: number) => () => void;

type CoordinatorOptions = Readonly<{
  discoverConnection(): Promise<DevelopmentConnection>;
  createClient?: (connection: DevelopmentConnection) => StudioDevelopmentClient;
  restartConnection?: () => Promise<void>;
  stopConnection?: () => Promise<void>;
  onState?: (state: StudioDevelopmentState) => void;
  schedule?: Scheduler;
  pollIntervalMilliseconds?: number;
}>;

const CONNECTION_FAILURE_THRESHOLD = 3;

export interface StudioCoordinator {
  read(): StudioDevelopmentState;
  start(): Promise<void>;
  stop(): void;
  refresh(): Promise<void>;
  restartGame(): Promise<void>;
  stopGame(): Promise<void>;
  pause(): Promise<DevelopmentSessionControlResult>;
  resume(): Promise<DevelopmentSessionControlResult>;
  step(): Promise<DevelopmentSessionControlResult>;
}

export class StudioControlError extends Error {
  constructor(readonly code: 'CONTROL_BUSY' | 'SESSION_UNAVAILABLE', message: string) {
    super(message);
    this.name = 'StudioControlError';
  }
}

export const createStudioInitialState = (): StudioDevelopmentState => Object.freeze({
  status: 'disconnected',
  developmentSessionId: null,
  snapshot: null,
  mcpCallLog: null,
  pendingControl: null,
  pendingLifecycle: null,
  lastControlResult: null,
  issue: null,
  updateSequence: 0,
});

export const createStudioConnectingState = (): StudioDevelopmentState => Object.freeze({
  ...createStudioInitialState(),
  status: 'connecting',
});

const defaultSchedule: Scheduler = (callback, delayMilliseconds) => {
  const timeout = globalThis.setTimeout(callback, delayMilliseconds);
  return () => globalThis.clearTimeout(timeout);
};

function readPollInterval(value: number | undefined): number {
  if (value === undefined) return 1_000;
  if (!Number.isSafeInteger(value) || value < 250 || value > 60_000) {
    throw new RangeError('Studio poll interval must be from 250 through 60000 milliseconds.');
  }
  return value;
}

function normalizeIssue(cause: unknown): StudioIssue {
  const source = cause !== null && typeof cause === 'object'
    ? cause as Record<string, unknown>
    : {};
  const code = typeof source.code === 'string' && /^[A-Z0-9_]{1,64}$/.test(source.code)
    ? source.code
    : 'ANTIKY_SESSION_UNAVAILABLE';
  const message = typeof source.message === 'string' && source.message.length > 0
    ? source.message.slice(0, 256)
    : 'No compatible local Antiky development session is available.';
  return Object.freeze({ code, message });
}

function sameConnection(
  left: DevelopmentConnection | null,
  right: DevelopmentConnection,
): boolean {
  return left?.inspectionUrl === right.inspectionUrl
    && left.developmentSessionId === right.developmentSessionId
    && left.credential === right.credential;
}

function sameIssue(left: StudioIssue | null, right: StudioIssue): boolean {
  return left?.code === right.code && left.message === right.message;
}

export function createStudioCoordinator(options: CoordinatorOptions): StudioCoordinator {
  const makeClient = options.createClient ?? createDevelopmentClient;
  const schedule = options.schedule ?? defaultSchedule;
  const pollInterval = readPollInterval(options.pollIntervalMilliseconds);
  let state = createStudioInitialState();
  let active = false;
  let generation = 0;
  let client: StudioDevelopmentClient | null = null;
  let connection: DevelopmentConnection | null = null;
  let inFlight: Promise<void> | null = null;
  let cancelScheduled: (() => void) | null = null;
  let consecutiveFailures = 0;

  const publish = (patch: Partial<StudioDevelopmentState>): void => {
    state = Object.freeze({
      ...state,
      ...patch,
      updateSequence: state.updateSequence + 1,
    });
    options.onState?.(state);
  };

  const isCurrent = (pollGeneration: number): boolean => (
    active && generation === pollGeneration
  );

  const scheduleNext = (): void => {
    cancelScheduled?.();
    cancelScheduled = active
      ? schedule(() => { void refresh(); }, pollInterval)
      : null;
  };

  const poll = async (pollGeneration: number): Promise<void> => {
    try {
      const discovered = await options.discoverConnection();
      if (!isCurrent(pollGeneration)) return;
      const pollClient = sameConnection(connection, discovered) && client
        ? client
        : makeClient(discovered);
      const [snapshot, mcpCallLog] = await Promise.all([
        pollClient.readDevelopmentSnapshotV2(),
        pollClient.getMcpCallLog(),
      ]);
      if (!isCurrent(pollGeneration)) return;
      if (
        snapshot.developmentSessionId !== discovered.developmentSessionId
        || mcpCallLog.developmentSessionId !== discovered.developmentSessionId
      ) throw new Error('Development responses belong to different sessions.');
      consecutiveFailures = 0;
      connection = discovered;
      client = pollClient;
      publish({
        status: 'connected',
        developmentSessionId: discovered.developmentSessionId,
        snapshot,
        mcpCallLog,
        issue: null,
      });
    } catch (cause: unknown) {
      if (!isCurrent(pollGeneration)) return;
      consecutiveFailures += 1;
      if (consecutiveFailures < CONNECTION_FAILURE_THRESHOLD) return;
      const issue = normalizeIssue(cause);
      const status = state.snapshot ? 'stale' : 'disconnected';
      if (state.status === status && sameIssue(state.issue, issue)) return;
      publish({
        status,
        issue,
      });
    }
  };

  const refresh = (): Promise<void> => {
    if (!active) return Promise.resolve();
    cancelScheduled?.();
    cancelScheduled = null;
    if (inFlight) return inFlight;
    const pollGeneration = generation;
    const operation = poll(pollGeneration).finally(() => {
      if (inFlight === operation) inFlight = null;
      if (isCurrent(pollGeneration)) scheduleNext();
    });
    inFlight = operation;
    return operation;
  };

  const control = async (kind: StudioControl): Promise<DevelopmentSessionControlResult> => {
    if (state.pendingControl || state.pendingLifecycle) {
      throw new StudioControlError('CONTROL_BUSY', 'Another simulation control is pending.');
    }
    if (inFlight) await inFlight;
    if (!active || state.status !== 'connected' || !client) {
      throw new StudioControlError('SESSION_UNAVAILABLE', 'No current development session is connected.');
    }
    const controlClient = client;
    const completedStepCount = state.snapshot?.inspection?.session?.clock.completedStepCount;
    if (kind === 'step' && completedStepCount === undefined) {
      throw new StudioControlError('SESSION_UNAVAILABLE', 'The runtime does not publish session status.');
    }

    cancelScheduled?.();
    cancelScheduled = null;
    publish({ pendingControl: kind, issue: null });
    try {
      const result = kind === 'pause'
        ? await controlClient.pauseSimulation()
        : kind === 'resume'
          ? await controlClient.resumeSimulation()
          : await controlClient.stepSimulation(completedStepCount!);
      publish({ lastControlResult: result });
      await refresh();
      return result;
    } catch (cause: unknown) {
      const issue = normalizeIssue(cause);
      publish({
        status: issue.code === 'ANTIKY_SESSION_UNAVAILABLE' ? 'stale' : state.status,
        issue,
      });
      scheduleNext();
      throw cause;
    } finally {
      publish({ pendingControl: null });
    }
  };

  const restartGame = async (): Promise<void> => {
    if (state.pendingControl || state.pendingLifecycle) {
      throw new StudioControlError('CONTROL_BUSY', 'Another Studio control is pending.');
    }
    cancelScheduled?.();
    cancelScheduled = null;
    publish({ pendingLifecycle: 'restart', issue: null });
    try {
      if (inFlight) await inFlight;
      if (active && state.status === 'connected' && client) {
        await client.requestReload();
        await refresh();
        return;
      }
      if (!options.restartConnection) {
        throw new StudioControlError(
          'SESSION_UNAVAILABLE',
          'The managed game service cannot be restarted from this Studio.',
        );
      }

      active = false;
      generation += 1;
      client = null;
      connection = null;
      consecutiveFailures = 0;
      publish({
        status: 'connecting',
        developmentSessionId: null,
        snapshot: null,
        mcpCallLog: null,
        lastControlResult: null,
      });
      await options.restartConnection();
      active = true;
      generation += 1;
      await refresh();
    } catch (cause: unknown) {
      if (!active) {
        active = true;
        generation += 1;
      }
      publish({
        status: state.snapshot ? 'stale' : 'disconnected',
        issue: normalizeIssue(cause),
      });
      scheduleNext();
      throw cause;
    } finally {
      publish({ pendingLifecycle: null });
    }
  };

  const stopGame = async (): Promise<void> => {
    if (state.status === 'stopped') return;
    if (state.pendingControl || state.pendingLifecycle) {
      throw new StudioControlError('CONTROL_BUSY', 'Another Studio control is pending.');
    }
    if (!options.stopConnection) {
      throw new StudioControlError(
        'SESSION_UNAVAILABLE',
        'The managed game service cannot be stopped from this Studio.',
      );
    }
    cancelScheduled?.();
    cancelScheduled = null;
    publish({ pendingLifecycle: 'stop', issue: null });
    try {
      if (inFlight) await inFlight;
      active = false;
      generation += 1;
      await options.stopConnection();
      client = null;
      connection = null;
      consecutiveFailures = 0;
      publish({
        status: 'stopped',
        developmentSessionId: null,
        snapshot: null,
        mcpCallLog: null,
        lastControlResult: null,
        issue: null,
      });
    } catch (cause: unknown) {
      active = true;
      generation += 1;
      publish({
        status: state.snapshot ? 'stale' : 'disconnected',
        issue: normalizeIssue(cause),
      });
      scheduleNext();
      throw cause;
    } finally {
      publish({ pendingLifecycle: null });
    }
  };

  return Object.freeze({
    read: () => state,
    start(): Promise<void> {
      if (active) return inFlight ?? Promise.resolve();
      active = true;
      generation += 1;
      publish({ status: 'connecting', issue: null });
      return refresh();
    },
    stop(): void {
      active = false;
      generation += 1;
      cancelScheduled?.();
      cancelScheduled = null;
      client = null;
      connection = null;
      consecutiveFailures = 0;
    },
    refresh,
    restartGame,
    stopGame,
    pause: () => control('pause'),
    resume: () => control('resume'),
    step: () => control('step'),
  });
}
