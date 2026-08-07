import type { AntikyProjectBoundary } from '@antiky/cli/project';

export type NativeProjectError = Readonly<{
  code: string;
  message: string;
}>;

export type NativeProjectSource = Readonly<{
  schemaVersion: 1;
  selectionId: number;
  manifestPath: string;
  projectRoot: string;
  revision: string;
  source: string;
}>;

export type NativeProjectEvent =
  | Readonly<{ kind: 'opened'; project: NativeProjectSource }>
  | Readonly<{ kind: 'error'; error: NativeProjectError }>;

export type NativeRecentProject = Readonly<{
  available: boolean;
  lastOpenedAt: number;
  manifestPath: string;
  projectRoot: string;
}>;

export type ProjectValidationRequest = Readonly<{
  selectionId: number;
  manifestPath: string;
  projectRoot: string;
  revision: string;
  developmentWorkingDirectory: string;
  buildWorkingDirectory: string;
}>;

export type ValidatedProjectBoundary = AntikyProjectBoundary & Readonly<{
  selectionId: number;
}>;

export type ProjectActivationRequest = Readonly<{
  selectionId: number;
  manifestPath: string;
  revision: string;
}>;

export interface EditorHost {
  readInitialProjectEvent(): Promise<NativeProjectEvent | null>;
  selectProject(): Promise<NativeProjectSource | null>;
  createProject(name: string): Promise<NativeProjectSource | null>;
  listRecentProjects(): Promise<readonly NativeRecentProject[]>;
  openRecentProject(manifestPath: string): Promise<NativeProjectSource | null>;
  listenProjectEvents(listener: (event: NativeProjectEvent) => void): Promise<() => void>;
  validateProject(request: ProjectValidationRequest): Promise<ValidatedProjectBoundary>;
  activateProject(request: ProjectActivationRequest): Promise<void>;
}
