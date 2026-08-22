export type TerminalBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type NativeTerminalStatus = Readonly<{
  isOpen: boolean;
  processExited: boolean;
  rendererHealthy: boolean;
  columns: number;
  rows: number;
  widthPx: number;
  heightPx: number;
}>;

type NativeInvoke = <T>(command: string, arguments_?: unknown) => Promise<T>;
type ReadTerminalBounds = () => TerminalBounds | null;

type NativeTerminalSynchronization = Readonly<{
  bounds: TerminalBounds | null;
  ready: boolean;
}>;

export type NativeTerminalSession = Readonly<{
  close(): Promise<void>;
  focus(
    readBounds: ReadTerminalBounds,
    previousBounds: TerminalBounds | null | undefined,
  ): Promise<NativeTerminalSynchronization>;
  synchronize(
    readBounds: ReadTerminalBounds,
    previousBounds: TerminalBounds | null | undefined,
  ): Promise<NativeTerminalSynchronization>;
}>;

export function sameTerminalBounds(
  left: TerminalBounds | null | undefined,
  right: TerminalBounds | null,
) {
  if (left === null || left === undefined || right === null) return left === right;
  return left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

export function createNativeTerminalSession(invoke: NativeInvoke): NativeTerminalSession {
  let commandQueue = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = commandQueue.then(operation, operation);
    commandQueue = result.then(() => undefined, () => undefined);
    return result;
  };

  const synchronize = async (
    readBounds: ReadTerminalBounds,
    previousBounds: TerminalBounds | null | undefined,
  ): Promise<NativeTerminalSynchronization> => {
    const requestedBounds = readBounds();
    const status = await invoke<NativeTerminalStatus>('terminal_status');

    if (requestedBounds === null) {
      if (status.isOpen && previousBounds !== null) {
        await invoke<void>('terminal_layout', { bounds: null });
      }
      return Object.freeze({
        bounds: null,
        ready: status.isOpen && !status.processExited,
      });
    }

    let recovered = false;
    if (!status.isOpen || status.processExited || !status.rendererHealthy) {
      if (status.isOpen) await invoke<void>('terminal_close');
      await invoke<void>('terminal_open', { bounds: requestedBounds });
      recovered = true;
    }

    const currentBounds = readBounds();
    if (currentBounds === null) {
      await invoke<void>('terminal_layout', { bounds: null });
      return Object.freeze({ bounds: null, ready: true });
    }
    if (recovered || !sameTerminalBounds(previousBounds, currentBounds)) {
      await invoke<void>('terminal_layout', { bounds: currentBounds });
    }
    return Object.freeze({ bounds: currentBounds, ready: true });
  };

  return Object.freeze({
    close: () => enqueue(() => invoke<void>('terminal_close')),
    focus: (readBounds, previousBounds) => enqueue(async () => {
      const result = await synchronize(readBounds, previousBounds);
      if (result.bounds !== null) await invoke<void>('terminal_focus');
      return result;
    }),
    synchronize: (readBounds, previousBounds) => enqueue(
      () => synchronize(readBounds, previousBounds),
    ),
  });
}
