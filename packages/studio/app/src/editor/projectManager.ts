import {
  AntikyCliError,
  describeAntikyProject,
  parseAntikyProjectManifest,
  type AntikyProject,
} from '@antiky/cli/project';

import type {
  EditorHost,
  NativeProjectError,
  NativeProjectEvent,
  NativeRecentProject,
  NativeProjectSource,
  ProjectActivationRequest,
} from './types.ts';

export type EditorProjectIssue = Readonly<{
  code: string;
  message: string;
}>;

export type EditorProjectState = Readonly<{
  status: 'empty' | 'ready';
  project: AntikyProject | null;
  issue: EditorProjectIssue | null;
  recentProjects: readonly NativeRecentProject[];
  loadingRecentProjects: boolean;
  creating: boolean;
  opening: boolean;
  updateSequence: number;
}>;

type ProjectManagerOptions = Readonly<{
  host: EditorHost;
  beforeProjectSwitch?: () => void | Promise<void>;
  onState?: (state: EditorProjectState) => void;
}>;

export interface ProjectManager {
  read(): EditorProjectState;
  start(): Promise<void>;
  stop(): void;
  createProject(name: string): Promise<void>;
  openProject(): Promise<void>;
  openRecentProject(manifestPath: string): Promise<void>;
  settled(): Promise<void>;
}

export const createEditorProjectInitialState = (): EditorProjectState => Object.freeze({
  status: 'empty',
  project: null,
  issue: null,
  recentProjects: Object.freeze([]),
  loadingRecentProjects: false,
  creating: false,
  opening: false,
  updateSequence: 0,
});

function normalizeIssue(cause: unknown): EditorProjectIssue {
  if (cause instanceof AntikyCliError) {
    return Object.freeze({ code: cause.code, message: cause.message });
  }
  const record = cause !== null && typeof cause === 'object' && !Array.isArray(cause)
    ? cause as Record<string, unknown>
    : {};
  return Object.freeze({
    code: typeof record.code === 'string' && /^[A-Z0-9_]{1,64}$/u.test(record.code)
      ? record.code
      : 'ANTIKY_PROJECT_INVALID',
    message: typeof record.message === 'string' && record.message.length > 0
      ? record.message.slice(0, 512)
      : 'The selected Antiky project is invalid.',
  });
}

function sameProject(left: AntikyProject | null, right: AntikyProject): boolean {
  return left?.manifestPath === right.manifestPath && left.revision === right.revision;
}

export function createProjectManager(options: ProjectManagerOptions): ProjectManager {
  let state = createEditorProjectInitialState();
  let active = false;
  let unlisten: (() => void) | null = null;
  let queue = Promise.resolve();
  let latestSelectionId = 0;

  const publish = (patch: Partial<EditorProjectState>): void => {
    state = Object.freeze({
      ...state,
      ...patch,
      updateSequence: state.updateSequence + 1,
    });
    options.onState?.(state);
  };

  const acceptError = (error: NativeProjectError | unknown): void => {
    publish({ issue: normalizeIssue(error), creating: false, opening: false });
  };

  const refreshRecentProjects = async (): Promise<void> => {
    publish({ loadingRecentProjects: true });
    try {
      const recentProjects = await options.host.listRecentProjects();
      publish({ recentProjects: Object.freeze([...recentProjects]), loadingRecentProjects: false });
    } catch {
      publish({ loadingRecentProjects: false });
    }
  };

  const acceptProject = async (source: NativeProjectSource): Promise<void> => {
    if (source.selectionId <= latestSelectionId) return;
    latestSelectionId = source.selectionId;
    publish({ opening: true });
    try {
      const manifest = parseAntikyProjectManifest(source.source);
      const boundary = await options.host.validateProject({
        selectionId: source.selectionId,
        manifestPath: source.manifestPath,
        projectRoot: source.projectRoot,
        revision: source.revision,
        developmentWorkingDirectory: manifest.development.workingDirectory,
        buildWorkingDirectory: manifest.build.workingDirectory,
      });
      const project = describeAntikyProject(manifest, boundary);
      if (state.project && !sameProject(state.project, project)) {
        await options.beforeProjectSwitch?.();
      }
      const activation: ProjectActivationRequest = {
        selectionId: boundary.selectionId,
        manifestPath: boundary.manifestPath,
        revision: boundary.revision,
      };
      await options.host.activateProject(activation);
      publish({ status: 'ready', project, issue: null, creating: false, opening: false });
      await refreshRecentProjects();
    } catch (cause: unknown) {
      acceptError(cause);
    }
  };

  const acceptEvent = async (event: NativeProjectEvent): Promise<void> => {
    if (event.kind === 'error') acceptError(event.error);
    else await acceptProject(event.project);
  };

  const enqueue = (operation: () => void | Promise<void>): Promise<void> => {
    queue = queue.then(operation, operation);
    return queue;
  };

  return Object.freeze({
    read: () => state,
    async start(): Promise<void> {
      if (active) return queue;
      active = true;
      try {
        const nextUnlisten = await options.host.listenProjectEvents((event) => {
          if (active) void enqueue(() => acceptEvent(event));
        });
        if (!active) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        await refreshRecentProjects();
        const initial = await options.host.readInitialProjectEvent();
        if (active && initial) await enqueue(() => acceptEvent(initial));
      } catch (cause: unknown) {
        if (active) acceptError(cause);
      }
    },
    stop(): void {
      active = false;
      unlisten?.();
      unlisten = null;
    },
    async createProject(name: string): Promise<void> {
      if (!active) return;
      publish({ creating: true, issue: null });
      try {
        const created = await options.host.createProject(name);
        if (!created) publish({ creating: false });
        else await enqueue(() => acceptProject(created));
      } catch (cause: unknown) {
        acceptError(cause);
      }
    },
    async openProject(): Promise<void> {
      if (!active) return;
      publish({ opening: true, issue: null });
      try {
        const selected = await options.host.selectProject();
        if (!selected) publish({ opening: false });
        else await enqueue(() => acceptProject(selected));
      } catch (cause: unknown) {
        acceptError(cause);
      }
    },
    async openRecentProject(manifestPath: string): Promise<void> {
      if (!active) return;
      publish({ opening: true, issue: null });
      try {
        const selected = await options.host.openRecentProject(manifestPath);
        if (!selected) publish({ opening: false });
        else await enqueue(() => acceptProject(selected));
      } catch (cause: unknown) {
        acceptError(cause);
      }
    },
    settled: () => queue,
  });
}
