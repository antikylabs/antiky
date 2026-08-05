export type PausableRenderLoop = Readonly<{
  readonly running: boolean;
  start(): void;
  pause(): void;
  dispose(): void;
}>;

type StartRenderLoop = (callback: (elapsedSeconds: number) => void) => () => void;

export function createPausableRenderLoop(
  startRenderLoop: StartRenderLoop,
  frame: (elapsedSeconds: number) => void,
): PausableRenderLoop {
  let disposed = false;
  let stopRenderLoop: (() => void) | null = null;

  const loop: PausableRenderLoop = Object.freeze({
    get running(): boolean {
      return stopRenderLoop !== null;
    },
    start(): void {
      if (disposed || stopRenderLoop !== null) return;
      stopRenderLoop = startRenderLoop(frame);
    },
    pause(): void {
      const stop = stopRenderLoop;
      stopRenderLoop = null;
      stop?.();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      loop.pause();
    },
  });

  return loop;
}
