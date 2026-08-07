import { useCallback, useEffect, useRef, useState } from 'react';

import type { AntikyProject } from '@antiky/cli/project';

import {
  createStudioCoordinator,
  createStudioInitialState,
  type StudioControl,
  type StudioCoordinator,
  type StudioDevelopmentState,
} from './coordinator.ts';
import {
  discoverNativeDevelopmentConnection,
  type StudioContext,
} from './native.ts';

export type StudioPlatform = 'browser' | 'native';

export type StudioDevelopmentActions = Readonly<{
  pause(): Promise<void>;
  resume(): Promise<void>;
  step(): Promise<void>;
  refresh(): Promise<void>;
}>;

export type StudioDevelopmentView = Readonly<{
  context: StudioContext;
  development: StudioDevelopmentState;
  actions: StudioDevelopmentActions;
}>;

const browserContext: StudioContext = Object.freeze({
  projectDirectory: '',
  projectName: 'Browser workspace',
});

const emptyNativeContext: StudioContext = Object.freeze({
  projectDirectory: '',
  projectName: 'No project selected',
});

export function useStudioDevelopment(
  platform: StudioPlatform,
  project: AntikyProject | null = null,
): StudioDevelopmentView {
  const [development, setDevelopment] = useState(createStudioInitialState);
  const [developmentKey, setDevelopmentKey] = useState<string | null>(null);
  const coordinator = useRef<StudioCoordinator | null>(null);
  const projectKey = platform === 'native' && project
    ? `${project.manifestPath}:${project.revision}`
    : null;
  const context: StudioContext = platform === 'browser'
    ? browserContext
    : project
      ? Object.freeze({ projectDirectory: project.projectRoot, projectName: project.name })
      : emptyNativeContext;

  useEffect(() => {
    setDevelopmentKey(projectKey);
    if (platform !== 'native' || projectKey === null) {
      setDevelopment(createStudioInitialState());
      return undefined;
    }

    let active = true;
    const nextCoordinator = createStudioCoordinator({
      discoverConnection: discoverNativeDevelopmentConnection,
      onState: (state) => {
        if (active) setDevelopment(state);
      },
    });
    coordinator.current = nextCoordinator;
    void nextCoordinator.start();

    return () => {
      active = false;
      if (coordinator.current === nextCoordinator) coordinator.current = null;
      nextCoordinator.stop();
    };
  }, [platform, projectKey]);

  const runControl = useCallback(async (control: StudioControl): Promise<void> => {
    const current = coordinator.current;
    if (!current) return;
    try {
      await current[control]();
    } catch {
      // The coordinator publishes a bounded issue for the UI.
    }
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    await coordinator.current?.refresh();
  }, []);

  return Object.freeze({
    context,
    development: developmentKey === projectKey ? development : createStudioInitialState(),
    actions: Object.freeze({
      pause: () => runControl('pause'),
      resume: () => runControl('resume'),
      step: () => runControl('step'),
      refresh,
    }),
  });
}
