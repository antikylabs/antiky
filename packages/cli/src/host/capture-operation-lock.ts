import { AntikyCliError } from '../errors.ts';

export interface CaptureOperationLock {
  run<Value>(operation: () => Promise<Value>): Promise<Value>;
}

export function createCaptureOperationLock(): CaptureOperationLock {
  let active = false;
  return Object.freeze({
    async run<Value>(operation: () => Promise<Value>): Promise<Value> {
      if (active) {
        throw new AntikyCliError(
          'CAPTURE_RUNTIME_BUSY',
          'Another capture owns the development-session writer.',
        );
      }
      active = true;
      try {
        return await operation();
      } finally {
        active = false;
      }
    },
  });
}
