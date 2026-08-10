export type CombatActionBuffer = Readonly<{
  capture(clicked: boolean): void;
  read(): boolean;
  consume(completedSteps: number): void;
}>;

export function createCombatActionBuffer(): CombatActionBuffer {
  let pending = false;
  let armed = true;
  return Object.freeze({
    capture(clicked: boolean): void {
      if (!clicked) {
        armed = true;
      } else if (armed) {
        pending = true;
        armed = false;
      }
    },
    read(): boolean {
      return pending;
    },
    consume(completedSteps: number): void {
      if (completedSteps > 0) pending = false;
    },
  });
}
