import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createStudioCoordinator,
  createStudioInitialState,
  type StudioControl,
  type StudioCoordinator,
  type StudioDevelopmentState,
} from './coordinator.ts';
import {
  discoverNativeDevelopmentConnection,
  readNativeStudioContext,
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

export function useStudioDevelopment(platform: StudioPlatform): StudioDevelopmentView {
  const [context, setContext] = useState<StudioContext>(browserContext);
  const [development, setDevelopment] = useState(createStudioInitialState);
  const coordinator = useRef<StudioCoordinator | null>(null);

  useEffect(() => {
    if (platform !== 'native') {
      setContext(browserContext);
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
    void readNativeStudioContext().then((nextContext) => {
      if (active) setContext(nextContext);
    }).catch(() => undefined);
    void nextCoordinator.start();

    return () => {
      active = false;
      if (coordinator.current === nextCoordinator) coordinator.current = null;
      nextCoordinator.stop();
    };
  }, [platform]);

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
    development,
    actions: Object.freeze({
      pause: () => runControl('pause'),
      resume: () => runControl('resume'),
      step: () => runControl('step'),
      refresh,
    }),
  });
}
