export type PausableRenderLoop = Readonly<{
  readonly running: boolean;
  start(): void;
  pause(): void;
  renderOnce(render: () => void): Promise<void>;
  dispose(): void;
}>;

type StartRenderLoop = (callback: (elapsedSeconds: number) => void) => () => void;

export function createPausableRenderLoop(
  startRenderLoop: StartRenderLoop,
  frame: (elapsedSeconds: number) => void,
): PausableRenderLoop {
  let disposed = false;
  let stopRenderLoop: (() => void) | null = null;
  let cancelOneShot: (() => void) | null = null;

  const loop: PausableRenderLoop = Object.freeze({
    get running(): boolean {
      return stopRenderLoop !== null;
    },
    start(): void {
      if (disposed || stopRenderLoop !== null || cancelOneShot !== null) return;
      stopRenderLoop = startRenderLoop(frame);
    },
    pause(): void {
      cancelOneShot?.();
      const stop = stopRenderLoop;
      stopRenderLoop = null;
      stop?.();
    },
    renderOnce(render: () => void): Promise<void> {
      if (disposed) return Promise.reject(new Error('The render loop is disposed.'));
      if (stopRenderLoop !== null) {
        return Promise.reject(new Error('Pause the render loop before requesting one frame.'));
      }
      if (cancelOneShot !== null) {
        return Promise.reject(new Error('A one-shot render is already pending.'));
      }

      return new Promise((resolve, reject) => {
        let finished = false;
        let stopOneShot: (() => void) | null = null;
        let stopAfterStart = false;
        const finish = (cause?: unknown) => {
          if (finished) return;
          finished = true;
          cancelOneShot = null;
          if (stopOneShot === null) {
            stopAfterStart = true;
          } else {
            const stop = stopOneShot;
            stopOneShot = null;
            stop();
          }
          if (cause === undefined) resolve();
          else reject(cause);
        };
        cancelOneShot = () => finish(new Error('The one-shot render was cancelled.'));

        try {
          stopOneShot = startRenderLoop(() => {
            try {
              render();
              finish();
            } catch (cause: unknown) {
              finish(cause);
            }
          });
          if (stopAfterStart) {
            const stop = stopOneShot;
            stopOneShot = null;
            stop();
          }
        } catch (cause: unknown) {
          finish(cause);
        }
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      loop.pause();
    },
  });

  return loop;
}
