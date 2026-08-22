import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';

import {
  createNativeTerminalSession,
  type TerminalBounds,
} from './nativeTerminalSession.ts';

type RectLike = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

type ViewportLike = Readonly<{
  width: number;
  height: number;
}>;

const MINIMUM_WIDTH = 80;
const MINIMUM_HEIGHT = 40;
const MAXIMUM_GEOMETRY = 16_384;

const nativeTerminalSession = createNativeTerminalSession(
  <T,>(command: string, arguments_?: unknown) => invoke<T>(
    command,
    arguments_ as Record<string, unknown> | undefined,
  ),
);

export function closeNativeTerminal() {
  return nativeTerminalSession.close();
}

export function displayError(reason: unknown) {
  if (typeof reason === 'string' && reason.trim()) return reason;
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String(reason.message);
  }
  return 'The native terminal could not be opened.';
}

export function terminalBoundsForRect(
  rect: RectLike,
  viewport?: ViewportLike,
): TerminalBounds | null {
  const rectValues = [rect.left, rect.top, rect.width, rect.height];
  if (rectValues.some((value) => !Number.isFinite(value))
    || rect.width < 0
    || rect.height < 0
    || rect.width > MAXIMUM_GEOMETRY
    || rect.height > MAXIMUM_GEOMETRY) return null;

  if (!viewport) {
    if (rect.left < 0
      || rect.top < 0
      || rect.width < MINIMUM_WIDTH
      || rect.height < MINIMUM_HEIGHT
      || rect.left + rect.width > MAXIMUM_GEOMETRY
      || rect.top + rect.height > MAXIMUM_GEOMETRY) return null;
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  const viewportValues = [viewport.width, viewport.height];
  if (viewportValues.some((value) => (
    !Number.isFinite(value) || value <= 0 || value > MAXIMUM_GEOMETRY
  ))) return null;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewport.width, rect.left + rect.width);
  const bottom = Math.min(viewport.height, rect.top + rect.height);
  const width = right - left;
  const height = bottom - top;
  if (width < MINIMUM_WIDTH || height < MINIMUM_HEIGHT) return null;
  return {
    x: left,
    y: top,
    width,
    height,
  };
}

type NativeTerminalProps = Readonly<{
  visible?: boolean;
}>;

export function NativeTerminal({ visible = true }: NativeTerminalProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const visibilityRef = useRef(visible);
  const synchronizeRef = useRef<(() => void) | null>(null);
  const readBoundsRef = useRef<(() => TerminalBounds | null) | null>(null);
  const lastSubmittedBoundsRef = useRef<TerminalBounds | null | undefined>(undefined);
  const [failure, setFailure] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  visibilityRef.current = visible;

  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;

    let active = true;
    let animationFrame: number | null = null;

    const readBounds = () => visibilityRef.current
      ? terminalBoundsForRect(
        element.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      )
      : null;

    const reportFailure = (reason: unknown) => {
      if (active) {
        setReady(false);
        setFailure(displayError(reason));
      }
    };

    const synchronize = () => {
      animationFrame = null;
      if (!active) return;
      void nativeTerminalSession.synchronize(
        readBounds,
        lastSubmittedBoundsRef.current,
      ).then((result) => {
        lastSubmittedBoundsRef.current = result.bounds;
        if (active) {
          setReady(result.ready);
          setFailure(null);
        }
      }).catch((reason) => {
        lastSubmittedBoundsRef.current = undefined;
        reportFailure(reason);
      });
    };

    const scheduleSynchronization = () => {
      if (!active || animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(synchronize);
    };
    synchronizeRef.current = scheduleSynchronization;
    readBoundsRef.current = readBounds;

    const observer = new ResizeObserver(scheduleSynchronization);
    const visualViewport = window.visualViewport;
    observer.observe(element);
    window.addEventListener('resize', scheduleSynchronization);
    document.addEventListener('scroll', scheduleSynchronization, true);
    visualViewport?.addEventListener('resize', scheduleSynchronization);
    visualViewport?.addEventListener('scroll', scheduleSynchronization);
    const statusPoll = window.setInterval(scheduleSynchronization, 1_000);
    scheduleSynchronization();

    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', scheduleSynchronization);
      document.removeEventListener('scroll', scheduleSynchronization, true);
      visualViewport?.removeEventListener('resize', scheduleSynchronization);
      visualViewport?.removeEventListener('scroll', scheduleSynchronization);
      window.clearInterval(statusPoll);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      synchronizeRef.current = null;
      readBoundsRef.current = null;
      lastSubmittedBoundsRef.current = undefined;
      void closeNativeTerminal();
    };
  }, []);

  useEffect(() => {
    synchronizeRef.current?.();
  }, [visible]);

  const focusTerminal = () => {
    const readBounds = readBoundsRef.current;
    if (!readBounds) return;
    void nativeTerminalSession.focus(
      readBounds,
      lastSubmittedBoundsRef.current,
    ).then((result) => {
      lastSubmittedBoundsRef.current = result.bounds;
      setReady(result.ready);
      setFailure(null);
    }).catch((reason) => {
      lastSubmittedBoundsRef.current = undefined;
      setFailure(displayError(reason));
    });
  };

  return (
    <div
      aria-label="Embedded native terminal"
      className="native-terminal-mount"
      data-terminal-visible={visible}
      onFocus={focusTerminal}
      role="application"
      tabIndex={visible ? 0 : -1}
    >
      <div className="native-terminal-viewport" ref={viewport} />
      {!ready && !failure && (
        <p className="native-terminal-state native-terminal-loading" role="status">
          Opening terminal…
        </p>
      )}
      {failure && (
        <p className="native-terminal-state native-terminal-error" role="alert">
          {failure}
        </p>
      )}
    </div>
  );
}
