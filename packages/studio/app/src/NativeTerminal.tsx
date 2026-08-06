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

type ViewportLike = Readonly<{
  width: number;
  height: number;
}>;

const MINIMUM_WIDTH = 80;
const MINIMUM_HEIGHT = 40;
const MAXIMUM_GEOMETRY = 16_384;

let nativeCommandQueue = Promise.resolve();

function enqueueNativeCommand(operation: () => Promise<void>) {
  nativeCommandQueue = nativeCommandQueue.then(operation, operation);
  return nativeCommandQueue;
}

export function closeNativeTerminal() {
  return enqueueNativeCommand(() => invoke('terminal_close'));
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

function sameBounds(left: TerminalBounds | null | undefined, right: TerminalBounds | null) {
  if (left === null || left === undefined || right === null) return left === right;
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

export function NativeTerminal() {
  const viewport = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;

    let active = true;
    let opened = false;
    let opening = false;
    let animationFrame: number | null = null;
    let lastSubmittedBounds: TerminalBounds | null | undefined;

    const readBounds = () => terminalBoundsForRect(
      element.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    );

    const reportFailure = (reason: unknown) => {
      if (active) {
        setReady(false);
        setFailure(displayError(reason));
      }
    };

    const submitLayout = (bounds: TerminalBounds | null) => {
      if (sameBounds(lastSubmittedBounds, bounds)) return;
      const submittedBounds = bounds;
      lastSubmittedBounds = submittedBounds;
      void enqueueNativeCommand(async () => {
        await invoke('terminal_layout', { bounds: submittedBounds });
        if (active) {
          setReady(true);
          setFailure(null);
        }
      }).catch((reason) => {
        lastSubmittedBounds = undefined;
        reportFailure(reason);
      });
    };

    const synchronize = () => {
      animationFrame = null;
      if (!active) return;
      const bounds = readBounds();
      if (opened) {
        submitLayout(bounds);
        return;
      }
      if (opening || !bounds) return;
      opening = true;
      void enqueueNativeCommand(async () => {
        await invoke('terminal_open', { bounds });
        opened = true;
        opening = false;
        if (!active) {
          await invoke('terminal_close');
          opened = false;
          return;
        }
        const currentBounds = readBounds();
        await invoke('terminal_layout', { bounds: currentBounds });
        lastSubmittedBounds = currentBounds;
        if (active) {
          setReady(true);
          setFailure(null);
        }
      }).catch((reason) => {
        opening = false;
        reportFailure(reason);
      });
    };

    const scheduleSynchronization = () => {
      if (!active || animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(synchronize);
    };

    const observer = new ResizeObserver(scheduleSynchronization);
    const visualViewport = window.visualViewport;
    observer.observe(element);
    window.addEventListener('resize', scheduleSynchronization);
    document.addEventListener('scroll', scheduleSynchronization, true);
    visualViewport?.addEventListener('resize', scheduleSynchronization);
    visualViewport?.addEventListener('scroll', scheduleSynchronization);
    scheduleSynchronization();

    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('resize', scheduleSynchronization);
      document.removeEventListener('scroll', scheduleSynchronization, true);
      visualViewport?.removeEventListener('resize', scheduleSynchronization);
      visualViewport?.removeEventListener('scroll', scheduleSynchronization);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      if (opened) {
        opened = false;
        void closeNativeTerminal();
      }
    };
  }, []);

  const focusTerminal = () => {
    void enqueueNativeCommand(() => invoke('terminal_focus')).catch((reason) => {
      setFailure(displayError(reason));
    });
  };

  return (
    <div
      aria-label="Embedded native terminal"
      className="native-terminal-mount"
      onFocus={focusTerminal}
      role="application"
      tabIndex={0}
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
