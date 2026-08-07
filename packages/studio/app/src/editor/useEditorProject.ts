import { useCallback, useEffect, useRef, useState } from 'react';

import { closeNativeTerminal } from '../NativeTerminal.tsx';
import type { StudioPlatform } from '../development/useStudioDevelopment.ts';
import {
  createEditorProjectInitialState,
  createProjectManager,
  type EditorProjectState,
  type ProjectManager,
} from './projectManager.ts';
import { createTauriEditorHost } from './tauriHost.ts';

export type EditorProjectView = Readonly<{
  state: EditorProjectState;
  createProject(name: string): Promise<void>;
  openProject(): Promise<void>;
  openRecentProject(manifestPath: string): Promise<void>;
}>;

export function useEditorProject(platform: StudioPlatform): EditorProjectView {
  const [state, setState] = useState(createEditorProjectInitialState);
  const manager = useRef<ProjectManager | null>(null);

  useEffect(() => {
    if (platform !== 'native') {
      setState(createEditorProjectInitialState());
      return undefined;
    }
    const nextManager = createProjectManager({
      host: createTauriEditorHost(),
      beforeProjectSwitch: closeNativeTerminal,
      onState: setState,
    });
    manager.current = nextManager;
    void nextManager.start();
    return () => {
      if (manager.current === nextManager) manager.current = null;
      nextManager.stop();
    };
  }, [platform]);

  const openProject = useCallback(async (): Promise<void> => {
    await manager.current?.openProject();
  }, []);

  const createProject = useCallback(async (name: string): Promise<void> => {
    await manager.current?.createProject(name);
  }, []);

  const openRecentProject = useCallback(async (manifestPath: string): Promise<void> => {
    await manager.current?.openRecentProject(manifestPath);
  }, []);

  return Object.freeze({ state, createProject, openProject, openRecentProject });
}
