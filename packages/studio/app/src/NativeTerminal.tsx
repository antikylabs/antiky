import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

type RectLike = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type TerminalBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

let nativeCommandQueue = Promise.resolve();

function enqueueNativeCommand(operation: () => Promise<void>) {
  nativeCommandQueue = nativeCommandQueue.then(operation, operation);
  return nativeCommandQueue;
}

function displayError(reason: unknown) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return 'The native terminal could not be opened.';
}

export function terminalBoundsForRect(rect: RectLike): TerminalBounds | null {
  const values = [rect.left, rect.top, rect.width, rect.height];
  if (values.some((value) => !Number.isFinite(value) || value < 0)
    || rect.width < 80
    || rect.height < 40) return null;
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function NativeTerminal() {
  const mount = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const element = mount.current;
    if (!element) return undefined;

    let active = true;
    let opened = false;
    let latestBounds = terminalBoundsForRect(element.getBoundingClientRect());

    const reportFailure = (reason: unknown) => {
      if (active) setFailure(displayError(reason));
    };
    const observer = new ResizeObserver(() => {
      latestBounds = terminalBoundsForRect(element.getBoundingClientRect());
      if (!opened || !latestBounds) return;
      const bounds = latestBounds;
      void enqueueNativeCommand(() => invoke('terminal_layout', { bounds })).catch(reportFailure);
    });
    observer.observe(element);

    if (latestBounds) {
      const bounds = latestBounds;
      void enqueueNativeCommand(async () => {
        await invoke('terminal_open', { bounds });
        opened = true;
        if (active && latestBounds) {
          await invoke('terminal_layout', { bounds: latestBounds });
        }
      }).catch(reportFailure);
    } else {
      setFailure('The terminal panel is too small to open.');
    }

    return () => {
      active = false;
      observer.disconnect();
      void enqueueNativeCommand(async () => {
        if (opened) await invoke('terminal_close');
        opened = false;
      });
    };
  }, []);

  return (
    <div
      aria-label="Embedded native terminal"
      className="native-terminal-mount"
      ref={mount}
      role="application"
    >
      {failure && <p className="native-terminal-error">{failure}</p>}
    </div>
  );
}

