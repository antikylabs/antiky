export type RelayInteractionBuffer = Readonly<{
  capture(clicked: boolean): void;
  read(): boolean;
  consume(completedSteps: number): void;
}>;

export function createRelayInteractionBuffer(): RelayInteractionBuffer {
  let pending = false;
  return Object.freeze({
    capture(clicked: boolean): void {
      pending ||= clicked;
    },
    read(): boolean {
      return pending;
    },
    consume(completedSteps: number): void {
      if (completedSteps > 0) pending = false;
    },
  });
}
