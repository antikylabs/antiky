import {
  createDevelopmentClient,
  type DevelopmentClient,
  type DevelopmentConnection,
  type DevelopmentMcpCallLog,
  type DevelopmentSessionControlResult,
  type DevelopmentSnapshot,
} from '@antiky/cli/development';

export type StudioConnectionStatus = 'connecting' | 'connected' | 'stale' | 'disconnected';
export type StudioControl = 'pause' | 'resume' | 'step';

export type StudioIssue = Readonly<{
  code: string;
  message: string;
}>;

export type StudioDevelopmentState = Readonly<{
  status: StudioConnectionStatus;
  developmentSessionId: string | null;
  snapshot: DevelopmentSnapshot | null;
  mcpCallLog: DevelopmentMcpCallLog | null;
  pendingControl: StudioControl | null;
  lastControlResult: DevelopmentSessionControlResult | null;
  issue: StudioIssue | null;
  updateSequence: number;
}>;

export type StudioDevelopmentClient = Pick<DevelopmentClient,
  | 'readDevelopmentSnapshot'
  | 'getMcpCallLog'
  | 'pauseSimulation'
  | 'resumeSimulation'
  | 'stepSimulation'
>;

type Scheduler = (callback: () => void, delayMilliseconds: number) => () => void;

type CoordinatorOptions = Readonly<{
  discoverConnection(): Promise<DevelopmentConnection>;
  createClient?: (connection: DevelopmentConnection) => StudioDevelopmentClient;
  onState?: (state: StudioDevelopmentState) => void;
  schedule?: Scheduler;
  pollIntervalMilliseconds?: number;
}>;

export interface StudioCoordinator {
  read(): StudioDevelopmentState;
  start(): Promise<void>;
  stop(): void;
  refresh(): Promise<void>;
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
  lastControlResult: null,
  issue: null,
  updateSequence: 0,
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
      let pollClient = client;
      if (!sameConnection(connection, discovered) || !pollClient) {
        publish({
          status: 'connecting',
          developmentSessionId: discovered.developmentSessionId,
          snapshot: null,
          mcpCallLog: null,
          lastControlResult: null,
          issue: null,
        });
        pollClient = makeClient(discovered);
      }
      const [snapshot, mcpCallLog] = await Promise.all([
        pollClient.readDevelopmentSnapshot(),
        pollClient.getMcpCallLog(),
      ]);
      if (!isCurrent(pollGeneration)) return;
      if (
        snapshot.developmentSessionId !== discovered.developmentSessionId
        || mcpCallLog.developmentSessionId !== discovered.developmentSessionId
      ) throw new Error('Development responses belong to different sessions.');
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
      client = null;
      connection = null;
      publish({
        status: state.snapshot ? 'stale' : 'disconnected',
        issue: normalizeIssue(cause),
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
    if (state.pendingControl) {
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
    },
    refresh,
    pause: () => control('pause'),
    resume: () => control('resume'),
    step: () => control('step'),
  });
}
